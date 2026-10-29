import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { mergeMessagesDeduplicated } from '@calipartner/core';
import type { ChatMessage, ChatServiceError } from '@/types/chat';
import { parseChatError } from '@/types/chat';
import { getSupabase } from '@/lib/supabase';
import { getDb } from '@/db';
import {
  acceptChatTerms,
  blockChatMember,
  deleteChatMessage,
  getChatMessages,
  getChatUnreadCount,
  hasAcceptedChatTerms,
  markChatRead,
  muteChatMember,
  reportChatMessage,
  sendChatMessage,
} from '@/services/chatService';

export interface UseRoomChatOptions {
  userId?: string | null;
  userNickname?: string;
  username?: string;
  avatarUrl?: string;
  markRead?: boolean;
}

export function useRoomChat(
  roomId: string | null,
  isVisible = true,
  options: UseRoomChatOptions = {},
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(roomId && isVisible));
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isDormant, setIsDormant] = useState<boolean>(false);
  const [error, setError] = useState<ChatServiceError | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const userId = options.userId;

  const scopeKey = JSON.stringify([roomId, userId, isVisible, options.markRead !== false]);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const cursor = useRef<{ created_at: string; id: string } | null>(null);
  const fetchingGap = useRef<string | null>(null),
    fetchingOlder = useRef<string | null>(null);
  const initialVersion = useRef(0);
  const shouldMarkRead = options.markRead !== false;
  const updateRead = useCallback(
    async (newest: ChatMessage | undefined) => {
      if (!roomId || !userId) return;
      const client = getSupabase(),
        db = await getDb();
      if (shouldMarkRead && isVisible && newest) {
        await markChatRead(client, db, roomId, userId, newest.id);
        if (activeScope.current === scopeKey) setUnreadCount(0);
      } else {
        const count = await getChatUnreadCount(client, roomId);
        if (activeScope.current === scopeKey) setUnreadCount(count);
      }
    },
    [roomId, userId, shouldMarkRead, isVisible, scopeKey],
  );
  const loadInitialMessages = useCallback(async () => {
    if (!roomId || !userId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const requestVersion = ++initialVersion.current;
    setLoading(true);
    setError(null);
    try {
      const client = getSupabase(),
        db = await getDb();
      const state = await client.from('rooms').select('state').eq('id', roomId).single();
      const fetched = await getChatMessages(client, db, roomId, { limit: 50, ownerId: userId });
      if (activeScope.current !== scopeKey) return;
      setIsLocked(state.data?.state === 'locked');
      setIsDormant(state.data?.state === 'dormant');
      const hidden = await client.rpc('get_chat_hidden_senders', { p_room_id: roomId });
      if (hidden.error && !/fetch|network|offline|timeout/i.test(JSON.stringify(hidden.error)))
        throw hidden.error;
      for (const sender of (hidden.data ?? []) as string[]) {
        await db.runAsync(
          'DELETE FROM local_chat_attachments WHERE message_id IN (SELECT id FROM local_chat_messages WHERE room_id=? AND sender_id=?)',
          [roomId, sender],
        );
        await db.runAsync('DELETE FROM local_chat_messages WHERE room_id=? AND sender_id=?', [
          roomId,
          sender,
        ]);
      }
      if (activeScope.current !== scopeKey || initialVersion.current !== requestVersion) return;
      setMessages((previous) =>
        mergeMessagesDeduplicated(
          previous.filter((m) => !((hidden.data ?? []) as string[]).includes(m.sender_id ?? '')),
          fetched,
        ),
      );
      const remote = fetched.filter((m) => m.sync_state === 'synced');
      setHasMore(remote.length >= 50);
      const newest = remote.at(-1);
      if (newest) cursor.current = { created_at: newest.created_at, id: newest.id };
      await updateRead(newest);
    } catch (error) {
      if (activeScope.current === scopeKey) {
        const parsed = parseChatError(error);
        setError(parsed);
        if (parsed.code === 'ROOM_LOCKED') setIsLocked(true);
        if (
          ['PLUS_REQUIRED', 'NOT_ROOM_MEMBER', 'ROOM_LOCKED', 'NOT_AUTHORIZED'].includes(
            parsed.code,
          )
        )
          setMessages([]);
      }
    } finally {
      if (activeScope.current === scopeKey) setLoading(false);
    }
  }, [roomId, userId, scopeKey, updateRead]);
  const loadMore = useCallback(async () => {
    if (!roomId || !userId || fetchingOlder.current === scopeKey || !hasMore) return;
    const oldest = messages.find((m) => m.sync_state === 'synced');
    if (!oldest) return;
    fetchingOlder.current = scopeKey;
    setLoadingMore(true);
    try {
      const fetched = await getChatMessages(getSupabase(), await getDb(), roomId, {
        limit: 50,
        beforeCreatedAt: oldest.created_at,
        beforeId: oldest.id,
        ownerId: userId,
      });
      if (activeScope.current !== scopeKey) return;
      setMessages((previous) => mergeMessagesDeduplicated(fetched, previous));
      setHasMore(fetched.filter((m) => m.sync_state === 'synced').length >= 50);
    } catch (error) {
      if (activeScope.current === scopeKey) setError(parseChatError(error));
    } finally {
      if (fetchingOlder.current === scopeKey) fetchingOlder.current = null;
      if (activeScope.current === scopeKey) setLoadingMore(false);
    }
  }, [roomId, userId, hasMore, messages, scopeKey]);
  const gapFillReconnect = useCallback(async () => {
    if (!roomId || !userId || fetchingGap.current === scopeKey) return;
    if (!cursor.current) {
      await loadInitialMessages();
      return;
    }
    fetchingGap.current = scopeKey;
    try {
      const client = getSupabase(),
        db = await getDb();
      for (let page = 0; page < 20; page++) {
        const after: { created_at: string; id: string } | null = cursor.current;
        if (!after) break;
        const fetched = await getChatMessages(client, db, roomId, {
          limit: 50,
          afterCreatedAt: after.created_at,
          afterId: after.id,
          ownerId: userId,
        });
        if (activeScope.current !== scopeKey) return;
        const remote = fetched.filter((m) => m.sync_state === 'synced'),
          newest = remote.at(-1);
        if (!newest) break;
        if (newest.created_at === after.created_at && newest.id === after.id) break;
        cursor.current = { created_at: newest.created_at, id: newest.id };
        setMessages((previous) => mergeMessagesDeduplicated(previous, fetched));
        await updateRead(newest);
        if (remote.length < 50) break;
      }
    } catch (error) {
      if (activeScope.current === scopeKey) setError(parseChatError(error));
    } finally {
      if (fetchingGap.current === scopeKey) fetchingGap.current = null;
    }
  }, [roomId, userId, scopeKey, loadInitialMessages, updateRead]);
  useEffect(() => {
    activeScope.current = scopeKey;
    let current = true;
    setMessages([]);
    setUnreadCount(0);
    setTermsAccepted(false);
    setIsLocked(false);
    setIsDormant(false);
    cursor.current = null;
    if (!roomId || !userId || !isVisible) {
      setLoading(false);
      return;
    }
    const client = getSupabase();
    void getDb()
      .then((db) => hasAcceptedChatTerms(client, db, userId))
      .then(
        (accepted) => {
          if (current) setTermsAccepted(accepted);
        },
        () => {},
      );
    void loadInitialMessages();
    const channel = client
      .channel(`chat:${roomId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => void gapFillReconnect(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: ChatMessage }) => {
          if (!current) return;
          const row = payload.new;
          if (row.deleted_at)
            setMessages((previous) =>
              previous.map((m) =>
                m.id === row.id
                  ? { ...m, deleted_at: row.deleted_at, text: null, attachments: [] }
                  : m,
              ),
            );
          void loadInitialMessages();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_attachments' },
        () => void loadInitialMessages(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => void loadInitialMessages(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void gapFillReconnect();
      });
    channelRef.current = channel;
    const timer = setInterval(() => {
      void gapFillReconnect();
      if (
        messagesRef.current.some((m) =>
          m.attachments?.some((a) => a.moderation_status === 'pending'),
        )
      )
        void loadInitialMessages();
    }, 4000);
    return () => {
      current = false;
      clearInterval(timer);
      activeScope.current = '';
      void client.removeChannel(channel);
    };
  }, [roomId, userId, isVisible, scopeKey, loadInitialMessages, gapFillReconnect]);

  // Send message action
  const sendMessage = useCallback(
    async (
      text?: string | null,
      attachments?: Array<{
        storage_key: string;
        size: number;
        mime_type: string;
        width?: number;
        height?: number;
        local_uri?: string;
      }>,
      clientId?: string,
    ) => {
      if (!roomId || !userId) throw new Error('UNAUTHENTICATED');

      const supabase = getSupabase();
      const db = await getDb();

      try {
        const sent = await sendChatMessage(supabase, db, roomId, userId, {
          text,
          attachments,
          clientId,
          nickname: options.userNickname,
          username: options.username,
          avatarUrl: options.avatarUrl,
        });

        // Add to local state
        if (activeScope.current === scopeKey)
          setMessages((prev) => mergeMessagesDeduplicated(prev, [sent]));
        void gapFillReconnect();
        return sent;
      } catch (err: unknown) {
        const chatErr = parseChatError(err);
        setError(chatErr);
        throw chatErr;
      }
    },
    [
      roomId,
      userId,
      options.userNickname,
      options.username,
      options.avatarUrl,
      gapFillReconnect,
      scopeKey,
    ],
  );

  // Delete message action
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!roomId) return;
      const supabase = getSupabase();
      const db = await getDb();

      try {
        await deleteChatMessage(supabase, db, messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: '[Message deleted]',
                  deleted_at: new Date().toISOString(),
                  attachments: [],
                }
              : m,
          ),
        );
      } catch (err: unknown) {
        const chatErr = parseChatError(err);
        setError(chatErr);
        throw chatErr;
      }
    },
    [roomId],
  );

  // Report message action
  const reportMessage = useCallback(async (messageId: string, reason: string, details?: string) => {
    const supabase = getSupabase();
    try {
      await reportChatMessage(supabase, messageId, reason, details);
    } catch (err: unknown) {
      const chatErr = parseChatError(err);
      setError(chatErr);
      throw chatErr;
    }
  }, []);

  // Mute member action
  const muteMember = useCallback(async (targetUserId: string) => {
    const supabase = getSupabase();
    try {
      await muteChatMember(supabase, targetUserId);
      // Purge hidden messages from the offline cache as well as this screen.
      setMessages((prev) => prev.filter((m) => m.sender_id !== targetUserId));
      const db = await getDb();
      await db.runAsync(
        'DELETE FROM local_chat_attachments WHERE message_id IN (SELECT id FROM local_chat_messages WHERE sender_id=?)',
        [targetUserId],
      );
      await db.runAsync('DELETE FROM local_chat_messages WHERE sender_id=?', [targetUserId]);
    } catch (err: unknown) {
      const chatErr = parseChatError(err);
      setError(chatErr);
      throw chatErr;
    }
  }, []);

  // Block member action (Apple App Store Guideline 1.2 UGC instant block)
  const blockMember = useCallback(async (targetUserId: string) => {
    const supabase = getSupabase();
    try {
      await blockChatMember(supabase, targetUserId);
      // Immediately purge their messages from active state and local SQLite
      setMessages((prev) => prev.filter((m) => m.sender_id !== targetUserId));
      try {
        const db = await getDb();
        await db.runAsync(
          'DELETE FROM local_chat_attachments WHERE message_id IN (SELECT id FROM local_chat_messages WHERE sender_id=?)',
          [targetUserId],
        );
        await db.runAsync('DELETE FROM local_chat_messages WHERE sender_id = ?', [targetUserId]);
      } catch {
        // ignore local delete error
      }
    } catch (err: unknown) {
      const chatErr = parseChatError(err);
      setError(chatErr);
      throw chatErr;
    }
  }, []);

  // Accept terms action
  const acceptTermsAction = useCallback(async () => {
    if (!userId) return;
    const supabase = getSupabase();
    const db = await getDb();
    try {
      await acceptChatTerms(supabase, db, userId);
      setTermsAccepted(true);
    } catch (err: unknown) {
      const chatErr = parseChatError(err);
      setError(chatErr);
      throw chatErr;
    }
  }, [userId]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    unreadCount,
    isLocked,
    isDormant,
    termsAccepted,
    error,
    loadMore,
    sendMessage,
    deleteMessage,
    reportMessage,
    muteMember,
    blockMember,
    acceptTerms: acceptTermsAction,
    refresh: loadInitialMessages,
  };
}
