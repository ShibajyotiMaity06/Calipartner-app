import { createClient } from 'jsr:@supabase/supabase-js@2';
import { StubImageModerationProvider, stripImageExif } from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleChatImageModeration(req: Request): Promise<Response> {
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
    const { attachment_id, storage_key, mime_type, test_flag } = body;

    if (!attachment_id || !storage_key) {
      return new Response(JSON.stringify({ error: 'Missing attachment_id or storage_key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call provider adapter
    const provider = new StubImageModerationProvider();
    const result = await provider.moderateImage({
      storageKey: storage_key,
      mimeType: mime_type || 'image/jpeg',
      testFlag: test_flag,
    });

    // Update attachment record in database
    const { error: updateErr } = await adminClient
      .from('chat_attachments')
      .update({ moderation_status: result.status })
      .eq('id', attachment_id);

    if (updateErr) {
      console.warn('Failed to update attachment moderation status:', updateErr.message);
    }

    // Insert entry into moderation_queue
    await adminClient.from('moderation_queue').insert({
      attachment_id,
      status: result.status === 'blocked' ? 'flagged' : 'approved',
      provider: 'stub',
      provider_score: result.score,
      flagged_reasons: result.reasons,
      details: { isNsfw: result.isNsfw },
    });

    return new Response(
      JSON.stringify({
        attachment_id,
        status: result.status,
        score: result.score,
        reasons: result.reasons,
        is_nsfw: result.isNsfw,
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
  Deno.serve(handleChatImageModeration);
}
