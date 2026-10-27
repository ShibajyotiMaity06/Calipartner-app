import { handleSendPush } from './index.ts';

async function withTestEnvironment(work: () => Promise<void>) {
  const originalKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const originalFirebase = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-worker-secret');
  Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
  try {
    await work();
  } finally {
    if (originalKey === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', originalKey);
    if (originalFirebase === undefined) Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
    else Deno.env.set('FIREBASE_SERVICE_ACCOUNT', originalFirebase);
  }
}
function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}; received ${actual}`);
}
Deno.test('push worker rejects unauthenticated and ordinary user calls before processing', () =>
  withTestEnvironment(async () => {
    for (const headers of [
      new Headers(),
      new Headers({ authorization: 'Bearer ordinary-user-token' }),
    ]) {
      const response = await handleSendPush(
        new Request('https://example.com/send-push', { method: 'POST', headers }),
      );
      equal(response.status, 401);
      equal((await response.json()).error, 'NOT_AUTHORIZED');
    }
  }),
);
Deno.test('push worker requires POST', async () => {
  equal((await handleSendPush(new Request('https://example.com/send-push'))).status, 405);
});
Deno.test('missing Firebase configuration returns unavailable instead of simulating delivery', () =>
  withTestEnvironment(async () => {
    const response = await handleSendPush(
      new Request('https://example.com/send-push', {
        method: 'POST',
        headers: { authorization: 'Bearer test-worker-secret' },
      }),
    );
    equal(response.status, 503);
    equal((await response.json()).error, 'FIREBASE_NOT_CONFIGURED');
  }),
);
