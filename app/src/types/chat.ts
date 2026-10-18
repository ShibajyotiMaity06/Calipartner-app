import type {
  ChatAttachment,
  ChatDeliveryStatus,
  ChatErrorCode,
  ChatMessage,
  ChatMessageType,
  ChatModerationStatus,
  ChatReadState,
  ChatRoomSettings,
  ChatSyncState,
  ChatSystemEventType,
  ConsentRecord,
  ChatUploadUrlRequest,
  ChatUploadUrlResponse,
  ChatSignedUrlRequest,
  ChatSignedUrlResponse,
} from '@calipartner/core';

export type {
  ChatAttachment,
  ChatDeliveryStatus,
  ChatErrorCode,
  ChatMessage,
  ChatMessageType,
  ChatModerationStatus,
  ChatReadState,
  ChatRoomSettings,
  ChatSyncState,
  ChatSystemEventType,
  ConsentRecord,
  ChatUploadUrlRequest,
  ChatUploadUrlResponse,
  ChatSignedUrlRequest,
  ChatSignedUrlResponse,
};

export class ChatServiceError extends Error {
  readonly code: ChatErrorCode;
  readonly originalError?: unknown;

  constructor(code: ChatErrorCode, message?: string, originalError?: unknown) {
    super(message ?? code);
    this.name = 'ChatServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

export function parseChatError(err: unknown): ChatServiceError {
  if (err instanceof ChatServiceError) {
    return err;
  }

  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);

  if (rawMessage.includes('TERMS_REQUIRED')) {
    return new ChatServiceError(
      'TERMS_REQUIRED',
      'Please accept the community terms before sending messages.',
      err,
    );
  }
  if (rawMessage.includes('NOT_ROOM_MEMBER')) {
    return new ChatServiceError(
      'NOT_ROOM_MEMBER',
      'You are no longer an active member of this room.',
      err,
    );
  }
  if (rawMessage.includes('ROOM_LOCKED')) {
    return new ChatServiceError('ROOM_LOCKED', 'This room is paused.', err);
  }
  if (rawMessage.includes('ROOM_DORMANT_READ_ONLY')) {
    return new ChatServiceError(
      'ROOM_DORMANT_READ_ONLY',
      'This room is waiting for partners; chat is read-only.',
      err,
    );
  }
  if (rawMessage.includes('RATE_LIMIT_EXCEEDED')) {
    return new ChatServiceError(
      'RATE_LIMIT_EXCEEDED',
      'You are sending messages too quickly. Please slow down.',
      err,
    );
  }
  if (rawMessage.includes('ATTACHMENT_LIMIT_EXCEEDED')) {
    return new ChatServiceError(
      'ATTACHMENT_LIMIT_EXCEEDED',
      'Maximum 5 images allowed per message.',
      err,
    );
  }
  if (rawMessage.includes('FILE_TOO_LARGE')) {
    return new ChatServiceError('FILE_TOO_LARGE', 'Image exceeds maximum 10 MB limit.', err);
  }
  if (rawMessage.includes('INVALID_FILE_TYPE')) {
    return new ChatServiceError(
      'INVALID_FILE_TYPE',
      'Only JPEG, PNG, HEIC and WebP images are supported.',
      err,
    );
  }
  if (rawMessage.includes('MESSAGE_TOO_LONG')) {
    return new ChatServiceError('MESSAGE_TOO_LONG', 'Message exceeds 2000 characters.', err);
  }
  if (rawMessage.includes('MESSAGE_EMPTY')) {
    return new ChatServiceError('MESSAGE_EMPTY', 'Message cannot be empty.', err);
  }
  if (rawMessage.includes('CANNOT_DELETE_OTHERS')) {
    return new ChatServiceError(
      'CANNOT_DELETE_OTHERS',
      'You can only delete your own messages.',
      err,
    );
  }
  if (rawMessage.includes('URL_EXPIRED')) {
    return new ChatServiceError('URL_EXPIRED', 'Image access link has expired.', err);
  }
  if (rawMessage.includes('UNAUTHENTICATED')) {
    return new ChatServiceError('UNAUTHENTICATED', 'You must be signed in.', err);
  }

  return new ChatServiceError(
    'UNKNOWN_ERROR',
    rawMessage || 'An unexpected chat error occurred.',
    err,
  );
}
