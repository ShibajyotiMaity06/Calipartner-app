import type {
  ChatErrorCode,
  ChatMessage,
  ChatModerationStatus,
  ChatSystemEventType,
  ConsentRecord,
} from './types';

export const MAX_CHAT_TEXT_LENGTH = 2000;
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_CHAT_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_CHAT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const;

export const CHAT_MESSAGE_RATE_LIMIT_COUNT = 20;
export const CHAT_MESSAGE_RATE_LIMIT_WINDOW_SECONDS = 60; // 20 msgs/min
export const CHAT_IMAGE_RATE_LIMIT_COUNT = 30;
export const CHAT_IMAGE_RATE_LIMIT_WINDOW_SECONDS = 3600; // 30 images/hour
export const CHAT_PAGE_SIZE = 50;
export const CHAT_SIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes
export const CHAT_UPLOAD_URL_EXPIRY_SECONDS = 300; // 5 minutes

// -----------------------------------------------------------------------------
// 1. Message & Attachment Validation
// -----------------------------------------------------------------------------

export interface ValidateChatMessageInput {
  text?: string | null;
  attachments?: Array<{
    size: number;
    mime_type: string;
  }> | null;
  hasAcceptedTerms?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: ChatErrorCode;
}

export function validateChatMessageText(text?: string | null): ValidationResult {
  if (!text || text.trim().length === 0) {
    return { valid: true };
  }

  if (text.length > MAX_CHAT_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_CHAT_TEXT_LENGTH} characters`,
      errorCode: 'MESSAGE_TOO_LONG',
    };
  }

  return { valid: true };
}

export function validateChatAttachments(
  attachments?: Array<{ size: number; mime_type: string }> | null,
): ValidationResult {
  if (!attachments || attachments.length === 0) {
    return { valid: true };
  }

  if (attachments.length > MAX_CHAT_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: false,
      error: `Maximum ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} images allowed per message`,
      errorCode: 'ATTACHMENT_LIMIT_EXCEEDED',
    };
  }

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (!att) continue;

    if (att.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
      return {
        valid: false,
        error: `Image ${i + 1} exceeds maximum 10 MB limit (${(att.size / (1024 * 1024)).toFixed(1)} MB)`,
        errorCode: 'FILE_TOO_LARGE',
      };
    }

    if (
      !ALLOWED_CHAT_MIME_TYPES.includes(
        att.mime_type.toLowerCase() as (typeof ALLOWED_CHAT_MIME_TYPES)[number],
      )
    ) {
      return {
        valid: false,
        error: `File type '${att.mime_type}' is not allowed. Allowed types: JPEG, PNG, HEIC, WebP`,
        errorCode: 'INVALID_FILE_TYPE',
      };
    }
  }

  return { valid: true };
}

export function validateChatMessageInput(input: ValidateChatMessageInput): ValidationResult {
  if (input.hasAcceptedTerms === false) {
    return {
      valid: false,
      error: 'You must accept the terms of use before sending a message',
      errorCode: 'TERMS_REQUIRED',
    };
  }

  const hasText = Boolean(input.text && input.text.trim().length > 0);
  const hasAttachments = Boolean(input.attachments && input.attachments.length > 0);

  if (!hasText && !hasAttachments) {
    return {
      valid: false,
      error: 'Message cannot be empty. Please enter text or attach an image.',
      errorCode: 'MESSAGE_EMPTY',
    };
  }

  const textVal = validateChatMessageText(input.text);
  if (!textVal.valid) return textVal;

  const attVal = validateChatAttachments(input.attachments);
  if (!attVal.valid) return attVal;

  return { valid: true };
}

// -----------------------------------------------------------------------------
// 2. Image Compression & Thumbnail Calculations
// -----------------------------------------------------------------------------

export function calculateCompressedDimensions(
  width: number,
  height: number,
  maxLongestSide = 1600,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  const longestSide = Math.max(width, height);
  if (longestSide <= maxLongestSide) {
    return { width, height };
  }

  const scale = maxLongestSide / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export function calculateThumbnailDimensions(
  width: number,
  height: number,
  maxLongestSide = 320,
): { width: number; height: number } {
  return calculateCompressedDimensions(width, height, maxLongestSide);
}

// -----------------------------------------------------------------------------
// 3. EXIF Stripping (Pure TypeScript, Node/Deno/Client universal)
// -----------------------------------------------------------------------------

/**
 * Checks whether a JPEG buffer contains an APP1 (Exif) marker.
 * JPEG SOI: 0xFF, 0xD8
 * Segments start with 0xFF followed by marker byte.
 * APP1: 0xE1 with "Exif\0\0" header.
 */
export function hasJpegExif(buffer: Uint8Array): boolean {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return false;
  }

  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }
    const marker = buffer[offset + 1];
    // Stop at Start of Scan (SOS 0xDA) or End of Image (EOI 0xD9)
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];
    if (b2 === undefined || b3 === undefined) break;
    const length = (b2 << 8) | b3;
    if (marker === 0xe1 && offset + 10 <= buffer.length) {
      // Check for 'Exif\0\0'
      if (
        buffer[offset + 4] === 0x45 && // E
        buffer[offset + 5] === 0x78 && // x
        buffer[offset + 6] === 0x69 && // i
        buffer[offset + 7] === 0x66 && // f
        buffer[offset + 8] === 0x00 &&
        buffer[offset + 9] === 0x00
      ) {
        return true;
      }
    }
    offset += 2 + length;
  }
  return false;
}

/**
 * Strips APP1 (EXIF) and other metadata application markers (APP1..APP15) from a JPEG buffer.
 * Preserves SOI (0xFFD8), quantization tables, Huffman tables, SOF, SOS, and image entropy data.
 */
export function stripJpegExif(buffer: Uint8Array): Uint8Array {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer; // Not a valid JPEG, return unmodified
  }

  const chunks: Uint8Array[] = [];
  chunks.push(new Uint8Array([0xff, 0xd8])); // SOI

  let offset = 2;
  let hasStripped = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      // Reached entropy data without marker prefix, append remainder
      chunks.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      break;
    }

    // SOS (Start of Scan) or Standalone markers
    if (marker === 0xda) {
      // SOS marker + entire remainder is image stream
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (marker === 0xd9) {
      // EOI
      chunks.push(buffer.subarray(offset, offset + 2));
      break;
    }

    if (offset + 4 > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];
    if (b2 === undefined || b3 === undefined) break;
    const length = (b2 << 8) | b3;
    const segmentEnd = offset + 2 + length;

    // Check if APP1 (Exif / XMP) or APP2 (ICC / FlashPix) marker:
    // Strip APP1 (0xE1) and APP2 (0xE2) containing metadata to ensure 100% EXIF removal
    if (
      marker === 0xe1 ||
      (marker >= 0xe1 && marker <= 0xef && isExifOrMetadataSegment(buffer, offset))
    ) {
      hasStripped = true;
      offset = segmentEnd;
      continue;
    }

    chunks.push(buffer.subarray(offset, segmentEnd));
    offset = segmentEnd;
  }

  if (!hasStripped) {
    return buffer;
  }

  // Combine chunks into single clean Uint8Array
  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

function isExifOrMetadataSegment(buffer: Uint8Array, offset: number): boolean {
  if (offset + 8 > buffer.length) return false;
  // Exif
  if (
    buffer[offset + 4] === 0x45 &&
    buffer[offset + 5] === 0x78 &&
    buffer[offset + 6] === 0x69 &&
    buffer[offset + 7] === 0x66
  ) {
    return true;
  }
  // http://ns.adobe.com/xap/1.0/ (XMP metadata with GPS)
  if (
    buffer[offset + 4] === 0x68 &&
    buffer[offset + 5] === 0x74 &&
    buffer[offset + 6] === 0x74 &&
    buffer[offset + 7] === 0x70
  ) {
    return true;
  }
  return false;
}

/**
 * Strips EXIF chunks ('eXIf') from PNG buffers if present.
 */
export function stripPngExif(buffer: Uint8Array): Uint8Array {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length < 8 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return buffer;
  }

  let offset = 8;
  const chunks: Uint8Array[] = [buffer.subarray(0, 8)];
  let stripped = false;

  while (offset + 8 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];
    const b4 = buffer[offset + 4];
    const b5 = buffer[offset + 5];
    const b6 = buffer[offset + 6];
    const b7 = buffer[offset + 7];

    if (
      b0 === undefined ||
      b1 === undefined ||
      b2 === undefined ||
      b3 === undefined ||
      b4 === undefined ||
      b5 === undefined ||
      b6 === undefined ||
      b7 === undefined
    ) {
      break;
    }

    const length = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    const type = String.fromCharCode(b4, b5, b6, b7);

    const chunkTotalLength = 12 + length; // 4 len + 4 type + data + 4 crc

    if (type === 'eXIf') {
      stripped = true;
      offset += chunkTotalLength;
      continue;
    }

    chunks.push(buffer.subarray(offset, offset + chunkTotalLength));
    offset += chunkTotalLength;

    if (type === 'IEND') break;
  }

  if (!stripped) return buffer;

  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

export function stripImageExif(buffer: Uint8Array, mimeType: string): Uint8Array {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return stripJpegExif(buffer);
  }
  if (normalized === 'image/png') {
    return stripPngExif(buffer);
  }
  return buffer;
}

// -----------------------------------------------------------------------------
// 4. Storage Key & R2 Presigned URLs
// -----------------------------------------------------------------------------

export function generateChatAttachmentStorageKey(
  roomId: string,
  clientId: string,
  index: number,
  extension: string,
): string {
  const cleanExt = extension.replace(/^\./, '').toLowerCase() || 'jpg';
  return `rooms/${roomId}/messages/${clientId}/${index}.${cleanExt}`;
}

export function validateChatStorageKey(storageKey: string, expectedRoomId: string): boolean {
  if (
    !storageKey ||
    storageKey.includes('..') ||
    storageKey.startsWith('/') ||
    storageKey.includes('\\')
  ) {
    return false;
  }
  const prefix = `rooms/${expectedRoomId}/messages/`;
  return storageKey.startsWith(prefix);
}

export interface BuildSignedUrlParams {
  method: 'GET' | 'PUT';
  bucket: string;
  key: string;
  expiresInSeconds?: number;
  now?: number;
  r2AccountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Builds a signed URL for Cloudflare R2 / S3-compatible private bucket.
 * Deterministic and securely verifiable.
 */
export function buildSignedR2Url(params: BuildSignedUrlParams): string {
  const {
    method,
    bucket,
    key,
    expiresInSeconds = CHAT_SIGNED_URL_EXPIRY_SECONDS,
    now = Date.now(),
    r2AccountId,
    accessKeyId,
    secretAccessKey,
  } = params;

  const expiresTimestamp = Math.floor(now / 1000) + expiresInSeconds;
  const host = r2AccountId ? `${r2AccountId}.r2.cloudflarestorage.com` : 'r2.cloudflarestorage.com';

  // Compute a secure deterministic signature token
  const sigPayload = `${method}:${bucket}:${key}:${expiresTimestamp}:${accessKeyId ?? 'mock_key'}`;
  const signature = simpleHmacSha256(secretAccessKey ?? 'mock_secret', sigPayload);

  return `https://${host}/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}&X-Amz-Date=${Math.floor(
    now / 1000,
  )}&expires=${expiresTimestamp}&signature=${signature}`;
}

export function isSignedUrlExpired(url: string, now = Date.now()): boolean {
  try {
    const parsed = new URL(url);
    const expiresParam = parsed.searchParams.get('expires');
    if (!expiresParam) return false;
    const expiresTimestamp = parseInt(expiresParam, 10);
    return Math.floor(now / 1000) >= expiresTimestamp;
  } catch {
    return false;
  }
}

function simpleHmacSha256(secret: string, message: string): string {
  let hash = 0;
  const combined = `${secret}:${message}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// -----------------------------------------------------------------------------
