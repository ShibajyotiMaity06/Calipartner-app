import { describe, expect, it } from 'vitest';
import {
  buildSignedR2Url,
  CHAT_IMAGE_RATE_LIMIT_COUNT,
  CHAT_MESSAGE_RATE_LIMIT_COUNT,
  isSignedUrlExpired,
  validateChatMessageInput,
  validateChatStorageKey,
} from './chat';
import type {
  ChatAttachment,
  ChatMessage,
  ConsentRecord,
  Room,
  RoomMember,
} from './types';

/**
 * In-memory simulation of Phase 8 Database Engine, RLS policies,
 * triggers, rate limits, and security constraints for comprehensive attack testing.
 */
class InMemoryPhase8ChatDb {
  rooms = new Map<string, Room>();
  roomMembers = new Map<string, RoomMember>(); // `${roomId}:${userId}`
  consentRecords = new Map<string, ConsentRecord>(); // `${userId}:${consentType}`
  chatMessages = new Map<string, ChatMessage>(); // `id`
  chatAttachments = new Map<string, ChatAttachment>(); // `id`
  chatReadState = new Map<string, { roomId: string; userId: string; lastReadMessageId: string | null; lastReadAt: string }>();
  blocks = new Set<string>(); // `${blockerId}:${blockedId}`
  memberMutes = new Set<string>(); // `${userId}:${mutedUserId}`
  systemMessageMutes = new Set<string>(); // `${roomId}:${userId}`
  rateLimits = new Map<string, { count: number; windowStart: number }>();
  reports: Array<{ id: string; reporterId: string; targetId: string; reason: string }> = [];

  registerRoom(room: Room) {
    this.rooms.set(room.id, room);
  }

