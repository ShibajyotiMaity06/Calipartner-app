import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeMessagesDeduplicated, validateChatMessageInput } from '@calipartner/core';
import type { ChatAttachment, ChatMessage } from '@/types/chat';
import { ChatServiceError, parseChatError } from '@/types/chat';
import { enqueueOutbox, type SyncDb } from './syncService';

export interface SupabaseRpcClient {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export type ChatSupabaseClient = SupabaseClient | SupabaseRpcClient;

export interface SendMessageOptions {
  text?: string | null;
  attachments?: Array<{
    storage_key: string;
    size: number;
    mime_type: string;
    width?: number;
    height?: number;
    local_uri?: string;
  }>;
  clientId?: string;
  nickname?: string;
  username?: string;
  avatarUrl?: string;
}

export interface GetMessagesOptions {
  limit?: number;
  beforeCreatedAt?: string | null;
  afterCreatedAt?: string | null;
  ownerId?: string;
  beforeId?: string | null;
  afterId?: string | null;
}

/**
 * Reads local messages from SQLite for instant offline rendering.
 */
export async function getLocalChatMessages(
  db: SyncDb,
  roomId: string,
  options: GetMessagesOptions = {},
): Promise<ChatMessage[]> {
  const limit = options.limit ?? 50;
  let query = `
    SELECT id, client_id, room_id, sender_id, sender_nickname, sender_username, sender_avatar_url,
           message_type, system_event_type, text, created_at, deleted_at, delivery_status, sync_state
    FROM local_chat_messages
    WHERE room_id = ?
  `;
  const params: unknown[] = [roomId];

  if (options.beforeCreatedAt) {
    query += options.beforeId
      ? ' AND (created_at < ? OR (created_at = ? AND id < ?))'
      : ' AND created_at < ?';
    params.push(
      ...(options.beforeId
        ? [options.beforeCreatedAt, options.beforeCreatedAt, options.beforeId]
        : [options.beforeCreatedAt]),
    );
  }
  if (options.afterCreatedAt) {
    query += options.afterId
      ? ' AND (created_at > ? OR (created_at = ? AND id > ?))'
      : ' AND created_at > ?';
    params.push(
      ...(options.afterId
        ? [options.afterCreatedAt, options.afterCreatedAt, options.afterId]
        : [options.afterCreatedAt]),
    );
  }

  query += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit);

  const rows = await db.getAllAsync<{
    id: string;
    client_id: string;
    room_id: string;
    sender_id: string | null;
    sender_nickname: string | null;
    sender_username: string | null;
    sender_avatar_url: string | null;
    message_type: string;
    system_event_type: string | null;
    text: string | null;
    created_at: string;
    deleted_at: string | null;
    delivery_status: string;
    sync_state: string;
  }>(query, ...params);

  const messages: ChatMessage[] = [];

  for (const row of rows) {
    // Fetch local attachments for this message
    const attRows = await db.getAllAsync<{
      id: string;
      message_id: string;
      storage_key: string;
      local_uri: string | null;
      width: number | null;
      height: number | null;
      size: number;
      mime_type: string;
      moderation_status: string;
      created_at: string;
    }>(
      `SELECT id, message_id, storage_key, local_uri, width, height, size, mime_type, moderation_status, created_at
       FROM local_chat_attachments
       WHERE message_id = ?`,
      row.id,
    );

    const attachments: ChatAttachment[] = attRows.map((a) => ({
      id: a.id,
      message_id: a.message_id,
      storage_key: a.storage_key,
      local_uri: a.local_uri,
      width: a.width,
      height: a.height,
      size: a.size,
      mime_type: a.mime_type,
      moderation_status: a.moderation_status as ChatAttachment['moderation_status'],
      created_at: a.created_at,
    }));

    messages.push({
      id: row.id,
      client_id: row.client_id,
      room_id: row.room_id,
      sender_id: row.sender_id,
      sender_nickname: row.sender_nickname,
      sender_username: row.sender_username,
      sender_avatar_url: row.sender_avatar_url,
      message_type: row.message_type as ChatMessage['message_type'],
      system_event_type: row.system_event_type as ChatMessage['system_event_type'],
      text: row.deleted_at ? '[Message deleted]' : row.text,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      delivery_status: row.delivery_status as ChatMessage['delivery_status'],
      sync_state: row.sync_state as ChatMessage['sync_state'],
      attachments: row.deleted_at ? [] : attachments,
    });
  }

