import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import { diaryEvents } from '@/services/diaryEvents';
import {
  getSquadToday,
  getSquadMemberDetails,
  getSquadMentions,
  getSquadUnreadCount,
} from '@/services/squadService';

function useSquadRead<T>(
  roomId: string | null,
  visible: boolean,
  read: (room: string) => Promise<T>,
  scope = '',
  pollMs = 0,
) {
  const { user } = useAuth();
  const { localDate } = useCurrentLocalDate();
  const key = JSON.stringify([user?.id, roomId, visible, scope, localDate]);
  const active = useRef(key);
  active.current = key;
  const version = useRef(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: boolean;
    loading: boolean;
  }>();
  const refresh = useCallback(async () => {
    if (!roomId || !user?.id || !visible) return;
    const request = ++version.current;
    setState((previous) => ({
      key,
      data: previous?.key === key ? previous.data : null,
      error: false,
      loading: true,
    }));
    try {
      const data = await read(roomId);
      if (active.current === key && request === version.current)
        setState({ key, data, error: false, loading: false });
    } catch {
      // Revoke stale data immediately on authorization and network failures alike.
      if (active.current === key && request === version.current)
        setState({ key, data: null, error: true, loading: false });
    }
  }, [roomId, user?.id, visible, read, key]);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  useEffect(() => {
    if (!roomId || !user?.id || !visible) return;
    void refresh();
    const unsubscribe = diaryEvents.subscribe(() => void refresh());
    const timer = pollMs ? setInterval(() => void refresh(), pollMs) : null;
    return () => {
      invalidate();
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [roomId, user?.id, visible, refresh, invalidate, pollMs]);
  const current = state?.key === key ? state : null;
  return {
    data: visible ? (current?.data ?? null) : null,
    error: current?.error ?? false,
    loading: visible && Boolean(roomId && user?.id) && (current?.loading ?? true),
    refresh,
  };
}
export function useSquadToday(roomId: string | null, visible = true) {
  return useSquadRead(roomId, visible, getSquadToday, '', 15000);
}
export function useSquadDetails(roomId: string | null, memberId: string | null, enabled: boolean) {
  const read = useCallback((room: string) => getSquadMemberDetails(room, memberId!), [memberId]);
  return useSquadRead(roomId, enabled && Boolean(memberId), read, memberId ?? '');
}
export function useSquadMentions(roomId: string | null, visible = true) {
  return useSquadRead(roomId, visible, getSquadMentions, '', 15000);
}

/** Count only: viewing Home never acknowledges or fetches chat history. */
export function useSquadUnread(roomId: string, visible: boolean) {
  const { user } = useAuth();
  const state = useSquadRead(roomId, visible, getSquadUnreadCount, '', 10000);
  useEffect(() => {
    if (!visible || !user?.id) return;
    const client = getSupabase();
    const channel = client
      .channel('home-unread:' + roomId + ':' + user.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: 'room_id=eq.' + roomId },
        () => diaryEvents.emitChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_read_state', filter: 'room_id=eq.' + roomId },
        () => diaryEvents.emitChange(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [visible, roomId, user?.id]);
  return state;
}
