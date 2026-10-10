import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MealSection,
  PublicUserProfile,
  RoomPrivacySettings,
  RoomReactionType,
  RoomSnapshot,
} from '@calipartner/core';
import {
  parseRoomError,
  type RoomRequestWithDetails,
  type RoomSummary,
  type TagSharedMealInput,
  type UserSummary,
} from '@/types/rooms';
import { getOrGenerateDeviceHash } from './deviceService';

/**
 * List all active rooms the authenticated user belongs to.
 */
export async function listUserRooms(client: SupabaseClient): Promise<RoomSummary[]> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      throw parseRoomError('UNAUTHENTICATED');
    }
    const userId = userData.user.id;

    // Fetch rooms and caller's membership
    const { data, error } = await client
      .from('room_members')
      .select(
        `role, status, room_id,
         rooms ( id, name, code, state, who_can_invite, plan_holder_id, member_cap, created_at )`,
      )
      .eq('user_id', userId)
      .in('status', ['active', 'paused']);

    if (error) {
      throw parseRoomError(error);
    }

    interface RoomMembershipRow {
      room_id: string;
      role: 'host' | 'member';
      rooms: {
        id: string;
        name: string;
        code: string;
        state: 'active' | 'dormant' | 'locked' | 'over_capacity' | 'archived';
        created_at: string;
        who_can_invite?: 'host_only' | 'any_member';
        plan_holder_id?: string | null;
        member_cap?: number;
      } | null;
    }

    const rows = (data ?? []) as unknown as RoomMembershipRow[];
    if (rows.length === 0) {
      return [];
    }

    const roomIds = rows.map((item) => item.room_id);

    // Count members in each room
    const { data: memberCounts, error: countError } = await client
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds)
      .in('status', ['active', 'paused']);

    if (countError) {
      throw parseRoomError(countError);
    }

    const countsMap = new Map<string, number>();
    for (const m of memberCounts ?? []) {
      countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
    }

    const result: RoomSummary[] = [];
    for (const row of rows) {
      const room = row.rooms;
      if (room && room.state !== 'archived') {
        result.push({
          id: room.id,
          name: room.name,
          code: room.code,
          state: room.state,
          role: row.role,
          member_count: countsMap.get(room.id) ?? 1,
          created_at: room.created_at,
          who_can_invite: room.who_can_invite ?? 'host_only',
          plan_holder_id: room.plan_holder_id,
          member_cap: room.member_cap ?? 5,
        });
      }
    }

    return result;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Create a new room. Starts trial automatically if user has not yet used it.
 */
