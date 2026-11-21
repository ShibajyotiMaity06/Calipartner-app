// Shared Workout AI Engine for Supabase Edge Functions
// Matches packages/core/src/workoutRedesign.ts exactly.

export interface AiWorkoutInputs {
  days_per_week: number;
  training_days: number[];
  session_minutes: 30 | 60 | 90 | 120;
  split: 'ppl' | 'upper_lower' | 'full_body' | 'body_part' | 'auto';
  experience: 'beginner' | 'intermediate' | 'experienced';
  location: 'home' | 'basic_gym' | 'advanced_gym';
  limitations?: string;
  workout_notes?: string;
}

export interface GeneratedPlanExercise {
  id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  is_compound: boolean;
}

export interface GeneratedPlanDay {
  weekday: number;
  is_rest: boolean;
  name: string;
  exercises: GeneratedPlanExercise[];
  about_minutes: number;
}

export interface GeneratedWorkoutPlan {
  name: string;
  source: 'ai' | 'custom';
  ai_inputs?: AiWorkoutInputs;
  days: GeneratedPlanDay[];
  excluded: string[];
  unmatched_limitations: string[];
}

export const EXERCISE_COUNTS_BY_MINUTES: Record<number, number> = {
  30: 3,
  60: 4,
  90: 5,
  120: 6,
};

export const AI_REBUILD_COOLDOWN_MONTHS = 3;

export function addCooldownMonths(from: Date, months: number = AI_REBUILD_COOLDOWN_MONTHS): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const maxDays = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDays);

  const result = new Date(from.getTime());
  result.setUTCFullYear(targetYear, normalizedMonth, targetDay);
  return result;
}

export const INJURY_RULES = [
  {
    group: 'lower_back',
    keywords: ['lower back', 'back', 'spine', 'lumbar', 'sciatica'],
    excludedExerciseNames: [
      'deadlift',
      'deadlifts',
      'romanian deadlift',
      'romanian deadlifts',
      'barbell row',
      'barbell rows',
      'bent over row',
      'squat',
      'squats',
      'barbell squat',
      'good morning',
      'good mornings',
    ],
  },
  {
    group: 'shoulder',
    keywords: ['shoulder', 'shoulders', 'rotator', 'rotator cuff', 'impingement'],
    excludedExerciseNames: [
      'overhead press',
      'overhead presses',
      'dumbbell seated shoulder press',
      'shoulder press',
      'military press',
      'upright row',
      'upright rows',
      'arnold press',
    ],
  },
  {
    group: 'knee',
    keywords: ['knee', 'knees'],
    excludedExerciseNames: [
      'squat',
      'squats',
      'dumbbell reverse lunge',
      'lunge',
      'lunges',
      'walking lunge',
      'leg extension',
      'leg extensions',
      'jumping',
      'jump squats',
      'plyometrics',
      'box jumps',
    ],
  },
  {
    group: 'wrist',
    keywords: ['wrist', 'wrists'],
    excludedExerciseNames: [
      'push-up',
      'push-ups',
      'push up',
      'barbell curl',
      'barbell curls',
      'front squat',
      'front squats',
    ],
  },
  {
    group: 'elbow',
    keywords: ['elbow', 'elbows'],
    excludedExerciseNames: [
      'skull crusher',
      'skull crushers',
      'dumbbell skull crusher',
      'tricep dip',
      'tricep dips',
      'dips',
      'close-grip bench press',
      'close-grip pressing',
    ],
  },
  {
    group: 'neck',
    keywords: ['neck'],
    excludedExerciseNames: [
      'overhead press',
      'overhead presses',
      'shrug',
      'shrugs',
      'barbell shrug',
      'dumbbell shrug',
    ],
  },
  {
    group: 'hip',
    keywords: ['hip', 'hips'],
    excludedExerciseNames: [
      'squat',
      'squats',
      'deadlift',
      'deadlifts',
      'lunge',
      'lunges',
      'dumbbell reverse lunge',
    ],
  },
  {
    group: 'ankle',
    keywords: ['ankle', 'ankles'],
    excludedExerciseNames: [
      'jumping',
      'jump squats',
      'box jumps',
      'calf raise',
      'calf raises',
      'standing calf raise',
      'lunge',
      'lunges',
    ],
  },
];

export const BEGINNER_EXCLUDED_EXERCISES = [
  'barbell squat',
  'barbell squats',
  'romanian deadlift',
  'romanian deadlifts',
  'pull-up',
  'pull-ups',
  'pull up',
  'tricep dip',
  'tricep dips',
  'skull crusher',
  'skull crushers',
  'dumbbell skull crusher',
];