  // Return in chronological order
  messages.reverse();
  return messages;
}

/**
 * Fetches chat messages from Supabase (or local SQLite when offline).
 * Merges and saves remote messages into local SQLite.
 */
export async function getChatMessages(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  roomId: string,
  options: GetMessagesOptions = {},
): Promise<ChatMessage[]> {
  // 1. Get local cached messages first
  const localMessages = await getLocalChatMessages(db, roomId, options);

  try {
    // 2. Fetch remote messages via RPC
    const { data: remoteData, error } = await supabase.rpc('get_chat_messages_v2', {
      p_room_id: roomId,
      p_limit: options.limit ?? 50,
      p_before_created_at: options.beforeCreatedAt ?? null,
      p_after_created_at: options.afterCreatedAt ?? null,
      p_before_id: options.beforeId ?? null,
      p_after_id: options.afterId ?? null,
    });

    if (error) {
      throw parseChatError(error);
    }

    const rawList = (remoteData as ChatMessage[]) || [];
    const remoteMessages: ChatMessage[] = rawList.map((m) => ({
      ...m,
      delivery_status: 'sent',
      sync_state: 'synced',
    }));

    // 3. Upsert remote messages into local SQLite
    for (const msg of remoteMessages) {
      if (Array.isArray(msg.attachments))
        await db.runAsync(
          'DELETE FROM local_chat_attachments WHERE message_id IN (SELECT id FROM local_chat_messages WHERE client_id = ?) OR message_id = ?',
          [msg.client_id, msg.id],
        );
      await db.runAsync(
        `INSERT INTO local_chat_messages (
          id, client_id, room_id, sender_id, sender_nickname, sender_username, sender_avatar_url,
          message_type, system_event_type, text, created_at, deleted_at, delivery_status, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 'synced')
        ON CONFLICT (client_id) DO UPDATE SET
          id = excluded.id,
          text = excluded.text,
          deleted_at = excluded.deleted_at,
          delivery_status = 'sent',
          sync_state = 'synced'`,
        [
          msg.id,
          msg.client_id,
          msg.room_id,
          msg.sender_id,
          msg.sender_nickname ?? null,
          msg.sender_username ?? null,
          msg.sender_avatar_url ?? null,
          msg.message_type,
          msg.system_event_type ?? null,
          msg.text,
          msg.created_at,
          msg.deleted_at ?? null,
        ],
      );

      // Upsert attachments
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          await db.runAsync(
            `INSERT INTO local_chat_attachments (
              id, message_id, storage_key, width, height, size, mime_type, moderation_status, upload_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)
            ON CONFLICT (id) DO UPDATE SET
              moderation_status = excluded.moderation_status`,
            [
              att.id,
              msg.id,
              att.storage_key,
              att.width ?? null,
              att.height ?? null,
              att.size,
              att.mime_type,
              att.moderation_status,
              att.created_at,
            ],
          );
        }
      }
    }

    return mergeMessagesDeduplicated(
      localMessages.filter(
        (message) =>
          message.sync_state !== 'synced' &&
          (!options.ownerId || message.sender_id === options.ownerId),
      ),
      remoteMessages,
    );
  } catch (err: unknown) {
    // If offline or network error, return local cache
    const chatErr = parseChatError(err);
    if (
      !/network|fetch failed|failed to fetch|offline|load failed/i.test(
        String(
          err instanceof Error ? err.message : ((err as { message?: string })?.message ?? err),
        ),
      )
    )
      throw chatErr;
    return localMessages.filter(
      (message) =>
        !options.ownerId ||
        message.sync_state === 'synced' ||
        message.sender_id === options.ownerId,
    );
  }
}

