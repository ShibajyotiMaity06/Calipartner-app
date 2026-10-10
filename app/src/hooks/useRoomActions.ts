import { useCallback, useState } from 'react';
import type {
  MealSection,
  RoomPrivacySettings,
  RoomReactionType,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import {
  blockUser as apiBlockUser,
  getPrivacySettings as apiGetPrivacy,
  leaveRoom as apiLeaveRoom,
  removeMember as apiRemoveMember,
  reportTarget as apiReport,
  respondSharedMeal as apiRespondSharedMeal,
  sendNudge as apiSendNudge,
  sendReaction as apiSendReaction,
  setWhoCanInvite as apiSetWhoCanInvite,
  tagSharedMeal as apiTagSharedMeal,
  transferHost as apiTransferHost,
  updatePrivacySettings as apiUpdatePrivacy,
} from '@/services/roomService';
import { parseRoomError, RoomServiceError, type TagSharedMealInput } from '@/types/rooms';

function handleError(err: unknown): RoomServiceError {
  return err instanceof RoomServiceError ? err : parseRoomError(err);
}

export function useRoomActions(roomId?: string | null) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<RoomServiceError | null>(null);

  const sendNudge = useCallback(
    async (recipientId: string, messageTemplate: string) => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiSendNudge(supabase, roomId, recipientId, messageTemplate);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const sendReaction = useCallback(
    async (eventId: string, reaction: RoomReactionType) => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiSendReaction(supabase, roomId, eventId, reaction);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const tagSharedMeal = useCallback(
    async (payload: Omit<TagSharedMealInput, 'roomId'>) => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiTagSharedMeal(supabase, { ...payload, roomId });
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const respondSharedMeal = useCallback(
    async (
      sharedMealId: string,
      accept: boolean,
      quantity?: number,
      mealSection?: MealSection,
    ) => {
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiRespondSharedMeal(
          supabase,
          sharedMealId,
          accept,
          quantity,
          mealSection,
        );
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [],
  );

  const getPrivacy = useCallback(async (): Promise<RoomPrivacySettings> => {
    if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
    setActionLoading(true);
    setActionError(null);
    try {
      const supabase = getSupabase();
      return await apiGetPrivacy(supabase, roomId);
    } catch (err: unknown) {
      const serviceErr = handleError(err);
      setActionError(serviceErr);
      throw serviceErr;
    } finally {
      setActionLoading(false);
    }
  }, [roomId]);

  const updatePrivacy = useCallback(
    async (settings: Partial<RoomPrivacySettings>): Promise<RoomPrivacySettings> => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiUpdatePrivacy(supabase, roomId, settings);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const setWhoCanInvite = useCallback(
    async (whoCanInvite: 'host_only' | 'any_member') => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiSetWhoCanInvite(supabase, roomId, whoCanInvite);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const removeMember = useCallback(
    async (targetUserId: string) => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiRemoveMember(supabase, roomId, targetUserId);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const transferHost = useCallback(
    async (newHostId: string) => {
      if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiTransferHost(supabase, roomId, newHostId);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [roomId],
  );

  const leaveRoom = useCallback(async () => {
    if (!roomId) throw new RoomServiceError('ROOM_NOT_FOUND', 'No room specified');
    setActionLoading(true);
    setActionError(null);
    try {
      const supabase = getSupabase();
      return await apiLeaveRoom(supabase, roomId);
    } catch (err: unknown) {
      const serviceErr = handleError(err);
      setActionError(serviceErr);
      throw serviceErr;
    } finally {
      setActionLoading(false);
    }
  }, [roomId]);

  const blockUser = useCallback(async (targetUserId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const supabase = getSupabase();
      return await apiBlockUser(supabase, targetUserId);
    } catch (err: unknown) {
      const serviceErr = handleError(err);
      setActionError(serviceErr);
      throw serviceErr;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const reportTarget = useCallback(
    async (
      targetType: 'user' | 'room' | 'message' | 'profile' | 'meal',
      targetId: string,
      reason: string,
      details?: string,
    ) => {
      setActionLoading(true);
      setActionError(null);
      try {
        const supabase = getSupabase();
        return await apiReport(supabase, targetType, targetId, reason, details);
      } catch (err: unknown) {
        const serviceErr = handleError(err);
        setActionError(serviceErr);
        throw serviceErr;
      } finally {
        setActionLoading(false);
      }
    },
    [],
  );

  return {
    actionLoading,
    actionError,
    sendNudge,
    sendReaction,
    tagSharedMeal,
    respondSharedMeal,
    getPrivacy,
    updatePrivacy,
    setWhoCanInvite,
    removeMember,
    transferHost,
    leaveRoom,
    blockUser,
    reportTarget,
  };
}