export function scanLimitations(limitations?: string): {
  matchedGroups: string[];
  excludedNames: string[];
  unmatched: string[];
} {
  if (!limitations || !limitations.trim()) {
    return { matchedGroups: [], excludedNames: [], unmatched: [] };
  }

  const text = limitations.toLowerCase();
  const matchedGroups: string[] = [];
  const excludedNamesSet = new Set<string>();

  for (const rule of INJURY_RULES) {
    const hasMatch = rule.keywords.some((kw) => {
      const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return regex.test(text);
    });

    if (hasMatch) {
      matchedGroups.push(rule.group);
      rule.excludedExerciseNames.forEach((name) => excludedNamesSet.add(name.toLowerCase()));
    }
  }

  const clauses = limitations
    .split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const unmatched: string[] = [];
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const matchesAny = INJURY_RULES.some((rule) =>
      rule.keywords.some((kw) => {
        const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
        return regex.test(lower);
      }),
    );
    if (!matchesAny) {
      unmatched.push(clause);
    }
  }

  return {
    matchedGroups,
    excludedNames: Array.from(excludedNamesSet),
    unmatched,
  };
}

export function isExerciseAllowed(
  exercise: { name: string; equipment: string; level_min?: string },
  location: 'home' | 'basic_gym' | 'advanced_gym',
  experience: 'beginner' | 'intermediate' | 'experienced',
  excludedNames: string[],
): boolean {
  const normName = exercise.name.toLowerCase();

  if (excludedNames.some((exc) => normName.includes(exc) || exc.includes(normName))) {
    return false;
  }

  if (
    experience === 'beginner' &&
    BEGINNER_EXCLUDED_EXERCISES.some((exc) => normName.includes(exc) || exc.includes(normName))
  ) {
    return false;
  }

  const eq = exercise.equipment.toLowerCase();
  if (location === 'home') return eq === 'bodyweight';
  if (location === 'basic_gym')
    return ['bodyweight', 'dumbbell', 'barbell', 'band', 'bench'].includes(eq);
  return true;
}

