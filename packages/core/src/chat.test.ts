import { describe, expect, it } from 'vitest';
import {
  calculateCompressedDimensions,
  calculateThumbnailDimensions,
  formatChatSystemMessage,
  generateChatAttachmentStorageKey,
  hasJpegExif,
  hasUserAcceptedChatTerms,
  isSignedUrlExpired,
  mergeMessagesDeduplicated,
  paginateChatMessages,
  stripJpegExif,
  stripPngExif,
  StubImageModerationProvider,
  validateChatAttachments,
  validateChatMessageInput,
  validateChatMessageText,
  validateChatStorageKey,
} from './chat';
import type { ChatMessage, ConsentRecord } from './types';

describe('Phase 8: Chat Core Logic Tests', () => {
  describe('Message text validation', () => {
    it('accepts valid text up to 2000 characters', () => {
      expect(validateChatMessageText('Hello partner!').valid).toBe(true);
      const exact2000 = 'a'.repeat(2000);
      expect(validateChatMessageText(exact2000).valid).toBe(true);
    });

    it('rejects text exceeding 2000 characters', () => {
      const over2000 = 'a'.repeat(2001);
      const res = validateChatMessageText(over2000);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('MESSAGE_TOO_LONG');
    });

    it('allows null or empty text when checked alone', () => {
      expect(validateChatMessageText(null).valid).toBe(true);
      expect(validateChatMessageText('').valid).toBe(true);
    });
  });

  describe('Attachment validation', () => {
    it('accepts up to 5 valid images under 10MB of allowed types', () => {
      const attachments = [
        { size: 1024 * 500, mime_type: 'image/jpeg' },
        { size: 1024 * 1024, mime_type: 'image/png' },
        { size: 1024 * 800, mime_type: 'image/webp' },
        { size: 1024 * 1200, mime_type: 'image/heic' },
        { size: 1024 * 100, mime_type: 'image/jpeg' },
      ];
      expect(validateChatAttachments(attachments).valid).toBe(true);
    });

    it('rejects more than 5 images', () => {
      const attachments = Array(6).fill({ size: 1000, mime_type: 'image/jpeg' });
      const res = validateChatAttachments(attachments);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('ATTACHMENT_LIMIT_EXCEEDED');
    });

    it('rejects images exceeding 10 MB', () => {
      const attachments = [{ size: 10 * 1024 * 1024 + 1, mime_type: 'image/jpeg' }];
      const res = validateChatAttachments(attachments);
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('rejects forbidden file types like GIF, PDF, BMP', () => {
      expect(validateChatAttachments([{ size: 500, mime_type: 'image/gif' }]).errorCode).toBe(
        'INVALID_FILE_TYPE',
      );
      expect(validateChatAttachments([{ size: 500, mime_type: 'application/pdf' }]).errorCode).toBe(
        'INVALID_FILE_TYPE',
      );
      expect(validateChatAttachments([{ size: 500, mime_type: 'image/bmp' }]).errorCode).toBe(
        'INVALID_FILE_TYPE',
      );
    });
  });

  describe('Complete message input validation', () => {
    it('rejects sending if terms are not accepted', () => {
      const res = validateChatMessageInput({
        text: 'Hello',
        hasAcceptedTerms: false,
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('TERMS_REQUIRED');
    });

    it('rejects completely empty message', () => {
      const res = validateChatMessageInput({
        text: '   ',
        attachments: [],
        hasAcceptedTerms: true,
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('MESSAGE_EMPTY');
    });

    it('accepts image-only message with no text', () => {
      const res = validateChatMessageInput({
        text: null,
        attachments: [{ size: 5000, mime_type: 'image/png' }],
        hasAcceptedTerms: true,
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Dimension calculations', () => {
    it('scales down landscape image to longest side 1600 px preserving aspect ratio', () => {
      const dims = calculateCompressedDimensions(3200, 1600, 1600);
      expect(dims.width).toBe(1600);
      expect(dims.height).toBe(800);
    });

    it('scales down portrait image to longest side 1600 px preserving aspect ratio', () => {
      const dims = calculateCompressedDimensions(2000, 4000, 1600);
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(1600);
    });

    it('does not upscale images smaller than maxLongestSide', () => {
      const dims = calculateCompressedDimensions(800, 600, 1600);
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });

    it('computes thumbnail dimensions to longest side 320 px', () => {
      const thumb = calculateThumbnailDimensions(1600, 1200, 320);
      expect(thumb.width).toBe(320);
      expect(thumb.height).toBe(240);
    });
  });

  describe('EXIF stripping', () => {
    function createMockJpegWithExif(): Uint8Array {
      // SOI: FF D8
      // APP1 marker: FF E1
      // Length: 00 10 (16 bytes)
      // Exif\0\0
      // 8 bytes dummy EXIF data
      // DQT marker: FF DB, length 00 05, 3 bytes table
      // SOS marker: FF DA, 4 bytes stream
      // EOI marker: FF D9
      return new Uint8Array([
        0xff,
        0xd8, // SOI
        0xff,
        0xe1,
        0x00,
        0x10, // APP1 marker + length 16
        0x45,
        0x78,
        0x69,
        0x66,
        0x00,
        0x00, // Exif\0\0
        0x01,
        0x02,
        0x03,
        0x04,
        0x05,
        0x06,
        0x07,
        0x08, // payload
        0xff,
        0xdb,
        0x00,
        0x05,
        0xaa,
        0xbb,
        0xcc, // DQT
        0xff,
        0xda,
        0x00,
        0x02,
        0x11,
        0x22, // SOS
        0xff,
        0xd9, // EOI
      ]);
    }

    it('detects presence of Exif APP1 segment in JPEG', () => {
      const jpeg = createMockJpegWithExif();
      expect(hasJpegExif(jpeg)).toBe(true);
    });

    it('strips Exif segment from JPEG and leaves SOI, DQT, SOS intact', () => {
      const jpegWithExif = createMockJpegWithExif();
      const cleaned = stripJpegExif(jpegWithExif);

      expect(hasJpegExif(cleaned)).toBe(false);
      // Cleaned must start with SOI 0xFF, 0xD8
      expect(cleaned[0]).toBe(0xff);
      expect(cleaned[1]).toBe(0xd8);
      // Cleaned must be shorter by the 18 bytes of APP1 marker + segment
      expect(cleaned.length).toBe(jpegWithExif.length - 18);
      // Cleaned should not contain ASCII 'Exif'
      const str = String.fromCharCode(...cleaned);
      expect(str.includes('Exif')).toBe(false);
    });

    it('returns unmodified buffer when JPEG has no EXIF', () => {
      const cleanJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff, 0xd9,
      ]);
      expect(hasJpegExif(cleanJpeg)).toBe(false);
      const res = stripJpegExif(cleanJpeg);
      expect(res.length).toBe(cleanJpeg.length);
    });

    it('strips eXIf chunk from PNG', () => {
      // Mock PNG with eXIf chunk
      // Header: 8 bytes
      // eXIf chunk: len 4 + 'eXIf' 4 + 4 data + 4 crc = 16 bytes
      // IEND chunk: len 0 + 'IEND' 4 + 4 crc = 12 bytes
      const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const exifChunk = [
        0x00,
        0x00,
        0x00,
        0x04, // len
        0x65,
        0x58,
        0x49,
        0x66, // 'eXIf'
        0x01,
        0x02,
        0x03,
        0x04, // data
        0xaa,
        0xbb,
        0xcc,
        0xdd, // crc
      ];
      const iendChunk = [
        0x00,
        0x00,
        0x00,
        0x00, // len
        0x49,
        0x45,
        0x4e,
        0x44, // 'IEND'
        0xae,
        0x42,
        0x60,
        0x82, // crc
      ];
      const pngWithExif = new Uint8Array([...pngHeader, ...exifChunk, ...iendChunk]);

      const stripped = stripPngExif(pngWithExif);
      expect(stripped.length).toBe(pngHeader.length + iendChunk.length);
      const str = String.fromCharCode(...stripped);
      expect(str.includes('eXIf')).toBe(false);
    });
  });

  describe('Storage key & path traversal prevention', () => {
    it('generates standard hierarchical storage keys', () => {
      const key = generateChatAttachmentStorageKey('room-123', 'client-msg-456', 0, 'jpg');
      expect(key).toBe('rooms/room-123/messages/client-msg-456/0.jpg');
    });

    it('validates storage key against room id and blocks path traversal', () => {
      expect(
        validateChatStorageKey('rooms/room-123/messages/client-msg-456/0.jpg', 'room-123'),
      ).toBe(true);
      // Mismatched room
      expect(
        validateChatStorageKey('rooms/room-999/messages/client-msg-456/0.jpg', 'room-123'),
      ).toBe(false);
      // Path traversal attempts
      expect(validateChatStorageKey('rooms/room-123/messages/../../secrets.txt', 'room-123')).toBe(
        false,
      );
      expect(validateChatStorageKey('/rooms/room-123/messages/0.jpg', 'room-123')).toBe(false);
      expect(validateChatStorageKey('rooms\\room-123\\messages\\0.jpg', 'room-123')).toBe(false);
    });
  });

  describe('Signed R2 URLs and expiration', () => {
    it('correctly identifies expired signed URLs', () => {
      const now = 1700000000000;
      const url =
        'https://test.r2.cloudflarestorage.com/chat/rooms/r1/file.jpg?X-Amz-Date=20231114T221320Z&X-Amz-Expires=900';

      // 5 minutes later: not expired
      expect(isSignedUrlExpired(url, now + 300 * 1000)).toBe(false);
      // 16 minutes later: expired
      expect(isSignedUrlExpired(url, now + 960 * 1000)).toBe(true);
    });
  });

  describe('Automated image moderation stub', () => {
    const provider = new StubImageModerationProvider();

    it('approves benign images', async () => {
      const res = await provider.moderateImage({
        storageKey: 'rooms/r1/messages/m1/meal_photo.jpg',
        mimeType: 'image/jpeg',
      });
      expect(res.status).toBe('ok');
      expect(res.isNsfw).toBe(false);
    });

    it('flags explicit/nsfw content as blocked', async () => {
      const res = await provider.moderateImage({
        storageKey: 'rooms/r1/messages/m1/nsfw_explicit_image.jpg',
        mimeType: 'image/jpeg',
      });
      expect(res.status).toBe('blocked');
      expect(res.isNsfw).toBe(true);
    });

    it('respects manual testFlag', async () => {
      const res = await provider.moderateImage({
        storageKey: 'rooms/r1/messages/m1/test.jpg',
        mimeType: 'image/jpeg',
        testFlag: 'blocked',
      });
      expect(res.status).toBe('blocked');
    });
  });

  describe('System message formatters', () => {
    it('formats member joined and left messages', () => {
      expect(formatChatSystemMessage('member_joined', { nickname: 'Priya' })).toBe(
        'Priya joined the room',
      );
      expect(formatChatSystemMessage('member_left', { nickname: 'Rahul' })).toBe(
        'Rahul left the room',
      );
    });

    it('formats room created and streak milestones', () => {
      expect(formatChatSystemMessage('room_created', { roomName: 'Beast Mode' })).toBe(
        'Room "Beast Mode" was created',
      );
      expect(formatChatSystemMessage('streak_milestone', { count: 14 })).toBe(
        'Milestone: The room reached a 14-day streak! Keep it up!',
      );
    });
  });

  describe('Message pagination and gap-fill deduplication', () => {
    const sampleMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        client_id: 'client-1',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'user',
        system_event_type: null,
        text: 'Message 1',
        created_at: '2026-10-11T08:00:00Z',
        deleted_at: null,
        attachments: [],
      },
      {
        id: 'msg-2',
        client_id: 'client-2',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'user',
        system_event_type: null,
        text: 'Message 2',
        created_at: '2026-10-11T08:01:00Z',
        deleted_at: null,
        attachments: [],
      },
      {
        id: 'msg-3',
        client_id: 'client-3',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'user',
        system_event_type: null,
        text: 'Message 3',
        created_at: '2026-10-11T08:02:00Z',
        deleted_at: null,
        attachments: [],
      },
    ];

    it('deduplicates incoming messages with existing messages by client_id', () => {
      const incoming: ChatMessage[] = [
        {
          ...sampleMessages[1]!,
          text: 'Updated Message 2',
          delivery_status: 'sent',
        },
        {
          id: 'msg-4',
          client_id: 'client-4',
          room_id: 'room-1',
          sender_id: 'user-2',
          message_type: 'user',
          system_event_type: null,
          text: 'Message 4',
          created_at: '2026-10-11T08:03:00Z',
          deleted_at: null,
          attachments: [],
        },
      ];

      const merged = mergeMessagesDeduplicated(sampleMessages, incoming);
      expect(merged.length).toBe(4);
      expect(merged.find((m) => m.client_id === 'client-2')?.delivery_status).toBe('sent');
      expect(merged[3]!.client_id).toBe('client-4');
    });

    it('paginates correctly and respects limits', () => {
      const page = paginateChatMessages(sampleMessages, { limit: 2 });
      expect(page.messages.length).toBe(2);
      expect(page.hasMore).toBe(true);
      // Newest 2 messages: msg-2 and msg-3, sorted chronologically
      expect(page.messages[0]!.id).toBe('msg-2');
      expect(page.messages[1]!.id).toBe('msg-3');
    });

    it('supports beforeCreatedAt for loading older messages', () => {
      const page = paginateChatMessages(sampleMessages, {
        limit: 5,
        beforeCreatedAt: '2026-10-11T08:02:00Z',
      });
      expect(page.messages.length).toBe(2);
      expect(page.messages[0]!.id).toBe('msg-1');
      expect(page.messages[1]!.id).toBe('msg-2');
      expect(page.hasMore).toBe(false);
    });

    it('supports afterCreatedAt for reconnect gap-fill', () => {
      const page = paginateChatMessages(sampleMessages, {
        limit: 5,
        afterCreatedAt: '2026-10-11T08:01:00Z',
      });
      expect(page.messages.length).toBe(1);
      expect(page.messages[0]!.id).toBe('msg-3');
    });
  });

  describe('Consent check', () => {
    it('verifies terms acceptance in consent records', () => {
      const emptyRecords: ConsentRecord[] = [];
      expect(hasUserAcceptedChatTerms(emptyRecords)).toBe(false);

      const recordsWithTerms: ConsentRecord[] = [
        {
          id: 'c-1',
          user_id: 'u-1',
          consent_type: 'chat_terms',
          version: '1.0',
          accepted_at: new Date().toISOString(),
        },
      ];
      expect(hasUserAcceptedChatTerms(recordsWithTerms)).toBe(true);
    });
  });
});
