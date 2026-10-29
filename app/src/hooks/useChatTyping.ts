import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
export interface TypingPerson {
  user_id: string;
  nickname: string;
}
export function useChatTyping(
  roomId: string | null,
  userId: string | null | undefined,
  visible: boolean,
) {
  const [people, setPeople] = useState<TypingPerson[]>([]);
  const lastSent = useRef({ room: '', at: 0, typing: false });
  const notify = useCallback(
    (typing: boolean) => {
      if (!roomId || !userId || !visible) return;
      const now = Date.now(),
        old = lastSent.current;
      if (typing && old.room === roomId && old.typing && now - old.at < 2000) return;
      if (!typing && old.room === roomId && !old.typing) return;
      lastSent.current = { room: roomId, at: now, typing };
      void getSupabase()
        .rpc('set_chat_typing', { p_room_id: roomId, p_is_typing: typing })
        .then(
          () => {},
          () => {},
        );
    },
    [roomId, userId, visible],
  );
  useEffect(() => {
    let current = true;
    setPeople([]);
    if (!roomId || !userId || !visible) return;
    const client = getSupabase();
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const fetchPeople = () =>
      void client.rpc('get_chat_typing', { p_room_id: roomId }).then(
        ({ data, error }) => {
          if (current)
            setPeople((previous) =>
              JSON.stringify(previous) === JSON.stringify(data ?? [])
                ? previous
                : error
                  ? []
                  : ((data ?? []) as TypingPerson[]),
            );
        },
        () => {
          if (current) setPeople([]);
        },
      );
    const refresh = () => {
      if (!scheduled)
        scheduled = setTimeout(() => {
          scheduled = null;
          if (current) fetchPeople();
        }, 700);
    };
    const channel = client
      .channel(`typing:${roomId}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_typing', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .subscribe(refresh);
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      current = false;
      if (scheduled) clearTimeout(scheduled);
      clearInterval(timer);
      void client.removeChannel(channel);
      void client.rpc('set_chat_typing', { p_room_id: roomId, p_is_typing: false });
      lastSent.current = { room: '', at: 0, typing: false };
    };
  }, [roomId, userId, visible]);
  return { typingPeople: people, notifyTyping: notify };
}
