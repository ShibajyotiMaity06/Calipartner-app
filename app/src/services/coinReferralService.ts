import { getSupabase } from '@/lib/supabase';
import { secureStoreAdapter } from '@/lib/secureStore';
import { avatarRewardEvents } from './avatarRewardEvents';

const pendingKey = 'calipartner.pending_coin_referral';
export const isCoinReferralToken = (token: unknown): token is string =>
  typeof token === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);

export async function coinReferralUrl() {
  const { data, error } = await getSupabase().rpc('get_coin_referral_link');
  if (error || !isCoinReferralToken(data)) throw new Error('REFERRAL_UNAVAILABLE');
  return 'https://app.calipartner.site/referral/' + data;
}

export async function rememberCoinReferral(token: string) {
  if (!isCoinReferralToken(token)) throw new Error('REFERRAL_UNAVAILABLE');
  await secureStoreAdapter.setItem(pendingKey, token);
}

export async function claimPendingCoinReferral(ownerId: string) {
  const token = await secureStoreAdapter.getItem(pendingKey);
  if (!isCoinReferralToken(token)) return;
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== ownerId) return;
  const { data, error } = await client.rpc('claim_coin_referral', { p_token: token });
  if (error) throw error;
  if (data === 'claimed' || data === 'ineligible') {
    if ((await secureStoreAdapter.getItem(pendingKey)) === token)
      await secureStoreAdapter.removeItem(pendingKey);
    if (data === 'claimed') avatarRewardEvents.emitChange();
  }
}

export async function coinEarnOptions(): Promise<{ action: string; amount: number }[]> {
  const { data, error } = await getSupabase().rpc('get_coin_earn_options');
  if (error || !Array.isArray(data)) throw new Error('REWARDS_UNAVAILABLE');
  return data;
}