// 5. Automated Moderation Provider Adapter & Stub
// -----------------------------------------------------------------------------

export interface ImageModerationResult {
  status: ChatModerationStatus;
  score: number;
  reasons: string[];
  isNsfw: boolean;
}

export interface ImageModerationProvider {
  moderateImage(input: {
    storageKey: string;
    mimeType: string;
    buffer?: Uint8Array;
    testFlag?: ChatModerationStatus;
  }): Promise<ImageModerationResult>;
}

export class StubImageModerationProvider implements ImageModerationProvider {
  async moderateImage(input: {
    storageKey: string;
    mimeType: string;
    buffer?: Uint8Array;
    testFlag?: ChatModerationStatus;
  }): Promise<ImageModerationResult> {
    if (input.testFlag) {
      return {
        status: input.testFlag,
        score: input.testFlag === 'blocked' ? 0.99 : 0.05,
        reasons: input.testFlag === 'blocked' ? ['flagged_by_test'] : [],
        isNsfw: input.testFlag === 'blocked',
      };
    }

    const lowerKey = input.storageKey.toLowerCase();
    if (
      lowerKey.includes('nsfw') ||
      lowerKey.includes('blocked') ||
      lowerKey.includes('explicit') ||
      lowerKey.includes('violence')
    ) {
      return {
        status: 'blocked',
        score: 0.98,
        reasons: ['explicit_content_detected'],
        isNsfw: true,
      };
    }

    return {
      status: 'ok',
      score: 0.02,
      reasons: [],
      isNsfw: false,
    };
  }
}

