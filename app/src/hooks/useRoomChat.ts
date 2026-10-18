import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { mergeMessagesDeduplicated } from '@calipartner/core';
import type { ChatMessage, ChatServiceError } from '@/types/chat';
import { parseChatError } from '@/types/chat';
import { getSupabase } from '@/lib/supabase';
import { getDb } from '@/db';
import {
  acceptChatTerms,
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
  const lastFetchedTimeRef = useRef<string | null>(null);

  const userId = options.userId;

  // Check consent terms
  const checkTerms = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabase();
      const db = await getDb();
      const accepted = await hasAcceptedChatTerms(supabase, db, userId);
      setTermsAccepted(accepted);
    } catch {
      // Ignore error
    }
  }, [userId]);

  // Initial fetch and unread count
  const loadInitialMessages = useCallback(async () => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsLocked(false);
    setIsDormant(false);

    try {
      const supabase = getSupabase();
      const db = await getDb();

      // Check room state
      const { data: roomData } = await supabase
        .from('rooms')
        .select('state')
        .eq('id', roomId)
        .single();

      if (roomData?.state === 'locked') {
        setIsLocked(true);
      } else if (roomData?.state === 'dormant') {
        setIsDormant(true);
      }

      // Fetch messages
      const fetched = await getChatMessages(supabase, db, roomId, { limit: 50 });
      setMessages(fetched);
      setHasMore(fetched.length >= 50);

      const lastFetchedMsg = fetched[fetched.length - 1];
      if (lastFetchedMsg) {
        lastFetchedTimeRef.current = lastFetchedMsg.created_at;
      }

      // Mark read if visible
      if (userId && isVisible && fetched.length > 0 && lastFetchedMsg) {
        await markChatRead(supabase, db, roomId, userId, lastFetchedMsg.id);
        setUnreadCount(0);
      } else if (roomId) {
        const unread = await getChatUnreadCount(supabase, roomId);
        setUnreadCount(unread);
      }
    } catch (err: unknown) {
      const chatErr = parseChatError(err);
      if (chatErr.code === 'ROOM_LOCKED') {
        setIsLocked(true);
      }
      setError(chatErr);
    } finally {
      setLoading(false);
    }
  }, [roomId, userId, isVisible]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    try {
      const supabase = getSupabase();
      const db = await getDb();
      const oldestMsg = messages[0];
      if (!oldestMsg) return;
      const oldestCreatedAt = oldestMsg.created_at;

      const olderMessages = await getChatMessages(supabase, db, roomId, {
        limit: 50,
        beforeCreatedAt: oldestCreatedAt,
      });

      if (olderMessages.length < 50) {
        setHasMore(false);
      }

      setMessages((prev) => mergeMessagesDeduplicated(olderMessages, prev));
    } catch (err: unknown) {
      setError(parseChatError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, hasMore, messages]);

  // Gap-fill on reconnect
  const gapFillReconnect = useCallback(async () => {
    if (!roomId || !lastFetchedTimeRef.current) return;

    try {
      const supabase = getSupabase();
      const db = await getDb();
      const newMessages = await getChatMessages(supabase, db, roomId, {
        limit: 50,
        afterCreatedAt: lastFetchedTimeRef.current,
      });

      if (newMessages.length > 0) {
        const newestMsg = newMessages[newMessages.length - 1];
        if (newestMsg) {
          lastFetchedTimeRef.current = newestMsg.created_at;
          setMessages((prev) => mergeMessagesDeduplicated(prev, newMessages));

          if (userId && isVisible) {
            await markChatRead(supabase, db, roomId, userId, newestMsg.id);
          }
        }
      }
    } catch {
      // Reconnect gap fill failed; will retry on next poll or reconnect
    }
  }, [roomId, userId, isVisible]);

  // Realtime subscription: one channel per room, subscribed ONLY while chat is visible
  useEffect(() => {
    if (!roomId || !isVisible || isLocked) {
      if (channelRef.current) {
        const supabase = getSupabase();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    checkTerms();
    loadInitialMessages();

    const supabase = getSupabase();
    const channelName = `chat:${roomId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: { new: ChatMessage }) => {
          const newMsg = payload.new;
          lastFetchedTimeRef.current = newMsg.created_at;

          setMessages((prev) => mergeMessagesDeduplicated(prev, [newMsg]));

          if (userId && isVisible) {
            const db = await getDb();
            await markChatRead(supabase, db, roomId, userId, newMsg.id);
          }
        },
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
          const updated = payload.new;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    ...updated,
                    text: updated.deleted_at ? '[Message deleted]' : updated.text,
                    attachments: updated.deleted_at ? [] : m.attachments,
                  }
                : m,
            ),
          );
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Perform reconnect gap fill to catch any missed messages
          gapFillReconnect();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, isVisible, isLocked, checkTerms, loadInitialMessages, gapFillReconnect, userId]);

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
    ) => {
      if (!roomId || !userId) return;

      const supabase = getSupabase();
      const db = await getDb();

      try {
        const sent = await sendChatMessage(supabase, db, roomId, userId, {
          text,
          attachments,
          nickname: options.userNickname,
          username: options.username,
          avatarUrl: options.avatarUrl,
        });

        // Add to local state
        setMessages((prev) => mergeMessagesDeduplicated(prev, [sent]));
        lastFetchedTimeRef.current = sent.created_at;
      } catch (err: unknown) {
        const chatErr = parseChatError(err);
        setError(chatErr);
        throw chatErr;
      }
    },
    [roomId, userId, options.userNickname, options.username, options.avatarUrl],
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
      // Hide their messages from state immediately
      setMessages((prev) => prev.filter((m) => m.sender_id !== targetUserId));
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
    acceptTerms: acceptTermsAction,
    refresh: loadInitialMessages,
  };
}
