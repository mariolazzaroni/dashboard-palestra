export function startOfWeek(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  return start;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isInWeek(date, weekStart) {
  const current = new Date(date);
  return current >= weekStart && current < addDays(weekStart, 7);
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function weekNumber(date = new Date()) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  return Math.ceil(((current - yearStart) / 86400000 + 1) / 7);
}

export function weeklyAverageWeight(bodyWeights, weekStart = startOfWeek()) {
  const entries = bodyWeights.filter((entry) => isInWeek(`${entry.date}T12:00:00`, weekStart));
  if (!entries.length) return null;
  return entries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0) / entries.length;
}

export function weeklyTrainingVolume(workouts, weekStart = startOfWeek()) {
  return workouts
    .filter((workout) => isInWeek(workout.date, weekStart))
    .reduce((sum, workout) => sum + Number(workout.volume || 0), 0);
}

export function weeklyVolumeByCategory(workouts, weekStart = startOfWeek()) {
  return workouts
    .filter((workout) => isInWeek(workout.date, weekStart))
    .flatMap((workout) => workout.exercises || [])
    .reduce((totals, exercise) => {
      const category = exercise.category || "Altro";
      totals[category] = (totals[category] || 0) + Number(exercise.volume || 0);
      return totals;
    }, {});
}

export function rollingWeightTrend52Weeks(bodyWeights, referenceDate = new Date()) {
  const currentWeekStart = startOfWeek(referenceDate);
  return Array.from({ length: 52 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 51) * 7);
    return {
      weekStart,
      weekNumber: weekNumber(weekStart),
      averageWeight: weeklyAverageWeight(bodyWeights, weekStart),
    };
  });
}

export function buildWeeklyReport(workouts, bodyWeights, referenceDate = new Date()) {
  const currentWeekStart = startOfWeek(referenceDate);
  const previousWeekStart = addDays(currentWeekStart, -7);
  const currentVolume = weeklyTrainingVolume(workouts, currentWeekStart);
  const previousVolume = weeklyTrainingVolume(workouts, previousWeekStart);
  const currentAverageWeight = weeklyAverageWeight(bodyWeights, currentWeekStart);
  const previousAverageWeight = weeklyAverageWeight(bodyWeights, previousWeekStart);
  const currentVolumeByCategory = weeklyVolumeByCategory(workouts, currentWeekStart);
  const previousVolumeByCategory = weeklyVolumeByCategory(workouts, previousWeekStart);
  const categoryNames = [...new Set([...Object.keys(currentVolumeByCategory), ...Object.keys(previousVolumeByCategory)])];

  return {
    currentWeekStart,
    previousWeekStart,
    weekNumber: weekNumber(currentWeekStart),
    current: {
      averageWeight: currentAverageWeight,
      totalVolume: currentVolume,
      volumeByCategory: currentVolumeByCategory,
    },
    previous: {
      averageWeight: previousAverageWeight,
      totalVolume: previousVolume,
      volumeByCategory: previousVolumeByCategory,
    },
    comparison: {
      volumeDelta: currentVolume - previousVolume,
      volumeDeltaPercent: percentChange(currentVolume, previousVolume),
      averageWeightDelta:
        currentAverageWeight === null || previousAverageWeight === null
          ? null
          : currentAverageWeight - previousAverageWeight,
      averageWeightDeltaPercent:
        currentAverageWeight === null || previousAverageWeight === null
          ? null
          : percentChange(currentAverageWeight, previousAverageWeight),
      volumeByCategory: categoryNames.reduce((items, category) => {
        const current = currentVolumeByCategory[category] || 0;
        const previous = previousVolumeByCategory[category] || 0;
        items[category] = {
          current,
          previous,
          delta: current - previous,
          deltaPercent: previous ? percentChange(current, previous) : null,
          isNew: current > 0 && !previous,
        };
        return items;
      }, {}),
    },
    rollingWeightTrend52Weeks: rollingWeightTrend52Weeks(bodyWeights, referenceDate),
  };
}

export function buildMonthlyReport(workouts, bodyWeights, referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentStart = new Date(year, month, 1);
  const nextStart = new Date(year, month + 1, 1);
  const previousStart = new Date(year, month - 1, 1);
  const currentWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.date);
    return date >= currentStart && date < nextStart;
  });
  const previousWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.date);
    return date >= previousStart && date < currentStart;
  });
  const currentVolume = currentWorkouts.reduce((sum, workout) => sum + Number(workout.volume || 0), 0);
  const previousVolume = previousWorkouts.reduce((sum, workout) => sum + Number(workout.volume || 0), 0);

  return {
    monthStart: currentStart,
    previousMonthStart: previousStart,
    totalVolume: currentVolume,
    previousTotalVolume: previousVolume,
    volumeDelta: currentVolume - previousVolume,
    volumeDeltaPercent: percentChange(currentVolume, previousVolume),
    rollingWeightTrend52Weeks: rollingWeightTrend52Weeks(bodyWeights, referenceDate),
  };
}