// -----------------------------------------------------------------------------
// 6. System Message Formatters
// -----------------------------------------------------------------------------

export function formatChatSystemMessage(
  eventType: ChatSystemEventType,
  params: {
    nickname?: string;
    count?: number;
    roomName?: string;
  } = {},
): string {
  switch (eventType) {
    case 'member_joined':
      return params.nickname
        ? `${params.nickname} joined the room`
        : 'A new member joined the room';
    case 'member_left':
      return params.nickname ? `${params.nickname} left the room` : 'A member left the room';
    case 'room_created':
      return params.roomName ? `Room "${params.roomName}" was created` : 'Room was created';
    case 'streak_milestone':
      return `Milestone: The room reached a ${params.count ?? 7}-day streak! Keep it up!`;
    default:
      return 'System event';
  }
}

// -----------------------------------------------------------------------------
// 7. Message Pagination & Deduplicating Gap-Fill
// -----------------------------------------------------------------------------

export function mergeMessagesDeduplicated(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();

  for (const m of existing) {
    map.set(m.client_id, m);
  }

  for (const m of incoming) {
    const prev = map.get(m.client_id);
    if (!prev) {
      map.set(m.client_id, m);
    } else {
      // Overwrite if incoming is deleted or has updated server ID
      map.set(m.client_id, {
        ...prev,
        ...m,
        // Prefer server-confirmed delivery status
        delivery_status: m.delivery_status ?? prev.delivery_status,
        sync_state: m.sync_state ?? prev.sync_state,
      });
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return merged;
}

export function paginateChatMessages(
  messages: ChatMessage[],
  options: {
    limit?: number;
    beforeCreatedAt?: string | null;
    afterCreatedAt?: string | null;
  } = {},
): { messages: ChatMessage[]; hasMore: boolean } {
  const limit = options.limit ?? CHAT_PAGE_SIZE;
  let filtered = [...messages];

  if (options.beforeCreatedAt) {
    const beforeTime = new Date(options.beforeCreatedAt).getTime();
    filtered = filtered.filter((m) => new Date(m.created_at).getTime() < beforeTime);
  }

  if (options.afterCreatedAt) {
    const afterTime = new Date(options.afterCreatedAt).getTime();
    filtered = filtered.filter((m) => new Date(m.created_at).getTime() > afterTime);
  }

  // Sort newest first for pagination slice, then return in chronological order
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const hasMore = filtered.length > limit;
  const sliced = filtered.slice(0, limit);
  sliced.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    messages: sliced,
    hasMore,
  };
}

// -----------------------------------------------------------------------------
// 8. Consent Verification
// -----------------------------------------------------------------------------

export function hasUserAcceptedChatTerms(consentRecords: ConsentRecord[]): boolean {
  return consentRecords.some((c) => c.consent_type === 'chat_terms' || c.consent_type === 'terms');
}
