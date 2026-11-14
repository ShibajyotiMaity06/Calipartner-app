import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AvatarProfile,
  AvatarProduct,
  AvatarLevel,
  AvatarGender,
  AvatarLoadout,
} from '@calipartner/core';
import { cachedRead } from './offlineReadService';
import { isDeviceOffline } from './networkService';

export interface AvatarTint {
  id: string;
  kind: 'skin' | 'hair' | 'garment';
  name: string;
  hex: string;
  tier_required: 'free' | 'plus' | 'pro';
}
export interface AvatarCollection {
  id: string;
  name: string;
  tier_required: 'free' | 'plus' | 'pro';
  sort: number;
  earn_only: boolean;
  bundle_discount_pct: number;
  price_to_complete?: number;
}
export interface AvatarState {
  enabled: boolean;
  profile: (AvatarProfile & { created_at: string }) | null;
  balances: { earned: number; purchased: number };
  tier: 'free' | 'plus' | 'pro';
  config: { level_cap: number; spend_order: string; starter_path: { key: string; cc: number }[] };
  levels: AvatarLevel[];
  tints: AvatarTint[];
  collections: AvatarCollection[];
  products: AvatarProduct[];
  daily_drop: { available: boolean; claimed: boolean; amount: number };
  starter_progress: string[];
  starter_active: boolean;
  ledger: {
    id: number;
    wallet: 'earned' | 'purchased';
    delta: number;
    reason: string;
    created_at: string;
  }[];
  packs: { id: string; store_product_id: string; cc: number }[];
  wishlist: string[];
}
async function rpc<T>(
  client: SupabaseClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (name !== 'get_avatar_state' && name !== 'get_avatar_public' && (await isDeviceOffline()))
    throw new Error('NETWORK_UNAVAILABLE');
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error('MISSING_ACKNOWLEDGEMENT');
  return data as T;
}
export async function fetchAvatarState(client: SupabaseClient): Promise<AvatarState> {
  return cachedRead(client, 'avatar', () => rpc<AvatarState>(client, 'get_avatar_state'));
}
export async function reconcileAvatarRewards(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('avatar_reconcile_rewards');
  if (error) throw new Error(error.message);
}
export const createAvatar = (client: SupabaseClient, gender: AvatarGender, skin: string) =>
  rpc<AvatarState>(client, 'avatar_create', { p_gender: gender, p_skin_tone_id: skin });
export const saveAvatar = (
  client: SupabaseClient,
  requestId: string,
  gender: AvatarGender,
  skin: string,
  loadout: AvatarLoadout,
) =>
  rpc<AvatarState>(client, 'avatar_save', {
    p_request_id: requestId,
    p_gender: gender,
    p_skin_tone_id: skin,
    p_slots: loadout.slots,
    p_tints: loadout.tints,
  });
export const purchaseAvatarProduct = (
  client: SupabaseClient,
  requestId: string,
  price: number,
  productId: string | null,
  collectionId: string | null,
) =>
  rpc<AvatarState>(client, 'avatar_purchase', {
    p_request_id: requestId,
    p_expected_price: price,
    p_product_id: productId,
    p_collection_id: collectionId,
  });
export const claimAvatarDrop = (client: SupabaseClient) =>
  rpc<AvatarState>(client, 'claim_daily_drop');
export const fetchPublicAvatars = (client: SupabaseClient, ids: string[]) =>
  rpc<AvatarProfile[]>(client, 'get_avatar_public', { p_user_ids: ids });
export async function setAvatarWishlist(
  client: SupabaseClient,
  userId: string,
  productId: string,
  wanted: boolean,
) {
  const query = wanted
    ? client
        .from('avatar_wishlist')
        .upsert(
          { user_id: userId, product_id: productId },
          { onConflict: 'user_id,product_id', ignoreDuplicates: true },
        )
    : client.from('avatar_wishlist').delete().eq('user_id', userId).eq('product_id', productId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}