/**
 * Sends a message with offline queueing and idempotent retry.
 */
export async function sendChatMessage(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  roomId: string,
  senderId: string,
  options: SendMessageOptions,
): Promise<ChatMessage> {
  const clientId =
    options.clientId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  const msgId = clientId; // Default local ID

  // 1. Validate inputs
  const validation = validateChatMessageInput({
    text: options.text,
    attachments: options.attachments,
    hasAcceptedTerms: true,
  });
  if (!validation.valid) {
    throw new ChatServiceError(validation.errorCode ?? 'UNKNOWN_ERROR', validation.error);
  }

  // 2. Save into SQLite local_chat_messages as 'sending' / 'pending'
  await db.runAsync(
    `INSERT INTO local_chat_messages (
      id, client_id, room_id, sender_id, sender_nickname, sender_username, sender_avatar_url,
      message_type, text, created_at, delivery_status, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', ?, ?, 'sending', 'pending')
    ON CONFLICT (id) DO UPDATE SET
      text = excluded.text,
      delivery_status = 'sending',
      sync_state = 'pending'`,
    [
      msgId,
      clientId,
      roomId,
      senderId,
      options.nickname ?? null,
      options.username ?? null,
      options.avatarUrl ?? null,
      options.text ?? null,
      now,
    ],
  );

  const localAttachments: ChatAttachment[] = [];
  if (options.attachments && options.attachments.length > 0) {
    for (let i = 0; i < options.attachments.length; i++) {
      const att = options.attachments[i];
      if (!att) continue;
      const attId = `att-${clientId}-${i}`;
      await db.runAsync(
        `INSERT INTO local_chat_attachments (
          id, message_id, storage_key, local_uri, width, height, size, mime_type, moderation_status, upload_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?) ON CONFLICT(id) DO UPDATE SET storage_key=excluded.storage_key,local_uri=excluded.local_uri`,
        [
          attId,
          msgId,
          att.storage_key,
          att.local_uri ?? null,
          att.width ?? null,
          att.height ?? null,
          att.size,
          att.mime_type,
          now,
        ],
      );

      localAttachments.push({
        id: attId,
        message_id: msgId,
        storage_key: att.storage_key,
        local_uri: att.local_uri,
        width: att.width ?? null,
        height: att.height ?? null,
        size: att.size,
        mime_type: att.mime_type,
        moderation_status: 'pending',
        created_at: now,
      });
    }
  }

  const localMessage: ChatMessage = {
    id: msgId,
    client_id: clientId,
    room_id: roomId,
    sender_id: senderId,
    sender_nickname: options.nickname,
    sender_username: options.username,
    sender_avatar_url: options.avatarUrl,
    message_type: 'user',
    system_event_type: null,
    text: options.text ?? null,
    created_at: now,
    deleted_at: null,
    attachments: localAttachments,
    delivery_status: 'sending',
    sync_state: 'pending',
  };

  // 3. Queue in SQLite outbox
  await enqueueOutbox(db, {
    id: msgId,
    entity: 'chat_messages',
    operation: 'upsert',
    payload: {
      client_id: clientId,
      room_id: roomId,
      sender_id: senderId,
      message_type: 'user',
      text: options.text ?? null,
      created_at: now,
      attachments:
        options.attachments?.map(({ storage_key, size, mime_type, width, height }) => ({
          storage_key,
          size,
          mime_type,
          width,
          height,
        })) ?? [],
    },
  });

  // 4. Try sending to Supabase immediately
  try {
    const { data: serverMsg, error } = await supabase.rpc('send_chat_message', {
      p_room_id: roomId,
      p_client_id: clientId,
      p_text: options.text ?? null,
      p_attachments:
        options.attachments?.map((a) => ({
          storage_key: a.storage_key,
          mime_type: a.mime_type,
          size: a.size,
          width: a.width,
          height: a.height,
        })) ?? [],
    });

    if (error) {
      throw parseChatError(error);
    }

    // Success: update local message with confirmed server ID and state
    const confirmedId = serverMsg?.id || msgId;
    await db.runAsync('UPDATE local_chat_attachments SET message_id = ? WHERE message_id = ?', [
      confirmedId,
      msgId,
    ]);
    await db.runAsync(
      `UPDATE local_chat_messages
       SET id = ?, delivery_status = 'sent', sync_state = 'synced'
       WHERE client_id = ?`,
      [confirmedId, clientId],
    );

    // Remove from outbox
    await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [msgId]);

    return {
      ...localMessage,
      id: confirmedId,
      delivery_status: 'sent',
      sync_state: 'synced',
    };
  } catch (err: unknown) {
    const chatErr = parseChatError(err);

    // Hard errors (permanent): fail immediately and remove from outbox
    if (
      chatErr.code === 'PLUS_REQUIRED' ||
      chatErr.code === 'PRO_REQUIRED' ||
      chatErr.code === 'ROOM_LOCKED' ||
      chatErr.code === 'NOT_ROOM_MEMBER' ||
      chatErr.code === 'ROOM_DORMANT_READ_ONLY' ||
      chatErr.code === 'RATE_LIMIT_EXCEEDED' ||
      chatErr.code === 'TERMS_REQUIRED' ||
      chatErr.code === 'ATTACHMENT_LIMIT_EXCEEDED' ||
      chatErr.code === 'FILE_TOO_LARGE'
    ) {
      await db.runAsync(
        `UPDATE local_chat_messages
         SET delivery_status = 'failed', sync_state = 'failed', last_error = ?
         WHERE client_id = ?`,
        [chatErr.message, clientId],
      );
      await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [msgId]);
      throw chatErr;
    }

    // Transient network error: leave in outbox for automatic reconnect sync
    return localMessage;
  }
}

