import assert from 'node:assert/strict';
import fixture from '../../../packages/core/src/__fixtures__/challengeConfig.json' with { type: 'json' };
import {
  createChallengeHandler,
  scoreUser,
  challengeTargets,
  validChallengeWorker,
} from './index.ts';
type Admin = Parameters<typeof createChallengeHandler>[0]['admin'];
const id = 'df280000-0000-4000-8000-000000000001';
Deno.test(
  'Worker HMAC binds the exact body and expires without exposing its reusable secret',
  async () => {
    const secret = 'test-worker-secret';
    const stamp = String(Math.floor(Date.now() / 1000));
    const body = '{"action": "maintenance"}';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(
      new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${stamp}.${body}`))),
    )
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const req = new Request('https://example.com', {
      headers: { 'x-challenge-worker-timestamp': stamp, 'x-challenge-worker-signature': signature },
    });
    assert.equal(await validChallengeWorker(req, body, secret), true);
    assert.equal(await validChallengeWorker(req, body + ' ', secret), false);
    assert.equal(
      await validChallengeWorker(
        new Request('https://example.com', {
          headers: {
            'x-challenge-worker-timestamp': '1000000000',
            'x-challenge-worker-signature': signature,
          },
        }),
        body,
        secret,
      ),
      false,
    );
  },
);
const input = {
  now: '2026-10-28T18:00:00Z',
  config: fixture,
  profile: {
    timezone: 'UTC',
    activity_level: 'moderate',
    current_weight: 70,
    date_of_birth: '1995-01-01',
    screened: false,
  },
  history: [],
  challenges: [],
};
function request(body: unknown, token = 'valid') {
  return new Request('https://example.com/challenges-api', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
Deno.test(
  'Missing/invalid authentication and worker spoofing never reach protected APIs',
  async () => {
    let calls = 0;
    const admin = {
      auth: { getUser: async () => ({ data: { user: null }, error: { message: 'expired' } }) },
      rpc: () => {
        calls++;
        throw new Error('unexpected');
      },
    } as unknown as Admin;
    const handler = createChallengeHandler({
      admin,
      userClient: () => admin,
      workerSecret: 'dedicated-secret',
    });
    for (const body of [{ action: 'create', actor_id: 'victim' }, { action: 'maintenance' }])
      assert.equal((await handler(request(body))).status, 401);
    assert.equal(calls, 0);
  },
);
Deno.test('A verified caller cannot use another account field to create a challenge', async () => {
  let actor: unknown;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified' } } }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'challenge_engine_input') return { data: input, error: null };
      if (name === 'challenge_create_server') {
        actor = args.p_actor;
        return { data: { id }, error: null };
      }
      throw new Error(name);
    },
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({
        data: { id: 'template', format: 'streak', tasks: ['steps'], rule_overrides: {} },
        error: null,
      }),
    }),
  } as unknown as Admin;
  const response = await createChallengeHandler({ admin, userClient: () => admin })(
    request({
      action: 'create',
      id,
      template_id: 'template',
      scope: 'solo',
      duration: 7,
      actor_id: 'victim',
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(actor, 'verified');
});
Deno.test('An unauthorized detail read is rejected before any service-role peer read', async () => {
  let reads = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified' } } }) },
    from: () => {
      reads++;
      throw new Error('should not read');
    },
  } as unknown as Admin;
  const client = {
    rpc: async () => ({ data: null, error: { message: 'NOT_CHALLENGE_PARTICIPANT' } }),
  } as unknown as Admin;
  const response = await createChallengeHandler({ admin, userClient: () => client })(
    request({ action: 'detail', id }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'NOT_CHALLENGE_PARTICIPANT');
  assert.equal(reads, 0);
});
Deno.test(
  'Targets use real history, sensible missing-history defaults and the configured caps',
  () => {
    const rules = {
      ...fixture.rules,
      format: 'streak',
      tasks: ['steps'],
      duration_days: 7,
      pass_days: 7,
      weekly_days: 7,
      allow_manual: true,
      shield_max: 1,
      pause_max: 3,
      cover_max: 0,
    } as Parameters<typeof challengeTargets>[1];
    assert.equal(
      challengeTargets(input as Parameters<typeof challengeTargets>[0], rules).steps,
      7000,
    );
    assert.equal(
      challengeTargets(
        {
          ...input,
          history: Array.from({ length: 14 }, (_, i) => ({
            local_date: `2026-10-${String(i + 1).padStart(2, '0')}`,
            values: { steps: 0 },
            sources: { steps: 'health_platform' },
          })),
        } as Parameters<typeof challengeTargets>[0],
        rules,
      ).steps,
      fixture.rules.metrics.steps.min,
    );
    assert.equal(
      challengeTargets(
        {
          ...input,
          history: Array.from({ length: 14 }, (_, i) => ({
            local_date: `2026-10-${String(i + 1).padStart(2, '0')}`,
            values: { steps: 10000 },
            sources: { steps: 'sensor' },
          })),
        } as Parameters<typeof challengeTargets>[0],
        rules,
      ).steps,
      11000,
    );
    assert.throws(
      () =>
        challengeTargets(input as Parameters<typeof challengeTargets>[0], rules, { steps: 999999 }),
      /INVALID_TARGET/,
    );
  },
);
Deno.test(
  'All six formats score with server time, preserve frozen tasks and commit only the verified actor',
  async () => {
    for (const format of ['streak', 'total', 'weekly_rhythm', 'checklist', 'duel', 'coop']) {
      const rules = {
        ...fixture.rules,
        format,
        tasks: ['steps'],
        duration_days: 2,
        pass_days: 2,
        weekly_days: 1,
        allow_manual: true,
      };
      let result: Record<string, unknown> | undefined;
      const admin = {
        rpc: async (name: string, args: Record<string, unknown>) => {
          if (name === 'challenge_engine_input')
            return {
              data: {
                ...input,
                now: '2026-10-28T18:00:00Z',
                challenges: [
                  {
                    challenge: { id, rules_snapshot: rules, status: 'active' },
                    participant: {
                      targets: { steps: 5000 },
                      start_date: '2026-10-26',
                      tz: 'UTC',
                      benefits: fixture.plans.plus,
                      cover_used: 0,
                    },
                    source_days: [
                      {
                        local_date: '2026-10-26',
                        values: { steps: 5000 },
                        sources: { steps: 'sensor' },
                      },
                      {
                        local_date: '2026-10-27',
                        values: { steps: 5000 },
                        sources: { steps: 'sensor' },
                      },
                    ],
                    existing: [],
                    pauses: [],
                  },
                ],
              },
              error: null,
            };
          if (name === 'challenge_commit_results') {
            result = args;
            return { data: null, error: null };
          }
          throw new Error(name);
        },
      } as unknown as Admin;
      await scoreUser(admin, 'verified');
      assert.equal(result?.p_actor, 'verified');
      assert.equal((result?.p_summary as { outcome: string }).outcome, 'completed');
      assert.equal((result?.p_summary as { percent: number }).percent, 100);
    }
  },
);
Deno.test('Unavailable schema errors are sanitized before reaching app clients', async () => {
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'verified' } } }) },
    rpc: async () => ({ data: null, error: { message: 'private schema and SQL secret' } }),
  } as unknown as Admin;
  const response = await createChallengeHandler({ admin, userClient: () => admin })(
    request({ action: 'home' }),
  );
  assert.deepEqual(await response.json(), { error: 'CHALLENGE_UNAVAILABLE' });
});
