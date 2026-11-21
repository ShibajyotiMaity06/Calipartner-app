import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { addCooldownMonths, type GeneratedWorkoutPlan } from '../_shared/workoutAiEngine.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers });

export async function handleConfirm(req: Request, dependencies: { admin?: SupabaseClient } = {}) {
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

    const body = await req.json();
    const draft_id = body?.draft_id;
    if (!draft_id) return reply(400, { error: 'invalid_input' });

    // Load ai_plan_state
    const aiStateRes = await admin
      .from('ai_plan_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const aiState = aiStateRes.data;

    // Idempotency: check if plan already confirmed
    const existingPlan = await admin
      .from('user_workout_plans')
      .select('*')
      .eq('id', draft_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPlan.data) {
      return reply(200, {
        plan: existingPlan.data,
        next_available_at: isOwnerTestBypass ? null : aiState?.next_available_at,
      });
    }

    if (!aiState || aiState.current_draft_id !== draft_id || !aiState.current_draft) {
      return reply(404, { error: 'draft_not_found' });
    }

    if (aiState.draft_expires_at && new Date(aiState.draft_expires_at).getTime() < Date.now()) {
      return reply(400, { error: 'draft_expired' });
    }

    const plan: GeneratedWorkoutPlan = aiState.current_draft;

    // Re-check eligibility
    const [profileRes, screeningRes] = await Promise.all([
      admin.from('profiles').select('date_of_birth').eq('id', userId).maybeSingle(),
      admin
        .from('health_screening')
        .select('pregnant_or_breastfeeding,has_diabetes_or_medication,has_eating_disorder_history')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const dob = profileRes.data?.date_of_birth;
    if (!dob) return reply(403, { error: 'not_eligible', reason: 'profile_incomplete' });
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = today.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
    if (age < 18) return reply(403, { error: 'not_eligible', reason: 'age' });

    const screening = screeningRes.data;
    if (
      !screening ||
      screening.pregnant_or_breastfeeding ||
      screening.has_diabetes_or_medication ||
      screening.has_eating_disorder_history
    ) {
      return reply(403, { error: 'not_eligible', reason: 'health' });
    }

    if (!isOwnerTestBypass && aiState.next_available_at) {
      if (new Date(aiState.next_available_at).getTime() > Date.now()) {
        return reply(403, { error: 'not_eligible', reason: 'cooldown' });
      }
    }

    const next_available_at = isOwnerTestBypass
      ? null
      : addCooldownMonths(new Date()).toISOString();

    // 1. Archive current active plans
    await admin
      .from('user_workout_plans')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    // 2. Insert new plan
    await admin.from('user_workout_plans').insert({
      id: draft_id,
      user_id: userId,
      source: 'ai',
      status: 'active',
      name: plan.name,
      ai_inputs: plan.ai_inputs,
    });

    // 3. Insert plan days & exercises
    for (const d of plan.days) {
      const dayId = crypto.randomUUID();
      await admin.from('plan_days').insert({
        id: dayId,
        plan_id: draft_id,
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

    // 4. Sync legacy workout_plans
    const legacyDays = plan.days.map((d) => ({
      day: d.weekday - 1,
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
      id: draft_id,
      preferences: plan.ai_inputs,
      content: { days: legacyDays },
      updated_at: new Date().toISOString(),
    });

    // 5. Update ai_plan_state (resets previews_used to 0, sets next_available_at)
    await admin.from('ai_plan_state').upsert({
      user_id: userId,
      last_generated_at: new Date().toISOString(),
      next_available_at,
      generation_count: (aiState.generation_count ?? 0) + 1,
      previews_used: 0,
      current_draft_id: null,
      current_draft: null,
      draft_expires_at: null,
      updated_at: new Date().toISOString(),
    });

    return reply(200, {
      plan,
      next_available_at,
    });
  } catch (err) {
    return reply(500, { error: 'confirmation_failed', details: String(err) });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleConfirm(req));
}
