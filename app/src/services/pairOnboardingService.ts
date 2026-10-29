import { secureStoreAdapter } from '@/lib/secureStore';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from './foodService';

const pendingKey = 'calipartner.pending_pair_invite';
const promptKey = (userId: string) => `calipartner.pair_prompt.${userId}`;
export const isPairToken = (token: unknown): token is string =>
  typeof token === 'string' &&
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(token);

export async function rememberPairInvite(token: string) {
  if (!isPairToken(token)) throw new Error('INVALID_INVITE');
  await secureStoreAdapter.setItem(pendingKey, token);
}
export async function pendingPairInvite() {
  const token = await secureStoreAdapter.getItem(pendingKey);
  return isPairToken(token) ? token : null;
}
export const clearPendingPairInvite = () => secureStoreAdapter.removeItem(pendingKey);
export const requirePairPrompt = (userId: string) =>
  secureStoreAdapter.setItem(promptKey(userId), 'pending');
export const finishPairPrompt = (userId: string) =>
  secureStoreAdapter.setItem(promptKey(userId), 'done');

export async function afterSetupDestination(userId: string): Promise<string> {
  const token = await pendingPairInvite();
  if (token) return `/invite/${token}`;
  return (await secureStoreAdapter.getItem(promptKey(userId))) === 'pending'
    ? '/pair-start'
    : '/today';
}

export async function preparePairInvite(userId: string, roomName: string) {
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('NOT_AUTHORIZED');
  const key = `calipartner.pair_request.${userId}`;
  let requestId = await secureStoreAdapter.getItem(key);
  if (!isPairToken(requestId)) {
    requestId = generateClientUuid();
    await secureStoreAdapter.setItem(key, requestId);
  }
  let { data, error } = await client.rpc('prepare_onboarding_pair_invite', {
    p_client_id: requestId,
    p_room_name: roomName,
  });
  if (error?.message.includes('INVITE_ALREADY_USED')) {
    requestId = generateClientUuid();
    await secureStoreAdapter.setItem(key, requestId);
    const retry = await client.rpc('prepare_onboarding_pair_invite', {
      p_client_id: requestId,
      p_room_name: roomName,
    });
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  if (!isPairToken(data?.token)) throw new Error('INVALID_INVITE');
  return { token: data.token as string, expiresAt: data.expires_at as string };
}
export async function acceptPairInvite(token: string) {
  if (!isPairToken(token)) throw new Error('INVALID_INVITE');
  const { data, error } = await getSupabase().rpc('accept_onboarding_pair_invite', {
    p_token: token,
  });
  if (error) throw error;
  if (!data?.room_id) throw new Error('INVITE_UNAVAILABLE');
  await clearPendingPairInvite();
  const auth = await getSupabase().auth.getUser();
  if (auth.data.user) await finishPairPrompt(auth.data.user.id);
  return data.room_id as string;
}

export interface PairInvitePreview {
  state: 'sender' | 'member' | 'joinable' | 'unavailable';
  room_id?: string;
  is_sender?: boolean;
  can_share?: boolean;
  reason?: 'expired' | 'host_limit';
}
export async function previewPairInvite(token: string): Promise<PairInvitePreview> {
  if (!isPairToken(token)) throw new Error('INVALID_INVITE');
  const { data, error } = await getSupabase().rpc('preview_onboarding_pair_invite', {
    p_token: token,
  });
  if (error) throw error;
  if (!data || !['sender', 'member', 'joinable', 'unavailable'].includes(data.state))
    throw new Error('INVALID_INVITE');
  return data as PairInvitePreview;
}
