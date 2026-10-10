import { useCallback, useEffect, useState } from 'react';
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
  const [incoming, setIncoming] = useState<RoomRequestWithDetails[]>([]);
  const [outgoing, setOutgoing] = useState<RoomRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RoomServiceError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const inbox = await getRequestsInbox(supabase);
      setIncoming(inbox.incoming);
      setOutgoing(inbox.outgoing);
    } catch (err: unknown) {
      const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
      setError(serviceErr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendInvitation = useCallback(
    async (roomId: string, username: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiSendInvitation(supabase, roomId, username);
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
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiRespondToRequest(supabase, requestId, accept);
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

  const cancelRequest = useCallback(
    async (requestId: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiCancelRequest(supabase, requestId);
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
