import { describe, expect, it, vi } from 'vitest';
import {
  getSignedImageUrl,
  processImageOnDevice,
  requestUploadPresignedUrl,
  uploadImageToR2,
} from './chatImageService';
import { ChatServiceError } from '@/types/chat';

describe('chatImageService', () => {
  describe('processImageOnDevice', () => {
    it('strips EXIF and computes compressed dimensions', () => {
      // JPEG with SOI and EOI
      const mockJpeg = new Uint8Array([
        0xff, 0xd8,
        0xff, 0xe1, 0x00, 0x10,
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0xff, 0xd9,
      ]);

      const res = processImageOnDevice(mockJpeg, 'image/jpeg', 3200, 1600);
      expect(res.width).toBe(1600);
      expect(res.height).toBe(800);
      expect(res.mimeType).toBe('image/jpeg');
      expect(res.data.length).toBeLessThan(mockJpeg.length);
    });

    it('throws error for invalid file types', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      expect(() => processImageOnDevice(buffer, 'image/gif', 500, 500)).toThrow(
        ChatServiceError,
      );
      expect(() => processImageOnDevice(buffer, 'application/pdf', 500, 500)).toThrow(
        ChatServiceError,
      );
    });

    it('throws error if processed image exceeds 10MB', () => {
      const hugeBuffer = new Uint8Array(10 * 1024 * 1024 + 5);
      expect(() => processImageOnDevice(hugeBuffer, 'image/webp', 800, 800)).toThrow(
        ChatServiceError,
      );
    });
  });

  describe('requestUploadPresignedUrl', () => {
    it('invokes chat-upload-url Edge Function and returns presigned URL', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              upload_url: 'https://r2.example.com/upload-put-url',
              storage_key: 'rooms/r1/messages/c1/0.jpg',
              headers: { 'Content-Type': 'image/jpeg' },
              expires_in_seconds: 300,
            },
            error: null,
          }),
        },
      };

      const res = await requestUploadPresignedUrl(mockSupabase, {
        room_id: 'r1',
        client_id: 'c1',
        filename: 'photo.jpg',
        mime_type: 'image/jpeg',
        size: 50000,
      });

      expect(res.upload_url).toBe('https://r2.example.com/upload-put-url');
      expect(res.storage_key).toBe('rooms/r1/messages/c1/0.jpg');
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('chat-upload-url', {
        body: expect.objectContaining({
          room_id: 'r1',
          client_id: 'c1',
          mime_type: 'image/jpeg',
        }),
      });
    });

    it('maps Edge Function errors to ChatServiceError', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'ROOM_LOCKED: This room is paused' },
          }),
        },
      };

      await expect(
        requestUploadPresignedUrl(mockSupabase, {
          room_id: 'r1',
          client_id: 'c1',
          filename: 'photo.jpg',
          mime_type: 'image/jpeg',
          size: 50000,
        }),
      ).rejects.toThrow(ChatServiceError);
    });
  });

  describe('uploadImageToR2', () => {
    it('uploads to R2 with fetch PUT and reports progress', async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      globalThis.fetch = mockFetch;

      const progressCallback = vi.fn();
      await uploadImageToR2(
        'https://r2.example.com/put',
        new Uint8Array([1, 2, 3]),
        'image/jpeg',
        progressCallback,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://r2.example.com/put',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      );
      expect(progressCallback).toHaveBeenCalledWith(100);

      globalThis.fetch = originalFetch;
    });
  });

  describe('getSignedImageUrl', () => {
    it('invokes chat-signed-url Edge Function and caches URL', async () => {
      const mockSupabase = {
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: {
              signed_url: 'https://r2.example.com/read-get-url',
              expires_in_seconds: 900,
            },
            error: null,
          }),
        },
      };

      const url1 = await getSignedImageUrl(mockSupabase, 'r1', 'rooms/r1/messages/c1/0.jpg');
      expect(url1).toBe('https://r2.example.com/read-get-url');
      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);

      // Second call uses memory cache
      const url2 = await getSignedImageUrl(mockSupabase, 'r1', 'rooms/r1/messages/c1/0.jpg');
      expect(url2).toBe('https://r2.example.com/read-get-url');
      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);
    });
  });
});
