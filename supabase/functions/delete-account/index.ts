import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Retrieve caller user from JWT
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      // Idempotent: If token is invalid because user is already deleted, return success
      return new Response(
        JSON.stringify({ success: true, message: 'User already deleted or session expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;

    const media = await adminClient
      .from('chat_media_uploads')
      .select('storage_key')
      .eq('user_id', userId)
      .limit(1);
    if (media.error) throw new Error('CHAT_MEDIA_LOOKUP_FAILED');
    if (media.data?.length) {
      const response = await fetch(`${supabaseUrl}/functions/v1/chat-image-moderation`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        },
        body: JSON.stringify({ action: 'cleanup' }),
      });
      if (!response.ok) throw new Error('CHAT_MEDIA_DELETE_FAILED');
    }
    // 1. Room Preservation & Ownership Transfer (Finding H21)
    // Avoid cascading rooms and destroying other members' room history
    const { data: hostedRooms } = await adminClient
      .from('rooms')
      .select('id, created_by, plan_holder_id')
      .or(`created_by.eq.${userId},plan_holder_id.eq.${userId}`);

    if (hostedRooms && hostedRooms.length > 0) {
      for (const room of hostedRooms) {
        // Find other active members in the room
        const { data: otherMembers } = await adminClient
          .from('room_members')
          .select('user_id, joined_at')
          .eq('room_id', room.id)
          .neq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1);

        if (otherMembers && otherMembers.length > 0) {
          const newHost = otherMembers[0].user_id;
          await adminClient
            .from('rooms')
            .update({
              created_by: room.created_by === userId ? newHost : room.created_by,
              plan_holder_id: room.plan_holder_id === userId ? null : room.plan_holder_id,
              state: 'dormant', // Needs a new plan to become active
              updated_at: new Date().toISOString(),
            })
            .eq('id', room.id);
        } else {
          // No other members; archive room
          await adminClient
            .from('rooms')
            .update({
              state: 'archived',
              plan_holder_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', room.id);
        }
      }
    }

    // 2. Remove user from room memberships
    await adminClient.from('room_members').delete().eq('user_id', userId);

    // 3. Delete attachments & chat metadata owned by user
    const ownMessages = await adminClient
      .from('chat_messages')
      .select('id')
      .eq('sender_id', userId);
    if (ownMessages.error) throw new Error('CHAT_METADATA_DELETE_FAILED');
    if (ownMessages.data?.length)
      await adminClient
        .from('chat_attachments')
        .delete()
        .in(
          'message_id',
          ownMessages.data.map((message) => message.id),
        );

    // 4. Delete user profile and all cascade-linked user records
    const { error: profileError } = await adminClient.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.warn('Profile deletion notice:', profileError.message);
    }

    // 5. Clean up entitlements & devices
    await adminClient.from('entitlements').delete().eq('user_id', userId);
    await adminClient.from('devices').delete().eq('user_id', userId);
    await adminClient.from('blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    // 6. Delete user from auth.users (Fail closed - H21 fix)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error('Auth user delete failed:', deleteUserError.message);
      return new Response(
        JSON.stringify({
          error: `Failed to remove user account: ${deleteUserError.message}`,
          code: 'AUTH_DELETE_FAILED',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account and associated data deleted successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Account deletion error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to delete account', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
