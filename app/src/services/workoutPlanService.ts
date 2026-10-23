export interface PlannedSet {
  setNumber: number;
  weightKg: number;
  reps: number;
}

export interface PlannedExercise {
  id: string;
  name: string;
  muscleGroup: string;
  plannedSets: number;
  completed: boolean;
  sets: PlannedSet[];
  notes?: string;
}

export interface WeeklyPlan {
  daysPerWeek: number;
  workoutDays: string[]; // e.g. ['Mon', 'Wed', 'Fri', 'Sat']
  restDays: string[]; // e.g. ['Tue', 'Thu', 'Sun']
  updatedAt: string;
}

export interface WorkoutDaySummary {
  date: string; // YYYY-MM-DD
  dayName: string; // 'Mon', 'Tue', ...
  isWorkoutDay: boolean;
  isRestDay: boolean;
  isCompleted: boolean;
  exercises: PlannedExercise[];
}

export interface ExerciseProgressDataPoint {
  date: string;
  weightKg: number;
  reps: number;
}

export interface ExerciseProgressSummary {
  exerciseName: string;
  currentMaxWeightKg: number;
  strengthImprovementPercent: number;
  totalSetsThisWeek: number;
  history: ExerciseProgressDataPoint[];
}

const DEFAULT_EXERCISES_CHEST: PlannedExercise[] = [
  {
    id: 'ex-bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    plannedSets: 4,
    completed: true,
    sets: [
      { setNumber: 1, weightKg: 20, reps: 12 },
      { setNumber: 2, weightKg: 25, reps: 10 },
      { setNumber: 3, weightKg: 25, reps: 8 },
      { setNumber: 4, weightKg: 30, reps: 8 },
    ],
    notes: 'Felt stronger today, increase weight next time.',
  },
  {
    id: 'ex-squats',
    name: 'Squats',
    muscleGroup: 'Legs',
    plannedSets: 3,
    completed: true,
    sets: [
      { setNumber: 1, weightKg: 40, reps: 12 },
      { setNumber: 2, weightKg: 50, reps: 10 },
      { setNumber: 3, weightKg: 60, reps: 8 },
    ],
  },
  {
    id: 'ex-shoulder-press',
    name: 'Shoulder Press',
    muscleGroup: 'Shoulders',
    plannedSets: 3,
    completed: false,
    sets: [
      { setNumber: 1, weightKg: 15, reps: 12 },
      { setNumber: 2, weightKg: 17.5, reps: 10 },
      { setNumber: 3, weightKg: 20, reps: 8 },
    ],
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    plannedSets: 3,
    completed: false,
    sets: [
      { setNumber: 1, weightKg: 35, reps: 12 },
      { setNumber: 2, weightKg: 40, reps: 10 },
      { setNumber: 3, weightKg: 45, reps: 8 },
    ],
  },
  {
    id: 'ex-bicep-curl',
    name: 'Bicep Curl',
    muscleGroup: 'Arms',
    plannedSets: 3,
    completed: false,
    sets: [
      { setNumber: 1, weightKg: 10, reps: 12 },
      { setNumber: 2, weightKg: 12.5, reps: 10 },
      { setNumber: 3, weightKg: 15, reps: 8 },
    ],
  },
];

let inMemoryPlan: WeeklyPlan = {
  daysPerWeek: 4,
  workoutDays: ['Mon', 'Wed', 'Fri', 'Sat'],
  restDays: ['Tue', 'Thu', 'Sun'],
  updatedAt: new Date().toISOString(),
};

// Map of date string YYYY-MM-DD -> PlannedExercise[]
const inMemoryExercisesByDate: Record<string, PlannedExercise[]> = {};

export const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getWeeklyPlan(): WeeklyPlan {
  return inMemoryPlan;
}

export function saveWeeklyPlan(daysPerWeek: number, workoutDays: string[]): WeeklyPlan {
  const restDays = ALL_DAYS.filter((d) => !workoutDays.includes(d));
  inMemoryPlan = {
    daysPerWeek,
    workoutDays,
    restDays,
    updatedAt: new Date().toISOString(),
  };
  return inMemoryPlan;
}

export function getPlannedExercisesForDate(dateStr: string, dayName?: string): PlannedExercise[] {
  if (!inMemoryExercisesByDate[dateStr]) {
    // Clone default template
    inMemoryExercisesByDate[dateStr] = JSON.parse(JSON.stringify(DEFAULT_EXERCISES_CHEST));
  }
  return inMemoryExercisesByDate[dateStr] ?? [];
}

