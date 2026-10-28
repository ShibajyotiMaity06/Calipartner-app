import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildSignedR2Url,
  CHAT_SIGNED_URL_EXPIRY_SECONDS,
  validateChatStorageKey,
} from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleChatSignedUrl(
  req: Request,
  makeClient = createClient,
): Promise<Response> {
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

    const adminClient = makeClient(supabaseUrl, supabaseServiceKey);
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
    const { room_id, storage_key } = body;

    if (!room_id || !storage_key) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: room_id, storage_key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Path traversal & key format validation
    if (!validateChatStorageKey(storage_key, room_id)) {
      return new Response(
        JSON.stringify({ error: 'INVALID_STORAGE_KEY: Key is invalid or does not belong to room' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Room membership check (active/paused members only)
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

    // 3. Room usable & Locked check
    const { data: isUsable } = await adminClient.rpc('room_is_usable', { p_room_id: room_id });
    if (!isUsable) {
      return new Response(JSON.stringify({ error: 'ROOM_LOCKED: This room is paused' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const access = await adminClient.rpc('active_room_tier', { p_user_id: user.id });
    if (access.error || !['plus', 'pro'].includes(access.data)) {
      return new Response(JSON.stringify({ error: 'PLUS_REQUIRED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Generate short-lived signed GET URL (expires in 15 minutes = 900 seconds)
    const r2AccountId = Deno.env.get('R2_ACCOUNT_ID');
    const r2Bucket = Deno.env.get('R2_CHAT_BUCKET') || 'calipartner-chat-private';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');

    const signedUrl = buildSignedR2Url({
      method: 'GET',
      bucket: r2Bucket,
      key: storage_key,
      expiresInSeconds: CHAT_SIGNED_URL_EXPIRY_SECONDS,
      r2AccountId,
      accessKeyId,
      secretAccessKey,
    });

    return new Response(
      JSON.stringify({
        signed_url: signedUrl,
        expires_in_seconds: CHAT_SIGNED_URL_EXPIRY_SECONDS,
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

if (import.meta.main) {
  Deno.serve((req) => handleChatSignedUrl(req));
}
