import { secureStoreAdapter } from '@/lib/secureStore';
import { publicSite } from '@/i18n/publicSite';

export const isFeedId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const feedPostLink = (id: string) => publicSite.origin + '/feed/post/' + id;

const pendingPost = 'calipartner.pending_feed_post';
let taking = false;

export async function rememberFeedPost(id: string) {
  if (isFeedId(id)) await secureStoreAdapter.setItem(pendingPost, id);
}

export async function takePendingFeedPost() {
  if (taking) return null;
  taking = true;
  try {
    const id = await secureStoreAdapter.getItem(pendingPost);
    if (!isFeedId(id)) return null;
    await secureStoreAdapter.removeItem(pendingPost);
    return id;
  } finally {
    taking = false;
  }
}
