import { normalizeExerciseName } from "./data-store.js";

function exerciseKey(exercise) {
  return exercise.exerciseId || normalizeExerciseName(exercise.name);
}

function exerciseMatches(exercise, selectedExercise) {
  const selectedId = typeof selectedExercise === "string" ? selectedExercise : selectedExercise.id;
  const selectedName = typeof selectedExercise === "string" ? selectedExercise : selectedExercise.name;
  const normalizedSelectedName = normalizeExerciseName(selectedName);
  return exercise.exerciseId === selectedId || normalizeExerciseName(exercise.name) === normalizedSelectedName;
}

export function trackedExercisesFromHistory(workouts) {
  const exercises = new Map();
  workouts.forEach((workout) => {
    workout.exercises?.forEach((exercise) => {
      const key = exerciseKey(exercise);
      if (!exercises.has(key)) {
        exercises.set(key, {
          id: key,
          name: exercise.name,
          category: exercise.category || "Altro",
        });
      }
    });
  });
  return [...exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function exerciseExecutions(workouts, selectedExercise) {
  return workouts
    .flatMap((workout) =>
      (workout.exercises || [])
        .filter((exercise) => exerciseMatches(exercise, selectedExercise))
        .map((exercise) => ({
          workoutId: workout.id,
          date: workout.date,
          workoutName: workout.name,
          sets: Number(exercise.sets || 0),
          reps: Number(exercise.reps || 0),
          load: Number(exercise.load || 0),
          category: exercise.category || "Altro",
        })),
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function exerciseProgressSummary(executions) {
  if (!executions.length) {
    return {
      latest: null,
      personalRecord: 0,
      firstLoad: 0,
      absoluteIncrease: 0,
      percentIncrease: null,
    };
  }
  const firstLoad = executions[0].load;
  const latest = executions.at(-1);
  const personalRecord = Math.max(...executions.map((execution) => execution.load));
  return {
    latest,
    personalRecord,
    firstLoad,
    absoluteIncrease: latest.load - firstLoad,
    percentIncrease: firstLoad ? ((latest.load - firstLoad) / firstLoad) * 100 : null,
  };
}

export function loadProgressionPoints(executions) {
  const sessions = new Map();
  executions.forEach((execution) => {
    const load = Number(execution.load);
    if (!Number.isFinite(load)) return;
    const sessionKey = execution.workoutId || `${execution.date}-${execution.workoutName}`;
    const current = sessions.get(sessionKey);
    if (!current || load > current.load) sessions.set(sessionKey, { ...execution, load });
  });
  return [...sessions.values()]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((execution) => ({
      date: execution.date,
      value: execution.load,
      workoutName: execution.workoutName,
      sets: execution.sets,
      reps: execution.reps,
      load: execution.load,
    }));
}
