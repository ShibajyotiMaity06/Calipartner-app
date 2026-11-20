import { getSupabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export type FeedPerson = { id: string; nickname: string | null; username: string | null };
export type FeedAudience = 'friends' | 'squads' | 'community';
export type FeedPost = {
  id: string;
  author: FeedPerson;
  caption: string;
  description: string;
  media_type: string;
  audience: FeedAudience;
  published_at: string;
  likes: number;
  liked: boolean;
  comments: number;
};
export type FeedComment = { id: string; author: FeedPerson; body: string; created_at: string };
export type FeedProfile = FeedPerson & { bio: string };
export type FeedPreferences = { accepted: boolean; community: boolean };
export type ShareTargets = { people: FeedPerson[]; squads: { id: string; name: string }[] };
export type FeedComparison =
  | { status: 'locked' | 'hidden' }
  | { status: 'ready'; date: string; you: number | null; author: number | null };

export const feedMaxBytes = 10 * 1024 * 1024;
const feedTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export function getFeedMediaType(type: string | null | undefined, name: string | null | undefined) {
  if (type && Object.values(feedTypes).includes(type)) return type;
  const ext = name?.split('.').pop()?.toLowerCase();
  return ext && Object.hasOwn(feedTypes, ext) ? feedTypes[ext as keyof typeof feedTypes] : null;
}

export class FeedError extends Error {}

async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new FeedError(error.message);
  return data as T;
}

async function edge<T>(
  action: string,
  post: string,
  body?: string | Blob | ArrayBuffer,
  id?: string,
) {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new FeedError('FEED_SIGN_IN');
  const url = new URL(env.supabaseUrl + '/functions/v1/feed-api');
  url.searchParams.set('action', action);
  url.searchParams.set('post', post);
  if (id) url.searchParams.set('id', id);
  const send = Platform.OS === 'web' ? globalThis.fetch : expoFetch;
  const response = await send(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + data.session.access_token,
      apikey: env.supabaseAnonKey,
      'Content-Type': action === 'publish' ? 'application/octet-stream' : 'text/plain',
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new FeedError(result?.error);
  return result as T;
}

export const feedApi = {
  list: ({ author, shared, before }: { author?: string; shared?: boolean; before?: FeedPost }) =>
    rpc<FeedPost[]>('list_feed_posts', {
      p_author: author ?? null,
      p_shared: shared ?? false,
      p_before: before?.published_at ?? null,
      p_before_id: before?.id ?? null,
    }),
  post: (post: string) => rpc<FeedPost | null>('get_feed_post', { p_post: post }),
  profile: (id: string) => rpc<FeedProfile | null>('get_feed_profile', { p_user: id }),
  preferences: () => rpc<FeedPreferences | null>('get_feed_preferences'),
  accept: () => rpc<boolean>('accept_feed_rules'),
  media: (post: string) => edge<{ url: string }>('media', post),
  async publish(input: {
    id: string;
    uri: string;
    file?: Blob;
    caption: string;
    description: string;
    mediaType: string;
    audience: FeedAudience;
    shareProgress: boolean;
    retrying: boolean;
  }) {
    if (input.retrying) {
      const posted = await rpc<FeedPost | null>('get_feed_post', { p_post: input.id });
      if (posted?.id === input.id) return { id: posted.id };
    }
    const file =
      input.file ??
      (Platform.OS === 'web'
        ? await (await globalThis.fetch(input.uri)).blob()
        : new File(input.uri));
    if (!file.size || file.size > feedMaxBytes) throw new FeedError('FEED_TOO_LARGE');
    const reserved = await rpc<string>('reserve_feed_post', {
      p_id: input.id,
      p_caption: input.caption,
      p_description: input.description,
      p_media_type: input.mediaType,
      p_audience: input.audience,
      p_share_progress: input.shareProgress,
    });
    if (reserved !== input.id) throw new FeedError('FEED_UNCONFIRMED');
    const result = await edge<{ id: string }>('publish', input.id, await file.arrayBuffer());
    if (result.id !== input.id) throw new FeedError('FEED_UNCONFIRMED');
    return result;
  },
  async remove(post: string) {
    if ((await edge<{ id: string }>('delete', post)).id !== post)
      throw new FeedError('FEED_UNCONFIRMED');
  },
  like: (post: string, liked: boolean) =>
    rpc<FeedPost>('set_feed_like', { p_post: post, p_liked: liked }),
  comments: (post: string, before?: FeedComment) =>
    rpc<FeedComment[]>('list_feed_comments', {
      p_post: post,
      p_before: before?.created_at ?? null,
      p_before_id: before?.id ?? null,
    }),
  async comment(post: string, id: string, body: string) {
    if ((await edge<{ id: string }>('comment', post, body, id)).id !== id)
      throw new FeedError('FEED_UNCONFIRMED');
  },
  async removeComment(id: string) {
    if (!(await rpc<boolean>('delete_feed_comment', { p_id: id })))
      throw new FeedError('FEED_UNCONFIRMED');
  },
  compare: (post: string) => edge<FeedComparison>('compare', post),
  targets: (post: string) => rpc<ShareTargets>('feed_share_targets', { p_post: post }),
  async share(post: string, id: string, target: string, squad: boolean) {
    if (
      !(await rpc<number>('share_feed_post', {
        p_id: id,
        p_post: post,
        p_target: target,
        p_squad: squad,
      }))
    )
      throw new FeedError('FEED_UNCONFIRMED');
  },
  report: (post: string, id: string, reason: string, comment?: string) =>
    rpc<boolean>('report_feed_content', {
      p_post: post,
      p_id: id,
      p_comment: comment ?? null,
      p_reason: reason,
    }),
  async block(owner: string, target: string) {
    const result = await rpc<{ status: string; target_user_id: string }>('block_social_profile', {
      p_actor_id: owner,
      p_target_id: target,
    });
    if (result?.status !== 'blocked' || result.target_user_id !== target)
      throw new FeedError('FEED_UNCONFIRMED');
  },
  reportUser: (owner: string, id: string, target: string, reason: string) =>
    rpc<{ status: string }>('report_social_profile', {
      p_actor_id: owner,
      p_report_id: id,
      p_target_id: target,
      p_reason: reason,
    }),
};
