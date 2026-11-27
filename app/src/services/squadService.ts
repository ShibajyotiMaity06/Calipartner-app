import { cachedRead } from './offlineReadService';
import {
  rankSquadMembers,
  type CompareRange,
  type SquadActivityItem,
  type SquadComparePayload,
  type SquadMember,
  type SquadMemberDetails,
  type SquadMentions,
  type SquadToday,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { diaryEvents } from './diaryEvents';
import { invalidateReadCache } from './readCache';

export async function getSquadToday(roomId: string): Promise<SquadToday> {
  return cachedRead(getSupabase(), 'squad:' + roomId, async () => {
    const { data, error } = await getSupabase().rpc('get_squad_today', { p_room_id: roomId });
    if (error) throw error;
    if (data?.room_id !== roomId || !Array.isArray(data.members))
      throw new Error('SQUAD_UNAVAILABLE');
    return {
      room_id: roomId,
      pinned_goal: (data.pinned_goal as string | null | undefined) ?? null,
      latest_message: (data.latest_message as SquadToday['latest_message']) ?? null,
      members: rankSquadMembers(data.members as SquadMember[]),
    };
  });
}
export async function getSquadMemberDetails(
  roomId: string,
  memberId: string,
): Promise<SquadMemberDetails> {
  return cachedRead(getSupabase(), 'squad-details:' + roomId + ':' + memberId, async () => {
    const { data, error } = await getSupabase().rpc('get_squad_member_details', {
      p_room_id: roomId,
      p_member_id: memberId,
    });
    if (error) throw error;
    return data as SquadMemberDetails;
  });
}
export async function getSquadMentions(
  roomId: string,
  before?: { created_at: string; message_id: string },
): Promise<SquadMentions> {
  const { data, error } = await getSupabase().rpc('get_squad_mentions', {
    p_room_id: roomId,
    p_before_created_at: before?.created_at ?? null,
    p_before_id: before?.message_id ?? null,
  });
  if (error) throw error;
  return data as SquadMentions;
}
export async function markSquadMentionSeen(roomId: string, messageId: string) {
  const { error } = await getSupabase().rpc('mark_squad_mention_seen', {
    p_room_id: roomId,
    p_message_id: messageId,
  });
  if (error) throw error;
  diaryEvents.emitChange();
}
export interface SquadVisibility {
  share_weight: boolean;
  share_height: boolean;
}
export async function getSquadVisibility(roomId: string): Promise<SquadVisibility> {
  const { data, error } = await getSupabase().rpc('get_squad_visibility', { p_room_id: roomId });
  if (error) throw error;
  return data as SquadVisibility;
}
export async function setSquadVisibility(
  roomId: string,
  settings: SquadVisibility,
): Promise<SquadVisibility> {
  const { data, error } = await getSupabase().rpc('set_squad_visibility', {
    p_room_id: roomId,
    p_share_weight: settings.share_weight,
    p_share_height: settings.share_height,
  });
  if (error) throw error;
  diaryEvents.emitChange();
  return data as SquadVisibility;
}

export async function getSquadUnreadCount(roomId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('get_chat_unread_count', { p_room_id: roomId });
  if (error) throw error;
  if (typeof data !== 'number' || !Number.isFinite(data) || data < 0)
    throw new Error('UNREAD_UNAVAILABLE');
  return data;
}

export async function getSquadActivity(roomId: string, limit = 12): Promise<SquadActivityItem[]> {
  return cachedRead(getSupabase(), 'squad-activity:' + roomId, async () => {
    const { data, error } = await getSupabase().rpc('get_squad_activity', {
      p_room_id: roomId,
      p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? (data as SquadActivityItem[]) : [];
  });
}

export async function setRoomPinnedGoal(
  roomId: string,
  goal: string | null,
): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('set_room_pinned_goal', {
    p_room_id: roomId,
    p_goal: goal,
  });
  if (error) throw error;
  invalidateReadCache('rooms');
  invalidateReadCache('squad:' + roomId);
  diaryEvents.emitChange();
  return (data as string | null) ?? null;
}

export async function getSquadCompare(
  roomId: string,
  leftId: string,
  rightId: string,
  range: CompareRange = '7d',
): Promise<SquadComparePayload> {
  const { data, error } = await getSupabase().rpc('get_squad_compare', {
    p_room_id: roomId,
    p_left_id: leftId,
    p_right_id: rightId,
    p_range: range,
  });
  if (error) throw error;
  return data as SquadComparePayload;
}

export interface ChatReactionState {
  count: number;
  viewer_liked: boolean;
}

export async function getChatReactions(
  roomId: string,
  messageIds: string[],
): Promise<Record<string, ChatReactionState>> {
  if (messageIds.length === 0) return {};
  const { data, error } = await getSupabase().rpc('get_chat_reactions', {
    p_room_id: roomId,
    p_message_ids: messageIds,
  });
  if (error) throw error;
  return (data as Record<string, ChatReactionState> | null) ?? {};
}

export async function toggleChatReaction(
  messageId: string,
  emoji = 'heart',
): Promise<ChatReactionState & { message_id: string }> {
  const { data, error } = await getSupabase().rpc('toggle_chat_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
  return data as ChatReactionState & { message_id: string };
}
