import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateRequestInboxes, subscribeRequestInbox } from '@/services/requestInboxEvents';
import type { PublicUserProfile } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import {
  cancelRoomRequest as apiCancelRequest,
  getRequestsInbox,
  requestToJoinRoom as apiRequestToJoin,
  respondToRoomRequest as apiRespondToRequest,
  searchUserByUsername as apiSearchUser,
  sendRoomInvitation as apiSendInvitation,
} from '@/services/roomService';
import { parseRoomError, RoomServiceError, type RoomRequestWithDetails } from '@/types/rooms';

export function useRoomRequests() {
  const { user } = useAuth();
  const actor = user?.id;
  const version = useRef(0);
  const acting = useRef(false);
  const [incoming, setIncoming] = useState<RoomRequestWithDetails[]>([]);
  const [outgoing, setOutgoing] = useState<RoomRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RoomServiceError | null>(null);
  const cancelRefresh = useCallback(() => {
    version.current++;
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = ++version.current;
    if (!actor) {
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const inbox = await getRequestsInbox(supabase);
      if (requestVersion !== version.current) return;
      setIncoming(inbox.incoming);
      setOutgoing(inbox.outgoing);
    } catch (err: unknown) {
      if (requestVersion !== version.current) return;
      const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
      setError(serviceErr);
    } finally {
      if (requestVersion === version.current) setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    setIncoming([]);
    setOutgoing([]);
    return cancelRefresh;
  }, [actor, cancelRefresh]);
  useEffect(
    () =>
      subscribeRequestInbox(() => {
        void refresh();
      }),
    [refresh],
  );
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => {
        void refresh();
      }, 5000);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  const removeRequest = useCallback((requestId: string) => {
    version.current++;
    setIncoming((current) => current.filter((request) => request.id !== requestId));
    setOutgoing((current) => current.filter((request) => request.id !== requestId));
    setLoading(false);
  }, []);

  const sendInvitation = useCallback(
    async (roomId: string, username: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiSendInvitation(supabase, roomId, username);
        invalidateRequestInboxes();
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        setError(serviceErr);
        throw serviceErr;
      }
    },
    [refresh],
  );

  const requestToJoin = useCallback(
    async (roomCodeOrUsername: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiRequestToJoin(supabase, roomCodeOrUsername);
        invalidateRequestInboxes();
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        setError(serviceErr);
        throw serviceErr;
      }
    },
    [refresh],
  );

  const respondToRequest = useCallback(
    async (requestId: string, accept: boolean) => {
      if (acting.current) return;
      acting.current = true;
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiRespondToRequest(supabase, requestId, accept);
        removeRequest(requestId);
        invalidateRequestInboxes();
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        if (serviceErr.code === 'REQUEST_NOT_FOUND' || serviceErr.code === 'REQUEST_EXPIRED') {
          removeRequest(requestId);
          invalidateRequestInboxes();
          await refresh();
          return;
        }
        setError(serviceErr);
        throw serviceErr;
      } finally {
        acting.current = false;
      }
    },
    [refresh, removeRequest],
  );

  const cancelRequest = useCallback(
    async (requestId: string) => {
      if (acting.current) return;
      acting.current = true;
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiCancelRequest(supabase, requestId);
        removeRequest(requestId);
        invalidateRequestInboxes();
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        if (serviceErr.code === 'REQUEST_NOT_FOUND' || serviceErr.code === 'REQUEST_EXPIRED') {
          removeRequest(requestId);
          invalidateRequestInboxes();
          await refresh();
          return;
        }
        setError(serviceErr);
        throw serviceErr;
      } finally {
        acting.current = false;
      }
    },
    [refresh, removeRequest],
  );

  const searchUsers = useCallback(async (usernamePrefix: string): Promise<PublicUserProfile[]> => {
    try {
      const supabase = getSupabase();
      return await apiSearchUser(supabase, usernamePrefix);
    } catch {
      return [];
    }
  }, []);

  return {
    incoming,
    outgoing,
    loading,
    error,
    refresh,
    sendInvitation,
    requestToJoin,
    respondToRequest,
    cancelRequest,
    searchUsers,
  };
}
