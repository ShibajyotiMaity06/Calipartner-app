import { describe, expect, it, vi } from 'vitest';
import type { SocialDb, SocialClient } from './friendsService';
import {
  sendFriendRequest,
  respondFriendRequest,
  reportSocialProfile,
  loadSocialProfile,
  browseSocialProfiles,
} from './friendsService';
const db: SocialDb = {
  runAsync: vi.fn(),
  getAllAsync: async () => [],
  getFirstAsync: async () => null,
};
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
}
describe('online social requests', () => {
  it('sends requests directly with an actor and client UUID, without writing a queue', async () => {
    const api = client();
    await sendFriendRequest(db, 'owner', 'friend', api);
    expect(api.rpc).toHaveBeenCalledWith(
      'send_friend_request',
      expect.objectContaining({
        p_actor_id: 'owner',
        p_recipient_id: 'friend',
        p_request_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
      }),
    );
    expect(db.runAsync).not.toHaveBeenCalled();
  });
  it('surfaces quota and network errors without automatic retry', async () => {
    const api = client();
    api.rpc.mockResolvedValue({ data: null, error: { message: 'FRIEND_WEEKLY_LIMIT' } });
    await expect(sendFriendRequest(db, 'owner', 'friend', api as SocialClient)).rejects.toThrow(
      'FRIEND_WEEKLY_LIMIT',
    );
    expect(api.rpc).toHaveBeenCalledOnce();
  });
  it('never sends or reads on behalf of another account', async () => {
    const api = client();
    await expect(respondFriendRequest(db, 'other', 'request', 'accept', api)).rejects.toThrow(
      'NOT_AUTHORIZED',
    );
    await expect(loadSocialProfile(db, api, 'other', 'friend', true)).rejects.toThrow(
      'NOT_AUTHORIZED',
    );
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('does not serve a disconnected social read as a successful response', async () => {
    const api = client();
    await expect(browseSocialProfiles(db, api, 'owner', false, 'cut')).rejects.toThrow(
      'NETWORK_UNAVAILABLE',
    );
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('submits reports through the privacy checked RPC with a UUID', async () => {
    const api = client();
    await reportSocialProfile(db, 'owner', 'friend', 'spam', 'detail', api);
    expect(api.rpc).toHaveBeenCalledWith(
      'report_social_profile',
      expect.objectContaining({
        p_actor_id: 'owner',
        p_target_id: 'friend',
        p_reason: 'spam',
        p_details: 'detail',
      }),
    );
  });
});
