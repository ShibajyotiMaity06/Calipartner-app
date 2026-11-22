import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import {
  generateWorkoutPlan,
  validateGeneratedWorkoutPlan,
  addCooldownMonths,
  type AiWorkoutInputs,
} from '../_shared/workoutAiEngine.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers });

export async function handleGenerate(req: Request, dependencies: { admin?: SupabaseClient } = {}) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'UNAUTHENTICATED' });

  try {
    const admin =
      dependencies.admin ??
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) return reply(401, { error: 'UNAUTHENTICATED' });

    const user = authData.user;
    const userId = user.id;
    const isOwnerTestBypass = user.email?.toLowerCase() === 'shibajyoti.maity06@gmail.com';

    const raw = await req.json();
    const ai_inputs: AiWorkoutInputs = raw?.ai_inputs ?? raw;
    const final_confirmed: boolean = Boolean(raw?.final_confirmed);

    // Validate inputs shape
    if (
      !ai_inputs ||
      typeof ai_inputs.days_per_week !== 'number' ||
      ai_inputs.days_per_week < 1 ||
      ai_inputs.days_per_week > 6 ||
      !Array.isArray(ai_inputs.training_days) ||
      ai_inputs.training_days.length !== ai_inputs.days_per_week ||
      ![30, 60, 90, 120].includes(ai_inputs.session_minutes) ||
      !['ppl', 'upper_lower', 'full_body', 'body_part', 'auto'].includes(ai_inputs.split) ||
      !['beginner', 'intermediate', 'experienced'].includes(ai_inputs.experience) ||
      !['home', 'basic_gym', 'advanced_gym'].includes(ai_inputs.location)
    ) {
      return reply(400, { error: 'invalid_input' });
    }

    // Eligibility check
    const [profileRes, screeningRes, aiStateRes, entitlementRes] = await Promise.all([
      admin.from('profiles').select('date_of_birth').eq('id', userId).maybeSingle(),
      admin
        .from('health_screening')
        .select('pregnant_or_breastfeeding,has_diabetes_or_medication,has_eating_disorder_history')
        .eq('user_id', userId)
        .maybeSingle(),
      admin.from('ai_plan_state').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('entitlements').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    // 0. Pro Subscription Check (AI Plan generation requires Pro, except owner test bypass)
    const entitlement = entitlementRes.data;
    const isPro =
      isOwnerTestBypass ||
      (entitlement &&
        entitlement.tier === 'pro' &&
        (entitlement.status === 'active' ||
          (entitlement.status === 'trial' &&
            (!entitlement.period_end || new Date(entitlement.period_end).getTime() > Date.now())) ||
          (entitlement.period_end && new Date(entitlement.period_end).getTime() > Date.now())));

    if (!isPro) {
      return reply(403, { error: 'not_eligible', reason: 'pro_required' });
    }

    const dob = profileRes.data?.date_of_birth;
    if (!dob) return reply(403, { error: 'not_eligible', reason: 'profile_incomplete' });

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = today.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
    if (age < 18) return reply(403, { error: 'not_eligible', reason: 'age' });

    const screening = screeningRes.data;
    if (!screening) return reply(403, { error: 'not_eligible', reason: 'profile_incomplete' });
    if (
      screening.pregnant_or_breastfeeding ||
      screening.has_diabetes_or_medication ||
      screening.has_eating_disorder_history
    ) {
      return reply(403, { error: 'not_eligible', reason: 'health' });
    }

    const aiState = aiStateRes.data;
    if (!isOwnerTestBypass && aiState?.next_available_at) {
      if (new Date(aiState.next_available_at).getTime() > Date.now()) {
        return reply(403, { error: 'not_eligible', reason: 'cooldown' });
      }
    }

    // Generate Plan
    const plan = generateWorkoutPlan(ai_inputs);
    const validation = validateGeneratedWorkoutPlan(plan, ai_inputs);
    if (!validation.valid) {
      return reply(500, { error: 'generation_failed', details: validation.errors });
    }

    const previews_used = aiState?.previews_used ?? 0;

    // Check if 3rd generation
    if (previews_used === 2) {
      if (!final_confirmed) {
        return reply(400, { error: 'final_confirmation_required' });
      }

      // Final generation: Automatically apply and confirm
      const next_available_at = isOwnerTestBypass
        ? null
        : addCooldownMonths(new Date()).toISOString();
      const planId = crypto.randomUUID();

      // Archive any active plans
      await admin
        .from('user_workout_plans')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'active');

      // Insert new active plan
      await admin.from('user_workout_plans').insert({
        id: planId,
        user_id: userId,
        source: 'ai',
        status: 'active',
        name: plan.name,
        ai_inputs,
      });

      // Insert days & exercises
      for (const d of plan.days) {
        const dayId = crypto.randomUUID();
        await admin.from('plan_days').insert({
          id: dayId,
          plan_id: planId,
          user_id: userId,
          weekday: d.weekday,
          is_rest: d.is_rest,
          name: d.name,
        });

        if (!d.is_rest && d.exercises.length > 0) {
          const exRows = d.exercises.map((e, idx) => ({
            id: crypto.randomUUID(),
            plan_day_id: dayId,
            exercise_id: e.id,
            position: idx + 1,
            target_sets: e.target_sets,
            target_reps: e.target_reps,
            target_weight_kg: e.target_weight_kg,
            rest_seconds: e.rest_seconds,
          }));
          await admin.from('plan_exercises').insert(exRows);
        }
      }

      // Sync to legacy workout_plans for backwards compatibility
      const legacyDays = plan.days.map((d) => ({
        day: d.weekday - 1, // 0..6
        title: d.name,
        minutes: d.about_minutes,
        exercises: d.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          sets: e.target_sets,
          reps: e.target_reps,
          rest_seconds: e.rest_seconds,
        })),
      }));

      await admin.from('workout_plans').upsert({
        user_id: userId,
        id: planId,
        preferences: ai_inputs,
        content: { days: legacyDays },
        updated_at: new Date().toISOString(),
      });

      // Update ai_plan_state
      await admin.from('ai_plan_state').upsert({
        user_id: userId,
        last_generated_at: new Date().toISOString(),
        next_available_at,
        generation_count: (aiState?.generation_count ?? 0) + 1,
        previews_used: 0,
        current_draft_id: null,
        current_draft: null,
        draft_expires_at: null,
        updated_at: new Date().toISOString(),
      });

      return reply(200, {
        final: true,
        plan,
        next_available_at,
      });
    }

    // Normal preview generation (preview 1 or 2)
    const draft_id = crypto.randomUUID();
    const draft_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await admin.from('ai_plan_state').upsert({
      user_id: userId,
      current_draft_id: draft_id,
      current_draft: plan,
      draft_expires_at,
      previews_used: previews_used + 1,
      updated_at: new Date().toISOString(),
    });

    return reply(200, {
      draft_id,
      plan,
      previews_used: previews_used + 1,
      excluded: plan.excluded,
      unmatched_limitations: plan.unmatched_limitations,
    });
  } catch (err) {
    return reply(500, { error: 'generation_failed', details: String(err) });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleGenerate(req));
}
