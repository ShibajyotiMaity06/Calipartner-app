import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { DEFAULT_TRACKING, personalTrackingCompletion } from '@feed-tracking';
import { checkMediaSafety, hasMediaSignature } from '../chat-image-moderation/index.ts';
import { removeFeedObject } from '../_shared/feedStorage.ts';
import { signR2Url } from '../_shared/r2.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const maxBytes = 10 * 1024 * 1024;
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

class FeedError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: cors });
}

async function readBytes(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new FeedError('FEED_INVALID_REQUEST', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new FeedError('FEED_TOO_LARGE', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function checked({ data, error }: { data: unknown; error: { message: string } | null }) {
  if (error) {
    if (error.message === 'FEED_LIMIT') throw new FeedError('FEED_LIMIT', 429);
    if (['FEED_UNAVAILABLE', 'FEED_RULES_REQUIRED'].includes(error.message))
      throw new FeedError(error.message, 403);
    throw new FeedError('FEED_SERVER_ERROR', 500);
  }
  return data;
}

type GoalInput = {
  values: Parameters<typeof personalTrackingCompletion>[0];
  targets: Parameters<typeof personalTrackingCompletion>[1];
  enabled: Parameters<typeof personalTrackingCompletion>[2] | null;
};
export function projectComparison(input: {
  status: 'locked' | 'hidden' | 'ready';
  date?: string;
  you?: GoalInput | null;
  author?: GoalInput | null;
}) {
  if (input.status !== 'ready') return { status: input.status };
  const score = (person: GoalInput | null | undefined) =>
    person
      ? personalTrackingCompletion(
          person.values,
          person.targets,
          person.enabled ?? DEFAULT_TRACKING,
        )
      : null;
  return { status: 'ready', date: input.date, you: score(input.you), author: score(input.author) };
}

async function publish(
  req: Request,
  db: SupabaseClient,
  actor: string,
  postId: string,
  fetcher: typeof fetch,
) {
  const post = checked(
    await db
      .from('feed_posts')
      .select('state,storage_key,media_type,caption,description')
      .eq('id', postId)
      .eq('author_id', actor)
      .maybeSingle(),
  ) as {
    state: string;
    storage_key: string;
    media_type: string;
    caption: string;
    description: string;
  } | null;
  if (!post || !['draft', 'published'].includes(post.state))
    throw new FeedError('FEED_UNAVAILABLE', 403);
  if (post.state === 'published') return json({ id: postId });

  const bytes = await readBytes(req, maxBytes);
  if (bytes.length < 12 || !hasMediaSignature(bytes, post.media_type))
    throw new FeedError('FEED_UNSUPPORTED_MEDIA', 400);
  await admitModeration(db, actor, post.media_type.startsWith('video/'));
  if (
    !(await checkMediaSafety(bytes, post.media_type, fetcher, {
      caption: post.caption,
      description: post.description,
    }))
  )
    throw new FeedError('FEED_CONTENT_REJECTED', 422);

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const fingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const headers = {
    'Content-Type': post.media_type,
    'If-None-Match': '*',
    'Cache-Control': 'private, no-store',
    'x-amz-meta-sha256': fingerprint,
  };
  const key = post.storage_key;
  const url = await signR2Url({ method: 'PUT', key, headers, expiresInSeconds: 60 });
  const stored = await fetcher(url, {
    method: 'PUT',
    headers,
    body: bytes,
    signal: AbortSignal.timeout(20000),
  });
  if (stored.status === 412) {
    const existing = await fetcher(await signR2Url({ method: 'HEAD', key, expiresInSeconds: 60 }), {
      method: 'HEAD',
      signal: AbortSignal.timeout(15000),
    });
    if (!existing.ok || existing.headers.get('x-amz-meta-sha256') !== fingerprint)
      throw new FeedError('FEED_DRAFT_CHANGED', 409);
  } else if (!stored.ok) {
    throw new FeedError('FEED_STORAGE_UNAVAILABLE', 503);
  }

  const result = await db.rpc('publish_feed_post', { p_post: postId, p_actor: actor });
  if (result.error?.message === 'FEED_UNAVAILABLE') await removeFeedObject(key, fetcher);
  return json({ id: checked(result) });
}

async function admitModeration(db: SupabaseClient, actor: string, video: boolean) {
  if (!checked(await db.rpc('check_feed_moderation_limit', { p_actor: actor, p_video: video })))
    throw new FeedError('FEED_LIMIT', 429);
}

export async function handleFeedRequest(
  req: Request,
  makeClient = createClient,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json({ error: 'FEED_SIGN_IN' }, 401);

  try {
    const db = makeClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'FEED_SIGN_IN' }, 401);
    const actor = data.user.id;
    const params = new URL(req.url).searchParams;
    const post = params.get('post');
    if (!uuid(post)) throw new FeedError('FEED_INVALID_REQUEST', 400);
    const identity = { p_post: post, p_viewer: actor };

    switch (params.get('action')) {
      case 'publish':
        return await publish(req, db, actor, post, fetcher);
      case 'media': {
        const key = checked(await db.rpc('feed_media_for_viewer', identity));
        if (typeof key !== 'string') throw new FeedError('FEED_UNAVAILABLE', 403);
        return json({ url: await signR2Url({ method: 'GET', key }) });
      }
      case 'compare': {
        const inputs = checked(await db.rpc('feed_compare_inputs', identity));
        return json(projectComparison(inputs as Parameters<typeof projectComparison>[0]));
      }
      case 'delete': {
        const key = checked(await db.rpc('delete_feed_post', { p_post: post, p_actor: actor }));
        if (typeof key !== 'string') throw new FeedError('FEED_UNAVAILABLE', 403);
        if (key) {
          await removeFeedObject(key, fetcher);
          checked(
            await db
              .from('feed_posts')
              .update({ media_removed_at: new Date().toISOString() })
              .eq('id', post)
              .eq('author_id', actor)
              .eq('state', 'deleted'),
          );
        }
        return json({ id: post });
      }
      case 'comment': {
        const id = params.get('id');
        const body = new TextDecoder().decode(await readBytes(req, 2000)).trim();
        if (!uuid(id) || !body || Array.from(body).length > 500)
          throw new FeedError('FEED_INVALID_REQUEST', 400);
        const args = { p_post: post, p_actor: actor, p_id: id, p_body: body };
        const exists = checked(await db.rpc('feed_comment_status', args));
        if (!exists) {
          await admitModeration(db, actor, false);
          if (!(await checkMediaSafety(null, null, fetcher, { comment: body })))
            throw new FeedError('FEED_CONTENT_REJECTED', 422);
        }
        return json({ id: exists ? id : checked(await db.rpc('add_feed_comment', args)) });
      }
      default:
        throw new FeedError('FEED_INVALID_REQUEST', 400);
    }
  } catch (error) {
    if (error instanceof FeedError) return json({ error: error.code }, error.status);
    const reason = error instanceof Error ? error.message : '';
    const moderation = /^MODERATION_(?:UNAVAILABLE|PROVIDER_\d{3})$/.test(reason);
    if (moderation) console.warn('Feed moderation unavailable', reason);
    const code = moderation ? 'FEED_MODERATION_UNAVAILABLE' : 'FEED_SERVER_ERROR';
    return json({ error: code }, 503);
  }
}

if (import.meta.main) Deno.serve((req) => handleFeedRequest(req));
