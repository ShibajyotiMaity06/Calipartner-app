import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { getChatMessages, getLocalChatMessages, sendChatMessage } from './chatService';
import { type LocalDb } from './accountDataService';
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE local_chat_messages(id TEXT PRIMARY KEY,client_id TEXT UNIQUE,room_id TEXT,sender_id TEXT,sender_nickname TEXT,sender_username TEXT,sender_avatar_url TEXT,message_type TEXT,system_event_type TEXT,text TEXT,created_at TEXT,deleted_at TEXT,delivery_status TEXT,sync_state TEXT,last_error TEXT);
    CREATE TABLE local_chat_attachments(id TEXT PRIMARY KEY,message_id TEXT,storage_key TEXT,local_uri TEXT,width INTEGER,height INTEGER,size INTEGER,mime_type TEXT,moderation_status TEXT,upload_status TEXT,created_at TEXT);
    CREATE TABLE outbox(id TEXT PRIMARY KEY,entity TEXT,operation TEXT,payload TEXT,created_at TEXT,attempts INTEGER DEFAULT 0,last_error TEXT,status TEXT DEFAULT 'pending',next_retry_at TEXT,updated_at TEXT);`);
  const params = (p: unknown[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const db: LocalDb = {
    runAsync: async (query, ...p) => sql.prepare(query).run(...(params(p) as never[])),
    getAllAsync: async <T>(query: string, ...p: unknown[]) =>
      sql.prepare(query).all(...(params(p) as never[])) as T[],
    getFirstAsync: async <T>(query: string, ...p: unknown[]) =>
      sql.prepare(query).get(...(params(p) as never[])) as T | null,
  };
  return { db, sql };
}
describe('real SQLite chat replay and cache isolation', () => {
  it('offline media retains references, RPC replay rebinds IDs and server refresh leaves one attachment', async () => {
    const { db, sql } = database();
    try {
      const attachment = {
        storage_key: 'rooms/room/messages/client/0.jpg',
        size: 4,
        mime_type: 'image/jpeg',
      };
      await expect(
        sendChatMessage(
          {
            rpc: async () => {
              throw new Error('Network request failed');
            },
          },
          db,
          'room',
          'owner',
          { clientId: 'client', text: 'Photo', attachments: [attachment] },
        ),
      ).rejects.toThrow('Network request failed');
      expect(sql.prepare('SELECT delivery_status FROM local_chat_messages').get()).toMatchObject({
        delivery_status: 'failed',
      });
      const rpc = vi.fn().mockResolvedValue({ data: { id: 'server-id' }, error: null });
      await sendChatMessage({ rpc }, db, 'room', 'owner', {
        clientId: 'client',
        text: 'Photo',
        attachments: [attachment],
      });
      expect(rpc).toHaveBeenCalledOnce();
      expect(rpc).toHaveBeenCalledWith(
        'send_chat_message',
        expect.objectContaining({ p_client_id: 'client', p_attachments: [attachment] }),
      );
      expect(sql.prepare('SELECT * FROM outbox').all()).toEqual([]);
      const message = {
        id: 'server-id',
        client_id: 'client',
        room_id: 'room',
        sender_id: 'owner',
        text: 'Photo',
        created_at: '2026-10-28T12:00:00Z',
        message_type: 'user',
        attachments: [
          {
            ...attachment,
            id: 'server-att',
            message_id: 'server-id',
            moderation_status: 'ok',
            created_at: '2026-10-28T12:00:00Z',
          },
        ],
      };
      await getChatMessages({ rpc: async () => ({ data: [message], error: null }) }, db, 'room', {
        ownerId: 'owner',
      });
      const cached = await getLocalChatMessages(db, 'room');
      expect(cached).toHaveLength(1);
      expect(cached[0]!.attachments!).toHaveLength(1);
      expect(cached[0]!.attachments![0]!.id).toBe('server-att');
    } finally {
      sql.close();
    }
  });
  it('permission denial never falls back to cached chat', async () => {
    const { db, sql } = database();
    try {
      await expect(
        getChatMessages(
          { rpc: async () => ({ data: null, error: { message: 'PLUS_REQUIRED' } }) },
          db,
          'room',
        ),
      ).rejects.toMatchObject({ code: 'PLUS_REQUIRED' });
    } finally {
      sql.close();
    }
  });
});