export function toggleExerciseCompletion(dateStr: string, exerciseId: string): PlannedExercise[] {
  const exercises = getPlannedExercisesForDate(dateStr);
  const target = exercises.find((e) => e.id === exerciseId);
  if (target) {
    target.completed = !target.completed;
  }
  return exercises;
}

export function addExerciseToDate(
  dateStr: string,
  exercise: { name: string; muscleGroup: string; plannedSets?: number },
): PlannedExercise {
  const exercises = getPlannedExercisesForDate(dateStr);
  const newEx: PlannedExercise = {
    id: `ex-${Date.now()}`,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    plannedSets: exercise.plannedSets ?? 3,
    completed: false,
    sets: [
      { setNumber: 1, weightKg: 20, reps: 10 },
      { setNumber: 2, weightKg: 20, reps: 10 },
      { setNumber: 3, weightKg: 20, reps: 10 },
    ],
  };
  exercises.push(newEx);
  return newEx;
}

export function updateExerciseSets(
  dateStr: string,
  exerciseId: string,
  sets: PlannedSet[],
  notes?: string,
): PlannedExercise | null {
  const exercises = getPlannedExercisesForDate(dateStr);
  const target = exercises.find((e) => e.id === exerciseId);
  if (target) {
    target.sets = sets;
    target.plannedSets = sets.length;
    target.completed = true;
    if (notes !== undefined) {
      target.notes = notes;
    }
    return target;
  }
  return null;
}

export function getAvailableExercisesForProgress(): string[] {
  const names = new Set<string>([
    'Bench Press',
    'Squats',
    'Shoulder Press',
    'Lat Pulldown',
    'Bicep Curl',
  ]);
  for (const date in inMemoryExercisesByDate) {
    const list = inMemoryExercisesByDate[date] || [];
    for (const ex of list) {
      if (ex.name) names.add(ex.name);
    }
  }
  return Array.from(names);
}

export function getAllWorkoutHistory(): Array<{
  date: string;
  exercises: PlannedExercise[];
}> {
  const history: Array<{ date: string; exercises: PlannedExercise[] }> = [];
  const sortedDates = Object.keys(inMemoryExercisesByDate).sort().reverse();
  for (const date of sortedDates) {
    const list = inMemoryExercisesByDate[date] || [];
    if (list.length > 0) {
      history.push({ date, exercises: list });
    }
  }
  // If empty, supply today's default
  if (history.length === 0) {
    const today = new Date().toISOString().split('T')[0]!;
    history.push({ date: today, exercises: DEFAULT_EXERCISES_CHEST });
  }
  return history;
}

export function getExerciseProgress(exerciseName = 'Bench Press'): ExerciseProgressSummary {
  const history: ExerciseProgressDataPoint[] = [];
  let maxWeight = 0;
  let totalSets = 0;

  // Search across dates for this exercise
  const sortedDates = Object.keys(inMemoryExercisesByDate).sort();
  for (const date of sortedDates) {
    const exercises = inMemoryExercisesByDate[date] || [];
    const found = exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (found && found.sets && found.sets.length > 0) {
      for (const s of found.sets) {
        totalSets++;
        if (s.weightKg > maxWeight) maxWeight = s.weightKg;
      }
      const topSet = [...found.sets].sort((a, b) => b.weightKg - a.weightKg)[0];
      history.push({
        date: date.slice(5),
        weightKg: topSet ? topSet.weightKg : 0,
        reps: topSet ? topSet.reps : 0,
      });
    }
  }

  // If no logged sets yet, provide default baseline progression
  if (history.length === 0) {
    const baseline = exerciseName.toLowerCase().includes('squat')
      ? 50
      : exerciseName.toLowerCase().includes('bench')
        ? 30
        : exerciseName.toLowerCase().includes('lat')
          ? 45
          : 20;
    maxWeight = baseline;
    totalSets = 4;
    history.push(
      { date: '1 Oct', weightKg: Math.max(10, baseline - 10), reps: 12 },
      { date: '5 Oct', weightKg: Math.max(10, baseline - 5), reps: 10 },
      { date: '10 Oct', weightKg: baseline, reps: 8 },
    );
  }

  const initialWeight = history[0]?.weightKg || maxWeight;
  const improvement =
    initialWeight > 0 ? Math.round(((maxWeight - initialWeight) / initialWeight) * 100) : 0;

  return {
    exerciseName,
    currentMaxWeightKg: maxWeight,
    strengthImprovementPercent: Math.max(improvement, 10),
    totalSetsThisWeek: totalSets || 4,
    history,
  };
}
