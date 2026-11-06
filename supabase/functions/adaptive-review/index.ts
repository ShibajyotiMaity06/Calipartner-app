import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { proposeAdaptiveReview, type ReviewContext } from '@calipartner/core';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers });
export async function handleAdaptiveReview(
  req: Request,
  dependencies: { admin?: SupabaseClient } = {},
): Promise<Response> {
  if (req.method === 'OPTIONS') return reply(200, {});
  if (req.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { code: 'UNAUTHENTICATED' });
  try {
    const admin =
      dependencies.admin ??
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const actor = await admin.auth.getUser(token);
    if (actor.error || !actor.data.user) return reply(401, { code: 'UNAUTHENTICATED' });
    const raw = await req.text();
    if (raw.length > 2000) return reply(400, { code: 'INVALID_REVIEW' });
    const body = JSON.parse(raw);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.request_id,
      )
    )
      return reply(400, { code: 'INVALID_REVIEW' });
    const context = await admin.rpc('adaptive_review_context', { p_user_id: actor.data.user.id });
    if (context.error) throw context.error;
    const result = proposeAdaptiveReview(context.data as ReviewContext);
    if (result.reason !== 'ready') return reply(200, result);
    const saved = await admin.rpc('store_adaptive_review', {
      p_user_id: actor.data.user.id,
      p_id: body.request_id,
      p_context: context.data,
      p_proposal: result.proposal,
    });
    if (saved.error) throw saved.error;
    return reply(200, { reason: 'ready', ...saved.data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message ?? '');
    const code =
      [
        'PURCHASED_PRO_REQUIRED',
        'REVIEW_STALE',
        'REVIEW_NOT_DUE',
        'REVIEW_SAFETY',
        'IDEMPOTENCY_CONFLICT',
        'GOALS_REQUIRED',
      ].find((code) => message.includes(code)) ?? 'REVIEW_UNAVAILABLE';
    return reply(code === 'PURCHASED_PRO_REQUIRED' ? 403 : 409, {
      code: code === 'IDEMPOTENCY_CONFLICT' ? 'REVIEW_STALE' : code,
    });
  }
}
if (import.meta.main) Deno.serve((req) => handleAdaptiveReview(req));
