import { describe, expect, it } from 'vitest';
import {
  getDefaultNotificationSettings,
  sanitizePushPayload,
  shouldDeliverNotification,
  validateFcmToken,
} from './notifications';
import type {
  Device,
  NotificationSettings,
  NotificationType,
  PushNotificationQueueItem,
  PushPayload,
  Room,
  RoomMember,
} from './types';

/**
 * In-memory simulation of Phase 9 Database Engine, RLS, Triggers,
 * Quiet Hours, Mutes, Privacy enforcement, and Device Token cleanup.
 */
class InMemoryPhase9NotificationDb {
  devices = new Map<string, Device>(); // token -> Device
  settings = new Map<string, NotificationSettings>(); // userId -> NotificationSettings
  userTimezones = new Map<string, string>(); // userId -> timezone
  rooms = new Map<string, Room>();
  roomMembers = new Map<string, RoomMember>(); // `${roomId}:${userId}` -> RoomMember
  chatRoomMutes = new Set<string>(); // `${roomId}:${userId}`
  memberMutes = new Set<string>(); // `${userId}:${mutedUserId}`
  blocks = new Set<string>(); // `${blockerId}:${blockedId}`
  activeChatViewers = new Map<string, number>(); // `${roomId}:${userId}` -> lastReadTimestampMs
  queue: PushNotificationQueueItem[] = [];

