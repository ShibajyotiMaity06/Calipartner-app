import assert from 'node:assert/strict';
import { handleChatSignedUrl } from './index.ts';

Deno.test('A Free joined member can sign approved shared media without a tier check', async () => {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const before = names.map((name) => Deno.env.get(name));
  try {
    Deno.env.set(names[0], 'testaccount');
    Deno.env.set(names[1], 'test-access');
    Deno.env.set(names[2], 'test-secret');
    const fake = {
      auth: { getUser: async () => ({ data: { user: { id: 'verified-free' } }, error: null }) },
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
        assert.notEqual(name, 'active_room_tier');
        if (name === 'can_read_chat_media') assert.equal(args.p_user_id, 'verified-free');
        return { data: true, error: null };
      },
    };
    const room = '20000000-0000-4000-8000-000000000001';
    const result = await handleChatSignedUrl(
      new Request('https://example', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture' },
        body: JSON.stringify({ room_id: room, storage_key: `rooms/${room}/messages/test/0.jpg` }),
      }),
      (() => fake) as unknown as Parameters<typeof handleChatSignedUrl>[1],
    );
    assert.equal(result.status, 200);
    assert.match((await result.json()).signed_url, /X-Amz-Signature=/);
  } finally {
    names.forEach((name, i) =>
      before[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, before[i]!),
    );
  }
});

Deno.test(
  'Signed chat media reads fail closed on unreadable attachments or permission lookup failures',
  async () => {
    for (const failed of [false, true]) {
      let checkedUser: unknown;
      const fake = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: 'verified-user' } }, error: null }),
        },
        from: () => ({
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: () =>
            Promise.resolve({ data: { status: 'active', state: 'active' }, error: null }),
        }),
        rpc: (name: string, args: { p_user_id?: string }) => {
          if (name === 'can_read_chat_media') checkedUser = args.p_user_id;
          return Promise.resolve({
            data: name === 'room_is_usable' ? true : failed ? null : false,
            error: failed && name === 'can_read_chat_media' ? { message: 'offline' } : null,
          });
        },
      };
      const roomId = '20000000-0000-4000-8000-000000000001';
      const result = await handleChatSignedUrl(
        new Request('https://example.com/chat-signed-url', {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-user-token' },
          body: JSON.stringify({
            room_id: roomId,
            storage_key: `rooms/${roomId}/messages/client-id/0.jpg`,
            user_id: 'paid-victim',
          }),
        }),
        (() => fake) as unknown as Parameters<typeof handleChatSignedUrl>[1],
      );
      assert.equal(result.status, 403);
      assert.equal((await result.json()).error, 'MEDIA_UNAVAILABLE');
      assert.equal(checkedUser, 'verified-user');
    }
  },
);