/**
 * Retries sending a failed message.
 */
export async function retryFailedChatMessage(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  message: ChatMessage,
): Promise<ChatMessage> {
  return sendChatMessage(supabase, db, message.room_id, message.sender_id || '', {
    text: message.text,
    attachments: message.attachments.map((a) => ({
      storage_key: a.storage_key,
      size: a.size,
      mime_type: a.mime_type,
      width: a.width ?? undefined,
      height: a.height ?? undefined,
      local_uri: a.local_uri ?? undefined,
    })),
    clientId: message.client_id,
  });
}

/**
 * Soft-deletes user's own message and removes stored objects.
 */
export async function deleteChatMessage(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  messageId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Confirm the server action before showing a successful deletion.
  if ('functions' in supabase) {
    const result = await supabase.functions.invoke('chat-image-moderation', {
      body: { action: 'delete_message', message_id: messageId },
    });
    if (result.error) throw parseChatError(result.error);
  } else {
    const result = await supabase.rpc('delete_own_chat_message', { p_message_id: messageId });
    if (result.error) throw parseChatError(result.error);
  }
  // 1. Soft-delete locally
  await db.runAsync(`UPDATE local_chat_messages SET deleted_at = ? WHERE id = ?`, [now, messageId]);
  await db.runAsync(`DELETE FROM local_chat_attachments WHERE message_id = ?`, [messageId]);
}

/**
 * Reports a message to the moderation queue.
 */
export async function reportChatMessage(
  supabase: ChatSupabaseClient,
  messageId: string,
  reason: string,
  details?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('report_chat_message', {
    p_message_id: messageId,
    p_reason: reason,
    p_details: details ?? null,
  });

  if (error) {
    throw parseChatError(error);
  }

  return data as string;
}

/**
 * Blocks an abusive user instantly (Apple Guideline 1.2 UGC).
 */