export async function createRoom(
  client: SupabaseClient,
  name: string,
  deviceHash?: string,
): Promise<{ room_id: string; name: string; code: string; role: string; state: string }> {
  try {
    const hash = deviceHash ?? (await getOrGenerateDeviceHash());
    const { data, error } = await client.rpc('create_room', {
      p_name: name,
      p_device_hash: hash,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Join an existing room using its short invite code.
 */
export async function joinRoomByCode(
  client: SupabaseClient,
  code: string,
  deviceHash?: string,
): Promise<{ room_id: string; status: string; name: string }> {
  try {
    const hash = deviceHash ?? (await getOrGenerateDeviceHash());
    const { data, error } = await client.rpc('join_by_code', {
      p_code: code.trim(),
      p_device_hash: hash,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Fetch incoming and outgoing room requests for the current user.
 */
export async function getRequestsInbox(client: SupabaseClient): Promise<{
  incoming: RoomRequestWithDetails[];
  outgoing: RoomRequestWithDetails[];
}> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      throw parseRoomError('UNAUTHENTICATED');
    }
    const userId = userData.user.id;

    const { data, error } = await client
      .from('room_requests')
      .select(
        `id, room_id, sender_id, recipient_id, type, status, expires_at, created_at, responded_at,
         rooms ( id, name, code )`,
      )
      .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw parseRoomError(error);
    }

    interface RequestRow {
      id: string;
      room_id: string;
      sender_id: string;
      recipient_id: string | null;
      type: 'invitation' | 'join_request';
      status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
      expires_at: string;
      created_at: string;
      responded_at: string | null;
      rooms: {
        id: string;
        name: string;
        code: string;
      } | null;
    }

    const allRequests = (data ?? []) as unknown as RequestRow[];
    const userIdsToFetch = new Set<string>();
    for (const r of allRequests) {
      if (r.sender_id) userIdsToFetch.add(r.sender_id);
      if (r.recipient_id) userIdsToFetch.add(r.recipient_id);
    }

    // Fetch profile info for senders and recipients
    const profilesMap = new Map<string, UserSummary>();
    if (userIdsToFetch.size > 0) {
      const { data: profs } = await client
        .from('profiles')
        .select('id, username, nickname, avatar_url')
        .in('id', Array.from(userIdsToFetch));

      for (const p of profs ?? []) {
        profilesMap.set(p.id, {
          id: p.id,
          username: p.username,
          nickname: p.nickname,
          avatar_url: p.avatar_url,
        });
      }
    }

    const incoming: RoomRequestWithDetails[] = [];
    const outgoing: RoomRequestWithDetails[] = [];

    for (const r of allRequests) {
      const room = r.rooms;
      const detail: RoomRequestWithDetails = {
        id: r.id,
        room_id: r.room_id,
        sender_id: r.sender_id,
        recipient_id: r.recipient_id,
        type: r.type,
        status: r.status,
        expires_at: r.expires_at,
        created_at: r.created_at,
        responded_at: r.responded_at,
        room_name: room?.name,
        room_code: room?.code,
        sender_profile: profilesMap.get(r.sender_id),
        recipient_profile: r.recipient_id ? profilesMap.get(r.recipient_id) : undefined,
      };

      if (r.recipient_id === userId) {
        incoming.push(detail);
      } else if (r.sender_id === userId) {
        outgoing.push(detail);
      }
    }

    return { incoming, outgoing };
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Search user by username prefix (min 3 chars). Respects discoverability and excludes blocked users.
 */
export async function searchUserByUsername(
  client: SupabaseClient,
  usernamePrefix: string,
): Promise<PublicUserProfile[]> {
  try {
    const clean = usernamePrefix.trim();
    if (clean.length < 3) return [];

    const { data, error } = await client.rpc('search_users', {
      prefix: clean,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return (data ?? []) as PublicUserProfile[];
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Send an invitation to join a room by exact username.
 */
export async function sendRoomInvitation(
  client: SupabaseClient,
  roomId: string,
  username: string,
): Promise<{ request_id: string; room_id: string; recipient_id: string; status: string }> {
  try {
    const { data, error } = await client.rpc('send_room_invitation', {
      p_room_id: roomId,
      p_username: username.trim(),
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Send a request to join a room by either room code or host username.
 */
export async function requestToJoinRoom(
  client: SupabaseClient,
  roomCodeOrUsername: string,
  deviceHash?: string,
): Promise<{ request_id: string; room_id: string; status: string }> {
  try {
    const hash = deviceHash ?? (await getOrGenerateDeviceHash());
    const { data, error } = await client.rpc('request_to_join', {
      p_target: roomCodeOrUsername.trim(),
      p_device_hash: hash,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Respond to an invitation or join request (Accept or Decline).
 */
export async function respondToRoomRequest(
  client: SupabaseClient,
  requestId: string,
  accept: boolean,
  deviceHash?: string,
): Promise<{ status: 'accepted' | 'declined'; room_id?: string; user_id?: string }> {
  try {
    const hash = deviceHash ?? (await getOrGenerateDeviceHash());
    const { data, error } = await client.rpc('respond_to_request', {
      p_request_id: requestId,
      p_accept: accept,
      p_device_hash: hash,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Cancel a pending outgoing request.
 */
export async function cancelRoomRequest(
  client: SupabaseClient,
  requestId: string,
): Promise<{ status: 'cancelled' }> {
  try {
    const { data, error } = await client.rpc('cancel_request', {
      p_request_id: requestId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Fetch a privacy-enforcing room snapshot.
 * Masks hidden metrics as "locked".
 * Supports search and paging for large rooms.
 */
export async function getRoomSnapshot(
  client: SupabaseClient,
  roomId: string,
  options?: {
    selectedUserId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<RoomSnapshot> {
  try {
    const { data, error } = await client.rpc('get_room_snapshot', {
      p_room_id: roomId,
      p_selected_user_id: options?.selectedUserId ?? null,
      p_search: options?.search ?? null,
      p_page: options?.page ?? 1,
      p_page_size: options?.pageSize ?? 20,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data as RoomSnapshot;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Sponsor a room to become its plan holder.
 */
export async function sponsorRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<{ status: string; room_id: string; plan_holder_id: string }> {
  try {
    const { data, error } = await client.rpc('sponsor_room', {
      p_room_id: roomId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data as { status: string; room_id: string; plan_holder_id: string };
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Read caller's privacy settings for a room.
 */
export async function getPrivacySettings(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomPrivacySettings> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      throw parseRoomError('UNAUTHENTICATED');
    }

    const { data, error } = await client
      .from('room_members')
      .select('privacy_settings')
      .eq('room_id', roomId)
      .eq('user_id', userData.user.id)
      .single();

    if (error) {
      throw parseRoomError(error);
    }

    return data.privacy_settings as RoomPrivacySettings;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Update caller's privacy settings for a room.
 */
export async function updatePrivacySettings(
  client: SupabaseClient,
  roomId: string,
  settings: Partial<RoomPrivacySettings>,
): Promise<RoomPrivacySettings> {
  try {
    const { data, error } = await client.rpc('set_privacy', {
      p_room_id: roomId,
      p_privacy_settings: settings,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data as RoomPrivacySettings;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Update room setting: who can invite ('host_only' or 'any_member'). Host only.
 */
export async function setWhoCanInvite(
  client: SupabaseClient,
  roomId: string,
  whoCanInvite: 'host_only' | 'any_member',
): Promise<{ who_can_invite: string }> {
  try {
    const { data, error } = await client.rpc('set_who_can_invite', {
      p_room_id: roomId,
      p_who_can_invite: whoCanInvite,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Send friendly nudge to room member (limit: 2/recipient/day).
 */
export async function sendNudge(
  client: SupabaseClient,
  roomId: string,
  recipientId: string,
  messageTemplate: string,
): Promise<{ status: 'sent'; nudge_id: string }> {
  try {
    const { data, error } = await client.rpc('nudge', {
      p_room_id: roomId,
      p_recipient_id: recipientId,
      p_message_template: messageTemplate,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * React to a room event from fixed 5 reactions.
 */
export async function sendReaction(
  client: SupabaseClient,
  roomId: string,
  eventId: string,
  reaction: RoomReactionType,
): Promise<{ status: 'reacted'; reaction: string }> {
  try {
    const { data, error } = await client.rpc('react', {
      p_room_id: roomId,
      p_event_id: eventId,
      p_reaction: reaction,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Tag room members in a shared meal.
 */
export async function tagSharedMeal(
  client: SupabaseClient,
  payload: TagSharedMealInput,
): Promise<{ status: 'created'; shared_meal_id: string }> {
  try {
    const { data, error } = await client.rpc('tag_shared_meal', {
      p_room_id: payload.roomId,
      p_food_id: payload.foodId ?? null,
      p_food_name: payload.foodName,
      p_meal_section: payload.mealSection,
      p_quantity: payload.quantity,
      p_unit: payload.unit,
      p_calories: payload.calories,
      p_protein: payload.protein,
      p_carbs: payload.carbs,
      p_fat: payload.fat,
      p_fiber: payload.fiber ?? 0,
      p_sugar: payload.sugar ?? 0,
      p_sodium_mg: payload.sodiumMg ?? 0,
      p_participant_ids: payload.participantIds,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Accept or decline a shared meal. Accepting creates an independent diary entry.
 */
export async function respondSharedMeal(
  client: SupabaseClient,
  sharedMealId: string,
  accept: boolean,
  quantity?: number,
  mealSection?: MealSection,
): Promise<{
  status: 'accepted' | 'declined';
  diary_entry_id?: string;
  quantity?: number;
  calories?: number;
}> {
  try {
    const { data, error } = await client.rpc('respond_shared_meal', {
      p_shared_meal_id: sharedMealId,
      p_accept: accept,
      p_quantity: quantity ?? null,
      p_meal_section: mealSection ?? null,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Leave a room. Transfers host automatically if caller is host.
 */
export async function leaveRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<{ status: 'left'; room_id: string }> {
  try {
    const { data, error } = await client.rpc('leave_room', {
      p_room_id: roomId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Remove a member from the room. Host only.
 */
export async function removeMember(
  client: SupabaseClient,
  roomId: string,
  targetUserId: string,
): Promise<{ status: 'removed'; user_id: string }> {
  try {
    const { data, error } = await client.rpc('remove_member', {
      p_room_id: roomId,
      p_target_user_id: targetUserId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Transfer room host role to another active member. Host only.
 */
export async function transferHost(
  client: SupabaseClient,
  roomId: string,
  newHostId: string,
): Promise<{ status: 'transferred'; new_host_id: string }> {
  try {
    const { data, error } = await client.rpc('transfer_host', {
      p_room_id: roomId,
      p_new_host_id: newHostId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Block another user.
 */
export async function blockUser(
  client: SupabaseClient,
  targetUserId: string,
): Promise<{ status: 'blocked'; target_user_id: string }> {
  try {
    const { data, error } = await client.rpc('block_user', {
      p_target_user_id: targetUserId,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}

/**
 * Report a user, room, message, or meal.
 */
export async function reportTarget(
  client: SupabaseClient,
  targetType: 'user' | 'room' | 'message' | 'profile' | 'meal',
  targetId: string,
  reason: string,
  details?: string,
): Promise<{ status: 'reported'; report_id: string }> {
  try {
    const { data, error } = await client.rpc('report', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_details: details ?? null,
    });

    if (error) {
      throw parseRoomError(error);
    }

    return data;
  } catch (err) {
    throw parseRoomError(err);
  }
}
