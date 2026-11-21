import { signR2Url } from './r2.ts';

export const avatarKey = (userId: string, requestId: string) =>
  `avatars/${userId}/${requestId}.png`;

export async function deleteCustomAvatarObject(userId: string, requestId: string) {
  const url = await signR2Url({ method: 'DELETE', key: avatarKey(userId, requestId) });
  const response = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(10000) });
  if (!response.ok && response.status !== 404) throw new Error('AVATAR_DELETE_FAILED');
}
