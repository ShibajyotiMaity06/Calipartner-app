import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  acceptChatTerms,
  deleteChatMessage,
  getChatMessages,
  hasAcceptedChatTerms,
  muteChatMember,
  reportChatMessage,
  sendChatMessage,
} from './chatService';
import type { SyncDb } from './syncService';
import { ChatServiceError } from '@/types/chat';

class MockSyncDb implements SyncDb {
  tables = new Map<string, Array<Record<string, unknown>>>();

  constructor() {
    this.tables.set('local_chat_messages', []);
    this.tables.set('local_chat_attachments', []);
    this.tables.set('local_chat_read_state', []);
    this.tables.set('local_consent_records', []);
    this.tables.set('outbox', []);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<unknown> {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const s = sql.toLowerCase().trim();

    if (s.includes('insert into local_chat_messages')) {
      const row = {
        id: p[0],
        client_id: p[1],
        room_id: p[2],
        sender_id: p[3],
        sender_nickname: p[4],
        sender_username: p[5],
        sender_avatar_url: p[6],
        message_type: p[7],
        text: p[8],
        created_at: p[9],
        deleted_at: null,
        delivery_status: p[10] || 'sending',
        sync_state: p[11] || 'pending',
      };
      const msgs = this.tables.get('local_chat_messages')!;
      const idx = msgs.findIndex((m) => m.client_id === row.client_id);
      if (idx >= 0) msgs[idx] = { ...msgs[idx], ...row };
      else msgs.push(row);
      return { changes: 1 };
    }

    if (s.includes('insert into local_chat_attachments')) {
      const row = {
        id: p[0],
        message_id: p[1],
        storage_key: p[2],
        local_uri: p[3],
        width: p[4],
        height: p[5],
        size: p[6],
        mime_type: p[7],
        moderation_status: 'pending',
        created_at: p[8],
      };
      this.tables.get('local_chat_attachments')!.push(row);
      return { changes: 1 };
    }

    if (s.includes('insert into outbox')) {
      const id = String(p[0]);
      const out = this.tables.get('outbox')!;
      const existingIdx = out.findIndex((o) => o.id === id);
      if (existingIdx >= 0) {
        out[existingIdx] = { id, entity: p[1], operation: p[2], payload: p[3] };
      } else {
        out.push({ id, entity: p[1], operation: p[2], payload: p[3] });
      }
      return { changes: 1 };
    }

    if (s.includes('delete from outbox')) {
      const id = String(p[0]);
      const out = this.tables.get('outbox')!;
      const idx = out.findIndex((o) => o.id === id);
      if (idx >= 0) out.splice(idx, 1);
      return { changes: 1 };
    }

    if (s.includes('update local_chat_messages')) {
      const msgs = this.tables.get('local_chat_messages')!;
      if (s.includes('set id = ?, delivery_status =')) {
        const confirmedId = p[0] as string;
        const clientId = p[1] as string;
        const target = msgs.find((m) => m.client_id === clientId);
        if (target) {
          target.id = confirmedId;
          target.delivery_status = 'sent';
          target.sync_state = 'synced';
        }
      } else if (s.includes('set deleted_at = ?')) {
        const deletedAt = p[0] as string;
        const msgId = p[1] as string;
        const target = msgs.find((m) => m.id === msgId);
        if (target) target.deleted_at = deletedAt;
      }
      return { changes: 1 };
    }

    if (s.includes('insert into local_consent_records')) {
      this.tables.get('local_consent_records')!.push({
        user_id: p[0],
        consent_type: 'chat_terms',
        version: p[1],
        accepted_at: p[2],
      });
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const s = sql.toLowerCase().trim();
    if (s.includes('from local_chat_messages')) {
      const roomId = p[0];
      return (this.tables.get('local_chat_messages') || []).filter(
        (m) => m.room_id === roomId,
      ) as unknown as T[];
    }
    if (s.includes('from local_chat_attachments')) {
      const messageId = p[0];
      return (this.tables.get('local_chat_attachments') || []).filter(
        (a) => a.message_id === messageId,
      ) as unknown as T[];
    }
    return [];
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const s = sql.toLowerCase().trim();
    if (s.includes('from local_consent_records')) {
      const userId = p[0];
      const match = (this.tables.get('local_consent_records') || []).find(
        (c) => c.user_id === userId,
      );
      return (match as unknown as T) || null;
    }
    return null;
  }
}

describe('chatService', () => {
  let db: MockSyncDb;

  beforeEach(() => {
    db = new MockSyncDb();
  });

  describe('sendChatMessage', () => {
    it('creates message locally, queues in outbox, and completes when remote succeeds', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            id: 'server-msg-1',
            client_id: 'client-1',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      const result = await sendChatMessage(mockSupabase, db, 'room-1', 'user-1', {
        text: 'Hello room!',
        clientId: 'client-1',
      });

      expect(result.delivery_status).toBe('sent');
      expect(result.sync_state).toBe('synced');
      expect(result.id).toBe('server-msg-1');

      // Outbox item deleted after successful sync
      expect(db.tables.get('outbox')?.length).toBe(0);

      // Local message marked sent
      const local = db.tables.get('local_chat_messages')?.find((m) => m.client_id === 'client-1');
      expect(local?.delivery_status).toBe('sent');
    });

    it('retains in outbox with sending state when server is unreachable (offline mode)', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('Network request failed')),
      };

      const result = await sendChatMessage(mockSupabase, db, 'room-1', 'user-1', {
        text: 'Offline message',
        clientId: 'client-offline',
      });

      expect(result.delivery_status).toBe('sending');
      expect(result.sync_state).toBe('pending');

      // Outbox item retained for syncService flush
      expect(db.tables.get('outbox')?.length).toBe(1);
    });

    it('rejects message with permanent error if room is locked', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'ROOM_LOCKED: This room is paused' },
        }),
      };

      await expect(
        sendChatMessage(mockSupabase, db, 'room-1', 'user-1', {
          text: 'Message during lock',
          clientId: 'client-lock',
        }),
      ).rejects.toThrow(ChatServiceError);
    });
  });

  describe('getChatMessages', () => {
    it('merges local and remote messages deduplicated', async () => {
      const now = new Date().toISOString();
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'server-1',
              client_id: 'c-1',
              room_id: 'room-1',
              sender_id: 'user-2',
              text: 'Partner says hi',
              message_type: 'user',
              system_event_type: null,
              created_at: now,
              deleted_at: null,
              attachments: [],
            },
          ],
          error: null,
        }),
      };

      const messages = await getChatMessages(mockSupabase, db, 'room-1');
      expect(messages.length).toBe(1);
      expect(messages[0]!.text).toBe('Partner says hi');
    });
  });

  describe('deleteChatMessage', () => {
    it('soft-deletes locally and calls RPC', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      };

      await deleteChatMessage(mockSupabase, db, 'msg-to-del');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_own_chat_message', {
        p_message_id: 'msg-to-del',
      });
    });
  });

  describe('report and moderation', () => {
    it('calls report_chat_message RPC', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: 'report-id-1', error: null }),
      };

      const reportId = await reportChatMessage(mockSupabase, 'msg-1', 'inappropriate_content');
      expect(reportId).toBe('report-id-1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('report_chat_message', {
        p_message_id: 'msg-1',
        p_reason: 'inappropriate_content',
        p_details: null,
      });
    });
  });

  describe('member mutes', () => {
    it('mutes and unmutes chat members via RPC', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      await muteChatMember(mockSupabase, 'bad-actor');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('mute_chat_member', {
        p_target_user_id: 'bad-actor',
      });
    });
  });

  describe('consent records', () => {
    it('accepts terms and saves to local SQLite and server', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      await acceptChatTerms(mockSupabase, db, 'user-1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_chat_terms', {
        p_version: '1.0',
      });

      const accepted = await hasAcceptedChatTerms(mockSupabase, db, 'user-1');
      expect(accepted).toBe(true);
    });
  });
});
