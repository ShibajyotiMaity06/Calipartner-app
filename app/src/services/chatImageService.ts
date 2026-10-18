import {
  ALLOWED_CHAT_MIME_TYPES,
  calculateCompressedDimensions,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  stripImageExif,
} from '@calipartner/core';
import type { ChatUploadUrlRequest, ChatUploadUrlResponse } from '@/types/chat';
import { ChatServiceError } from '@/types/chat';

export interface ProcessedImageResult {
  data: Uint8Array;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  thumbnailData?: Uint8Array;
}

export interface UploadImageProgressCallback {
  (progress: number): void;
}

interface SupabaseFunctionsClient {
  functions: {
    invoke: (
      name: string,
      options: { body: unknown },
    ) => Promise<{
      data: Record<string, unknown> | null;
      error: { message?: string } | null;
    }>;
  };
}

/**
 * Strips EXIF location data on device and computes target compressed dimensions.
 */
export function processImageOnDevice(
  buffer: Uint8Array,
  mimeType: string,
  originalWidth: number,
  originalHeight: number,
): ProcessedImageResult {
  const normalizedMime = mimeType.toLowerCase();
  const allowedList: readonly string[] = ALLOWED_CHAT_MIME_TYPES;
  if (!allowedList.includes(normalizedMime)) {
    throw new ChatServiceError(
      'INVALID_FILE_TYPE',
      `File type ${mimeType} is not supported. Use JPEG, PNG, HEIC or WebP.`,
    );
  }

  // 1. Strip EXIF & GPS location metadata on the device
  const cleanBuffer = stripImageExif(buffer, normalizedMime);

  // 2. Validate max size (<= 10MB)
  if (cleanBuffer.length > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
    throw new ChatServiceError(
      'FILE_TOO_LARGE',
      `Image size ${(cleanBuffer.length / (1024 * 1024)).toFixed(1)} MB exceeds 10 MB limit.`,
    );
  }

  // 3. Compute target compressed dimensions (longest side ~1600 px)
  const targetDims = calculateCompressedDimensions(originalWidth, originalHeight, 1600);

  return {
    data: cleanBuffer,
    width: targetDims.width,
    height: targetDims.height,
    size: cleanBuffer.length,
    mimeType: normalizedMime,
  };
}

/**
 * Requests presigned upload URL from the Edge Function.
 */
export async function requestUploadPresignedUrl(
  supabase: SupabaseFunctionsClient,
  params: ChatUploadUrlRequest & { attachmentIndex?: number },
): Promise<ChatUploadUrlResponse> {
  const { data, error } = await supabase.functions.invoke('chat-upload-url', {
    body: {
      room_id: params.room_id,
      client_id: params.client_id,
      filename: params.filename,
      mime_type: params.mime_type,
      size: params.size,
      width: params.width,
      height: params.height,
      attachment_index: params.attachmentIndex ?? 0,
    },
  });

  if (error || !data) {
    const errorMsg = error?.message || 'Failed to obtain upload URL';
    if (errorMsg.includes('NOT_ROOM_MEMBER')) {
      throw new ChatServiceError('NOT_ROOM_MEMBER', 'Access denied: not a room member');
    }
    if (errorMsg.includes('ROOM_LOCKED')) {
      throw new ChatServiceError('ROOM_LOCKED', 'This room is paused');
    }
    if (errorMsg.includes('ROOM_DORMANT')) {
      throw new ChatServiceError('ROOM_DORMANT_READ_ONLY', 'Chat is read-only in dormant rooms');
    }
    if (errorMsg.includes('RATE_LIMIT')) {
      throw new ChatServiceError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded: 30 images per hour');
    }
    if (errorMsg.includes('TERMS_REQUIRED')) {
      throw new ChatServiceError('TERMS_REQUIRED', 'Please accept community terms first');
    }
    throw new ChatServiceError('UNKNOWN_ERROR', errorMsg);
  }

  return data as unknown as ChatUploadUrlResponse;
}

/**
 * Uploads processed image bytes to Cloudflare R2 bucket via presigned PUT URL.
 */
export async function uploadImageToR2(
  uploadUrl: string,
  imageBytes: Uint8Array,
  mimeType: string,
  onProgress?: UploadImageProgressCallback,
  maxRetries = 2,
): Promise<void> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      if (onProgress) onProgress(10);

      // Perform fetch PUT with image payload
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: imageBytes,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      if (onProgress) onProgress(100);
      return;
    } catch (err) {
      attempt += 1;
      if (attempt > maxRetries) {
        throw new Error(
          `Image upload failed after ${maxRetries + 1} attempts: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      // Exponential backoff
      await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Fetches short-lived signed GET URL for reading an attachment from Cloudflare R2.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedImageUrl(
  supabase: SupabaseFunctionsClient,
  roomId: string,
  storageKey: string,
): Promise<string> {
  const cached = signedUrlCache.get(storageKey);
  const now = Date.now();
  // Return cached URL if valid for at least another 60 seconds
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  const { data, error } = await supabase.functions.invoke('chat-signed-url', {
    body: {
      room_id: roomId,
      storage_key: storageKey,
    },
  });

  if (error || !data?.signed_url) {
    const errorMsg = error?.message || 'Failed to fetch signed image URL';
    if (errorMsg.includes('NOT_ROOM_MEMBER')) {
      throw new ChatServiceError('NOT_ROOM_MEMBER', 'Access denied');
    }
    if (errorMsg.includes('ROOM_LOCKED')) {
      throw new ChatServiceError('ROOM_LOCKED', 'This room is paused');
    }
    throw new ChatServiceError('UNKNOWN_ERROR', errorMsg);
  }

  const signedUrl = data.signed_url as string;
  const expiresInSeconds = (data.expires_in_seconds as number) || 900;
  signedUrlCache.set(storageKey, {
    url: signedUrl,
    expiresAt: now + expiresInSeconds * 1000,
  });

  return signedUrl;
}
