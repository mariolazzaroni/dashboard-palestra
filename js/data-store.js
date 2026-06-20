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
  return exercises.find((exercise) => exercise.normalizedName === normalized) || null;
}

function plannedValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function planExerciseItem(value) {
  if (typeof value === "string") return { exerciseId: value, plannedSets: 3, plannedReps: 8 };
  return {
    exerciseId: value.exerciseId,
    plannedSets: plannedValue(value.plannedSets, 3),
    plannedReps: plannedValue(value.plannedReps, 8),
  };
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

  async update(id, changes) {
    const exercises = await this.getAll();
    const name = String(changes.name || "").trim();
    if (!name) throw new Error("Inserisci un nome esercizio.");
    const normalizedName = normalizeExerciseName(name);
    const duplicate = exercises.find((exercise) => exercise.id !== id && exercise.normalizedName === normalizedName);
    if (duplicate) throw new Error("Esiste già un esercizio con questo nome.");
    const updatedExercise = {
      ...exercises.find((exercise) => exercise.id === id),
      name,
      normalizedName,
      category: exerciseCategory(changes.category),
    };
    await this.save(exercises.map((exercise) => exercise.id === id ? updatedExercise : exercise));
    return updatedExercise;
  }

  async remove(id) {
    await super.remove(id);

    const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans.map((plan) => ({
      ...plan,
      exerciseIds: plan.exerciseIds?.filter((exerciseId) => exerciseId !== id),
      exerciseItems: plan.exerciseItems?.filter((item) => planExerciseItem(item).exerciseId !== id),
      exercises: Array.isArray(plan.exercises) ? plan.exercises.filter((name) => name !== id) : plan.exercises,
    }))));

    const workouts = JSON.parse(localStorage.getItem(WORKOUTS_KEY) || "[]");
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts.map((workout) => {
      const exercises = (workout.exercises || []).filter((exercise) => exercise.exerciseId !== id);
      return { ...workout, exercises, volume: exercises.reduce((sum, exercise) => sum + Number(exercise.volume || 0), 0) };
    })));
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
      if (!plan.exerciseItems) {
        if (plan.exerciseIds) plan.exerciseItems = plan.exerciseIds.map(planExerciseItem);
        else {
          const resolved = await this.exercises.resolveNames(plan.exercises || []);
          plan.exerciseItems = resolved.map((exercise) => ({ exerciseId: exercise.id, plannedSets: 3, plannedReps: 8 }));
          delete plan.exercises;
        }
        delete plan.exerciseIds;
        changed = true;
      }
    }
    if (changed) await this.save(plans);
    const exercises = await this.exercises.getAll();
    return plans.map((plan) => ({
      ...plan,
      exerciseItems: (plan.exerciseItems || []).map(planExerciseItem),
      exercises: (plan.exerciseItems || [])
        .map(planExerciseItem)
        .map((item) => {
          const exercise = exercises.find((entry) => entry.id === item.exerciseId);
          return exercise ? { ...exercise, plannedSets: item.plannedSets, plannedReps: item.plannedReps } : null;
        })
        .filter(Boolean),
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

  async restore(id) {
    await this.update(id, { archivedAt: null });
  }

  async remove(id) {
    await super.remove(id);
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

let supabaseExerciseCache = null;

class SupabaseExerciseStore {
  async getAll() {
    if (supabaseExerciseCache) return supabaseExerciseCache;
    const { data, error } = await supabase.from("exercises").select("id, name, normalized_name, category, created_at").order("name");
    throwIfError(error);
    supabaseExerciseCache = data.map((exercise) => ({ id: exercise.id, name: exercise.name, normalizedName: exercise.normalized_name, category: exerciseCategory(exercise.category), createdAt: exercise.created_at }));
    return supabaseExerciseCache;
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
        supabaseExerciseCache = exercises;
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
    const updated = { id: data.id, name: data.name, normalizedName: data.normalized_name, category: exerciseCategory(data.category), createdAt: data.created_at };
    if (supabaseExerciseCache) supabaseExerciseCache = supabaseExerciseCache.map((exercise) => exercise.id === updated.id ? updated : exercise);
    return updated;
  }

  async update(id, changes) {
    const name = String(changes.name || "").trim();
    if (!name) throw new Error("Inserisci un nome esercizio.");
    const { data, error } = await supabase
      .from("exercises")
      .update({ name, normalized_name: normalizeExerciseName(name), category: exerciseCategory(changes.category) })
      .eq("id", id)
      .select("id, name, normalized_name, category, created_at")
      .single();
    throwIfError(error);
    const updated = { id: data.id, name: data.name, normalizedName: data.normalized_name, category: exerciseCategory(data.category), createdAt: data.created_at };
    if (supabaseExerciseCache) supabaseExerciseCache = supabaseExerciseCache.map((exercise) => exercise.id === updated.id ? updated : exercise);
    return updated;
  }

  async remove(id) {
    const { data: resultRows, error: resultError } = await supabase
      .from("exercise_results")
      .select("workout_id, volume")
      .eq("exercise_id", id);
    throwIfError(resultError);

    const { error } = await supabase.from("exercises").delete().eq("id", id);
    throwIfError(error);
    if (supabaseExerciseCache) supabaseExerciseCache = supabaseExerciseCache.filter((exercise) => exercise.id !== id);

    const removedVolumeByWorkout = (resultRows || []).reduce((map, result) => {
      map.set(result.workout_id, (map.get(result.workout_id) || 0) + Number(result.volume || 0));
      return map;
    }, new Map());
    if (!removedVolumeByWorkout.size) return;

    const workoutIds = [...removedVolumeByWorkout.keys()];
    const { data: workouts, error: workoutsError } = await supabase
      .from("workouts")
      .select("id, total_volume")
      .in("id", workoutIds);
    throwIfError(workoutsError);

    await Promise.all((workouts || []).map((workout) => {
      const totalVolume = Math.max(0, Number(workout.total_volume || 0) - removedVolumeByWorkout.get(workout.id));
      return supabase.from("workouts").update({ total_volume: totalVolume }).eq("id", workout.id).then(({ error: updateError }) => throwIfError(updateError));
    }));
  }
}

class SupabasePlanStore {
  async getAll() {
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, created_at, archived_at, plan_exercises(position, exercise_id, planned_sets, planned_reps, exercise:exercises(id, name, normalized_name, category))")
      .order("created_at", { ascending: false });
    throwIfError(error);
    return data.map((plan) => ({
      id: plan.id,
      name: plan.name,
      createdAt: plan.created_at,
      archivedAt: plan.archived_at,
      exerciseItems: [...plan.plan_exercises].sort((a, b) => a.position - b.position).map((entry) => ({
        exerciseId: entry.exercise_id,
        plannedSets: plannedValue(entry.planned_sets, 3),
        plannedReps: plannedValue(entry.planned_reps, 8),
      })),
      exercises: [...plan.plan_exercises]
        .sort((a, b) => a.position - b.position)
        .map((entry) => ({
          id: entry.exercise.id,
          name: entry.exercise.name,
          normalizedName: entry.exercise.normalized_name,
          category: exerciseCategory(entry.exercise.category),
          plannedSets: plannedValue(entry.planned_sets, 3),
          plannedReps: plannedValue(entry.planned_reps, 8),
        })),
    }));
  }

  async add(plan) {
    const userId = await getUserId();
    const { data, error } = await supabase.from("plans").insert({ user_id: userId, name: plan.name }).select("id").single();
    throwIfError(error);
    await this.replaceExercises(data.id, plan.exerciseItems || plan.exerciseIds);
    return data;
  }

  async update(id, changes) {
    if (changes.name) {
      const { error } = await supabase.from("plans").update({ name: changes.name }).eq("id", id);
      throwIfError(error);
    }
    if (changes.exerciseItems || changes.exerciseIds) await this.replaceExercises(id, changes.exerciseItems || changes.exerciseIds);
  }

  async replaceExercises(planId, exerciseItems) {
    const { error: deleteError } = await supabase.from("plan_exercises").delete().eq("plan_id", planId);
    throwIfError(deleteError);
    if (!exerciseItems.length) return;
    const rows = exerciseItems.map(planExerciseItem).map((item, position) => ({
      plan_id: planId,
      exercise_id: item.exerciseId,
      planned_sets: item.plannedSets,
      planned_reps: item.plannedReps,
      position,
    }));
    const { error } = await supabase.from("plan_exercises").insert(rows);
    throwIfError(error);
  }

  async archive(id) {
    const { error } = await supabase.from("plans").update({ archived_at: new Date().toISOString() }).eq("id", id);
    throwIfError(error);
  }

  async restore(id) {
    const { error } = await supabase.from("plans").update({ archived_at: null }).eq("id", id);
    throwIfError(error);
  }

  async remove(id) {
    const { error } = await supabase.from("plans").delete().eq("id", id);
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
      .insert({ user_id: userId, plan_id: workout.planId, name: workout.name, duration: 1, total_volume: workout.volume, performed_at: workout.date })
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
