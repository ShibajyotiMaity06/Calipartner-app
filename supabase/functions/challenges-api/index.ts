import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import {
  summarizeChallenge,
  challengeHistoryValues,
  evaluateChallengeDays,
  personalChallengeTarget,
  challengeLocalDate,
  challengeDateAdd,
  challengeDateDiff,
  safeOccasionMilestones,
  type ChallengeRules,
  type ChallengeMetric,
  type ChallengeSourceDay,
  type ChallengeDayResult,
} from '../../../packages/core/src/challengeEngine.ts';
import { buildChallengeHome } from '../../../packages/core/src/challengeViewModel.ts';
import type {
  ChallengeConfig,
  ChallengeTemplate,
  ChallengeSnapshot,
  ChallengeHome,
} from '../../../packages/core/src/challengeTypes.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Client = Pick<SupabaseClient, 'rpc' | 'from' | 'auth'>;
async function rpc<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
interface EngineInput {
  now: string;
  config: ChallengeConfig;
  profile: {
    timezone: string;
    activity_level: string;
    current_weight: number;
    date_of_birth: string | null;
    screened: boolean;
  };
  history: ChallengeSourceDay[];
  challenges: Array<{
    challenge: { id: string; rules_snapshot: ChallengeRules; status: string };
    participant: {
      targets: Partial<Record<ChallengeMetric, number>>;
      start_date: string | null;
      tz: string;
      benefits: { shield_max: number; pause_max: number; cover_max: number; custom: boolean };
      cover_used: number;
    };
    source_days: ChallengeSourceDay[];
    existing: Array<ChallengeDayResult & { source: ChallengeDayResult['tasks'] }>;
    pauses: string[];
  }>;
}
export function challengeTargets(
  input: EngineInput,
  rules: ChallengeRules,
  chosen: Partial<Record<ChallengeMetric, number>> = {},
) {
  const targets: Partial<Record<ChallengeMetric, number>> = {};
  for (const metric of rules.tasks) {
    const config = rules.metrics[metric];
    if (!config) throw new Error('UNSAFE_CHALLENGE_METRIC');
    const target =
      chosen[metric] ??
      personalChallengeTarget(
        challengeHistoryValues(input.history, metric, rules),
        config,
        input.profile.activity_level,
        rules,
      ).target;
    if (!Number.isFinite(target) || target < config.min || target > config.max)
      throw new Error('INVALID_TARGET');
    targets[metric] = target;
  }
  return targets;
}
export async function scoreUser(admin: Client, user: string, id?: string) {
  const input = await rpc<EngineInput>(admin, 'challenge_engine_input', {
    p_user: user,
    p_id: id ?? null,
  });
  for (const entry of input.challenges) {
    const p = entry.participant;
    if (!p.start_date || entry.challenge.status === 'invited') continue;
    const rules = {
      ...entry.challenge.rules_snapshot,
      shield_max: p.benefits.shield_max,
      pause_max: p.benefits.pause_max,
      cover_max: p.benefits.cover_max,
    };
    const result = evaluateChallengeDays({
      rules,
      targets: p.targets,
      start_date: p.start_date,
      tz: p.tz,
      now: new Date(input.now),
      source_days: entry.source_days,
      existing: entry.existing.map((day) => ({ ...day, tasks: day.source })),
      pauses: entry.pauses,
      cover_spent: p.cover_used,
    });
    const summary = summarizeChallenge({
      result,
      rules: entry.challenge.rules_snapshot,
      benefits: p.benefits,
      now: new Date(input.now),
      tz: p.tz,
    });
    await rpc(admin, 'challenge_commit_results', {
      p_actor: user,
      p_id: entry.challenge.id,
      p_days: result.days,
      p_summary: summary,
    });
  }
}
async function scoreGroup(admin: Client, user: string, id?: string) {
  if (!id) {
    await scoreUser(admin, user);
    return;
  }
  const { data, error } = await admin
    .from('challenge_participants')
    .select('user_id')
    .eq('challenge_id', id)
    .eq('status', 'joined');
  if (error) throw error;
  for (const peer of data ?? []) await scoreUser(admin, peer.user_id, id);
}
export async function executeChallenge(
  admin: Client,
  client: Client,
  user: string,
  body: Record<string, unknown>,
) {
  const action = body.action;
  if (
    ['detail', 'respond', 'social', 'recap'].includes(String(action)) &&
    !uuid.test(String(body.id))
  )
    throw new Error('INVALID_ID');
  if (action === 'detail' || (action === 'respond' && body.accept === true) || action === 'recap')
    await rpc(client, 'challenge_snapshot', { p_id: body.id }); // Authorization before service reads or peer scoring.
  if (action === 'track')
    return await rpc(client, 'challenge_track', {
      p_request: body.request_id,
      p_event: body.event,
      p_challenge: body.id ?? null,
    });
  if (action === 'home') {
    await scoreUser(admin, user);
    const home = await rpc<ChallengeHome>(client, 'challenge_home');
    for (const item of home.items.filter(
      (item) => item.self.status === 'joined' && item.challenge.scope !== 'solo',
    ))
      await scoreGroup(admin, user, item.challenge.id);
    return buildChallengeHome(await rpc<ChallengeHome>(client, 'challenge_home'));
  }
  if (action === 'read')
    return buildChallengeHome(await rpc<ChallengeHome>(client, 'challenge_home'));
  if (action === 'detail') {
    await scoreGroup(admin, user, String(body.id));
    return await rpc(client, 'challenge_snapshot', { p_id: body.id });
  }
  if (action === 'recommend' || action === 'create' || action === 'occasion') {
    const input = await rpc<EngineInput>(admin, 'challenge_engine_input', { p_user: user });
    const { data: template, error } = await admin
      .from('challenge_templates')
      .select('*')
      .eq('id', body.template_id)
      .eq('active', true)
      .single();
    if (error || !template) throw new Error('TEMPLATE_UNAVAILABLE');
    const t = template as ChallengeTemplate;
    const rules = {
      ...input.config.rules,
      ...t.rule_overrides,
      tasks: body.tasks && t.format === 'checklist' ? body.tasks : t.tasks,
      format: t.format,
      allow_manual: typeof body.allow_manual === 'boolean' ? body.allow_manual : t.allow_manual,
    } as ChallengeRules;
    if (!Array.isArray(rules.tasks) || new Set(rules.tasks).size !== rules.tasks.length)
      throw new Error('INVALID_TASKS');
    const targets = challengeTargets(
      input,
      rules,
      (body.targets ?? {}) as Partial<Record<ChallengeMetric, number>>,
    );
    if (action === 'recommend')
      return { targets, today: challengeLocalDate(new Date(input.now), input.profile.timezone) };
    if (!uuid.test(String(body.id))) throw new Error('INVALID_ID');
    if (action === 'occasion') {
      const today = challengeLocalDate(new Date(input.now), input.profile.timezone);
      const start = challengeDateAdd(today, 1);
      const date = String(body.event_date);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !input.config.occasion_event_types.includes(String(body.event_type))
      )
        throw new Error('INVALID_OCCASION');
      const days = challengeDateDiff(start, date) + input.config.recovery_days + 1;
      if (days <= 0 || days > input.config.occasion_max_days) throw new Error('INVALID_OCCASION');
      const adult =
        !!input.profile.date_of_birth &&
        challengeDateAdd(input.profile.date_of_birth, 0) <=
          `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
      const bodyGoal = body.target_weight !== undefined && body.target_weight !== null;
      const height = bodyGoal
        ? await admin.from('profiles').select('height_cm').eq('id', user).single()
        : null;
      if (height?.error) throw new Error('PROFILE_REQUIRED');
      const milestones = bodyGoal
        ? safeOccasionMilestones({
            current_weight: input.profile.current_weight,
            height_cm: height!.data.height_cm,
            target_weight: Number(body.target_weight),
            start_date: start,
            event_date: date,
            event_week_days: input.config.event_week_days,
            event_week_factor: input.config.event_week_factor,
            screened: input.profile.screened || !adult,
          })
        : Array.from({ length: Math.ceil(challengeDateDiff(start, date) / 7) }, (_, index) => ({
            week: index + 1,
            date: challengeDateAdd(
              start,
              Math.min(challengeDateDiff(start, date), (index + 1) * 7),
            ),
            habit_factor:
              challengeDateDiff(challengeDateAdd(start, (index + 1) * 7), date) <
              input.config.event_week_days
                ? input.config.event_week_factor
                : 1,
          }));
      return await rpc(admin, 'challenge_occasion_server', {
        p_actor: user,
        p_id: body.id,
        p_template: t.id,
        p_partner: body.partner_id,
        p_event: body.event_type,
        p_date: date,
        p_duration: days,
        p_targets: targets,
        p_private: {
          body_goal: bodyGoal,
          tasks: rules.tasks,
          ...(bodyGoal
            ? {
                current_weight: input.profile.current_weight,
                target_weight: Number(body.target_weight),
              }
            : {}),
        },
        p_milestones: milestones,
      });
    }
    return await rpc(admin, 'challenge_create_server', {
      p_actor: user,
      p_id: body.id,
      p_template: t.id,
      p_scope: body.scope,
      p_duration: body.duration,
      p_partners: body.partners ?? [],
      p_targets: targets,
      p_room: body.room_id ?? null,
      p_title: body.title ?? null,
      p_forfeit: body.forfeit_id ?? null,
      p_start: body.start_date ?? null,
      p_options: {
        tasks: rules.tasks,
        board_opt_in: body.board_opt_in === true,
        same_target: body.same_target === true,
        ...(body.rest_weekdays ? { rest_weekdays: body.rest_weekdays } : {}),
        ...(typeof body.allow_manual === 'boolean' ? { allow_manual: body.allow_manual } : {}),
      },
    });
  }
  if (action === 'respond') {
    if (body.accept !== true)
      return await rpc(admin, 'challenge_respond_server', {
        p_actor: user,
        p_id: body.id,
        p_accept: false,
        p_targets: {},
      });
    const snapshot = await rpc<ChallengeSnapshot>(client, 'challenge_snapshot', { p_id: body.id });
    const input = await rpc<EngineInput>(admin, 'challenge_engine_input', { p_user: user });
    const rules = snapshot.challenge.rules_snapshot as ChallengeRules & {
      same_target?: boolean;
      same_targets?: Partial<Record<ChallengeMetric, number>>;
    };
    return await rpc(admin, 'challenge_respond_server', {
      p_actor: user,
      p_id: body.id,
      p_accept: body.accept === true,
      p_targets:
        body.accept === true
          ? challengeTargets(input, rules, rules.same_target ? rules.same_targets : {})
          : {},
    });
  }
  if (action === 'social') {
    if (body.kind === 'block') {
      await rpc(client, 'block_social_profile', { p_target_id: body.target });
      return { id: body.id };
    }
    if (!uuid.test(String(body.request_id))) throw new Error('INVALID_ID');
    const result = await rpc(client, 'challenge_action', {
      p_client_id: body.request_id,
      p_id: body.id,
      p_action: body.kind,
      p_target: body.target ?? null,
      p_date: body.date ?? null,
      p_value: body.value ?? {},
    });
    if (body.kind !== 'leave') await scoreGroup(admin, user, String(body.id));
    return result;
  }
  if (action === 'remind')
    return await rpc(client, 'challenge_remind', {
      p_template: body.template_id,
      p_enabled: body.enabled === true,
    });
  if (action === 'notify')
    return await rpc(client, 'challenge_notification_preference', {
      p_id: body.id,
      p_enabled: body.enabled === true,
    });
  if (action === 'board') return await rpc(client, 'challenge_board', { p_season: body.season_id });
  if (action === 'recap') {
    const snapshot = await rpc<ChallengeSnapshot>(client, 'challenge_snapshot', { p_id: body.id });
    const catalog = await rpc<{ plan: string }>(client, 'challenge_catalog');
    if (catalog.plan !== 'pro') throw new Error('PRO_REQUIRED');
    const me = snapshot.participants.find((p) => p.self);
    return {
      summary: me?.summary,
      title: snapshot.challenge.custom_title ?? snapshot.challenge.rules_snapshot.title_key,
    };
  }
  throw new Error('INVALID_ACTION');
}
export async function validChallengeWorker(
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const stamp = req.headers.get('x-challenge-worker-timestamp') ?? '';
  const signature = req.headers.get('x-challenge-worker-signature') ?? '';
  if (
    !/^\d{10}$/.test(stamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(Date.now() / 1000 - Number(stamp)) > 90
  )
    return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(signature.match(/../g)!.map((pair) => parseInt(pair, 16))),
    encoder.encode(`${stamp}.${body}`),
  );
}
export function createChallengeHandler(deps: {
  admin: Client;
  userClient: (token: string) => Client;
  workerSecret?: string;
}) {
  return async (req: Request): Promise<Response> => {
    const reply = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
      const raw = await req.text();
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (body.action === 'maintenance') {
        if (!deps.workerSecret || !(await validChallengeWorker(req, raw, deps.workerSecret)))
          return reply({ error: 'UNAUTHENTICATED' }, 401);
        const users = await rpc<string[]>(deps.admin, 'challenge_worker_users');
        for (const id of users) await scoreUser(deps.admin, id);
        await rpc(deps.admin, 'challenge_maintenance');
        return reply({ processed: users.length });
      }
      const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
      if (!token) return reply({ error: 'UNAUTHENTICATED' }, 401);
      const { data, error } = await deps.admin.auth.getUser(token);
      if (error || !data.user) return reply({ error: 'UNAUTHENTICATED' }, 401);
      if (body.action === 'analytics') {
        if (data.user.app_metadata?.challenge_admin !== true)
          return reply({ error: 'NOT_AUTHORIZED' }, 403);
        return reply(await rpc(deps.admin, 'challenge_analytics_dashboard'));
      }
      return reply(await executeChallenge(deps.admin, deps.userClient(token), data.user.id, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      return reply({ error: /^[A-Z_]+$/.test(message) ? message : 'CHALLENGE_UNAVAILABLE' }, 400);
    }
  };
}
if (import.meta.main) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  Deno.serve(
    createChallengeHandler({
      admin: createClient(url, key, { auth: { persistSession: false } }),
      userClient: (token) =>
        createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        }),
      workerSecret: Deno.env.get('CHALLENGE_JOB_SECRET'),
    }),
  );
}