export async function blockChatMember(
  supabase: ChatSupabaseClient,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('block_user', {
    p_target_user_id: targetUserId,
  });
  if (error) throw parseChatError(error);
}

/**
 * Unblocks a previously blocked user.
 */
export async function unblockChatMember(
  supabase: ChatSupabaseClient,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', {
    p_target_user_id: targetUserId,
  });
  if (error) throw parseChatError(error);
}

/**
 * Mutes a room member.
 */
export async function muteChatMember(
  supabase: ChatSupabaseClient,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('mute_chat_member', {
    p_target_user_id: targetUserId,
  });
  if (error) throw parseChatError(error);
}

export async function unmuteChatMember(
  supabase: ChatSupabaseClient,
  targetUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('unmute_chat_member', {
    p_target_user_id: targetUserId,
  });
  if (error) throw parseChatError(error);
}

/**
 * Updates room chat settings (e.g. mute system messages).
 */
export async function setRoomChatSettings(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  roomId: string,
  userId: string,
  muteSystemMessages: boolean,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_chat_room_settings (room_id, user_id, mute_system_messages)
     VALUES (?, ?, ?)
     ON CONFLICT (room_id, user_id) DO UPDATE SET mute_system_messages = excluded.mute_system_messages`,
    [roomId, userId, muteSystemMessages ? 1 : 0],
  );

  const { error } = await supabase.rpc('set_room_chat_settings', {
    p_room_id: roomId,
    p_mute_system_messages: muteSystemMessages,
  });
  if (error) throw parseChatError(error);
}

/**
 * Marks chat as read and resets unread count.
 */
export async function markChatRead(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  roomId: string,
  userId: string,
  messageId?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_chat_read_state (room_id, user_id, last_read_message_id, last_read_at, unread_count)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT (room_id, user_id) DO UPDATE SET
       last_read_message_id = coalesce(excluded.last_read_message_id, local_chat_read_state.last_read_message_id),
       last_read_at = excluded.last_read_at,
       unread_count = 0`,
    [roomId, userId, messageId ?? null, now],
  );

  await supabase.rpc('mark_chat_read', {
    p_room_id: roomId,
    p_message_id: messageId ?? null,
  });
}

/**
 * Gets unread message count for a room.
 */
export async function getChatUnreadCount(
  supabase: ChatSupabaseClient,
  roomId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_chat_unread_count', {
      p_room_id: roomId,
    });
    if (error) return 0;
    return (data as number) || 0;
  } catch {
    return 0;
  }
}

/**
 * Checks if user has accepted chat terms.
 */
export async function hasAcceptedChatTerms(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  userId: string,
): Promise<boolean> {
  // Check local database first
  const local = await db.getFirstAsync<{ accepted_at: string }>(
    `SELECT accepted_at FROM local_consent_records WHERE user_id = ? AND consent_type = 'chat_terms'`,
    [userId],
  );
  if (local) return true;

  try {
    const { data } = await supabase.rpc('has_accepted_chat_terms', {
      p_user_id: userId,
    });
    if (data === true) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO local_consent_records (user_id, consent_type, version, accepted_at)
         VALUES (?, 'chat_terms', '1.0', ?)
         ON CONFLICT (user_id, consent_type) DO UPDATE SET accepted_at = excluded.accepted_at`,
        [userId, now],
      );
      return true;
    }
  } catch {
    // Return false on error
  }
  return false;
}

/**
 * Accepts chat terms of use.
 */
export async function acceptChatTerms(
  supabase: ChatSupabaseClient,
  db: SyncDb,
  userId: string,
  version = '1.0',
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_consent_records (user_id, consent_type, version, accepted_at)
     VALUES (?, 'chat_terms', ?, ?)
     ON CONFLICT (user_id, consent_type) DO UPDATE SET accepted_at = excluded.accepted_at`,
    [userId, version, now],
  );

  const { error } = await supabase.rpc('accept_chat_terms', {
    p_version: version,
  });
  if (error) throw parseChatError(error);
}
