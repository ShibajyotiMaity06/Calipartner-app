import { getSupabase } from '@/lib/supabase';
import {
  type AiWorkoutInputs,
  type GeneratedWorkoutPlan,
  type GeneratedPlanDay,
  generateWorkoutPlan,
  validateGeneratedWorkoutPlan,
  addCooldownMonths,
} from '@calipartner/core';

export interface WorkoutEligibilityResponse {
  eligible: boolean;
  reason: 'age' | 'health' | 'profile_incomplete' | 'cooldown' | 'pro_required' | null;
  state: 'never' | 'locked' | 'ready';
  next_available_at: string | null;
  previews_used: number;
  projected_next_available_at: string | null;
}

export interface WorkoutSettings {
  weight_unit: 'kg' | 'lbs';
  rest_timer_sound: boolean;
  rest_timer_vibrate: boolean;
  auto_start_rest_timer: boolean;
  keep_screen_awake: boolean;
  next_rebuild_available_at?: string | null;
}

export interface SessionSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number | null;
  completed: boolean;
  completed_at?: string | null;
  previous_performance?: string;
}

export interface SessionExercise {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name: string;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  sets: SessionSet[];
}

export interface ActiveWorkoutSession {
  id: string;
  name: string;
  local_date: string;
  status: 'in_progress' | 'completed' | 'discarded';
  started_at: string;
  ended_at?: string | null;
  effort?: number | null;
  plan_day_id?: string | null;
  exercises: SessionExercise[];
}

export interface ActivityLogItem {
  id: string;
  user_id: string;
  activity_name: string;
  duration_minutes: number;
  calories_burned?: number | null;
  local_date: string;
  notes?: string | null;
  created_at: string;
}

export interface PersonalBestItem {
  exercise_name: string;
  weight_kg: number;
  reps: number;
  achieved_at: string;
  gain_kg?: number;
}

// In-memory fallback / cache for fast offline resilience
let localSettings: WorkoutSettings = {
  weight_unit: 'kg',
  rest_timer_sound: true,
  rest_timer_vibrate: true,
  auto_start_rest_timer: true,
  keep_screen_awake: true,
};

let inMemoryActiveSession: ActiveWorkoutSession | null = null;
const inMemoryCompletedSessions: ActiveWorkoutSession[] = [];

