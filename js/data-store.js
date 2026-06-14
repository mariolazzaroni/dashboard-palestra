import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const EXERCISES_KEY = "gymboard-exercises-v1";
const PLANS_KEY = "gymboard-plans-v1";
const WORKOUTS_KEY = "gymboard-workouts-v2";
const BODY_WEIGHTS_KEY = "gymboard-body-weights-v1";

export const EXERCISE_CATEGORIES = ["Petto", "Schiena", "Spalle", "Gambe", "Bicipiti", "Tricipiti", "Core", "Altro"];

function exerciseCategory(value) {
  return EXERCISE_CATEGORIES.includes(value) ? value : "Altro";
}

export function normalizeExerciseName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left, right) {
  const rows = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = rows[0];
    rows[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = rows[j];
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return rows[right.length];
}

function matchScore(query, candidate) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) return 0.94;
  const longest = Math.max(query.length, candidate.length);
  return longest ? 1 - editDistance(query, candidate) / longest : 0;
}

export function findExerciseMatches(exercises, value, limit = 5) {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return [];
  return exercises
    .map((exercise) => ({ exercise, score: matchScore(normalized, exercise.normalizedName) }))
    .filter((result) => result.score >= 0.58)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, limit)
    .map((result) => result.exercise);
}

function findEquivalent(exercises, name) {
  const normalized = normalizeExerciseName(name);
  const exact = exercises.find((exercise) => exercise.normalizedName === normalized);
  if (exact) return exact;
  const best = findExerciseMatches(exercises, name, 1)[0];
  if (!best) return null;
  const distance = editDistance(normalized, best.normalizedName);
  const longest = Math.max(normalized.length, best.normalizedName.length);
  const allowedDistance = longest >= 16 ? 2 : 1;
  return distance <= allowedDistance && 1 - distance / longest >= 0.88 ? best : null;
}

class LocalStore {
  constructor(key) {
    this.key = key;
  }

  async getRaw() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  }

  async save(items) {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  async remove(id) {
    await this.save((await this.getRaw()).filter((item) => item.id !== id));
  }
}

class LocalExerciseStore extends LocalStore {
  async getAll() {
    const exercises = await this.getRaw();
    const normalized = exercises.map((exercise) => ({ ...exercise, category: exerciseCategory(exercise.category) }));
    if (normalized.some((exercise, index) => exercise.category !== exercises[index].category)) await this.save(normalized);
    return normalized;
  }

  async resolveNames(entries) {
    const exercises = await this.getAll();
    const resolved = [];
    for (const entry of entries) {
      const name = String(typeof entry === "string" ? entry : entry.name).trim();
      const hasCategory = typeof entry !== "string" && Boolean(entry.category);
      const category = exerciseCategory(hasCategory ? entry.category : "Altro");
      let exercise = findEquivalent(exercises, name);
      if (!exercise) {
        exercise = {
          id: crypto.randomUUID?.() ?? `exercise-${Date.now()}-${resolved.length}`,
          name,
          normalizedName: normalizeExerciseName(name),
          category,
          createdAt: new Date().toISOString(),
        };
        exercises.push(exercise);
      } else if (hasCategory && exercise.category !== category) {
        exercise.category = category;
      }
      if (!resolved.some((item) => item.id === exercise.id)) resolved.push(exercise);
    }
    await this.save(exercises);
    return resolved;
  }

  async updateCategory(id, category) {
    const exercises = await this.getAll();
    const updated = exercises.map((exercise) => exercise.id === id ? { ...exercise, category: exerciseCategory(category) } : exercise);
    await this.save(updated);
    return updated.find((exercise) => exercise.id === id);
  }
}

class LocalPlanStore extends LocalStore {
  constructor(key, exercises) {
    super(key);
    this.exercises = exercises;
  }

  async getAll() {
    const plans = await this.getRaw();
    let changed = false;
    for (const plan of plans) {
      if (plan.exerciseIds) continue;
      const resolved = await this.exercises.resolveNames(plan.exercises || []);
      plan.exerciseIds = resolved.map((exercise) => exercise.id);
      delete plan.exercises;
      changed = true;
    }
    if (changed) await this.save(plans);
    const exercises = await this.exercises.getAll();
    return plans.map((plan) => ({
      ...plan,
      exercises: plan.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)).filter(Boolean),
    }));
  }

  async add(plan) {
    const item = { id: crypto.randomUUID?.() ?? `plan-${Date.now()}`, createdAt: new Date().toISOString(), archivedAt: null, ...plan };
    await this.save([item, ...(await this.getRaw())]);
    return item;
  }

  async update(id, changes) {
    const plans = await this.getRaw();
    const updated = plans.map((plan) => (plan.id === id ? { ...plan, ...changes } : plan));
    await this.save(updated);
  }

  async archive(id) {
    await this.update(id, { archivedAt: new Date().toISOString() });
  }
}