export const WORKOUT_MASTER_LIBRARY = [
  // Chest
  {
    id: 'ex-push-up',
    name: 'Push-Up',
    primary_muscle: 'chest',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-incline-push-up',
    name: 'Incline Push-Up',
    primary_muscle: 'chest',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-bench-press',
    name: 'Dumbbell Bench Press',
    primary_muscle: 'chest',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-incline-press',
    name: 'Incline Dumbbell Press',
    primary_muscle: 'chest',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-bb-bench-press',
    name: 'Barbell Bench Press',
    primary_muscle: 'chest',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-bb-incline-press',
    name: 'Incline Bench Press',
    primary_muscle: 'chest',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-cable-crossover',
    name: 'Cable Crossover',
    primary_muscle: 'chest',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-machine-chest-press',
    name: 'Seated Chest Press',
    primary_muscle: 'chest',
    equipment: 'machine',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-pec-deck',
    name: 'Pec Deck Machine',
    primary_muscle: 'chest',
    equipment: 'machine',
    level_min: 'beginner',
    is_compound: false,
  },

  // Shoulders
  {
    id: 'ex-db-shoulder-press',
    name: 'Dumbbell Seated Shoulder Press',
    primary_muscle: 'shoulders',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    primary_muscle: 'shoulders',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-db-front-raise',
    name: 'Dumbbell Front Raise',
    primary_muscle: 'shoulders',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-arnold-press',
    name: 'Arnold Press',
    primary_muscle: 'shoulders',
    equipment: 'dumbbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-bb-overhead-press',
    name: 'Overhead Press',
    primary_muscle: 'shoulders',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-band-face-pull',
    name: 'Band Face Pull',
    primary_muscle: 'shoulders',
    equipment: 'band',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-cable-lateral-raise',
    name: 'Cable Lateral Raise',
    primary_muscle: 'shoulders',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: false,
  },

  // Back
  {
    id: 'ex-band-seated-row',
    name: 'Band Seated Row',
    primary_muscle: 'back',
    equipment: 'band',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-band-pull-apart',
    name: 'Band Pull-Apart',
    primary_muscle: 'back',
    equipment: 'band',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-db-single-arm-row',
    name: 'Dumbbell Single-Arm Row',
    primary_muscle: 'back',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-pull-up',
    name: 'Pull-Up',
    primary_muscle: 'back',
    equipment: 'bodyweight',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-bb-row',
    name: 'Barbell Row',
    primary_muscle: 'back',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-deadlift',
    name: 'Deadlift',
    primary_muscle: 'back',
    equipment: 'barbell',
    level_min: 'experienced',
    is_compound: true,
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Lat Pulldown',
    primary_muscle: 'back',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-cable-seated-row',
    name: 'Cable Seated Row',
    primary_muscle: 'back',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: true,
  },

  // Legs
  {
    id: 'ex-bodyweight-squat',
    name: 'Bodyweight Squat',
    primary_muscle: 'legs',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-goblet-squat',
    name: 'Dumbbell Goblet Squat',
    primary_muscle: 'legs',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-reverse-lunge',
    name: 'Dumbbell Reverse Lunge',
    primary_muscle: 'legs',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-walking-lunge',
    name: 'Dumbbell Walking Lunge',
    primary_muscle: 'legs',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-db-step-up',
    name: 'Dumbbell Step-Up',
    primary_muscle: 'legs',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-bb-squat',
    name: 'Barbell Squat',
    primary_muscle: 'legs',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-romanian-deadlift',
    name: 'Romanian Deadlift',
    primary_muscle: 'legs',
    equipment: 'barbell',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-leg-press',
    name: 'Leg Press',
    primary_muscle: 'legs',
    equipment: 'machine',
    level_min: 'beginner',
    is_compound: true,
  },
  {
    id: 'ex-leg-extension',
    name: 'Leg Extension',
    primary_muscle: 'legs',
    equipment: 'machine',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-standing-calf-raise',
    name: 'Standing Calf Raise',
    primary_muscle: 'legs',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: false,
  },

  // Arms
  {
    id: 'ex-db-bicep-curl',
    name: 'Dumbbell Bicep Curl',
    primary_muscle: 'arms',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-db-hammer-curl',
    name: 'Dumbbell Hammer Curl',
    primary_muscle: 'arms',
    equipment: 'dumbbell',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-db-skull-crusher',
    name: 'Dumbbell Skull Crusher',
    primary_muscle: 'arms',
    equipment: 'dumbbell',
    level_min: 'intermediate',
    is_compound: false,
  },
  {
    id: 'ex-tricep-dips',
    name: 'Tricep Dips',
    primary_muscle: 'arms',
    equipment: 'bodyweight',
    level_min: 'intermediate',
    is_compound: true,
  },
  {
    id: 'ex-cable-tricep-pushdown',
    name: 'Cable Tricep Pushdown',
    primary_muscle: 'arms',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-cable-bicep-curl',
    name: 'Cable Bicep Curl',
    primary_muscle: 'arms',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: false,
  },

  // Core
  {
    id: 'ex-plank',
    name: 'Plank',
    primary_muscle: 'core',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-dead-bug',
    name: 'Dead Bug',
    primary_muscle: 'core',
    equipment: 'bodyweight',
    level_min: 'beginner',
    is_compound: false,
  },
  {
    id: 'ex-hanging-knee-raise',
    name: 'Hanging Knee Raise',
    primary_muscle: 'core',
    equipment: 'bodyweight',
    level_min: 'intermediate',
    is_compound: false,
  },
  {
    id: 'ex-cable-woodchopper',
    name: 'Cable Woodchopper',
    primary_muscle: 'core',
    equipment: 'cable',
    level_min: 'beginner',
    is_compound: false,
  },
];

export function resolveEffectiveSplit(
  split: 'ppl' | 'upper_lower' | 'full_body' | 'body_part' | 'auto',
  daysCount: number,
): 'ppl' | 'upper_lower' | 'full_body' | 'body_part' {
  if (daysCount === 1) return 'full_body';
  if (split !== 'auto') return split;
  if (daysCount <= 2) return 'full_body';
  if (daysCount === 3 || daysCount === 6) return 'ppl';
  if (daysCount === 4) return 'upper_lower';
  return 'body_part';
}

