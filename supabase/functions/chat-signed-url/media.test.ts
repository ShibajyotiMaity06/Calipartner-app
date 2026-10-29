import assert from 'node:assert/strict';
import { signR2Url } from '../_shared/r2.ts';
import { handleChatImageModeration, checkMediaSafety } from '../chat-image-moderation/index.ts';
import { handleChatUploadUrl } from '../chat-upload-url/index.ts';
import { handleChatSignedUrl } from './index.ts';

Deno.test('R2 signer uses AWS4 credentials and a real signature, never mock defaults', async () => {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const old = names.map((n) => Deno.env.get(n));
  try {
    for (const name of names) Deno.env.delete(name);
    await assert.rejects(
      () => signR2Url({ method: 'GET', key: 'rooms/a.jpg' }),
      /MEDIA_NOT_CONFIGURED/,
    );
    Deno.env.set(names[0], 'testaccount');
    Deno.env.set(names[1], 'public-test-access');
    Deno.env.set(names[2], 'private-test-secret');
    const url = new URL(
      await signR2Url({ method: 'PUT', key: 'rooms/a b/file.jpg', contentType: 'image/jpeg' }),
    );
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[a-f0-9]{64}$/);
    assert(url.searchParams.get('X-Amz-SignedHeaders')?.includes('content-type'));
    assert(!url.toString().includes('private-test-secret'));
  } finally {
    names.forEach((n, i) => (old[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, old[i]!)));
  }
});
Deno.test(
  'Moderation rejects arbitrary actors and client test overrides before media or provider access',
  async () => {
    const fake = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    };
    const make = (() => fake) as unknown as Parameters<typeof handleChatImageModeration>[1];
    for (const body of [
      { action: 'finalize', storage_key: 'victim-file' },
      { action: 'finalize', storage_key: 'victim-file', test_flag: 'ok' },
    ]) {
      const response = await handleChatImageModeration(
        new Request('https://test', {
          method: 'POST',
          headers: { Authorization: 'Bearer owner' },
          body: JSON.stringify(body),
        }),
        make,
        () => {
          throw new Error('Provider must not be called');
        },
      );
      assert.equal(response.status, 'test_flag' in body ? 400 : 403);
    }
  },
);
Deno.test(
  'Media moderation approves only a strict boolean and fails closed on malformed/provider output',
  async () => {
    const previous = Deno.env.get('GEMINI_API_KEY');
    Deno.env.set('GEMINI_API_KEY', 'test-provider-key');
    try {
      for (const [result, expected] of [
        [{ safe: true }, true],
        [{ safe: false }, false],
      ] as const) {
        const fetcher = async () =>
          Response.json({
            candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
          });
        assert.equal(
          await checkMediaSafety(new Uint8Array([1, 2]), 'image/jpeg', fetcher as typeof fetch),
          expected,
        );
      }
      await assert.rejects(
        () =>
          checkMediaSafety(new Uint8Array([1]), 'image/jpeg', (async () =>
            Response.json({
              candidates: [{ content: { parts: [{ text: '{"safe":"true"}' }] } }],
            })) as typeof fetch),
        /MODERATION_UNAVAILABLE/,
      );
    } finally {
      previous === undefined
        ? Deno.env.delete('GEMINI_API_KEY')
        : Deno.env.set('GEMINI_API_KEY', previous);
    }
  },
);
Deno.test(
  'Upload URLs require Pro even when an active Plus member forges request fields',
  async () => {
    const fake = {
      auth: { getUser: async () => ({ data: { user: { id: 'plus-user' } }, error: null }) },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { status: 'active' }, error: null }),
      }),
      rpc: async () => ({ data: 'plus', error: null }),
    };
    const response = await handleChatUploadUrl(
      new Request('https://test', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid' },
        body: JSON.stringify({
          room_id: 'room',
          client_id: 'id',
          mime_type: 'image/jpeg',
          size: 5,
          tier: 'pro',
          user_id: 'pro-victim',
        }),
      }),
      (() => fake) as unknown as Parameters<typeof handleChatUploadUrl>[1],
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'PRO_REQUIRED');
  },
);
Deno.test(
  'Signed reads require an actual readable attachment in the verified caller room',
  async () => {
    const fake = {
      auth: { getUser: async () => ({ data: { user: { id: 'verified-plus' } }, error: null }) },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { status: 'active', state: 'active' }, error: null }),
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === 'can_read_chat_media') {
          assert.equal(args.p_user_id, 'verified-plus');
          return { data: false, error: null };
        }
        return { data: name === 'active_room_tier' ? 'plus' : true, error: null };
      },
    };
    const id = '20000000-0000-4000-8000-000000000001';
    const response = await handleChatSignedUrl(
      new Request('https://test', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid' },
        body: JSON.stringify({
          room_id: id,
          storage_key: `rooms/${id}/messages/client-id/0.jpg`,
          user_id: 'pro-victim',
        }),
      }),
      (() => fake) as unknown as Parameters<typeof handleChatSignedUrl>[1],
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'MEDIA_UNAVAILABLE');
  },
);
Deno.test(
  'Deleting media invokes the message RPC as its verified owner, never as service role',
  async () => {
    const admin = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
      from: (table: string) => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle: async () => ({ data: { id: 'message', sender_id: 'owner' }, error: null }),
        then(resolve: (r: unknown) => unknown) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      }),
      rpc: () => {
        throw new Error('service-role RPC loses the actor');
      },
    };
    let actorCalls = 0;
    const factory = ((
      _url: string,
      _key: string,
      options?: { global?: { headers?: { Authorization?: string } } },
    ) =>
      options?.global?.headers?.Authorization
        ? {
            rpc: async (name: string, args: unknown) => {
              assert.equal(options.global?.headers?.Authorization, 'Bearer owner-token');
              assert.equal(name, 'delete_own_chat_message');
              assert.deepEqual(args, { p_message_id: 'message' });
              actorCalls++;
              return { data: null, error: null };
            },
          }
        : admin) as unknown as Parameters<typeof handleChatImageModeration>[1];
    const response = await handleChatImageModeration(
      new Request('https://test', {
        method: 'POST',
        headers: { Authorization: 'Bearer owner-token' },
        body: JSON.stringify({ action: 'delete_message', message_id: 'message' }),
      }),
      factory,
    );
    assert.equal(response.status, 200);
    assert.equal(actorCalls, 1);
  },
);