class LocalWorkoutStore extends LocalStore {
  constructor(key, exercises) {
    super(key);
    this.exercises = exercises;
  }

  async getAll() {
    const workouts = await this.getRaw();
    let changed = false;
    for (const workout of workouts) {
      for (const result of workout.exercises || []) {
        if (result.exerciseId) continue;
        const [exercise] = await this.exercises.resolveNames([result.name]);
        result.exerciseId = exercise.id;
        changed = true;
      }
    }
    if (changed) await this.save(workouts);
    const catalog = await this.exercises.getAll();
    return workouts.map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map((result) => ({
        ...result,
        name: catalog.find((exercise) => exercise.id === result.exerciseId)?.name || result.name,
        category: catalog.find((exercise) => exercise.id === result.exerciseId)?.category || "Altro",
      })),
    }));
  }

  async add(workout) {
    const item = { id: crypto.randomUUID?.() ?? `workout-${Date.now()}`, createdAt: new Date().toISOString(), ...workout };
    await this.save([item, ...(await this.getRaw())]);
    return item;
  }
}

class LocalBodyWeightStore extends LocalStore {
  async getAll() {
    return this.getRaw();
  }

  async upsertByDate(item) {
    const items = await this.getRaw();
    const existing = items.find((entry) => entry.date === item.date);
    if (existing) {
      const updated = { ...existing, ...item };
      await this.save(items.map((entry) => (entry.id === existing.id ? updated : entry)));
      return updated;
    }
    const created = { id: crypto.randomUUID?.() ?? `weight-${Date.now()}`, createdAt: new Date().toISOString(), ...item };
    await this.save([created, ...items]);
    return created;
  }
}

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sessione non valida. Accedi di nuovo.");
  return data.user.id;
}

function throwIfError(error) {
  if (error) throw error;
}

class SupabaseExerciseStore {
  async getAll() {
    const { data, error } = await supabase.from("exercises").select("id, name, normalized_name, category, created_at").order("name");
    throwIfError(error);
    return data.map((exercise) => ({ id: exercise.id, name: exercise.name, normalizedName: exercise.normalized_name, category: exerciseCategory(exercise.category), createdAt: exercise.created_at }));
  }

  async resolveNames(entries) {
    const userId = await getUserId();
    const exercises = await this.getAll();
    const resolved = [];
    for (const entry of entries) {
      const name = String(typeof entry === "string" ? entry : entry.name).trim();
      const hasCategory = typeof entry !== "string" && Boolean(entry.category);
      const category = exerciseCategory(hasCategory ? entry.category : "Altro");
      let exercise = findEquivalent(exercises, name);
      if (!exercise) {
        const normalizedName = normalizeExerciseName(name);
        const { data, error } = await supabase
          .from("exercises")
          .upsert({ user_id: userId, name, normalized_name: normalizedName, category }, { onConflict: "user_id,normalized_name", ignoreDuplicates: false })
          .select("id, name, normalized_name, category, created_at")
          .single();
        throwIfError(error);
        exercise = { id: data.id, name: data.name, normalizedName: data.normalized_name, category: exerciseCategory(data.category), createdAt: data.created_at };
        exercises.push(exercise);
      } else if (hasCategory && exercise.category !== category) {
        exercise = await this.updateCategory(exercise.id, category);
      }
      if (!resolved.some((item) => item.id === exercise.id)) resolved.push(exercise);
    }
    return resolved;
  }

  async updateCategory(id, category) {
    const { data, error } = await supabase
      .from("exercises")
      .update({ category: exerciseCategory(category) })
      .eq("id", id)
      .select("id, name, normalized_name, category, created_at")
      .single();
    throwIfError(error);
    return { id: data.id, name: data.name, normalizedName: data.normalized_name, category: exerciseCategory(data.category), createdAt: data.created_at };
  }
}

class SupabasePlanStore {
  async getAll() {
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, created_at, archived_at, plan_exercises(position, exercise_id, exercise:exercises(id, name, normalized_name, category))")
      .order("created_at", { ascending: false });
    throwIfError(error);
    return data.map((plan) => ({
      id: plan.id,
      name: plan.name,
      createdAt: plan.created_at,
      archivedAt: plan.archived_at,
      exerciseIds: [...plan.plan_exercises].sort((a, b) => a.position - b.position).map((entry) => entry.exercise_id),
      exercises: [...plan.plan_exercises]
        .sort((a, b) => a.position - b.position)
        .map((entry) => ({ id: entry.exercise.id, name: entry.exercise.name, normalizedName: entry.exercise.normalized_name, category: exerciseCategory(entry.exercise.category) })),
    }));
  }

