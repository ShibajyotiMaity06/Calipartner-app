import { getSupabase } from '@/lib/supabase';
import type {
  FriendInbox,
  SocialProfile,
  SocialProfileDraft,
  FriendAction,
} from '@calipartner/core';
import { validateSocialProfile, normalizeSocialQuery, isSocialQueryValid } from '@calipartner/core';
import { generateClientUuid } from './foodService';
import type { LocalDb } from './accountDataService';

export interface SocialDb extends LocalDb {
  withTransactionAsync?(work: () => Promise<void>): Promise<void>;
}
export interface SocialClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  rpc(
    name: string,
    payload?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}
export type SocialRpc =
  | 'set_social_profile'
  | 'send_friend_request'
  | 'respond_friend_request'
  | 'block_social_profile'
  | 'report_social_profile';
async function requestSocial<T>(
  _db: SocialDb,
  client: SocialClient,
  owner: string,
  _key: string,
  rpc: string,
  args: Record<string, unknown>,
  online: boolean,
) {
  if (!online) throw new Error('NETWORK_UNAVAILABLE');
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== owner) throw new Error('NOT_AUTHORIZED');
  const result = await client.rpc(rpc, { ...args, p_actor_id: owner });
  if (result.error) throw new Error(`${result.error.code ?? ''} ${result.error.message}`.trim());
  return { data: result.data as T, cached: false };
}
async function writeSocial(
  db: SocialDb,
  owner: string,
  rpc: SocialRpc,
  payload: Record<string, unknown>,
  client: SocialClient = getSupabase(),
) {
  return requestSocial(db, client, owner, '', rpc, payload, true);
}
export async function saveSocialProfile(
  db: SocialDb,
  owner: string,
  profile: SocialProfile,
  draft: SocialProfileDraft,
  client?: SocialClient,
) {
  if (!validateSocialProfile(draft).valid) throw new Error('INVALID_PROFILE');
  const edited = Date.parse(profile.edited_at ?? '');
  return writeSocial(
    db,
    owner,
    'set_social_profile',
    {
      p_mutation_id: generateClientUuid(),
      p_edited_at: new Date(
        Math.max(Date.now(), Number.isFinite(edited) ? edited + 1 : 0),
      ).toISOString(),
      p_bio: draft.bio,
      p_training_style: draft.training_style,
      p_instagram_handle: draft.instagram_handle,
      p_website_url: draft.website_url.trim() ? new URL(draft.website_url.trim()).href : '',
      p_is_public: draft.is_public,
    },
    client,
  );
}
export function sendFriendRequest(
  db: SocialDb,
  owner: string,
  target: string,
  client?: SocialClient,
) {
  return writeSocial(
    db,
    owner,
    'send_friend_request',
    { p_request_id: generateClientUuid(), p_recipient_id: target },
    client,
  );
}
export async function respondFriendRequest(
  db: SocialDb,
  owner: string,
  request: string,
  action: FriendAction,
  client?: SocialClient,
) {
  const result = await writeSocial(
    db,
    owner,
    'respond_friend_request',
    { p_request_id: request, p_action: action },
    client,
  );
  const status = {
    accept: 'accepted',
    decline: 'declined',
    cancel: 'cancelled',
    remove: 'removed',
  }[action];
  if ((result.data as { status?: string } | null)?.status !== status)
    throw new Error('REQUEST_RESPONSE_UNCONFIRMED');
  return result;
}
export function blockSocialProfile(
  db: SocialDb,
  owner: string,
  target: string,
  client?: SocialClient,
) {
  return writeSocial(db, owner, 'block_social_profile', { p_target_id: target }, client);
}
export function reportSocialProfile(
  db: SocialDb,
  owner: string,
  target: string,
  reason: string,
  details?: string,
  client?: SocialClient,
) {
  return writeSocial(
    db,
    owner,
    'report_social_profile',
    {
      p_report_id: generateClientUuid(),
      p_target_id: target,
      p_reason: reason,
      p_details: details ?? null,
    },
    client,
  );
}
export async function loadSocialProfile(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  target: string,
  online: boolean,
) {
  return requestSocial<SocialProfile>(
    db,
    client,
    owner,
    `profile:${target}`,
    'get_social_profile',
    { p_user_id: target },
    online,
  );
}
export function loadFriendInbox(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  online: boolean,
) {
  return requestSocial<FriendInbox>(db, client, owner, 'inbox', 'get_friend_inbox', {}, online);
}
export async function searchSocialProfiles(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  query: string,
  online: boolean,
) {
  if (!isSocialQueryValid(query)) throw new Error('INVALID_QUERY');
  const normalized = normalizeSocialQuery(query);
  return requestSocial<SocialProfile[]>(
    db,
    client,
    owner,
    `search:${normalized}`,
    'search_social_profiles',
    { p_query: normalized },
    online,
  );
}

export function browseSocialProfiles(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  online: boolean,
  goal: 'bulk' | 'cut' | 'maintain' | null,
  query = '',
  after = '',
  random = false,
) {
  const normalized = normalizeSocialQuery(query);
  return requestSocial<SocialProfile[]>(
    db,
    client,
    owner,
    `search:browse:v2:${goal ?? 'all'}:${normalized}:${after}:${random}`,
    'browse_social_profiles',
    { p_goal: goal, p_query: normalized, p_after: after, p_random: random },
    online,
  );
}
