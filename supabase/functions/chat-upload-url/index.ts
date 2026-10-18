import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ALLOWED_CHAT_MIME_TYPES,
  buildSignedR2Url,
  generateChatAttachmentStorageKey,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  validateChatStorageKey,
} from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleChatUploadUrl(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { room_id, client_id, filename, mime_type, size, width, height, attachment_index } = body;

    if (!room_id || !client_id || !mime_type || typeof size !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: room_id, client_id, mime_type, size' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Membership check
    const { data: member, error: memberErr } = await adminClient
      .from('room_members')
      .select('status')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .single();

    if (memberErr || !member || !['active', 'paused'].includes(member.status)) {
      return new Response(JSON.stringify({ error: 'NOT_ROOM_MEMBER: Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Room usable check
    const { data: isUsable } = await adminClient.rpc('room_is_usable', { p_room_id: room_id });
    if (!isUsable) {
      return new Response(JSON.stringify({ error: 'ROOM_LOCKED: This room is paused' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Room state check (locked / dormant / archived)
    const { data: roomData } = await adminClient
      .from('rooms')
      .select('state')
      .eq('id', room_id)
      .single();

    if (roomData?.state === 'locked') {
      return new Response(JSON.stringify({ error: 'ROOM_LOCKED: This room is paused' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (roomData?.state === 'dormant') {
      return new Response(
        JSON.stringify({ error: 'ROOM_DORMANT_READ_ONLY: Chat is read-only in dormant rooms' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. File size check
    if (size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'FILE_TOO_LARGE: Maximum image size is 10 MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. File MIME type check
    const normalizedMime = mime_type.toLowerCase();
    if (!ALLOWED_CHAT_MIME_TYPES.includes(normalizedMime as any)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_FILE_TYPE: Allowed types are JPEG, PNG, HEIC, WebP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Image rate limit check (30 images / hour)
    const { data: rateAllowed } = await adminClient.rpc('check_rate_limit', {
      p_key: `chat_img:${user.id}`,
      p_max_requests: 30,
      p_window_seconds: 3600,
    });
    if (rateAllowed === false) {
      return new Response(
        JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED: Maximum 30 images per hour' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7. Terms accepted check
    const { data: termsAccepted } = await adminClient.rpc('has_accepted_chat_terms', {
      p_user_id: user.id,
    });
    if (!termsAccepted) {
      return new Response(
        JSON.stringify({ error: 'TERMS_REQUIRED: Must accept terms before uploading' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 8. Generate storage key
    const extension = filename?.split('.').pop() || normalizedMime.split('/')[1] || 'jpg';
    const index = typeof attachment_index === 'number' ? attachment_index : 0;
    const storageKey = generateChatAttachmentStorageKey(room_id, client_id, index, extension);

    // 9. Presign Cloudflare R2 PUT URL
    const r2AccountId = Deno.env.get('R2_ACCOUNT_ID');
    const r2Bucket = Deno.env.get('R2_CHAT_BUCKET') || 'calipartner-chat-private';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');

    const uploadUrl = buildSignedR2Url({
      method: 'PUT',
      bucket: r2Bucket,
      key: storageKey,
      expiresInSeconds: 300,
      r2AccountId,
      accessKeyId,
      secretAccessKey,
    });

    return new Response(
      JSON.stringify({
        upload_url: uploadUrl,
        storage_key: storageKey,
        headers: {
          'Content-Type': normalizedMime,
        },
        expires_in_seconds: 300,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

if (typeof Deno !== 'undefined') {
  Deno.serve(handleChatUploadUrl);
}
