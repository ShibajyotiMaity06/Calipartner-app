import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { addCooldownMonths } from '../_shared/workoutAiEngine.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers });

export async function handleEligibility(
  req: Request,
  dependencies: { admin?: SupabaseClient } = {},
) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

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

    const [profileRes, screeningRes, aiStateRes] = await Promise.all([
      admin.from('profiles').select('date_of_birth').eq('id', userId).maybeSingle(),
      admin
        .from('health_screening')
        .select('pregnant_or_breastfeeding,has_diabetes_or_medication,has_eating_disorder_history')
        .eq('user_id', userId)
        .maybeSingle(),
      admin.from('ai_plan_state').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const dob = profileRes.data?.date_of_birth;
    const screening = screeningRes.data;
    const aiState = aiStateRes.data;

    // Projected next available at (now + 3 months) for S31 warning display
    const projected_next_available_at = addCooldownMonths(new Date()).toISOString();
    const previews_used = aiState?.previews_used ?? 0;
    const next_available_at = aiState?.next_available_at ?? null;

    // 1. Check Age (18+)
    if (!dob) {
      return reply(200, {
        eligible: false,
        reason: 'profile_incomplete',
        state: 'never',
        next_available_at,
        previews_used,
        projected_next_available_at,
      });
    }

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = today.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
      age--;
    }

    if (age < 18) {
      return reply(200, {
        eligible: false,
        reason: 'age',
        state: 'locked',
        next_available_at,
        previews_used,
        projected_next_available_at,
      });
    }

    // 2. Check Health Screening
    if (!screening) {
      return reply(200, {
        eligible: false,
        reason: 'profile_incomplete',
        state: 'never',
        next_available_at,
        previews_used,
        projected_next_available_at,
      });
    }

    if (
      screening.pregnant_or_breastfeeding ||
      screening.has_diabetes_or_medication ||
      screening.has_eating_disorder_history
    ) {
      return reply(200, {
        eligible: false,
        reason: 'health',
        state: 'locked',
        next_available_at,
        previews_used,
        projected_next_available_at,
      });
    }

    // 3. Cooldown check (Bypassed for test owner shibajyoti.maity06@gmail.com)
    if (!isOwnerTestBypass && next_available_at) {
      const unlockTime = new Date(next_available_at).getTime();
      if (unlockTime > Date.now()) {
        return reply(200, {
          eligible: false,
          reason: 'cooldown',
          state: 'locked',
          next_available_at,
          previews_used,
          projected_next_available_at,
        });
      }
    }

    // Unlocked / Ready state vs Never state
    const state = next_available_at ? 'ready' : 'never';
    return reply(200, {
      eligible: true,
      reason: null,
      state,
      next_available_at: isOwnerTestBypass ? null : next_available_at,
      previews_used,
      projected_next_available_at,
    });
  } catch (err) {
    return reply(500, { error: 'INTERNAL_ERROR', details: String(err) });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleEligibility(req));
}
