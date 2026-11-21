import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import { signR2Url } from '../_shared/r2.ts';
import { avatarKey, deleteCustomAvatarObject } from '../_shared/customAvatarStorage.ts';
import { fitAvatarPng } from './fit.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const photoLimit = 3_000_000;
const signedSeconds = 120;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (body: object, status = 200) => Response.json(body, { status, headers });

type AvatarProjection = {
  gender: 'm' | 'f';
  request_id: string | null;
  period_end: string | null;
};
type Part = { text?: string; inlineData?: { data: string; mimeType: string } };

async function generateImage(photo: string, reference: Uint8Array) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('AVATAR_NOT_CONFIGURED');
  const model = Deno.env.get('GEMINI_AVATAR_MODEL') || 'gemini-3.1-flash-image';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(75000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Image 1 is a precise wardrobe mannequin template. Image 2 is the person reference. If image 2 lacks one adult visible from head to feet, only reply FULL_BODY_REQUIRED without any image. Otherwise redraw image 1 as a polished 3D fitness-game avatar resembling the person in image 2 (face, facial hair, complexion). Match the entire standing A-pose, silhouette, head size, shoulders, neck, hips, hand and foot positions of image 1. Use a close-fitting neutral athletic base outfit, no outerwear, footwear or accessories. Use the template proportions rather than the subjects proportions. Center the figure with margins all around on a solid #ff00ff background; no ground, cast shadow, decorations, frames or text. Output exactly one image.',
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: Buffer.from(reference).toString('base64'),
                },
              },
              { inlineData: { mimeType: 'image/jpeg', data: photo } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '9:16', imageSize: '1K' },
        },
      }),
    },
  );
  if (!response.ok) throw new Error('AVATAR_PROVIDER_ERROR');
  const body = (await response.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  if (parts.some((part) => part.text?.includes('FULL_BODY_REQUIRED')))
    throw new Error('FULL_BODY_REQUIRED');
  const image = parts.find((part) => part.inlineData?.mimeType === 'image/png')?.inlineData;
  if (!image || image.data.length > 12_000_000) throw new Error('AVATAR_PROVIDER_ERROR');
  return fitAvatarPng(Buffer.from(image.data, 'base64'), reference);
}

async function currentAvatar(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc('get_custom_avatar', { p_user_id: userId });
  if (error) throw new Error('AVATAR_LOOKUP_FAILED');
  return data as AvatarProjection | null;
}

async function signedAvatar(admin: SupabaseClient, userId: string) {
  const avatar = await currentAvatar(admin, userId);
  if (!avatar?.request_id) return respond({ custom_base_url: null });
  const seconds = Math.min(
    signedSeconds,
    avatar.period_end
      ? Math.floor((Date.parse(avatar.period_end) - Date.now()) / 1000)
      : signedSeconds,
  );
  if (seconds < 1) return respond({ custom_base_url: null });
  const url = await signR2Url({
    method: 'GET',
    key: avatarKey(userId, avatar.request_id),
    expiresInSeconds: seconds,
  });
  return respond({
    custom_base_url: url,
    gender: avatar.gender,
    expires_at: Date.now() + seconds * 1000,
  });
}

export async function handleAvatar(req: Request, makeClient = createClient) {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const bearer = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return respond({ error: 'UNAUTHENTICATED' }, 401);
    const admin = makeClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(bearer);
    if (error || !user) return respond({ error: 'UNAUTHENTICATED' }, 401);
    if (Number(req.headers.get('Content-Length')) > (photoLimit * 4) / 3 + 1024)
      return respond({ error: 'INVALID_PHOTO' }, 413);
    const input = await req.json().catch(() => null);
    if (input?.action === 'read') return await signedAvatar(admin, user.id);
    if (!(await currentAvatar(admin, user.id))) return respond({ error: 'UPGRADE_REQUIRED' }, 403);
    if (
      input?.action !== 'generate' ||
      typeof input.request_id !== 'string' ||
      !uuid.test(input.request_id) ||
      typeof input.image_base64 !== 'string' ||
      input.image_base64.length > (photoLimit * 4) / 3 ||
      !/^[a-z0-9+/]+={0,2}$/i.test(input.image_base64)
    )
      return respond({ error: 'INVALID_PHOTO' }, 400);
    const photo = Buffer.from(input.image_base64, 'base64');
    if (photo[0] !== 255 || photo[1] !== 216 || photo[2] !== 255)
      return respond({ error: 'INVALID_PHOTO' }, 400);
    const requestId = input.request_id.toLowerCase();
    const photoHash = Buffer.from(await crypto.subtle.digest('SHA-256', photo)).toString('hex');
    const args = { p_user_id: user.id, p_request_id: requestId };
    const { data: reservation, error: reserveError } = await admin.rpc('begin_custom_avatar', {
      ...args,
      p_photo_hash: photoHash,
    });
    if (reserveError) throw new Error('AVATAR_RESERVATION_FAILED');
    if (reservation?.replay) return await signedAvatar(admin, user.id);
    if (!reservation?.lease_id)
      return respond({ error: reservation?.code ?? 'AVATAR_RESERVATION_FAILED' }, 409);
    const leaseArgs = { ...args, p_lease_id: reservation.lease_id };
    const object = avatarKey(user.id, requestId);
    try {
      const reference = await Deno.readFile(
        new URL(
          reservation.gender === 'f' ? './base_f_form1.png' : './base_m_form1.png',
          import.meta.url,
        ),
      );
      const png = await generateImage(input.image_base64, reference);
      const uploadHeaders = { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' };
      const url = await signR2Url({ method: 'PUT', key: object, headers: uploadHeaders });
      const uploaded = await fetch(url, {
        method: 'PUT',
        body: png,
        headers: uploadHeaders,
        signal: AbortSignal.timeout(15000),
      });
      if (!uploaded.ok) throw new Error('AVATAR_UPLOAD_FAILED');
      const signed = await signR2Url({
        method: 'GET',
        key: object,
        expiresInSeconds: signedSeconds,
      });
      const { data: settled, error: settleError } = await admin.rpc('finish_custom_avatar', {
        ...leaseArgs,
        p_url: signed,
      });
      if (settleError || !settled?.saved) throw new Error('AVATAR_SAVE_FAILED');
      if (settled.previous_id && settled.previous_id !== requestId)
        await deleteCustomAvatarObject(user.id, settled.previous_id).catch(() => undefined);
    } catch (cause) {
      const { data: released } = await admin.rpc('finish_custom_avatar', leaseArgs);
      if (released?.released)
        await deleteCustomAvatarObject(user.id, requestId).catch(() => undefined);
      const error = cause instanceof Error ? cause.message : '';
      if (error === 'FULL_BODY_REQUIRED' || error === 'AVATAR_FIT_FAILED')
        return respond({ error }, 422);
      throw cause;
    }
    return await signedAvatar(admin, user.id);
  } catch {
    return respond({ error: 'AVATAR_UNAVAILABLE' }, 503);
  }
}

if (import.meta.main) Deno.serve((request) => handleAvatar(request));