  async add(plan) {
    const userId = await getUserId();
    const { data, error } = await supabase.from("plans").insert({ user_id: userId, name: plan.name }).select("id").single();
    throwIfError(error);
    await this.replaceExercises(data.id, plan.exerciseIds);
    return data;
  }

  async update(id, changes) {
    if (changes.name) {
      const { error } = await supabase.from("plans").update({ name: changes.name }).eq("id", id);
      throwIfError(error);
    }
    if (changes.exerciseIds) await this.replaceExercises(id, changes.exerciseIds);
  }

  async replaceExercises(planId, exerciseIds) {
    const { error: deleteError } = await supabase.from("plan_exercises").delete().eq("plan_id", planId);
    throwIfError(deleteError);
    if (!exerciseIds.length) return;
    const rows = exerciseIds.map((exerciseId, position) => ({ plan_id: planId, exercise_id: exerciseId, position }));
    const { error } = await supabase.from("plan_exercises").insert(rows);
    throwIfError(error);
  }

  async archive(id) {
    const { error } = await supabase.from("plans").update({ archived_at: new Date().toISOString() }).eq("id", id);
    throwIfError(error);
  }
}

class SupabaseWorkoutStore {
  async getAll() {
    const { data, error } = await supabase
      .from("workouts")
      .select("id, plan_id, name, duration, total_volume, performed_at, exercise_results(id, exercise_id, exercise_name, sets, reps, load, volume, exercise:exercises(id, name, category))")
      .order("performed_at", { ascending: false });
    throwIfError(error);
    return data.map((workout) => ({
      id: workout.id,
      planId: workout.plan_id,
      name: workout.name,
      duration: workout.duration,
      volume: Number(workout.total_volume),
      date: workout.performed_at,
      exercises: workout.exercise_results.map((result) => ({
        id: result.id,
        exerciseId: result.exercise_id,
        name: result.exercise?.name || result.exercise_name,
        category: exerciseCategory(result.exercise?.category),
        sets: result.sets,
        reps: result.reps,
        load: Number(result.load),
        volume: Number(result.volume),
      })),
    }));
  }

  async add(workout) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, plan_id: workout.planId, name: workout.name, duration: workout.duration, total_volume: workout.volume, performed_at: workout.date })
      .select("id")
      .single();
    throwIfError(error);
    const results = workout.exercises.map((result) => ({ workout_id: data.id, exercise_id: result.exerciseId, exercise_name: result.name, sets: result.sets, reps: result.reps, load: result.load }));
    const { error: resultsError } = await supabase.from("exercise_results").insert(results);
    if (resultsError) {
      await supabase.from("workouts").delete().eq("id", data.id);
      throw resultsError;
    }
    return { ...workout, id: data.id };
  }

  async remove(id) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    throwIfError(error);
  }
}

class SupabaseBodyWeightStore {
  async getAll() {
    const { data, error } = await supabase.from("body_weights").select("id, measured_on, weight, created_at").order("measured_on", { ascending: false });
    throwIfError(error);
    return data.map((entry) => ({ id: entry.id, date: entry.measured_on, weight: Number(entry.weight), createdAt: entry.created_at }));
  }

  async upsertByDate(entry) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("body_weights")
      .upsert({ user_id: userId, measured_on: entry.date, weight: entry.weight }, { onConflict: "user_id,measured_on" })
      .select("id, measured_on, weight, created_at")
      .single();
    throwIfError(error);
    return { id: data.id, date: data.measured_on, weight: Number(data.weight), createdAt: data.created_at };
  }
}

const localExercises = new LocalExerciseStore(EXERCISES_KEY);

export const exerciseStore = isSupabaseConfigured ? new SupabaseExerciseStore() : localExercises;
export const planStore = isSupabaseConfigured ? new SupabasePlanStore() : new LocalPlanStore(PLANS_KEY, localExercises);
export const workoutStore = isSupabaseConfigured ? new SupabaseWorkoutStore() : new LocalWorkoutStore(WORKOUTS_KEY, localExercises);
export const bodyWeightStore = isSupabaseConfigured ? new SupabaseBodyWeightStore() : new LocalBodyWeightStore(BODY_WEIGHTS_KEY);
