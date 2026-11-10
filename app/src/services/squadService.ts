import { cachedRead } from './offlineReadService';
import {
  rankSquadMembers,
  type SquadMember,
  type SquadMemberDetails,
  type SquadMentions,
  type SquadToday,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { diaryEvents } from './diaryEvents';

export async function getSquadToday(roomId: string): Promise<SquadToday> {
  return cachedRead(getSupabase(), 'squad:' + roomId, async () => {
    const { data, error } = await getSupabase().rpc('get_squad_today', { p_room_id: roomId });
    if (error) throw error;
    if (data?.room_id !== roomId || !Array.isArray(data.members))
      throw new Error('SQUAD_UNAVAILABLE');
    return { room_id: roomId, members: rankSquadMembers(data.members as SquadMember[]) };
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
