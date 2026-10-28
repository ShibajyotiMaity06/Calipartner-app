import assert from 'node:assert/strict';
import { handleChatSignedUrl } from './index.ts';

Deno.test(
  'Free and unavailable entitlements cannot obtain a chat media URL even as room members',
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
          if (name === 'active_room_tier') checkedUser = args.p_user_id;
          return Promise.resolve({
            data: name === 'room_is_usable' ? true : failed ? null : 'free',
            error: failed && name === 'active_room_tier' ? { message: 'offline' } : null,
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
      assert.equal((await result.json()).error, 'PLUS_REQUIRED');
      assert.equal(checkedUser, 'verified-user');
    }
  },
);