export const workoutRedesignService = {
  async fetchEligibility(): Promise<WorkoutEligibilityResponse> {
    const supabase = getSupabase();
    try {
      const { data, error } =
        await supabase.functions.invoke<WorkoutEligibilityResponse>('workout-ai-eligibility');
      if (error || !data) {
        // Fallback check against user profile and ai_plan_state
        return this.fallbackEligibilityCheck();
      }
      return data;
    } catch {
      return this.fallbackEligibilityCheck();
    }
  },

  async fallbackEligibilityCheck(): Promise<WorkoutEligibilityResponse> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return {
        eligible: false,
        reason: 'profile_incomplete',
        state: 'never',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    // shibajyoti.maity06@gmail.com bypass: never blocked by cooldown or test profile incompleteness
    if (user.email === 'shibajyoti.maity06@gmail.com') {
      return {
        eligible: true,
        reason: null,
        state: 'ready',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    // Check Pro entitlement for AI workout plans
    const { data: ent } = await supabase
      .from('entitlements')
      .select('tier, status, period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    const isPro = Boolean(
      ent &&
      ent.tier === 'pro' &&
      (ent.status === 'active' ||
        (ent.status === 'trial' &&
          (!ent.period_end || new Date(ent.period_end).getTime() > Date.now())) ||
        (ent.period_end && new Date(ent.period_end).getTime() > Date.now())),
    );

    if (!isPro) {
      return {
        eligible: false,
        reason: 'pro_required',
        state: 'locked',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('date_of_birth, is_pregnant, is_breastfeeding, medical_flags')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.date_of_birth) {
      return {
        eligible: false,
        reason: 'profile_incomplete',
        state: 'never',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    const birthDate = new Date(profile.date_of_birth);
    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
      age--;
    }

    if (age < 18) {
      return {
        eligible: false,
        reason: 'age',
        state: 'never',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    if (
      profile.is_pregnant ||
      profile.is_breastfeeding ||
      (profile.medical_flags && profile.medical_flags.length > 0)
    ) {
      return {
        eligible: false,
        reason: 'health',
        state: 'never',
        next_available_at: null,
        previews_used: 0,
        projected_next_available_at: null,
      };
    }

    const { data: aiState } = await supabase
      .from('ai_plan_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!aiState || !aiState.next_available_at) {
      return {
        eligible: true,
        reason: null,
        state: 'never',
        next_available_at: null,
        previews_used: aiState?.previews_used || 0,
        projected_next_available_at: null,
      };
    }

    const nextAvailable = new Date(aiState.next_available_at);
    if (nextAvailable.getTime() > now.getTime()) {
      return {
        eligible: false,
        reason: 'cooldown',
        state: 'locked',
        next_available_at: aiState.next_available_at,
        previews_used: aiState.previews_used || 0,
        projected_next_available_at: null,
      };
    }

    return {
      eligible: true,
      reason: null,
      state: 'ready',
      next_available_at: aiState.next_available_at,
      previews_used: aiState.previews_used || 0,
      projected_next_available_at: null,
    };
  },

  async generateAiPlan(
    inputs: AiWorkoutInputs,
    finalConfirmed: boolean = false,
  ): Promise<{
    draft_id: string;
    plan: GeneratedWorkoutPlan;
    excluded?: string[];
    unmatched_limitations?: string[];
  }> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.functions.invoke<{
        draft_id: string;
        plan: GeneratedWorkoutPlan;
        excluded?: string[];
        unmatched_limitations?: string[];
        code?: string;
      }>('workout-ai-generate', {
        body: { ai_inputs: inputs, final_confirmed: finalConfirmed },
      });

      if (error || !data) {
        const errorMsg = error?.message || '';
        if (
          errorMsg.includes('pro_required') ||
          (data as { reason?: string })?.reason === 'pro_required'
        ) {
          throw new Error('AI workout plans require CaliPartner Pro.');
        }
        throw new Error(errorMsg || 'AI Plan generation failed');
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Pro') || msg.includes('pro_required')) {
        throw err;
      }
      // Verify user has Pro access before doing local generation
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user && user.email !== 'shibajyoti.maity06@gmail.com') {
        const { data: ent } = await supabase
          .from('entitlements')
          .select('tier, status, period_end')
          .eq('user_id', user.id)
          .maybeSingle();

        const isPro = Boolean(
          ent &&
          ent.tier === 'pro' &&
          (ent.status === 'active' ||
            (ent.status === 'trial' &&
              (!ent.period_end || new Date(ent.period_end).getTime() > Date.now())) ||
            (ent.period_end && new Date(ent.period_end).getTime() > Date.now())),
        );

        if (!isPro) {
          throw new Error('AI workout plans require CaliPartner Pro.');
        }
      }

      // Local pure fallback generation for entitled users
      const plan = generateWorkoutPlan(inputs);
      const validation = validateGeneratedWorkoutPlan(plan, inputs);
      if (!validation.valid) {
        throw new Error(`Generation validation failed: ${validation.errors.join(', ')}`);
      }
      return {
        draft_id: crypto.randomUUID(),
        plan,
        excluded: plan.excluded,
        unmatched_limitations: plan.unmatched_limitations,
      };
    }
  },

  async confirmAiPlan(
    draftId: string,
    planFallback?: GeneratedWorkoutPlan,
  ): Promise<{ plan: GeneratedWorkoutPlan; next_available_at: string }> {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.functions.invoke<{
        plan: GeneratedWorkoutPlan;
        next_available_at: string;
      }>('workout-ai-confirm', {
        body: { draft_id: draftId },
      });

      if (error || !data) {
        throw new Error(error?.message || 'Confirmation failed');
      }
      return data;
    } catch (err) {
      if (planFallback) {
        await this.saveCustomPlan(
          planFallback.name,
          planFallback.days,
          'ai',
          planFallback.ai_inputs,
        );
        const cooldown = addCooldownMonths(new Date()).toISOString();
        return { plan: planFallback, next_available_at: cooldown };
      }
      throw err;
    }
  },

  async fetchWorkoutSettings(): Promise<WorkoutSettings> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return localSettings;

    const { data } = await supabase
      .from('workout_settings')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (data) {
      localSettings = {
        weight_unit: data.weight_unit || 'kg',
        rest_timer_sound: data.rest_timer_sound !== false,
        rest_timer_vibrate: data.rest_timer_vibrate !== false,
        auto_start_rest_timer: data.auto_start_rest_timer !== false,
        keep_screen_awake: data.keep_screen_awake !== false,
      };
    }
    return localSettings;
  },

  async updateWorkoutSettings(updates: Partial<WorkoutSettings>): Promise<WorkoutSettings> {
    localSettings = { ...localSettings, ...updates };
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return localSettings;

    await supabase.from('workout_settings').upsert({
      user_id: authData.user.id,
      weight_unit: localSettings.weight_unit,
      rest_timer_sound: localSettings.rest_timer_sound,
      rest_timer_vibrate: localSettings.rest_timer_vibrate,
      auto_start_rest_timer: localSettings.auto_start_rest_timer,
      keep_screen_awake: localSettings.keep_screen_awake,
      updated_at: new Date().toISOString(),
    });

    return localSettings;
  },

  async fetchActivePlan(): Promise<GeneratedWorkoutPlan | null> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    const { data: planData } = await supabase
      .from('user_workout_plans')
      .select('id, name, source, ai_inputs, status')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!planData) return null;

    const { data: daysData } = await supabase
      .from('plan_days')
      .select('id, weekday, is_rest, name')
      .eq('plan_id', planData.id)
      .order('weekday');

    if (!daysData || daysData.length === 0) return null;

    const dayIds = daysData.map((d) => d.id);
    const { data: exercisesData } = await supabase
      .from('plan_exercises')
      .select(
        'id, plan_day_id, exercise_id, exercise_name, position, target_sets, target_reps, target_weight_kg, rest_seconds',
      )
      .in('plan_day_id', dayIds)
      .order('position');

    const days: GeneratedPlanDay[] = daysData.map((day) => {
      const exList = (exercisesData || [])
        .filter((e) => e.plan_day_id === day.id)
        .map((e) => ({
          id: e.exercise_id || e.id,
          name: e.exercise_name,
          primary_muscle: 'general',
          equipment: 'bodyweight',
          target_sets: e.target_sets || 3,
          target_reps: e.target_reps || 10,
          target_weight_kg: e.target_weight_kg,
          rest_seconds: e.rest_seconds || 60,
          is_compound: false,
        }));

      return {
        weekday: day.weekday,
        is_rest: day.is_rest,
        name: day.name,
        exercises: exList,
        about_minutes: 60,
      };
    });

    return {
      name: planData.name,
      source: planData.source as 'ai' | 'custom',
      ai_inputs: planData.ai_inputs,
      days,
      excluded: [],
      unmatched_limitations: [],
    };
  },

  async saveCustomPlan(
    name: string,
    days: GeneratedPlanDay[],
    source: 'custom' | 'ai' = 'custom',
    ai_inputs?: AiWorkoutInputs,
  ): Promise<GeneratedWorkoutPlan> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error('Not authenticated');
    const userId = authData.user.id;

    // Archive existing active plans
    await supabase
      .from('user_workout_plans')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    const planId = crypto.randomUUID();
    const { data: planRow, error: planError } = await supabase
      .from('user_workout_plans')
      .insert({
        id: planId,
        user_id: userId,
        name,
        source,
        ai_inputs: ai_inputs || null,
        status: 'active',
      })
      .select()
      .single();

    if (planError || !planRow) {
      throw new Error(planError?.message || 'Could not save plan');
    }

    for (const d of days) {
      const dayId = crypto.randomUUID();
      const { data: dayRow, error: dayError } = await supabase
        .from('plan_days')
        .insert({
          id: dayId,
          plan_id: planRow.id,
          user_id: userId,
          weekday: d.weekday,
          is_rest: d.is_rest,
          name: d.name,
        })
        .select()
        .single();

      if (dayError || !dayRow) continue;

      if (!d.is_rest && d.exercises.length > 0) {
        const exercisesToInsert = d.exercises.map((ex, idx) => ({
          id: crypto.randomUUID(),
          plan_day_id: dayRow.id,
          exercise_id: ex.id && !ex.id.startsWith('draft') ? ex.id : null,
          exercise_name: ex.name,
          position: idx + 1,
          target_sets: ex.target_sets || 3,
          target_reps: ex.target_reps || 10,
          target_weight_kg: ex.target_weight_kg || null,
          rest_seconds: ex.rest_seconds || 60,
        }));

        await supabase.from('plan_exercises').insert(exercisesToInsert);
      }
    }

    return {
      name,
      source,
      ai_inputs,
      days,
      excluded: [],
      unmatched_limitations: [],
    };
  },

  async fetchActiveSession(): Promise<ActiveWorkoutSession | null> {
    if (inMemoryActiveSession && inMemoryActiveSession.status === 'in_progress') {
      return inMemoryActiveSession;
    }

    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    const { data: workout } = await supabase
      .from('workouts')
      .select('id, name, local_date, status, started_at, effort, plan_day_id')
      .eq('user_id', authData.user.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .maybeSingle();

    if (!workout || workout.status !== 'in_progress') return null;

    const { data: wExercises } = await supabase
      .from('workout_exercises')
      .select(
        'id, exercise_id, exercise_name, position, target_sets, target_reps, target_weight_kg, rest_seconds',
      )
      .eq('workout_id', workout.id)
      .order('position');

    const exerciseIds = (wExercises || []).map((e) => e.id);
    const { data: wSets } = await supabase
      .from('workout_sets')
      .select('id, workout_exercise_id, set_number, reps, weight_kg, completed, completed_at')
      .in('workout_exercise_id', exerciseIds)
      .order('set_number');

    const exercises: SessionExercise[] = (wExercises || []).map((we) => {
      const sets: SessionSet[] = (wSets || [])
        .filter((s) => s.workout_exercise_id === we.id)
        .map((s) => ({
          id: s.id,
          workout_exercise_id: s.workout_exercise_id,
          set_number: s.set_number,
          reps: s.reps ?? we.target_reps ?? 10,
          weight_kg: s.weight_kg ?? we.target_weight_kg ?? null,
          completed: !!s.completed,
          completed_at: s.completed_at,
        }));

      return {
        id: we.id,
        workout_id: workout.id,
        exercise_id: we.exercise_id,
        exercise_name: we.exercise_name,
        position: we.position,
        target_sets: we.target_sets || 3,
        target_reps: we.target_reps || 10,
        target_weight_kg: we.target_weight_kg,
        rest_seconds: we.rest_seconds || 60,
        sets,
      };
    });

    inMemoryActiveSession = {
      id: workout.id,
      name: workout.name || 'Workout',
      local_date: workout.local_date,
      status: 'in_progress',
      started_at: workout.started_at,
      plan_day_id: workout.plan_day_id,
      exercises,
    };

    return inMemoryActiveSession;
  },

  async startSession(day: GeneratedPlanDay, localDate: string): Promise<ActiveWorkoutSession> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000001';

    const workoutId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const sessionExercises: SessionExercise[] = day.exercises.map((ex, idx) => {
      const weId = crypto.randomUUID();
      const sets: SessionSet[] = [];
      for (let s = 1; s <= ex.target_sets; s++) {
        sets.push({
          id: crypto.randomUUID(),
          workout_exercise_id: weId,
          set_number: s,
          reps: ex.target_reps,
          weight_kg: ex.target_weight_kg,
          completed: false,
        });
      }
      return {
        id: weId,
        workout_id: workoutId,
        exercise_id: ex.id,
        exercise_name: ex.name,
        position: idx + 1,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight_kg: ex.target_weight_kg,
        rest_seconds: ex.rest_seconds,
        sets,
      };
    });

    const activeSession: ActiveWorkoutSession = {
      id: workoutId,
      name: day.name,
      local_date: localDate,
      status: 'in_progress',
      started_at: startedAt,
      exercises: sessionExercises,
    };

    inMemoryActiveSession = activeSession;

    // Remote persistence
    try {
      if (authData?.user) {
        await supabase.from('workouts').insert({
          id: workoutId,
          user_id: userId,
          type: 'strength',
          name: day.name,
          local_date: localDate,
          status: 'in_progress',
          start_time: startedAt,
          started_at: startedAt,
          duration_minutes: 0,
        });

        for (const se of sessionExercises) {
          await supabase.from('workout_exercises').insert({
            id: se.id,
            workout_id: workoutId,
            user_id: userId,
            exercise_id:
              se.exercise_id && !se.exercise_id.startsWith('draft') ? se.exercise_id : null,
            exercise_name: se.exercise_name,
            position: se.position,
            order_in_workout: se.position,
            target_sets: se.target_sets,
            target_reps: se.target_reps,
            target_weight_kg: se.target_weight_kg,
            rest_seconds: se.rest_seconds,
          });

          const setsToInsert = se.sets.map((s) => ({
            id: s.id,
            workout_exercise_id: se.id,
            workout_id: workoutId,
            user_id: userId,
            set_number: s.set_number,
            reps: s.reps,
            weight_kg: s.weight_kg,
            completed: false,
          }));
          await supabase.from('workout_sets').insert(setsToInsert);
        }
      }
    } catch {
      // Offline fallback succeeds in memory
    }

    return activeSession;
  },

  async tickSet(
    setId: string,
    completed: boolean,
    actualReps?: number,
    actualWeightKg?: number,
  ): Promise<void> {
    if (inMemoryActiveSession) {
      for (const ex of inMemoryActiveSession.exercises) {
        const s = ex.sets.find((set) => set.id === setId);
        if (s) {
          s.completed = completed;
          s.completed_at = completed ? new Date().toISOString() : null;
          if (actualReps !== undefined) s.reps = actualReps;
          if (actualWeightKg !== undefined) s.weight_kg = actualWeightKg;
          break;
        }
      }
    }

    const supabase = getSupabase();
    try {
      await supabase
        .from('workout_sets')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          reps: actualReps,
          weight_kg: actualWeightKg,
        })
        .eq('id', setId);
    } catch {
      // offline resilience
    }
  },

  async finishSession(
    workoutId: string,
    effort: number,
    _useWeightsNextTime: boolean,
  ): Promise<void> {
    const endedAt = new Date().toISOString();
    const effortString: 'easy' | 'good' | 'hard' | 'max' =
      effort <= 4 ? 'easy' : effort <= 7 ? 'good' : effort <= 9 ? 'hard' : 'max';

    if (inMemoryActiveSession && inMemoryActiveSession.id === workoutId) {
      inMemoryActiveSession.status = 'completed';
      inMemoryActiveSession.ended_at = endedAt;
      inMemoryActiveSession.effort = effort;
      inMemoryCompletedSessions.unshift({ ...inMemoryActiveSession });
    }

    const supabase = getSupabase();
    try {
      await supabase
        .from('workouts')
        .update({
          status: 'completed',
          ended_at: endedAt,
          effort: effortString,
          effort_rating: effort,
        })
        .eq('id', workoutId);

      // Check personal bests & update plan weights if requested
      if (inMemoryActiveSession) {
        for (const ex of inMemoryActiveSession.exercises) {
          for (const s of ex.sets) {
            if (s.completed && s.weight_kg && s.weight_kg > 0) {
              await this.recordPersonalBest(ex.exercise_name, s.weight_kg, s.reps);
            }
          }
        }
      }
    } catch {
      // resilience
    }
  },

  async logCompletedStrengthExercise(
    exerciseName: string,
    setsCount: number,
    reps: number,
    weightKg: number | null,
    localDate: string,
  ): Promise<void> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000001';
    const workoutId = crypto.randomUUID();
    const weId = crypto.randomUUID();
    const now = new Date().toISOString();

    const sets: SessionSet[] = [];
    for (let i = 1; i <= setsCount; i++) {
      sets.push({
        id: crypto.randomUUID(),
        workout_exercise_id: weId,
        set_number: i,
        reps,
        weight_kg: weightKg,
        completed: true,
        completed_at: now,
      });
    }

    const completedSession: ActiveWorkoutSession = {
      id: workoutId,
      name: exerciseName,
      local_date: localDate,
      status: 'completed',
      started_at: now,
      ended_at: now,
      effort: 3,
      exercises: [
        {
          id: weId,
          workout_id: workoutId,
          exercise_id: null,
          exercise_name: exerciseName,
          position: 1,
          target_sets: setsCount,
          target_reps: reps,
          target_weight_kg: weightKg,
          rest_seconds: 60,
          sets,
        },
      ],
    };

    inMemoryCompletedSessions.unshift(completedSession);
    inMemoryActiveSession = null;

    try {
      if (authData?.user) {
        await supabase.from('workouts').insert({
          id: workoutId,
          user_id: userId,
          type: 'strength',
          name: exerciseName,
          local_date: localDate,
          status: 'completed',
          start_time: now,
          started_at: now,
          ended_at: now,
          duration_minutes: Math.max(5, setsCount * 2),
          effort: 'good',
        });

        await supabase.from('workout_exercises').insert({
          id: weId,
          workout_id: workoutId,
          user_id: userId,
          exercise_name: exerciseName,
          position: 1,
          order_in_workout: 1,
          target_sets: setsCount,
          target_reps: reps,
          target_weight_kg: weightKg,
          rest_seconds: 60,
        });

        const setsToInsert = sets.map((s) => ({
          id: s.id,
          workout_exercise_id: weId,
          workout_id: workoutId,
          user_id: userId,
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: s.weight_kg,
          completed: true,
          completed_at: now,
        }));
        await supabase.from('workout_sets').insert(setsToInsert);

        if (weightKg && weightKg > 0) {
          await this.recordPersonalBest(exerciseName, weightKg, reps);
        }
      }
    } catch {
      // offline fallback - already safely retained in inMemoryCompletedSessions
    }
  },

  async discardSession(workoutId: string): Promise<void> {
    if (inMemoryActiveSession && inMemoryActiveSession.id === workoutId) {
      inMemoryActiveSession = null;
    }
    const supabase = getSupabase();
    try {
      await supabase.from('workouts').delete().eq('id', workoutId);
    } catch {
      // offline
    }
  },

  async recordPersonalBest(exerciseName: string, weightKg: number, reps: number): Promise<void> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const { data: existing } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('exercise_name', exerciseName)
      .maybeSingle();

    if (!existing || weightKg > (existing.weight_kg || 0)) {
      await supabase.from('personal_bests').upsert({
        user_id: authData.user.id,
        exercise_name: exerciseName,
        weight_kg: weightKg,
        reps,
        achieved_at: new Date().toISOString(),
      });
    }
  },

  async fetchPersonalBests(): Promise<PersonalBestItem[]> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return [];

    const { data } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('achieved_at', { ascending: false });

    return data || [];
  },

  async logActivity(
    activityName: string,
    durationMinutes: number,
    localDate: string,
    caloriesBurned?: number,
    notes?: string,
  ): Promise<ActivityLogItem> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000001';
    const actId = crypto.randomUUID();

    const item: ActivityLogItem = {
      id: actId,
      user_id: userId,
      activity_name: activityName,
      duration_minutes: durationMinutes,
      calories_burned: caloriesBurned || null,
      local_date: localDate,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    try {
      if (authData?.user) {
        await supabase.from('activity_logs').insert({
          id: actId,
          user_id: userId,
          name: activityName,
          local_date: localDate,
          sets: [],
        });
      }
    } catch {
      // resilience
    }
    return item;
  },

  async deleteActivity(id: string): Promise<void> {
    const supabase = getSupabase();
    try {
      await supabase.from('activity_logs').delete().eq('id', id);
    } catch {
      // resilience
    }
  },

  async fetchHistory(
    filter: 'all' | 'workouts' | 'activities',
    date?: string,
  ): Promise<{
    workouts: ActiveWorkoutSession[];
    activities: ActivityLogItem[];
  }> {
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser();

    let remoteWorkouts: ActiveWorkoutSession[] = [];
    let remoteActivities: ActivityLogItem[] = [];

    if (authData?.user) {
      let wQuery = supabase
        .from('workouts')
        .select('id, name, local_date, status, started_at, ended_at, effort')
        .eq('user_id', authData.user.id)
        .eq('status', 'completed')
        .order('local_date', { ascending: false });

      let aQuery = supabase
        .from('activity_logs')
        .select('id, user_id, name, local_date, created_at')
        .eq('user_id', authData.user.id)
        .order('local_date', { ascending: false });

      if (date) {
        wQuery = wQuery.eq('local_date', date);
        aQuery = aQuery.eq('local_date', date);
      }

      const [{ data: workouts }, { data: activities }] = await Promise.all([
        filter === 'activities' ? Promise.resolve({ data: [] }) : wQuery,
        filter === 'workouts' ? Promise.resolve({ data: [] }) : aQuery,
      ]);

      remoteWorkouts = (workouts || []).map((w) => ({
        id: w.id,
        name: w.name || 'Workout',
        local_date: w.local_date,
        status: w.status,
        started_at: w.started_at,
        ended_at: w.ended_at,
        effort: w.effort,
        exercises: [],
      }));

      remoteActivities = (activities || []).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        activity_name: a.name || 'Activity',
        duration_minutes: 30,
        calories_burned: null,
        local_date: a.local_date,
        notes: null,
        created_at: a.created_at,
      }));
    }

    const seenIds = new Set<string>();
    const combinedWorkouts: ActiveWorkoutSession[] = [];

    for (const w of [...inMemoryCompletedSessions, ...remoteWorkouts]) {
      if (!seenIds.has(w.id)) {
        if (!date || w.local_date === date) {
          seenIds.add(w.id);
          combinedWorkouts.push(w);
        }
      }
    }

    return {
      workouts: filter === 'activities' ? [] : combinedWorkouts,
      activities: filter === 'workouts' ? [] : remoteActivities,
    };
  },
};
