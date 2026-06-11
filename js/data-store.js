import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const WORKOUTS_KEY = "gymboard-workouts-v2";
const PLANS_KEY = "gymboard-plans-v1";
const BODY_WEIGHTS_KEY = "gymboard-body-weights-v1";

class LocalStore {
  constructor(key) {
    this.key = key;
  }

  async getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  }

  async save(items) {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  async add(item) {
    const newItem = {
      id: crypto.randomUUID?.() ?? `${this.key}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...item,
    };
    await this.save([newItem, ...(await this.getAll())]);
    return newItem;
  }

  async remove(id) {
    await this.save((await this.getAll()).filter((item) => item.id !== id));
  }

  async upsertByDate(item) {
    const items = await this.getAll();
    const existing = items.find((entry) => entry.date === item.date);
    if (!existing) return this.add(item);
    const updated = { ...existing, ...item };
    await this.save(items.map((entry) => (entry.id === existing.id ? updated : entry)));
    return updated;
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

class SupabasePlanStore {
  async getAll() {
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, created_at, plan_exercises(id, name, position)")
      .order("created_at", { ascending: false });
    throwIfError(error);
    return data.map((plan) => ({
      id: plan.id,
      name: plan.name,
      createdAt: plan.created_at,
      exercises: [...plan.plan_exercises]
        .sort((a, b) => a.position - b.position)
        .map((exercise) => exercise.name),
    }));
  }

  async add(plan) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("plans")
      .insert({ user_id: userId, name: plan.name })
      .select("id, name, created_at")
      .single();
    throwIfError(error);

    const exercises = plan.exercises.map((name, position) => ({ plan_id: data.id, name, position }));
    const { error: exercisesError } = await supabase.from("plan_exercises").insert(exercises);
    if (exercisesError) {
      await supabase.from("plans").delete().eq("id", data.id);
      throw exercisesError;
    }
    return { id: data.id, name: data.name, createdAt: data.created_at, exercises: plan.exercises };
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
      .select("id, plan_id, name, duration, total_volume, performed_at, exercise_results(id, exercise_name, sets, reps, load, volume)")
      .order("performed_at", { ascending: false });
    throwIfError(error);
    return data.map((workout) => ({
      id: workout.id,
      planId: workout.plan_id,
      name: workout.name,
      duration: workout.duration,
      volume: Number(workout.total_volume),
      date: workout.performed_at,
      exercises: workout.exercise_results.map((exercise) => ({
        id: exercise.id,
        name: exercise.exercise_name,
        sets: exercise.sets,
        reps: exercise.reps,
        load: Number(exercise.load),
        volume: Number(exercise.volume),
      })),
    }));
  }

  async add(workout) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        plan_id: workout.planId,
        name: workout.name,
        duration: workout.duration,
        total_volume: workout.volume,
        performed_at: workout.date,
      })
      .select("id")
      .single();
    throwIfError(error);

    const results = workout.exercises.map((exercise) => ({
      workout_id: data.id,
      exercise_name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      load: exercise.load,
    }));
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
    const { data, error } = await supabase
      .from("body_weights")
      .select("id, measured_on, weight, created_at")
      .order("measured_on", { ascending: false });
    throwIfError(error);
    return data.map((entry) => ({
      id: entry.id,
      date: entry.measured_on,
      weight: Number(entry.weight),
      createdAt: entry.created_at,
    }));
  }

  async upsertByDate(entry) {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from("body_weights")
      .upsert(
        { user_id: userId, measured_on: entry.date, weight: entry.weight },
        { onConflict: "user_id,measured_on" },
      )
      .select("id, measured_on, weight, created_at")
      .single();
    throwIfError(error);
    return { id: data.id, date: data.measured_on, weight: Number(data.weight), createdAt: data.created_at };
  }
}

export const planStore = isSupabaseConfigured ? new SupabasePlanStore() : new LocalStore(PLANS_KEY);
export const workoutStore = isSupabaseConfigured ? new SupabaseWorkoutStore() : new LocalStore(WORKOUTS_KEY);
export const bodyWeightStore = isSupabaseConfigured
  ? new SupabaseBodyWeightStore()
  : new LocalStore(BODY_WEIGHTS_KEY);