  registerDevice(userId: string, token: string, platform: 'android' | 'ios' | 'web'): string {
    if (!validateFcmToken(token)) {
      throw new Error('INVALID_FCM_TOKEN');
    }
    const id = `dev_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();
    const device: Device = {
      id,
      user_id: userId,
      fcm_token: token,
      platform,
      app_version: '1.0.0',
      device_id: 'test_dev',
      last_seen: now,
      created_at: now,
      updated_at: now,
    };
    this.devices.set(token, device);
    return id;
  }

  unregisterDevice(userId: string, token: string): boolean {
    const existing = this.devices.get(token);
    if (existing && existing.user_id === userId) {
      this.devices.delete(token);
      return true;
    }
    return false;
  }

  cleanupStaleDevices(daysStale: number, referenceDate: Date = new Date()): number {
    let count = 0;
    const thresholdMs = referenceDate.getTime() - daysStale * 24 * 60 * 60 * 1000;
    for (const [token, device] of this.devices.entries()) {
      if (new Date(device.last_seen).getTime() < thresholdMs) {
        this.devices.delete(token);
        count++;
      }
    }
    return count;
  }

  removeInvalidDeviceTokens(tokens: string[]): number {
    let count = 0;
    for (const token of tokens) {
      if (this.devices.delete(token)) {
        count++;
      }
    }
    return count;
  }

  getSettings(userId: string): NotificationSettings {
    let userSettings = this.settings.get(userId);
    if (!userSettings) {
      userSettings = getDefaultNotificationSettings(userId);
      this.settings.set(userId, userSettings);
    }
    return userSettings;
  }

  setChatActive(roomId: string, userId: string, timestampMs: number = Date.now()): void {
    this.activeChatViewers.set(`${roomId}:${userId}`, timestampMs);
  }

  isViewingChat(roomId: string, userId: string, currentTimestampMs: number = Date.now()): boolean {
    const lastRead = this.activeChatViewers.get(`${roomId}:${userId}`);
    if (!lastRead) return false;
    return currentTimestampMs - lastRead < 30 * 1000; // active within 30 seconds
  }

  queueNotification(options: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    roomId?: string;
    currentLocalTime?: string; // HH:mm in user's timezone
    currentTimestampMs?: number;
  }): PushNotificationQueueItem {
    const settings = this.getSettings(options.userId);
    const roomChatMuted = options.roomId
      ? this.chatRoomMutes.has(`${options.roomId}:${options.userId}`)
      : false;
    const isViewing = options.roomId
      ? this.isViewingChat(options.roomId, options.userId, options.currentTimestampMs ?? Date.now())
      : false;

    // Check delivery eligibility
    const decision = shouldDeliverNotification({
      settings,
      type: options.type,
      roomChatMuted,
      isViewingChat: isViewing,
      currentTimeLocal: options.currentLocalTime,
    });

    // Check devices count
    const hasDevices = Array.from(this.devices.values()).some((d) => d.user_id === options.userId);

    let status: PushNotificationQueueItem['status'] = 'pending';
    let skipReason: string | undefined = undefined;

    if (!decision.deliver) {
      status = 'skipped';
      skipReason = decision.reason;
    } else if (!hasDevices) {
      status = 'skipped';
      skipReason = 'no_devices';
    }

    // Sanitize payload
    const rawPayload: PushPayload = {
      title: options.title,
      body: options.body,
      data: {
        type: options.type,
        ...(options.data || {}),
      },
    };
    const sanitized = sanitizePushPayload(rawPayload, settings.hide_previews);

    const item: PushNotificationQueueItem = {
      id: `queue_${this.queue.length + 1}`,
      user_id: options.userId,
      notification_type: options.type,
      title: sanitized.title,
      body: sanitized.body,
      data: sanitized.data,
      status,
      skip_reason: skipReason,
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    this.queue.push(item);
    return item;
  }

  // Simulates chat insert trigger
  onChatMessageSent(senderId: string, roomId: string, text: string): void {
    const members = Array.from(this.roomMembers.values()).filter(
      (m) => m.room_id === roomId && m.user_id !== senderId,
    );

    for (const member of members) {
      // 1. Removed/left/locked check: only active and paused members get notified
      if (member.status !== 'active' && member.status !== 'paused') {
        continue;
      }
      // 2. Block check
      if (this.blocks.has(`${member.user_id}:${senderId}`)) {
        continue;
      }
      // 3. Member mute check
      if (this.memberMutes.has(`${member.user_id}:${senderId}`)) {
        continue;
      }

      this.queueNotification({
        userId: member.user_id,
        type: 'chat_message',
        title: 'Room Chat',
        body: text,
        roomId,
        data: {
          roomId,
          roomName: 'Beast Mode Room',
        },
      });
    }
  }

  // Simulates workout trigger
  onWorkoutCompleted(userId: string, workoutTitle: string, privacyShareWorkouts: boolean): void {
    if (!privacyShareWorkouts) {
      return; // Workout sharing is disabled; no notification sent
    }

    // Find all partners in common rooms
    const userRooms = Array.from(this.roomMembers.values())
      .filter((m) => m.user_id === userId && (m.status === 'active' || m.status === 'paused'))
      .map((m) => m.room_id);

    const notifiedUsers = new Set<string>();

    for (const roomId of userRooms) {
      const roomMembers = Array.from(this.roomMembers.values()).filter(
        (m) => m.room_id === roomId && m.user_id !== userId,
      );

      for (const partner of roomMembers) {
        if (partner.status !== 'active' && partner.status !== 'paused') {
          continue; // No notification to removed/left/locked members
        }
        if (this.memberMutes.has(`${partner.user_id}:${userId}`)) {
          continue; // Muted member
        }
        if (notifiedUsers.has(partner.user_id)) {
          continue; // Already notified once
        }
        notifiedUsers.add(partner.user_id);

        this.queueNotification({
          userId: partner.user_id,
          type: 'partner_workout',
          title: 'Partner finished workout!',
          body: `Partner completed: ${workoutTitle}`,
          roomId,
          data: {
            roomId,
          },
        });
      }
    }
  }
}

describe('Phase 9 Notification Attack & Security Tests', () => {
  it('1. Quiet hours: skips notifications during quiet hours and allows outside', () => {
    const db = new InMemoryPhase9NotificationDb();
    const token = 'fcm_valid_user1_token_1234567890abcdef123456';
    db.registerDevice('user1', token, 'android');

    const settings = db.getSettings('user1');
    settings.quiet_hours_enabled = true;
    settings.quiet_hours_start = '22:00';
    settings.quiet_hours_end = '07:00';

    // During quiet hours (23:30 local) -> skipped
    const item1 = db.queueNotification({
      userId: 'user1',
      type: 'nudge',
      title: 'Nudge',
      body: 'Time to log!',
      currentLocalTime: '23:30',
    });
    expect(item1.status).toBe('skipped');
    expect(item1.skip_reason).toBe('quiet_hours');

    // Outside quiet hours (14:30 local) -> pending
    const item2 = db.queueNotification({
      userId: 'user1',
      type: 'nudge',
      title: 'Nudge',
      body: 'Time to log!',
      currentLocalTime: '14:30',
    });
    expect(item2.status).toBe('pending');
    expect(item2.skip_reason).toBeUndefined();
  });

  it('2. Mute: pause_all, type toggle, per-room mute, and member mutes', () => {
    const db = new InMemoryPhase9NotificationDb();
    const token = 'fcm_valid_user2_token_1234567890abcdef123456';
    db.registerDevice('user2', token, 'ios');

    // A. Pause all
    const settings = db.getSettings('user2');
    settings.pause_all = true;

    const item1 = db.queueNotification({
      userId: 'user2',
      type: 'streak_at_risk',
      title: 'Streak at risk',
      body: 'Log today!',
    });
    expect(item1.status).toBe('skipped');
    expect(item1.skip_reason).toBe('pause_all');

    // B. Type toggle
    settings.pause_all = false;
    settings.nudge_enabled = false;

    const item2 = db.queueNotification({
      userId: 'user2',
      type: 'nudge',
      title: 'Nudge',
      body: 'Time for lunch!',
    });
    expect(item2.status).toBe('skipped');
    expect(item2.skip_reason).toBe('type_disabled');

    // C. Per-room chat mute
    settings.nudge_enabled = true;
    db.chatRoomMutes.add('room-abc:user2');

    const item3 = db.queueNotification({
      userId: 'user2',
      type: 'chat_message',
      title: 'New Chat',
      body: 'Hello',
      roomId: 'room-abc',
    });
    expect(item3.status).toBe('skipped');
    expect(item3.skip_reason).toBe('room_chat_muted');

    // Chat in unmuted room succeeds
    const item4 = db.queueNotification({
      userId: 'user2',
      type: 'chat_message',
      title: 'New Chat',
      body: 'Hello',
      roomId: 'room-other',
    });
    expect(item4.status).toBe('pending');
  });

  it('3. Active chat viewing: skips push when recipient is looking at the screen', () => {
    const db = new InMemoryPhase9NotificationDb();
    const token = 'fcm_valid_user3_token_1234567890abcdef123456';
    db.registerDevice('user3', token, 'android');

    const now = Date.now();
    db.setChatActive('room-1', 'user3', now - 5000); // read 5 seconds ago

    const item = db.queueNotification({
      userId: 'user3',
      type: 'chat_message',
      title: 'Room message',
      body: 'New reply',
      roomId: 'room-1',
      currentTimestampMs: now,
    });

    expect(item.status).toBe('skipped');
    expect(item.skip_reason).toBe('currently_viewing_chat');
  });

  it('4. Privacy: never includes calorie numbers and respects hide-previews', () => {
    const db = new InMemoryPhase9NotificationDb();
    const token = 'fcm_valid_user4_token_1234567890abcdef123456';
    db.registerDevice('user4', token, 'android');

    // Partner food push with raw calorie numbers must be sanitized
    const itemCal = db.queueNotification({
      userId: 'user4',
      type: 'partner_food',
      title: 'Partner logged food',
      body: 'Aarav logged chicken biryani: 850 kcal and 50g protein',
      data: {
        calories: 850,
        protein_g: 50,
        roomId: 'room-1',
      },
    });

    expect(itemCal.body).not.toContain('850 kcal');
    expect(itemCal.body).toContain('logged meal');
    expect(itemCal.data.calories).toBeUndefined();
    expect(itemCal.data.protein_g).toBeUndefined();

    // Hide previews for chat
    const settings = db.getSettings('user4');
    settings.hide_previews = true;

    const itemChat = db.queueNotification({
      userId: 'user4',
      type: 'chat_message',
      title: 'Secret Chat',
      body: 'Here is the private message text',
      roomId: 'room-secret',
      data: {
        roomName: 'Alpha Room',
      },
    });

    expect(itemChat.body).toBe('New message received');
    expect(itemChat.body).not.toContain('private message text');
    expect(itemChat.title).toBe('Alpha Room');
  });

  it('5. No push to removed or locked room members', () => {
    const db = new InMemoryPhase9NotificationDb();
    const tokenMember = 'fcm_valid_member_token_1234567890abcdef1234';
    const tokenRemoved = 'fcm_valid_removed_token_1234567890abcdef1234';
    const tokenLeft = 'fcm_valid_left_token_1234567890abcdef1234';

    db.registerDevice('active-member', tokenMember, 'android');
    db.registerDevice('removed-member', tokenRemoved, 'android');
    db.registerDevice('left-member', tokenLeft, 'android');

    const roomId = 'room-alpha';
    db.rooms.set(roomId, {
      id: roomId,
      name: 'Alpha Room',
      code: 'ALPHA1',
      state: 'active',
      who_can_invite: 'any_member',
      member_cap: 5,
      created_by: 'host-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    db.roomMembers.set(`${roomId}:sender`, {
      id: 'm1',
      room_id: roomId,
      user_id: 'sender',
      role: 'member',
      status: 'active',
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

    db.roomMembers.set(`${roomId}:active-member`, {
      id: 'm2',
      room_id: roomId,
      user_id: 'active-member',
      role: 'member',
      status: 'active',
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

    // Member removed
    db.roomMembers.set(`${roomId}:removed-member`, {
      id: 'm3',
      room_id: roomId,
      user_id: 'removed-member',
      role: 'member',
      status: 'left', // removed from room
      privacy_settings: {
        share_streak: false,
        share_goal_completion: false,
        share_steps: false,
        share_water: false,
        share_workouts: false,
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

    // Member left
    db.roomMembers.set(`${roomId}:left-member`, {
      id: 'm4',
      room_id: roomId,
      user_id: 'left-member',
      role: 'member',
      status: 'left',
      privacy_settings: {
        share_streak: false,
        share_goal_completion: false,
        share_steps: false,
        share_water: false,
        share_workouts: false,
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

    // Sender sends a chat message
    db.onChatMessageSent('sender', roomId, 'Hey everyone!');

    const activeNotifications = db.queue.filter((q) => q.user_id === 'active-member');
    const removedNotifications = db.queue.filter((q) => q.user_id === 'removed-member');
    const leftNotifications = db.queue.filter((q) => q.user_id === 'left-member');

    expect(activeNotifications.length).toBe(1);
    expect(activeNotifications[0]?.status).toBe('pending');
    expect(removedNotifications.length).toBe(0); // Zero pushes to locked/removed
    expect(leftNotifications.length).toBe(0); // Zero pushes to members who left
  });

  it('6. Token cleanup: invalid tokens and stale tokens are removed', () => {
    const db = new InMemoryPhase9NotificationDb();
    const token1 = 'fcm_token_active_user_1234567890abcdef12345';
    const token2 = 'fcm_token_invalid_user_1234567890abcdef1234';
    const token3 = 'fcm_token_stale_user_1234567890abcdef123456';

    db.registerDevice('u1', token1, 'android');
    db.registerDevice('u2', token2, 'ios');
    db.registerDevice('u3', token3, 'android');

    // Simulate stale device (last seen 90 days ago)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const staleDevice = db.devices.get(token3);
    if (staleDevice) {
      staleDevice.last_seen = ninetyDaysAgo;
    }

    // A. Unregister token on sign out
    const unregResult = db.unregisterDevice('u1', token1);
    expect(unregResult).toBe(true);
    expect(db.devices.has(token1)).toBe(false);

    // B. Invalid token reported by FCM HTTP v1
    const cleanedCount = db.removeInvalidDeviceTokens([token2]);
    expect(cleanedCount).toBe(1);
    expect(db.devices.has(token2)).toBe(false);

    // C. Stale cleanup cleans up devices > 60 days
    const staleCount = db.cleanupStaleDevices(60);
    expect(staleCount).toBe(1);
    expect(db.devices.has(token3)).toBe(false);
  });
});