  setMember(roomId: string, userId: string, status: 'active' | 'paused' | 'left') {
    this.roomMembers.set(`${roomId}:${userId}`, {
      id: `member-${roomId}-${userId}`,
      room_id: roomId,
      user_id: userId,
      role: 'member',
      status,
      privacy_settings: {
        share_streak: true,
        share_goal_completion: true,
        share_steps: true,
        share_water: true,
        share_workouts: true,
        share_workout_details: false,
        share_calories_macros: false,
        share_meals: 'never',
        share_weight_number: false,
        share_weight_progress: false,
        share_fasting: false,
      },
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  acceptTerms(userId: string, consentType: 'chat_terms' = 'chat_terms', version = '1.0') {
    this.consentRecords.set(`${userId}:${consentType}`, {
      id: `consent-${userId}-${consentType}`,
      user_id: userId,
      consent_type: consentType,
      version,
      accepted_at: new Date().toISOString(),
    });
  }

  isRoomMember(roomId: string, userId: string): boolean {
    const mem = this.roomMembers.get(`${roomId}:${userId}`);
    return Boolean(mem && (mem.status === 'active' || mem.status === 'paused'));
  }

  roomIsUsable(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.state === 'locked' || room.state === 'archived') return false;
    return true; // Simplified plan active check for attack harness
  }

  checkRateLimit(key: string, maxRequests: number, windowSeconds: number, now = Date.now()): boolean {
    const entry = this.rateLimits.get(key);
    if (!entry) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (now > entry.windowStart + windowSeconds * 1000) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  // Simulates send_chat_message() RPC + RLS & Triggers
  sendMessage(
    callerId: string,
    params: {
      roomId: string;
      clientId: string;
      text?: string | null;
      attachments?: Array<{
        storageKey: string;
        size: number;
        mimeType: string;
        width?: number;
        height?: number;
      }>;
    },
    now = Date.now(),
  ): { success: boolean; error?: string; message?: ChatMessage } {
    const { roomId, clientId, text, attachments = [] } = params;

    // 1. Consent check: must have accepted chat terms
    const hasConsent = this.consentRecords.has(`${callerId}:chat_terms`);
    if (!hasConsent) {
      return { success: false, error: 'TERMS_REQUIRED: Must accept terms before sending' };
    }

    // 2. Room membership check: active or paused member
    if (!this.isRoomMember(roomId, callerId)) {
      return { success: false, error: 'NOT_ROOM_MEMBER: Caller is not a room member' };
    }

    // 3. Room usable & state check
    const room = this.rooms.get(roomId);
    if (!room || !this.roomIsUsable(roomId) || room.state === 'locked') {
      return { success: false, error: 'ROOM_LOCKED: This room is paused' };
    }
    if (room.state === 'dormant') {
      return { success: false, error: 'ROOM_DORMANT_READ_ONLY: Chat is read-only in dormant rooms' };
    }

    // 4. Input validation
    const validation = validateChatMessageInput({
      text,
      attachments: attachments.map((a) => ({ size: a.size, mime_type: a.mimeType })),
      hasAcceptedTerms: true,
    });
    if (!validation.valid) {
      return { success: false, error: `${validation.errorCode}: ${validation.error}` };
    }

    // 5. Rate limiting: 20 msgs/min
    if (!this.checkRateLimit(`chat_msg:${callerId}`, CHAT_MESSAGE_RATE_LIMIT_COUNT, 60, now)) {
      return { success: false, error: 'RATE_LIMIT_EXCEEDED: Maximum 20 messages per minute' };
    }

    // 6. Image rate limiting: 30 images/hour
    if (attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        if (!this.checkRateLimit(`chat_img:${callerId}`, CHAT_IMAGE_RATE_LIMIT_COUNT, 3600, now)) {
          return { success: false, error: 'RATE_LIMIT_EXCEEDED: Maximum 30 images per hour' };
        }
      }
    }

    // 7. Idempotency by clientId
    for (const existing of this.chatMessages.values()) {
      if (existing.client_id === clientId) {
        return { success: true, message: existing };
      }
    }

    // 8. Insert message
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdMsg: ChatMessage = {
      id: msgId,
      client_id: clientId,
      room_id: roomId,
      sender_id: callerId,
      message_type: 'user',
      system_event_type: null,
      text: text ?? null,
      created_at: new Date(now).toISOString(),
      deleted_at: null,
      attachments: [],
      delivery_status: 'sent',
      sync_state: 'synced',
    };

    // 9. Insert attachments
    for (let i = 0; i < attachments.length; i++) {
      const attInput = attachments[i];
      if (!attInput) continue;
      const attId = `att-${msgId}-${i}`;
      const attachment: ChatAttachment = {
        id: attId,
        message_id: msgId,
        storage_key: attInput.storageKey,
        width: attInput.width ?? null,
        height: attInput.height ?? null,
        size: attInput.size,
        mime_type: attInput.mimeType,
        moderation_status: 'pending',
        created_at: new Date(now).toISOString(),
      };
      this.chatAttachments.set(attId, attachment);
      createdMsg.attachments.push(attachment);
    }

    this.chatMessages.set(msgId, createdMsg);
    return { success: true, message: createdMsg };
  }

  // Simulates get_chat_messages() query applying RLS
  fetchMessages(callerId: string, roomId: string): { success: boolean; messages: ChatMessage[]; error?: string } {
    // 1. Membership check
    if (!this.isRoomMember(roomId, callerId)) {
      return { success: false, messages: [], error: 'NOT_ROOM_MEMBER: Access denied' };
    }

    // 2. Room usable & Locked check
    const room = this.rooms.get(roomId);
    if (!room || !this.roomIsUsable(roomId) || room.state === 'locked') {
      return { success: false, messages: [], error: 'ROOM_LOCKED: This room is paused' };
    }

    // 3. Filter messages according to RLS
    const result: ChatMessage[] = [];
    for (const msg of this.chatMessages.values()) {
      if (msg.room_id !== roomId) continue;

      // Filter blocked sender
      if (msg.sender_id && this.blocks.has(`${callerId}:${msg.sender_id}`)) {
        continue;
      }

      // Filter muted sender
      if (msg.sender_id && this.memberMutes.has(`${callerId}:${msg.sender_id}`)) {
        continue;
      }

      // Filter muted system messages
      if (msg.message_type === 'system' && this.systemMessageMutes.has(`${roomId}:${callerId}`)) {
        continue;
      }

      // Soft delete masking
      if (msg.deleted_at) {
        result.push({
          ...msg,
          text: '[Message deleted]',
          attachments: [],
        });
      } else {
        result.push(msg);
      }
    }

    result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { success: true, messages: result };
  }

  // Simulates get_signed_image_url Edge Function
  getSignedImageUrl(
    callerId: string,
    roomId: string,
    storageKey: string,
    now = Date.now(),
  ): { success: boolean; signedUrl?: string; error?: string } {
    if (!this.isRoomMember(roomId, callerId)) {
      return { success: false, error: 'NOT_ROOM_MEMBER: Access denied' };
    }

    if (!this.roomIsUsable(roomId)) {
      return { success: false, error: 'ROOM_LOCKED: Room is paused' };
    }

    if (!validateChatStorageKey(storageKey, roomId)) {
      return { success: false, error: 'INVALID_STORAGE_KEY: Path traversal or invalid key' };
    }

    const url = buildSignedR2Url({
      method: 'GET',
      bucket: 'calipartner-chat',
      key: storageKey,
      expiresInSeconds: 900,
      now,
    });

    return { success: true, signedUrl: url };
  }

  // Simulates delete_own_chat_message() RPC + trigger deleting stored objects
  deleteMessage(callerId: string, messageId: string): { success: boolean; error?: string } {
    const msg = this.chatMessages.get(messageId);
    if (!msg) {
      return { success: false, error: 'MESSAGE_NOT_FOUND' };
    }

    if (msg.sender_id !== callerId) {
      return { success: false, error: 'CANNOT_DELETE_OTHERS: Cannot delete another user message' };
    }

    // Soft delete
    msg.deleted_at = new Date().toISOString();

    // Trigger: remove stored attachment objects from DB
    for (const [attId, att] of this.chatAttachments.entries()) {
      if (att.message_id === messageId) {
        this.chatAttachments.delete(attId);
      }
    }
    msg.attachments = [];

    return { success: true };
  }
}

describe('Phase 8: Comprehensive Attack & Security Tests', () => {
  const roomId = 'room-alpha-123';
  const userA = 'user-a-111';
  const userB = 'user-b-222';
  const nonMember = 'user-intruder-999';

  function createTestHarness(): InMemoryPhase8ChatDb {
    const db = new InMemoryPhase8ChatDb();
    db.registerRoom({
      id: roomId,
      name: 'Alpha Room',
      code: 'ALPHA1',
      created_by: userA,
      plan_holder_id: userA,
      member_cap: 8,
      state: 'active',
      who_can_invite: 'any_member',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    db.setMember(roomId, userA, 'active');
    db.setMember(roomId, userB, 'active');
    db.acceptTerms(userA);
    db.acceptTerms(userB);

    return db;
  }

  it('ATTACK 1: Non-member cannot fetch messages from the room', () => {
    const db = createTestHarness();
    db.sendMessage(userA, {
      roomId,
      clientId: 'msg-c1',
      text: 'Private room secret',
    });

    const res = db.fetchMessages(nonMember, roomId);
    expect(res.success).toBe(false);
    expect(res.messages.length).toBe(0);
    expect(res.error).toContain('NOT_ROOM_MEMBER');
  });

  it('ATTACK 2: Non-member cannot obtain signed image URLs', () => {
    const db = createTestHarness();
    const res = db.getSignedImageUrl(
      nonMember,
      roomId,
      `rooms/${roomId}/messages/c1/0.jpg`,
    );
    expect(res.success).toBe(false);
    expect(res.signedUrl).toBeUndefined();
    expect(res.error).toContain('NOT_ROOM_MEMBER');
  });

  it('ATTACK 3: Expired / removed member loses access immediately', () => {
    const db = createTestHarness();
    db.sendMessage(userA, {
      roomId,
      clientId: 'msg-c1',
      text: 'Message before B leaves',
    });

    // User B leaves / is removed
    db.setMember(roomId, userB, 'left');

    const res = db.fetchMessages(userB, roomId);
    expect(res.success).toBe(false);
    expect(res.messages.length).toBe(0);
    expect(res.error).toContain('NOT_ROOM_MEMBER');

    const imgRes = db.getSignedImageUrl(
      userB,
      roomId,
      `rooms/${roomId}/messages/c1/0.jpg`,
    );
    expect(imgRes.success).toBe(false);
  });

  it('ATTACK 4: Signed URLs expire after validity duration', () => {
    const db = createTestHarness();
    const now = 1700000000000;
    const res = db.getSignedImageUrl(
      userA,
      roomId,
      `rooms/${roomId}/messages/c1/0.jpg`,
      now,
    );
    expect(res.success).toBe(true);
    const url = res.signedUrl!;

    // Active after 10 mins
    expect(isSignedUrlExpired(url, now + 600 * 1000)).toBe(false);
    // Expired after 16 mins (960 seconds > 900 seconds)
    expect(isSignedUrlExpired(url, now + 960 * 1000)).toBe(true);
  });

  it('ATTACK 5: Duplicate sends with identical client_id are idempotent and create exactly one message', () => {
    const db = createTestHarness();
    const send1 = db.sendMessage(userA, {
      roomId,
      clientId: 'idempotent-client-uuid-123',
      text: 'Hello idempotent world',
    });
    expect(send1.success).toBe(true);

    const send2 = db.sendMessage(userA, {
      roomId,
      clientId: 'idempotent-client-uuid-123',
      text: 'Hello idempotent world',
    });
    expect(send2.success).toBe(true);
    expect(send2.message?.id).toBe(send1.message?.id);

    // Only 1 message exists in DB
    const msgs = db.fetchMessages(userA, roomId);
    expect(msgs.messages.length).toBe(1);
  });

  it('ATTACK 6: Message rate limit blocks flooding above 20 messages/min', () => {
    const db = createTestHarness();
    const now = 1700000000000;

    // Send 20 messages within the minute
    for (let i = 1; i <= 20; i++) {
      const res = db.sendMessage(
        userA,
        {
          roomId,
          clientId: `rapid-msg-${i}`,
          text: `Message ${i}`,
        },
        now + i * 1000,
      );
      expect(res.success).toBe(true);
    }

    // 21st message in the same minute must be blocked
    const burst21 = db.sendMessage(
      userA,
      {
        roomId,
        clientId: 'rapid-msg-21',
        text: 'Flood message 21',
      },
      now + 25000,
    );
    expect(burst21.success).toBe(false);
    expect(burst21.error).toContain('RATE_LIMIT_EXCEEDED');

    // After 61 seconds (next minute window), sending is allowed again
    const nextMin = db.sendMessage(
      userA,
      {
        roomId,
        clientId: 'rapid-msg-22',
        text: 'Message in next window',
      },
      now + 65000,
    );
    expect(nextMin.success).toBe(true);
  });

  it('ATTACK 7: Image rate limit blocks more than 30 images/hour', () => {
    const db = createTestHarness();
    const now = 1700000000000;

    // Send 6 messages each with 5 images = 30 images
    for (let i = 1; i <= 6; i++) {
      const atts = Array(5).fill(null).map((_, idx) => ({
        storageKey: `rooms/${roomId}/messages/img-batch-${i}/${idx}.jpg`,
        size: 50000,
        mimeType: 'image/jpeg',
      }));
      const res = db.sendMessage(
        userA,
        {
          roomId,
          clientId: `img-batch-${i}`,
          attachments: atts,
        },
        now + i * 1000,
      );
      expect(res.success).toBe(true);
    }

    // 31st image within the hour must be blocked
    const excess = db.sendMessage(
      userA,
      {
        roomId,
        clientId: 'img-batch-excess',
        attachments: [
          {
            storageKey: `rooms/${roomId}/messages/excess/0.jpg`,
            size: 50000,
            mimeType: 'image/jpeg',
          },
        ],
      },
      now + 10000,
    );
    expect(excess.success).toBe(false);
    expect(excess.error).toContain('RATE_LIMIT_EXCEEDED');
  });

  it('ATTACK 8: Oversized (> 10MB) or forbidden file types are rejected', () => {
    const db = createTestHarness();

    const oversized = db.sendMessage(userA, {
      roomId,
      clientId: 'oversized-1',
      attachments: [
        {
          storageKey: `rooms/${roomId}/messages/o1/0.jpg`,
          size: 11 * 1024 * 1024,
          mimeType: 'image/jpeg',
        },
      ],
    });
    expect(oversized.success).toBe(false);
    expect(oversized.error).toContain('FILE_TOO_LARGE');

    const invalidType = db.sendMessage(userA, {
      roomId,
      clientId: 'invalid-type-1',
      attachments: [
        {
          storageKey: `rooms/${roomId}/messages/it1/0.exe`,
          size: 5000,
          mimeType: 'application/x-msdownload',
        },
      ],
    });
    expect(invalidType.success).toBe(false);
    expect(invalidType.error).toContain('INVALID_FILE_TYPE');
  });

  it('ATTACK 9: Path traversal in storage keys is strictly blocked', () => {
    const db = createTestHarness();
    const attackKeys = [
      'rooms/room-alpha-123/messages/../../etc/passwd',
      '../secret/key.jpg',
      '/rooms/room-alpha-123/messages/0.jpg',
      'rooms\\room-alpha-123\\messages\\0.jpg',
    ];

    for (const key of attackKeys) {
      const res = db.getSignedImageUrl(userA, roomId, key);
      expect(res.success).toBe(false);
      expect(res.error).toContain('INVALID_STORAGE_KEY');
    }
  });

  it('ATTACK 10: Locked rooms completely hide chat from all members ("This room is paused")', () => {
    const db = createTestHarness();
    db.sendMessage(userA, {
      roomId,
      clientId: 'msg-pre-lock',
      text: 'Message before room lock',
    });

    // Lock the room
    const room = db.rooms.get(roomId)!;
    room.state = 'locked';

    // Neither user A nor user B can read
    const fetchA = db.fetchMessages(userA, roomId);
    expect(fetchA.success).toBe(false);
    expect(fetchA.error).toContain('ROOM_LOCKED');

    const fetchB = db.fetchMessages(userB, roomId);
    expect(fetchB.success).toBe(false);
    expect(fetchB.error).toContain('ROOM_LOCKED');

    // Neither can send
    const sendA = db.sendMessage(userA, {
      roomId,
      clientId: 'msg-during-lock',
      text: 'Trying to send in locked room',
    });
    expect(sendA.success).toBe(false);
    expect(sendA.error).toContain('ROOM_LOCKED');
  });

  it('ATTACK 11: Dormant rooms keep chat working as read-only', () => {
    const db = createTestHarness();
    db.sendMessage(userA, {
      roomId,
      clientId: 'msg-pre-dormant',
      text: 'Hello before dormancy',
    });

    // Room becomes dormant
    const room = db.rooms.get(roomId)!;
    room.state = 'dormant';

    // Reading chat still works
    const read = db.fetchMessages(userA, roomId);
    expect(read.success).toBe(true);
    expect(read.messages.length).toBe(1);

    // Sending is blocked as read-only
    const send = db.sendMessage(userA, {
      roomId,
      clientId: 'msg-during-dormant',
      text: 'Should be blocked',
    });
    expect(send.success).toBe(false);
    expect(send.error).toContain('ROOM_DORMANT_READ_ONLY');
  });

  it('ATTACK 12: Muted and blocked members have their messages hidden for the muter/blocker', () => {
    const db = createTestHarness();
    db.sendMessage(userA, {
      roomId,
      clientId: 'msg-a',
      text: 'From user A',
    });
    db.sendMessage(userB, {
      roomId,
      clientId: 'msg-b',
      text: 'From user B',
    });

    // User A mutes User B
    db.memberMutes.add(`${userA}:${userB}`);

    const resA = db.fetchMessages(userA, roomId);
    expect(resA.messages.length).toBe(1);
    expect(resA.messages[0]!.sender_id).toBe(userA);

    // User B still sees both
    const resB = db.fetchMessages(userB, roomId);
    expect(resB.messages.length).toBe(2);
  });

  it('ATTACK 13: Deleting a message soft-deletes text and deletes stored attachment objects', () => {
    const db = createTestHarness();
    const sent = db.sendMessage(userA, {
      roomId,
      clientId: 'msg-to-delete',
      text: 'Secret text to delete',
      attachments: [
        {
          storageKey: `rooms/${roomId}/messages/msg-to-delete/0.jpg`,
          size: 1000,
          mimeType: 'image/jpeg',
        },
      ],
    });
    const msgId = sent.message!.id;

    // Attacker User B tries to delete User A's message -> rejected
    const attackDelete = db.deleteMessage(userB, msgId);
    expect(attackDelete.success).toBe(false);
    expect(attackDelete.error).toContain('CANNOT_DELETE_OTHERS');

    // Owner deletes own message
    const ownerDelete = db.deleteMessage(userA, msgId);
    expect(ownerDelete.success).toBe(true);

    // Messages now masked to others and attachments removed
    const read = db.fetchMessages(userB, roomId);
    expect(read.messages[0]!.text).toBe('[Message deleted]');
    expect(read.messages[0]!.attachments.length).toBe(0);
    // Attachment deleted from DB
    expect(db.chatAttachments.size).toBe(0);
  });

  it('ATTACK 14: Terms acceptance is required before first message', () => {
    const db = createTestHarness();
    // User C joins but has NOT accepted chat terms
    const userC = 'user-c-333';
    db.setMember(roomId, userC, 'active');

    const res = db.sendMessage(userC, {
      roomId,
      clientId: 'msg-c-no-terms',
      text: 'First message without terms',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('TERMS_REQUIRED');

    // Once accepted, message succeeds
    db.acceptTerms(userC);
    const res2 = db.sendMessage(userC, {
      roomId,
      clientId: 'msg-c-with-terms',
      text: 'First message after accepting terms',
    });
    expect(res2.success).toBe(true);
  });
});