export function getSplitDayTemplates(
  split: 'ppl' | 'upper_lower' | 'full_body' | 'body_part',
  daysCount: number,
): Array<{ title: string; muscles: string[] }> {
  if (daysCount === 1) {
    return [
      { title: 'Full Body', muscles: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] },
    ];
  }

  if (split === 'ppl') {
    const cycle = [
      { title: 'Push Day', muscles: ['chest', 'shoulders', 'arms'] },
      { title: 'Pull Day', muscles: ['back', 'arms', 'core'] },
      { title: 'Legs Day', muscles: ['legs', 'core'] },
    ];
    const result: Array<{ title: string; muscles: string[] }> = [];
    for (let i = 0; i < daysCount; i++) {
      const base = cycle[i % 3]!;
      const suffix = daysCount > 3 ? (Math.floor(i / 3) === 0 ? ' A' : ' B') : '';
      result.push({ title: `${base.title}${suffix}`, muscles: base.muscles });
    }
    return result;
  }

  if (split === 'upper_lower') {
    if (daysCount === 4) {
      return [
        { title: 'Upper Body Strength', muscles: ['chest', 'back', 'shoulders', 'arms'] },
        { title: 'Lower Body and Core', muscles: ['legs', 'core'] },
        { title: 'Upper Body Volume', muscles: ['chest', 'back', 'shoulders', 'arms'] },
        { title: 'Lower Body and Arms', muscles: ['legs', 'arms', 'core'] },
      ];
    }
    const result: Array<{ title: string; muscles: string[] }> = [];
    for (let i = 0; i < daysCount; i++) {
      const isUpper = i % 2 === 0;
      const letter = String.fromCharCode(65 + Math.floor(i / 2));
      result.push({
        title: `${isUpper ? 'Upper Body' : 'Lower Body'} ${letter}`,
        muscles: isUpper ? ['chest', 'back', 'shoulders', 'arms'] : ['legs', 'core'],
      });
    }
    return result;
  }

  if (split === 'full_body') {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const result: Array<{ title: string; muscles: string[] }> = [];
    for (let i = 0; i < daysCount; i++) {
      result.push({
        title: `Full Body ${letters[i] || ''}`.trim(),
        muscles: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
      });
    }
    return result;
  }

  // body_part
  if (daysCount === 5) {
    return [
      { title: 'Chest Day', muscles: ['chest'] },
      { title: 'Back Day', muscles: ['back'] },
      { title: 'Shoulders Day', muscles: ['shoulders'] },
      { title: 'Arms Day', muscles: ['arms'] },
      { title: 'Legs Day', muscles: ['legs'] },
    ];
  }
  if (daysCount === 4) {
    return [
      { title: 'Chest Day', muscles: ['chest'] },
      { title: 'Back Day', muscles: ['back'] },
      { title: 'Shoulders and Arms', muscles: ['shoulders', 'arms'] },
      { title: 'Legs Day', muscles: ['legs'] },
    ];
  }
  if (daysCount === 3) {
    return [
      { title: 'Chest and Triceps', muscles: ['chest', 'arms'] },
      { title: 'Back and Biceps', muscles: ['back', 'arms'] },
      { title: 'Legs and Shoulders', muscles: ['legs', 'shoulders'] },
    ];
  }
  if (daysCount === 2) {
    return [
      { title: 'Upper Body', muscles: ['chest', 'back', 'shoulders', 'arms'] },
      { title: 'Lower Body', muscles: ['legs', 'core'] },
    ];
  }
  return [
    { title: 'Chest Day', muscles: ['chest'] },
    { title: 'Back Day', muscles: ['back'] },
    { title: 'Shoulders Day', muscles: ['shoulders'] },
    { title: 'Arms Day', muscles: ['arms'] },
    { title: 'Legs Day', muscles: ['legs'] },
    { title: 'Core and Conditioning', muscles: ['core'] },
  ];
}