Deno.test(
  'Owned media cleanup drains more than one result page before reporting success',
  async () => {
    const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
    const previous = names.map((n) => Deno.env.get(n));
    names.forEach((n, i) => Deno.env.set(n, ['testaccount', 'testaccess', 'testsecret'][i]));
    const remaining = Array.from({ length: 101 }, (_, i) => ({
      storage_key: `rooms/owned/${i}`,
      temporary_key: `pending/owner/${i}`,
    }));
    let reads = 0,
      deletes = 0;
    try {
      const fake = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
        from: () => {
          let deleting = false,
            key = '';
          return {
            select() {
              return this;
            },
            delete() {
              deleting = true;
              return this;
            },
            eq(column: string, value: string) {
              if (column === 'storage_key') key = value;
              return this;
            },
            limit() {
              return this;
            },
            then(resolve: (value: unknown) => unknown) {
              if (deleting) {
                const index = remaining.findIndex((r) => r.storage_key === key);
                if (index >= 0) remaining.splice(index, 1);
                return Promise.resolve(resolve({ error: null }));
              }
              reads++;
              return Promise.resolve(resolve({ data: remaining.slice(0, 100), error: null }));
            },
          };
        },
      };
      const response = await handleChatImageModeration(
        new Request('https://test', {
          method: 'POST',
          headers: { Authorization: 'Bearer owner-token' },
          body: JSON.stringify({ action: 'cleanup' }),
        }),
        (() => fake) as unknown as Parameters<typeof handleChatImageModeration>[1],
        (async (_input: unknown, init?: RequestInit) => {
          assert.equal(init?.method, 'DELETE');
          deletes++;
          return new Response(null, { status: 204 });
        }) as typeof fetch,
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).count, 101);
      assert.equal(remaining.length, 0);
      assert.equal(reads, 3);
      assert.equal(deletes, 202);
    } finally {
      names.forEach((n, i) =>
        previous[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, previous[i]!),
      );
    }
  },
);
