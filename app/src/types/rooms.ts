import type {
  MealSection,
  Room,
  RoomMember,
  RoomMemberSnapshot,
  RoomPrivacySettings,
  RoomReactionType,
  RoomRequest,
  RoomRole,
  RoomSnapshot,
  RoomState,
} from '@calipartner/core';

export type RoomErrorCode =
  | 'ROOM_FULL'
  | 'ROOM_LOCKED'
  | 'PLAN_REQUIRED'
  | 'PLAN_ALREADY_ATTACHED'
  | 'MAX_ROOMS_REACHED'
  | 'REQUEST_LIMIT_REACHED'
  | 'HOURLY_REQUEST_LIMIT_REACHED'
  | 'RATE_LIMITED'
  | 'USER_BLOCKED'
  | 'USER_NOT_FOUND'
  | 'CANNOT_INVITE_SELF'
  | 'ALREADY_MEMBER'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'NOT_ROOM_MEMBER'
  | 'RECIPIENT_NOT_MEMBER'
  | 'ROOM_DORMANT'
  | 'ROOM_ARCHIVED'
  | 'ROOM_NOT_FOUND'
  | 'NUDGE_LIMIT_REACHED'
  | 'INVALID_ROOM_NAME'
  | 'HOST_ONLY_INVITE'
  | 'CANNOT_REMOVE_SELF'
  | 'CANNOT_BLOCK_SELF'
  | 'INVALID_REACTION'
  | 'UNAUTHENTICATED'
  | 'UNKNOWN_ERROR';

export class RoomServiceError extends Error {
  readonly code: RoomErrorCode;
  readonly originalError?: unknown;

  constructor(code: RoomErrorCode, message?: string, originalError?: unknown) {
    super(message ?? code);
    this.name = 'RoomServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

export function parseRoomError(err: unknown): RoomServiceError {
  if (err instanceof RoomServiceError) {
    return err;
  }

  const rawMessage =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : String(err);

  const recognizedCodes: RoomErrorCode[] = [
    'PLAN_ALREADY_ATTACHED',
    'HOURLY_REQUEST_LIMIT_REACHED',
    'REQUEST_LIMIT_REACHED',
    'NUDGE_LIMIT_REACHED',
    'MAX_ROOMS_REACHED',
    'RECIPIENT_NOT_MEMBER',
    'CANNOT_INVITE_SELF',
    'CANNOT_REMOVE_SELF',
    'CANNOT_BLOCK_SELF',
    'HOST_ONLY_INVITE',
    'INVALID_ROOM_NAME',
    'INVALID_REACTION',
    'REQUEST_NOT_FOUND',
    'REQUEST_EXPIRED',
    'NOT_ROOM_MEMBER',
    'USER_NOT_FOUND',
    'PLAN_REQUIRED',
    'UNAUTHENTICATED',
    'ROOM_NOT_FOUND',
    'ROOM_ARCHIVED',
    'NOT_AUTHORIZED',
    'ALREADY_MEMBER',
    'USER_BLOCKED',
    'ROOM_DORMANT',
    'RATE_LIMITED',
    'ROOM_LOCKED',
    'ROOM_FULL',
  ];

  for (const code of recognizedCodes) {
    if (rawMessage.includes(code)) {
      return new RoomServiceError(code, rawMessage, err);
    }
  }

  if (rawMessage.toLowerCase().includes('rate limit')) {
    return new RoomServiceError('RATE_LIMITED', rawMessage, err);
  }

  if (
    rawMessage.toLowerCase().includes('schema cache') ||
    rawMessage.toLowerCase().includes('could not find the function')
  ) {
    return new RoomServiceError(
      'UNKNOWN_ERROR',
      'Database migration not applied: Please run migration 20261008000006_phase5_v04_room_billing_capacity_lifecycle.sql in your Supabase SQL editor.',
      err,
    );
  }

  return new RoomServiceError('UNKNOWN_ERROR', rawMessage, err);
}

export interface RoomSummary {
  id: string;
  name: string;
  code: string;
  state: RoomState;
  role: RoomRole;
  member_count: number;
  created_at: string;
  who_can_invite: 'host_only' | 'any_member';
  plan_holder_id?: string | null;
  member_cap?: number;
}

export interface UserSummary {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
}

export interface RoomRequestWithDetails extends RoomRequest {
  room_name?: string;
  room_code?: string;
  sender_profile?: UserSummary;
  recipient_profile?: UserSummary;
}

export interface TagSharedMealInput {
  roomId: string;
  foodId?: string | null;
  foodName: string;
  mealSection: MealSection;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodiumMg?: number;
  participantIds: string[];
}

export type {
  Room,
  RoomMember,
  RoomPrivacySettings,
  RoomRequest,
  RoomSnapshot,
  RoomMemberSnapshot,
  RoomReactionType,
  RoomRole,
  RoomState,
};
