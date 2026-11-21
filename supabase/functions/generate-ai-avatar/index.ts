import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import { PNG } from 'npm:pngjs@7.0.0';
import jpeg from 'npm:jpeg-js@0.4.4';
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

async function generateImage(photo: string, reference: Uint8Array, gender: 'm' | 'f' = 'm') {
  const subject = gender === 'f' ? 'athletic woman' : 'athletic man';
  const prompt = `full body 3D fitness game character ${subject} standing in A-pose facing forward, hands slightly away from hips, legs slightly apart, neutral athletic gym base outfit, athletic physique, centered with margins all around, on a solid pure magenta #ff00ff background, no shadows, no ground, no floor, clean cut-out`;

  let imageBytes: Uint8Array | null = null;

  const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN') || Deno.env.get('CF_API_TOKEN');
  const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || Deno.env.get('R2_ACCOUNT_ID');
  const cleanAccount = cfAccount?.replace(/['"]/g, '').trim();

  if (cfToken && cleanAccount) {
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cleanAccount}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, steps: 4 }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (cfRes.ok) {
        const contentType = cfRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await cfRes.json();
          if (json.result?.image) {
            imageBytes = Buffer.from(json.result.image, 'base64');
          }
        } else {
          imageBytes = new Uint8Array(await cfRes.arrayBuffer());
        }
      }
    } catch {
      // Fall through to Pollinations
    }
  }

  if (!imageBytes) {
    const seed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=512&height=768&nologo=true&seed=${seed}`;
    const res = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error('AVATAR_PROVIDER_ERROR');
    imageBytes = new Uint8Array(await res.arrayBuffer());
  }

  if (!imageBytes || imageBytes.byteLength < 1000) throw new Error('AVATAR_PROVIDER_ERROR');

  let sourceWidth = 0;
  let sourceHeight = 0;
  let sourceData: Uint8Array;

  if (imageBytes[0] === 0xff && imageBytes[1] === 0xd8) {
    const decoded = jpeg.decode(Buffer.from(imageBytes));
    sourceWidth = decoded.width;
    sourceHeight = decoded.height;
    sourceData = decoded.data;
  } else {
    const decoded = PNG.sync.read(Buffer.from(imageBytes));
    sourceWidth = decoded.width;
    sourceHeight = decoded.height;
    sourceData = decoded.data;
  }

  const template = PNG.sync.read(Buffer.from(reference));
  const art = new PNG({ width: template.width, height: template.height });
  for (let i = 0; i < art.data.length; i += 4) {
    art.data[i] = 255;
    art.data[i + 1] = 0;
    art.data[i + 2] = 255;
    art.data[i + 3] = 255;
  }

  let minX = template.width;
  let maxX = 0;
  let minY = template.height;
  let maxY = 0;
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      if (template.data[(y * template.width + x) * 4 + 3] > 48) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  for (let y = minY; y <= maxY; y++) {
    const srcY = Math.min(
      sourceHeight - 1,
      Math.max(0, Math.floor(((y - minY) / (maxY - minY)) * sourceHeight)),
    );
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * template.width + x) * 4;
      if (template.data[idx + 3] > 48) {
        const srcX = Math.min(
          sourceWidth - 1,
          Math.max(0, Math.floor(((x - minX) / (maxX - minX)) * sourceWidth)),
        );
        const sIdx = (srcY * sourceWidth + srcX) * 4;
        art.data[idx] = sourceData[sIdx];
        art.data[idx + 1] = sourceData[sIdx + 1];
        art.data[idx + 2] = sourceData[sIdx + 2];
        art.data[idx + 3] = 255;
      }
    }
  }

  const artPng = PNG.sync.write(art);
  return fitAvatarPng(artPng, reference);
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
    const cleanBase64 =
      typeof input?.image_base64 === 'string' ? input.image_base64.replace(/\s+/g, '') : '';
    if (
      input?.action !== 'generate' ||
      typeof input.request_id !== 'string' ||
      !uuid.test(input.request_id) ||
      !cleanBase64 ||
      cleanBase64.length > (photoLimit * 4) / 3 ||
      !/^[a-z0-9+/]+={0,2}$/i.test(cleanBase64)
    )
      return respond({ error: 'INVALID_PHOTO' }, 400);
    const photo = Buffer.from(cleanBase64, 'base64');
    const isJpeg = photo[0] === 255 && photo[1] === 216 && photo[2] === 255;
    const isPng = photo[0] === 0x89 && photo[1] === 0x50 && photo[2] === 0x4e && photo[3] === 0x47;
    if (!isJpeg && !isPng) return respond({ error: 'INVALID_PHOTO' }, 400);
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
      const png = await generateImage(input.image_base64, reference, reservation.gender);
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
