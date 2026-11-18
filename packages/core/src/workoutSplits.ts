export const WORKOUT_SPLITS = ['full_body', 'upper_lower', 'ppl', 'body_part', 'hybrid'] as const;
export type WorkoutSplit = (typeof WORKOUT_SPLITS)[number];
export const WORKOUT_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'core',
] as const;
export type WorkoutMuscle = (typeof WORKOUT_MUSCLES)[number];
export const WORKOUT_SPLIT_DAYS: Record<WorkoutSplit, readonly number[]> = {
  full_body: [2, 3],
  upper_lower: [4],
  ppl: [3, 6],
  body_part: [5, 6],
  hybrid: [5],
};
export function defaultWorkoutDays(count: number): number[] {
  return (
    (
      {
        2: [0, 3],
        3: [0, 2, 4],
        4: [0, 1, 3, 4],
        5: [0, 1, 2, 4, 5],
        6: [0, 1, 2, 3, 4, 5],
      } as Record<number, number[]>
    )[count]?.slice() ?? []
  );
}
export interface WorkoutSplitPreferences {
  workout_days: number[];
  workout_split?: WorkoutSplit;
  workout_notes?: string;
}
export function validateWorkoutSplitPreferences(input: WorkoutSplitPreferences): void {
  if (input.workout_split === undefined) {
    return; // Existing plans and older clients remain readable.
  }
  if (
    !WORKOUT_SPLITS.includes(input.workout_split) ||
    !WORKOUT_SPLIT_DAYS[input.workout_split].includes(input.workout_days.length)
  )
    throw new Error('INVALID_WORKOUT_SPLIT');
}
export interface WorkoutSplitDay {
  day: number;
  focus: string;
  muscles: WorkoutMuscle[];
}

export function avoidedWorkoutMuscles(notes: string): WorkoutMuscle[] {
  const regions: Record<WorkoutMuscle, RegExp> = {
    chest: /\b(chest|pecs?|pectoral[s]?)\b/i,
    back: /\b(back|lats?|spine|traps?)\b/i,
    shoulders: /\b(shoulders?|delts?|rotator cuff)\b/i,
    biceps: /\b(biceps?|arms?|elbows?|wrists?|forearms?)\b/i,
    triceps: /\b(triceps?|arms?|elbows?|wrists?|forearms?)\b/i,
    legs: /\b(legs?|knees?|hips?|calf|calves|quads?|quadriceps|hamstrings?|glutes?|ankles?|lower body)\b/i,
    core: /\b(core|abs?|abdominals?)\b/i,
  };
  const exclusions = notes
    .split(/[.;,\n]+/)
    .map((clause) => {
      if (!/^\s*(focus|prioriti[sz]e|target)\b/i.test(clause)) return clause;
      const start = clause.search(/\b(no|avoid|skip|exclude|without)\b/i);
      return start < 0 ? '' : clause.slice(start);
    })
    .join(' ');
  return WORKOUT_MUSCLES.filter((muscle) => regions[muscle].test(exclusions));
}
/** A deterministic prescription: the provider chooses exercises, never the weekly split. */
export function workoutSplitSchedule(input: WorkoutSplitPreferences): WorkoutSplitDay[] | null {
  validateWorkoutSplitPreferences(input);
  if (!input.workout_split) return null;
  const upper: WorkoutMuscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
  const lower: WorkoutMuscle[] = ['legs', 'core'];
  const push: WorkoutMuscle[] = ['chest', 'shoulders', 'triceps'];
  const pull: WorkoutMuscle[] = ['back', 'biceps'];
  const templates: Record<WorkoutSplit, Array<[string, WorkoutMuscle[]]>> = {
    full_body: [['Full body', [...WORKOUT_MUSCLES]]],
    upper_lower: [
      ['Upper body', upper],
      ['Lower body', lower],
    ],
    ppl: [
      ['Push', push],
      ['Pull', pull],
      ['Legs and core', lower],
    ],
    body_part: [
      ['Chest', ['chest']],
      ['Back', ['back']],
      ['Shoulders', ['shoulders']],
      ['Arms', ['biceps', 'triceps']],
      [
        input.workout_days.length === 6 ? 'Legs' : 'Legs and core',
        input.workout_days.length === 6 ? ['legs'] : lower,
      ],
      ['Core', ['core']],
    ],
    hybrid: [
      ['Upper body', upper],
      ['Lower body', lower],
      ['Push', push],
      ['Pull', pull],
      ['Legs and core', lower],
    ],
  };
  const template = templates[input.workout_split];
  const excluded = avoidedWorkoutMuscles(input.workout_notes ?? '');
  const days = [...input.workout_days]
    .sort((a, b) => a - b)
    .map((day, index) => {
      const [focus, muscles] = template[index % template.length]!;
      return {
        day,
        focus,
        muscles: muscles.filter((m) => !excluded.includes(m)),
      };
    });
  return days;
}