export function generateWorkoutPlan(inputs: AiWorkoutInputs): GeneratedWorkoutPlan {
  const {
    days_per_week,
    training_days,
    session_minutes,
    split,
    experience,
    location,
    limitations,
    workout_notes,
  } = inputs;

  const targetExercisesPerDay = EXERCISE_COUNTS_BY_MINUTES[session_minutes] ?? 4;
  const { excludedNames, unmatched } = scanLimitations(limitations);
  const effectiveSplit = resolveEffectiveSplit(split, days_per_week);
  const dayTemplates = getSplitDayTemplates(effectiveSplit, days_per_week);

  const candidateExercises = WORKOUT_MASTER_LIBRARY.filter((ex) =>
    isExerciseAllowed(ex, location, experience, excludedNames),
  );

  const usedInPlan = new Set<string>();
  const weekdays = [1, 2, 3, 4, 5, 6, 7];
  const sortedTrainingDays = [...training_days].sort((a, b) => a - b);
  let templateIdx = 0;

  const days: GeneratedPlanDay[] = weekdays.map((weekday) => {
    const isTraining = sortedTrainingDays.includes(weekday);
    if (!isTraining) {
      return {
        weekday,
        is_rest: true,
        name: 'Rest day',
        exercises: [],
        about_minutes: 0,
      };
    }

    const template = dayTemplates[templateIdx % dayTemplates.length]!;
    templateIdx++;

    const dayPool = candidateExercises.filter((ex) => template.muscles.includes(ex.primary_muscle));
    const backupPool = candidateExercises;

    const chosen: typeof WORKOUT_MASTER_LIBRARY = [];
    const compounds = dayPool.filter((e) => e.is_compound);
    const isolations = dayPool.filter((e) => !e.is_compound);

    for (const ex of [...compounds, ...isolations]) {
      if (chosen.length >= targetExercisesPerDay) break;
      if (!chosen.some((c) => c.id === ex.id) && !usedInPlan.has(ex.id)) {
        chosen.push(ex);
        usedInPlan.add(ex.id);
      }
    }

    if (chosen.length < targetExercisesPerDay) {
      for (const ex of dayPool) {
        if (chosen.length >= targetExercisesPerDay) break;
        if (!chosen.some((c) => c.id === ex.id)) {
          chosen.push(ex);
        }
      }
    }

    if (chosen.length < targetExercisesPerDay) {
      for (const ex of backupPool) {
        if (chosen.length >= targetExercisesPerDay) break;
        if (!chosen.some((c) => c.id === ex.id)) {
          chosen.push(ex);
        }
      }
    }

    const exercises: GeneratedPlanExercise[] = chosen.map((ex) => {
      let target_sets = 3;
      let target_reps = 10;
      if (experience === 'beginner') {
        target_sets = 3;
        target_reps = 10;
      } else if (experience === 'intermediate') {
        target_sets = ex.is_compound ? 4 : 3;
        target_reps = ex.is_compound ? 8 : 10;
      } else {
        target_sets = ex.is_compound ? 4 : 3;
        target_reps = ex.is_compound ? 6 : 10;
      }

      if (
        workout_notes &&
        /no heavy leg days/i.test(workout_notes) &&
        ex.primary_muscle === 'legs'
      ) {
        target_sets = 3;
        target_reps = Math.max(target_reps, 12);
      }

      const rest_seconds = ex.is_compound ? 90 : 60;

      return {
        id: ex.id,
        name: ex.name,
        primary_muscle: ex.primary_muscle,
        equipment: ex.equipment,
        target_sets,
        target_reps,
        target_weight_kg: null,
        rest_seconds,
        is_compound: ex.is_compound,
      };
    });

    return {
      weekday,
      is_rest: false,
      name: template.title,
      exercises,
      about_minutes: session_minutes,
    };
  });

  return {
    name: `${split.toUpperCase().replace('_', ' ')} Weekly Plan`,
    source: 'ai',
    ai_inputs: inputs,
    days,
    excluded: excludedNames,
    unmatched_limitations: unmatched,
  };
}

export function validateGeneratedWorkoutPlan(
  plan: GeneratedWorkoutPlan,
  inputs: AiWorkoutInputs,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const trainingDays = plan.days.filter((d) => !d.is_rest);
  if (trainingDays.length !== inputs.days_per_week) {
    errors.push(`Expected ${inputs.days_per_week} training days, got ${trainingDays.length}`);
  }

  const expectedWeekdays = new Set(inputs.training_days);
  for (const d of trainingDays) {
    if (!expectedWeekdays.has(d.weekday)) {
      errors.push(`Day ${d.weekday} was not in user's selected training days`);
    }
  }

  const targetCount = EXERCISE_COUNTS_BY_MINUTES[inputs.session_minutes];
  const { excludedNames } = scanLimitations(inputs.limitations);

  for (const d of trainingDays) {
    if (d.exercises.length !== targetCount) {
      errors.push(
        `Day ${d.name} (${d.weekday}) has ${d.exercises.length} exercises, expected ${targetCount}`,
      );
    }

    const ids = d.exercises.map((e) => e.id);
    if (new Set(ids).size !== ids.length) {
      errors.push(`Day ${d.name} has duplicate exercises`);
    }

    for (const e of d.exercises) {
      if (!isExerciseAllowed(e, inputs.location, inputs.experience, excludedNames)) {
        errors.push(
          `Exercise ${e.name} on day ${d.name} violates equipment, experience or injury restrictions`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
