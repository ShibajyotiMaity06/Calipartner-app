import { getSupabase } from '@/lib/supabase';

export interface CustomAvatar {
  custom_base_url: string;
  gender: 'f' | 'm';
  expires_at: number;
}

type AvatarRequest =
  { action: 'read' } | { action: 'generate'; request_id: string; image_base64: string };

export async function requestCustomAvatar(body: AvatarRequest): Promise<CustomAvatar | null> {
  const { data, error } = await getSupabase().functions.invoke('generate-ai-avatar', { body });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.error ?? 'AVATAR_UNAVAILABLE');
  }
  if (!data?.custom_base_url) return null;
  if (
    typeof data.custom_base_url !== 'string' ||
    !data.custom_base_url.startsWith('https://') ||
    !['m', 'f'].includes(data.gender) ||
    !Number.isFinite(data.expires_at)
  )
    throw new Error('INVALID_AVATAR_RESPONSE');
  return data as CustomAvatar;
}
