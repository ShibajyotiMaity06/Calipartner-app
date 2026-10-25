export const FREE_FRIEND_REQUESTS_PER_WEEK = 3;
export const FRIEND_REQUEST_WINDOW_DAYS = 7;

export interface SocialProfileDraft {
  bio: string;
  training_style: string;
  instagram_handle: string;
  website_url: string;
  is_public: boolean;
}
export type SocialRelationship = 'self' | 'none' | 'incoming' | 'outgoing' | 'friends';
export interface SocialProfile extends SocialProfileDraft {
  edited_at?: string | null;
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  relationship: SocialRelationship;
  request_id: string | null;
}
export interface FriendRequestQuota {
  premium: boolean;
  sent: number;
  remaining: number | null;
  resets_at: string | null;
}
export interface FriendInbox {
  incoming: SocialProfile[];
  outgoing: SocialProfile[];
  friends: SocialProfile[];
  quota: FriendRequestQuota;
}
export type FriendAction = 'accept' | 'decline' | 'cancel' | 'remove';

export function normalizeSocialQuery(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}
export function isSocialQueryValid(value: string): boolean {
  return /^[a-z0-9_.]{3,20}$/.test(normalizeSocialQuery(value));
}
export function validateSocialProfile(input: SocialProfileDraft): {
  valid: boolean;
  field?: keyof SocialProfileDraft;
} {
  if (input.bio.trim().length > 240) return { valid: false, field: 'bio' };
  if (input.training_style.trim().length > 80) return { valid: false, field: 'training_style' };
  const handle = input.instagram_handle.trim().replace(/^@/, '');
  if (handle && !/^[A-Za-z0-9_.]{1,30}$/.test(handle))
    return { valid: false, field: 'instagram_handle' };
  if (input.website_url.trim()) {
    try {
      const url = new URL(input.website_url.trim());
      if (
        input.website_url.trim().length > 2048 ||
        url.protocol !== 'https:' ||
        !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(url.hostname) ||
        url.href.length > 2048 ||
        url.username ||
        url.password
      )
        return { valid: false, field: 'website_url' };
    } catch {
      return { valid: false, field: 'website_url' };
    }
  }
  return { valid: true };
}

/** Calendar-independent UTC window prevents timezone changes from refilling the allowance. */
export function friendRequestQuota(
  sentAt: readonly string[],
  premium: boolean,
  now = new Date(),
): FriendRequestQuota {
  const start = now.getTime() - FRIEND_REQUEST_WINDOW_DAYS * 86400000;
  const recent = sentAt
    .map(Date.parse)
    .filter((at) => Number.isFinite(at) && at > start && at <= now.getTime());
  return {
    premium,
    sent: recent.length,
    remaining: premium ? null : Math.max(0, FREE_FRIEND_REQUESTS_PER_WEEK - recent.length),
    resets_at:
      !premium && recent.length >= FREE_FRIEND_REQUESTS_PER_WEEK
        ? new Date(
            recent.sort((a, b) => b - a)[FREE_FRIEND_REQUESTS_PER_WEEK - 1]! +
              FRIEND_REQUEST_WINDOW_DAYS * 86400000,
          ).toISOString()
        : null,
  };
}
