import { signR2Url } from './r2.ts';

export async function removeFeedObject(key: string, fetcher: typeof fetch = fetch) {
  const url = await signR2Url({ method: 'DELETE', key, expiresInSeconds: 60 });
  const response = await fetcher(url, { method: 'DELETE', signal: AbortSignal.timeout(15000) });
  if (!response.ok && response.status !== 404) throw new Error('FEED_STORAGE_UNAVAILABLE');
}
