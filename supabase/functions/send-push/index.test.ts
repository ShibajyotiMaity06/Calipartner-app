import { handleSendPush } from './index.ts';

async function withTestEnvironment(work: () => Promise<void>) {
  const originalKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const originalFirebase = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  const originalWorkerSecret = Deno.env.get('PUSH_WORKER_SECRET');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-worker-secret');
  Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
  Deno.env.delete('PUSH_WORKER_SECRET');
  try {
    await work();
  } finally {
    if (originalKey === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', originalKey);
    if (originalFirebase === undefined) Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
    else Deno.env.set('FIREBASE_SERVICE_ACCOUNT', originalFirebase);
    if (originalWorkerSecret === undefined) Deno.env.delete('PUSH_WORKER_SECRET');
    else Deno.env.set('PUSH_WORKER_SECRET', originalWorkerSecret);
  }
}
function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}; received ${actual}`);
}
async function signedRequest(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('scoped-worker-credential'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`))),
  )
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return new Request('https://example.com/send-push', {
    method: 'POST',
    body,
    headers: { 'x-push-worker-timestamp': timestamp, 'x-push-worker-signature': signature },
  });
}
Deno.test(
  'scheduled requests authenticate with an expiring signature instead of the long-lived key',
  () =>
    withTestEnvironment(async () => {
      Deno.env.set('PUSH_WORKER_SECRET', 'scoped-worker-credential');
      const request = await signedRequest('{"limit":50}');
      equal(request.headers.has('x-push-worker-secret'), false);
      equal((await handleSendPush(request)).status, 503);
    }),
);
Deno.test('scheduled request signatures reject expired, future, forged and tampered payloads', () =>
  withTestEnvironment(async () => {
    Deno.env.set('PUSH_WORKER_SECRET', 'scoped-worker-credential');
    const now = Math.floor(Date.now() / 1000);
    for (const timestamp of [String(now - 120), String(now + 120)]) {
      equal((await handleSendPush(await signedRequest('{"limit":50}', timestamp))).status, 401);
    }
    const request = await signedRequest('{"limit":50}');
    equal((await handleSendPush(new Request(request, { body: '{"limit":100}' }))).status, 401);
    const forged = await signedRequest('{"limit":50}');
    forged.headers.set('x-push-worker-signature', '0'.repeat(64));
    equal((await handleSendPush(forged)).status, 401);
  }),
);
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
Deno.test(
  'hosted workers accept the scoped credential without a service-role Authorization header',
  () =>
    withTestEnvironment(async () => {
      Deno.env.set('PUSH_WORKER_SECRET', 'scoped-worker-credential');
      const response = await handleSendPush(
        new Request('https://example.com/send-push', {
          method: 'POST',
          headers: { 'x-push-worker-secret': 'scoped-worker-credential' },
        }),
      );
      equal(response.status, 503);
      equal((await response.json()).error, 'FIREBASE_NOT_CONFIGURED');
    }),
);
Deno.test(
  'configured scoped credentials reject incorrect keys and the legacy bearer fallback',
  () =>
    withTestEnvironment(async () => {
      Deno.env.set('PUSH_WORKER_SECRET', 'scoped-worker-credential');
      for (const headers of [
        new Headers({ 'x-push-worker-secret': 'wrong-key' }),
        new Headers({ authorization: 'Bearer test-worker-secret' }),
      ]) {
        const response = await handleSendPush(
          new Request('https://example.com/send-push', { method: 'POST', headers }),
        );
        equal(response.status, 401);
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
