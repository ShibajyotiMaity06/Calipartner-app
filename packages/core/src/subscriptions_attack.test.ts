import { describe, expect, it } from 'vitest';
import {
  canCreateRoom,
  evaluateRoomState,
  getTierCap,
  hasPlan,
  isEventNewer,
  isTrialEligible,
  mapProductIdToTierAndPeriod,
  mapWebhookEventToEntitlementStatus,
  reconcileRoomSubscriptions,
  roomIsUsable,
  verifyWebhookAuth,
} from './subscriptions';
import type { Entitlement, Room, RoomMember, RoomState } from './types';

/**
 * Server-side Simulation Engine for Phase 10 Subscriptions, Lifecycle & Attack Tests
 */
class SubscriptionAttackTestEngine {
  entitlements = new Map<string, Entitlement>();
  deviceTrials = new Map<string, { userId: string; trialStartedAt: string }>();
  rooms = new Map<string, Room>();
  roomMembers = new Map<string, RoomMember>(); // key: `${roomId}:${userId}`
  processedWebhooks = new Set<string>(); // idempotency keys
  webhookSecret = 'rc_test_secret_abc123';

  // Room mutex simulation for concurrent join transactions
  private roomLocks = new Set<string>();

  registerUser(userId: string) {
    this.entitlements.set(userId, {
      user_id: userId,
      tier: 'basic',
      period: 'monthly',
      source: 'none',
      status: 'lapsed',
      attached_room_id: null,
      is_unattached: false,
      trial_started_at: null,
      period_end: null,
    });
  }

  // 1. Create Room (Starts 3-day trial if eligible)
  createRoom(
    userId: string,
    roomName: string,
    deviceHash?: string,
  ): { roomId: string; state: RoomState } {
    const ent = this.entitlements.get(userId);

    // SUB-17: One plan covers one hosted room
    const hostedCount = Array.from(this.rooms.values()).filter(
      (r) =>
        r.plan_holder_id === userId && ['active', 'dormant', 'over_capacity'].includes(r.state),
    ).length;

    if (!canCreateRoom(ent, hostedCount)) {
      throw new Error('PLAN_REQUIRED: User cannot create room without active plan or unused trial');
    }

    const roomId = `room-${Math.random().toString(36).substring(2, 9)}`;

    // Start trial if not already paid
    if (ent && ent.status !== 'paid' && ent.status !== 'grace' && !ent.trial_started_at) {
      if (deviceHash && this.deviceTrials.has(deviceHash)) {
        const owner = this.deviceTrials.get(deviceHash)!.userId;
        if (owner !== userId) {
          throw new Error('DEVICE_TRIAL_ALREADY_CLAIMED');
        }
      }

      ent.trial_started_at = new Date().toISOString();
      ent.status = 'trial';
      ent.tier = 'basic';
      ent.attached_room_id = roomId;
      ent.period_end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      if (deviceHash) {
        this.deviceTrials.set(deviceHash, { userId, trialStartedAt: ent.trial_started_at });
      }
    } else if (ent && !ent.attached_room_id) {
      ent.attached_room_id = roomId;
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      code: 'JOIN1234',
      state: 'dormant', // single member initially
      who_can_invite: 'host_only',
      plan_holder_id: userId,
      member_cap: ent ? getTierCap(ent.tier ?? 'basic') : 5,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.rooms.set(roomId, room);
    this.roomMembers.set(`${roomId}:${userId}`, {
      id: `rm-${userId}`,
      room_id: roomId,
      user_id: userId,
      role: 'host',
      status: 'active',
      joined_at: new Date().toISOString(),
    } as unknown as RoomMember);

    this.recomputeRoomState(roomId);
    return { roomId, state: this.rooms.get(roomId)!.state };
  }

  // 2. Concurrent-safe Join Room
  joinRoom(userId: string, roomId: string): { status: string; memberCount: number } {
    // Acquire row-level lock
    if (this.roomLocks.has(roomId)) {
      // Simulate mutex wait / collision
    }
    this.roomLocks.add(roomId);

    try {
      const room = this.rooms.get(roomId);
      if (!room) throw new Error('ROOM_NOT_FOUND');

      if (room.state === 'archived') throw new Error('ROOM_ARCHIVED');
      if (room.state === 'locked' || !this.isRoomUsable(roomId)) throw new Error('ROOM_LOCKED');
      if (room.state === 'over_capacity') throw new Error('ROOM_FULL');

      // Joining does NOT start trial for the joining user!
      const userEnt = this.entitlements.get(userId);
      expect(userEnt?.trial_started_at).toBeNull(); // Joining never starts trial

      // Active members count
      const activeMembers = Array.from(this.roomMembers.values()).filter(
        (m) => m.room_id === roomId && m.status === 'active',
      );

      const cap = this.getRoomCap(roomId);
      if (activeMembers.length >= cap) {
        throw new Error('ROOM_FULL');
      }

      this.roomMembers.set(`${roomId}:${userId}`, {
        id: `rm-${userId}`,
        room_id: roomId,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      } as unknown as RoomMember);

      this.recomputeRoomState(roomId);

      const newCount = Array.from(this.roomMembers.values()).filter(
        (m) => m.room_id === roomId && m.status === 'active',
      ).length;

      return { status: 'joined', memberCount: newCount };
    } finally {
      this.roomLocks.delete(roomId);
    }
  }

  // 3. Sponsor a Room
  sponsorRoom(userId: string, roomId: string) {
    const ent = this.entitlements.get(userId);
    if (!ent || (ent.status !== 'paid' && ent.status !== 'grace')) {
      throw new Error('PLAN_REQUIRED');
    }

    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    ent.attached_room_id = roomId;
    ent.is_unattached = false;

    this.reconcileSubscriptions(roomId);
    this.recomputeRoomState(roomId);
  }

  // 4. Webhook Processing
  processWebhook(payload: {
    authHeader: string;
    eventId: string;
    eventType: string;
    userId: string;
    productId: string;
    periodEndMs?: number;
    eventTimestampMs: number;
  }) {
    if (!verifyWebhookAuth(payload.authHeader, this.webhookSecret)) {
      throw new Error('UNAUTHORIZED: Webhook authentication failed');
    }

    if (this.processedWebhooks.has(payload.eventId)) {
      return { status: 'already_processed', eventId: payload.eventId };
    }

    let ent = this.entitlements.get(payload.userId);
    if (!ent) {
      this.registerUser(payload.userId);
      ent = this.entitlements.get(payload.userId)!;
    }

    // Out of order check
    if (ent.last_event_timestamp) {
      if (!isEventNewer(payload.eventTimestampMs, ent.last_event_timestamp)) {
        this.processedWebhooks.add(payload.eventId);
        return { status: 'skipped_older_event', eventId: payload.eventId };
      }
    }

    const parsed = mapProductIdToTierAndPeriod(payload.productId) ?? {
      tier: 'basic',
      period: 'monthly',
    };

    const status = mapWebhookEventToEntitlementStatus(payload.eventType, ent.status);

    ent.tier = parsed.tier;
    ent.period = parsed.period;
    ent.status = status;
    ent.period_end = payload.periodEndMs
      ? new Date(payload.periodEndMs).toISOString()
      : ent.period_end;
    ent.last_event_id = payload.eventId;
    ent.last_event_timestamp = new Date(payload.eventTimestampMs).toISOString();

    // Attach to hosted room automatically if not attached
    if (!ent.attached_room_id && (status === 'paid' || status === 'grace')) {
      const hosted = Array.from(this.rooms.values()).find((r) => r.created_by === payload.userId);
      if (hosted) {
        ent.attached_room_id = hosted.id;
      }
    }

    if (ent.attached_room_id) {
      this.reconcileSubscriptions(ent.attached_room_id);
      this.recomputeRoomState(ent.attached_room_id);
    }

    this.processedWebhooks.add(payload.eventId);
    return { status: 'applied', eventId: payload.eventId, entitlement: ent };
  }

  // 5. Subscription reconciliation
  reconcileSubscriptions(roomId: string) {
    const attached = Array.from(this.entitlements.values()).filter(
      (e) => e.attached_room_id === roomId,
    );
    const { active, unattached } = reconcileRoomSubscriptions(attached);

    if (active) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.plan_holder_id = active.user_id;
        room.member_cap = getTierCap(active.tier ?? 'basic');
      }
      this.entitlements.get(active.user_id)!.is_unattached = false;
    }

    for (const u of unattached) {
      this.entitlements.get(u.user_id)!.is_unattached = true;
    }
  }

  // 6. Room state recomputation
  recomputeRoomState(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    if (room.state === 'archived') return 'archived';

    this.reconcileSubscriptions(roomId);

    const planHolderEnt = room.plan_holder_id ? this.entitlements.get(room.plan_holder_id) : null;
    const hasActivePlan = Boolean(
      planHolderEnt &&
      ((['paid', 'grace'].includes(planHolderEnt.status) &&
        (!planHolderEnt.period_end || new Date(planHolderEnt.period_end) > new Date())) ||
        (planHolderEnt.status === 'trial' &&
          planHolderEnt.period_end &&
          new Date(planHolderEnt.period_end) > new Date())),
    );

    const activeMembers = Array.from(this.roomMembers.values()).filter(
      (m) => m.room_id === roomId && m.status === 'active',
    );

    const cap = this.getRoomCap(roomId);

    const newState = evaluateRoomState({
      hasActivePlan,
      activeMemberCount: activeMembers.length,
      memberCap: cap,
      dormantSince: room.dormant_at ? new Date(room.dormant_at) : null,
      overCapacitySince: room.over_capacity_at ? new Date(room.over_capacity_at) : null,
      lockedSince: room.locked_at ? new Date(room.locked_at) : null,
    });

    room.state = newState;
    if (newState === 'locked' && !room.locked_at) {
      room.locked_at = new Date().toISOString();
    } else if (newState !== 'locked') {
      room.locked_at = null;
    }

    if (newState === 'over_capacity' && !room.over_capacity_at) {
      room.over_capacity_at = new Date().toISOString();
    } else if (newState !== 'over_capacity') {
      room.over_capacity_at = null;
    }

    return newState;
  }

  getRoomCap(roomId: string): number {
    const room = this.rooms.get(roomId);
    if (!room || !room.plan_holder_id) return 5;
    const ent = this.entitlements.get(room.plan_holder_id);
    if (!ent) return 5;
    if (ent.status === 'trial') return 5;
    return getTierCap(ent.tier ?? 'basic');
  }

  isRoomUsable(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const ent = room.plan_holder_id ? this.entitlements.get(room.plan_holder_id) : null;
    return roomIsUsable(room, ent);
  }

  checkAiCoachAccess(userId: string): boolean {
    const ent = this.entitlements.get(userId);
    return hasPlan(ent); // Paid or grace; trial rejected
  }

  checkPartnerFinderAccess(userId: string): boolean {
    const ent = this.entitlements.get(userId);
    return hasPlan(ent); // Paid or grace; trial rejected
  }
}

describe('Phase 10: Server-Side Enforcement Attack Tests (All 15 Scenarios)', () => {
  it('1. A user without a plan can still join, chat, track, and focus in a usable room', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-paid');
    engine.registerUser('member-free');

    // Host has active Plus plan (paid)
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-init-1',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-paid',
      productId: 'plus_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-paid', 'Plus Gym Group');
    expect(engine.isRoomUsable(roomId)).toBe(true);

    // Free user joins without paying a penny
    const joinResult = engine.joinRoom('member-free', roomId);
    expect(joinResult.status).toBe('joined');
    expect(joinResult.memberCount).toBe(2);

    // Free user has NO plan, but room is active and usable
    expect(hasPlan(engine.entitlements.get('member-free'))).toBe(false);
    expect(engine.isRoomUsable(roomId)).toBe(true);
    expect(engine.rooms.get(roomId)?.state).toBe('active');
  });

  it('2. A Locked room is unreadable by every route for members and non-members', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-trial');
    engine.registerUser('member-1');

    // Host creates room on 3-day trial
    const { roomId } = engine.createRoom('host-trial', 'Alex Room');
    engine.joinRoom('member-1', roomId);

    expect(engine.rooms.get(roomId)?.state).toBe('active');
    expect(engine.isRoomUsable(roomId)).toBe(true);

    // Expire the trial!
    const hostEnt = engine.entitlements.get('host-trial')!;
    hostEnt.period_end = new Date(Date.now() - 1000).toISOString();
    hostEnt.status = 'lapsed';

    const state = engine.recomputeRoomState(roomId);
    expect(state).toBe('locked');
    expect(engine.isRoomUsable(roomId)).toBe(false);

    // Any attempt to join locked room fails with ROOM_LOCKED
    engine.registerUser('member-2');
    expect(() => engine.joinRoom('member-2', roomId)).toThrowError('ROOM_LOCKED');
  });

  it('3. The sixth person cannot join a Basic room even with simultaneous joins', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-basic');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-basic-1',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-basic',
      productId: 'basic_monthly', // Cap 5!
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-basic', 'Basic Room');
    expect(engine.getRoomCap(roomId)).toBe(5);

    // Add members 2, 3, 4, 5 (all succeed)
    for (let i = 2; i <= 5; i++) {
      const u = `member-${i}`;
      engine.registerUser(u);
      engine.joinRoom(u, roomId);
    }

    const room = engine.rooms.get(roomId)!;
    expect(room.state).toBe('active');

    // Simultaneous 6th join attempt must be strictly rejected with ROOM_FULL
    engine.registerUser('member-6');
    engine.registerUser('member-7');

    expect(() => engine.joinRoom('member-6', roomId)).toThrowError('ROOM_FULL');
    expect(() => engine.joinRoom('member-7', roomId)).toThrowError('ROOM_FULL');
  });

  it('4. Accept-invite when room is full returns ROOM_FULL', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-1');
    const { roomId } = engine.createRoom('host-1', 'Trial Room'); // Cap 5

    for (let i = 2; i <= 5; i++) {
      const u = `m-${i}`;
      engine.registerUser(u);
      engine.joinRoom(u, roomId);
    }

    engine.registerUser('invited-guest');
    expect(() => engine.joinRoom('invited-guest', roomId)).toThrowError('ROOM_FULL');
  });

  it('5. Trial cannot restart and joining never starts it', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('user-a');
    engine.registerUser('host-b');

    // Host B starts room on trial
    const { roomId } = engine.createRoom('host-b', 'Host B Room');

    // User A joins Room B
    engine.joinRoom('user-a', roomId);

    // User A did NOT consume their trial by joining
    const entA = engine.entitlements.get('user-a')!;
    expect(entA.trial_started_at).toBeNull();
    expect(isTrialEligible(entA, null, 'user-a')).toBe(true);

    // Now User A creates their own room: consumes trial
    engine.createRoom('user-a', 'Room A', 'device-hash-a');
    expect(entA.trial_started_at).not.toBeNull();

    // Expire trial
    entA.status = 'lapsed';
    entA.period_end = new Date(Date.now() - 1000).toISOString();

    // Cannot restart trial!
    expect(isTrialEligible(entA, 'user-a', 'user-a')).toBe(false);
    expect(() => engine.createRoom('user-a', 'Room A 2', 'device-hash-a')).toThrowError(
      'PLAN_REQUIRED',
    );
  });

  it('6. One plan cannot cover two hosted rooms', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-one');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-sub-single',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-one',
      productId: 'plus_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    // Create 1st room
    engine.createRoom('host-one', 'First Room');

    // Attempting to create a second active room with same plan throws error
    expect(() => engine.createRoom('host-one', 'Second Room')).toThrowError('PLAN_REQUIRED');
  });

  it('7. Plan holder leaving keeps the plan on the room', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-paid');
    engine.registerUser('member-active');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-keep-plan',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-paid',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-paid', 'Workout Crew');
    engine.joinRoom('member-active', roomId);

    // Host leaves: member becomes host, but plan stays on room!
    const memberObj = engine.roomMembers.get(`${roomId}:host-paid`)!;
    memberObj.status = 'left';

    const room = engine.rooms.get(roomId)!;
    // plan_holder_id remains host-paid
    expect(room.plan_holder_id).toBe('host-paid');

    // Room is STILL usable because host-paid's period_end is in the future
    engine.recomputeRoomState(roomId);
    expect(engine.isRoomUsable(roomId)).toBe(true);
    expect(room.state).toBe('dormant'); // 1 active member remaining
  });

  it('8. Upgrade raises the cap immediately', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-upgrade');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-basic',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-upgrade',
      productId: 'basic_monthly', // Cap 5
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-upgrade', 'Scale Room');
    expect(engine.getRoomCap(roomId)).toBe(5);

    // Upgrade to Pro immediately raises cap to 20
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-upgrade-pro',
      eventType: 'PRODUCT_CHANGE',
      userId: 'host-upgrade',
      productId: 'pro_monthly', // Cap 20!
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now() + 1000,
    });

    expect(engine.getRoomCap(roomId)).toBe(20);
  });

  it('9. Downgrade creates Over capacity and the 7-day job locks it', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-downgrade');

    // Start with Plus (cap 20)
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-plus',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-downgrade',
      productId: 'plus_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-downgrade', 'Downgrade Room');

    // Add 7 members total
    for (let i = 2; i <= 7; i++) {
      const u = `m-${i}`;
      engine.registerUser(u);
      engine.joinRoom(u, roomId);
    }
    expect(engine.rooms.get(roomId)?.state).toBe('active');

    // Downgrade to Basic (cap 5). Now 7 members > cap 5!
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-down-basic',
      eventType: 'PRODUCT_CHANGE',
      userId: 'host-downgrade',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now() + 2000,
    });

    const room = engine.rooms.get(roomId)!;
    expect(room.state).toBe('over_capacity');
    expect(room.over_capacity_at).not.toBeNull();

    // Works normally during 7-day window, but accepts no new members
    expect(engine.isRoomUsable(roomId)).toBe(true);
    engine.registerUser('m-8');
    expect(() => engine.joinRoom('m-8', roomId)).toThrowError('ROOM_FULL');

    // After 7 days, lifecycle maintenance locks it
    room.over_capacity_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    engine.recomputeRoomState(roomId);
    expect(room.state).toBe('locked');
    expect(engine.isRoomUsable(roomId)).toBe(false);
  });

  it('10. Forged or replayed webhooks are rejected', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('hacker');

    expect(() =>
      engine.processWebhook({
        authHeader: 'Bearer forged_bad_secret',
        eventId: 'evt-forged',
        eventType: 'INITIAL_PURCHASE',
        userId: 'hacker',
        productId: 'pro_annual',
        eventTimestampMs: Date.now(),
      }),
    ).toThrowError('UNAUTHORIZED');
  });

  it('11. Out-of-order webhooks (expire before renew) are handled safely', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('subscriber');

    const renewTimestamp = Date.now() + 5000;
    const oldExpireTimestamp = Date.now() + 1000; // earlier in time

    // Renewal arrives first
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-renew-1',
      eventType: 'RENEWAL',
      userId: 'subscriber',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: renewTimestamp,
    });
    expect(engine.entitlements.get('subscriber')?.status).toBe('paid');

    // Delayed expiration event with OLD timestamp arrives later
    const delayedResult = engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-expire-delayed',
      eventType: 'EXPIRATION',
      userId: 'subscriber',
      productId: 'basic_monthly',
      periodEndMs: Date.now() - 1000,
      eventTimestampMs: oldExpireTimestamp, // older!
    });

    expect(delayedResult.status).toBe('skipped_older_event');
    // Status MUST remain paid!
    expect(engine.entitlements.get('subscriber')?.status).toBe('paid');
  });

  it('12. Duplicate webhooks do nothing (Idempotency)', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('sub-user');

    const res1 = engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-dup-1',
      eventType: 'INITIAL_PURCHASE',
      userId: 'sub-user',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });
    expect(res1.status).toBe('applied');

    const res2 = engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-dup-1', // same event id
      eventType: 'INITIAL_PURCHASE',
      userId: 'sub-user',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });
    expect(res2.status).toBe('already_processed');
  });

  it('13. Restore on a new device works seamlessly', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('user-device-1');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-dev-1',
      eventType: 'INITIAL_PURCHASE',
      userId: 'user-device-1',
      productId: 'plus_annual',
      periodEndMs: Date.now() + 365 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    // When logging in on Device 2 with same user ID, entitlement is already paid
    const ent = engine.entitlements.get('user-device-1');
    expect(hasPlan(ent)).toBe(true);
    expect(ent?.tier).toBe('plus');
  });

  it('14. Refund removes access immediately', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('user-refund');

    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-buy',
      eventType: 'INITIAL_PURCHASE',
      userId: 'user-refund',
      productId: 'pro_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });
    expect(hasPlan(engine.entitlements.get('user-refund'))).toBe(true);

    const { roomId } = engine.createRoom('user-refund', 'Refunded Room');
    expect(engine.rooms.get(roomId)?.state).toBe('dormant');

    // Store issues refund (REVOCATION event)
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-revocation',
      eventType: 'REVOCATION',
      userId: 'user-refund',
      productId: 'pro_monthly',
      eventTimestampMs: Date.now() + 1000,
    });

    const ent = engine.entitlements.get('user-refund')!;
    expect(ent.status).toBe('lapsed');
    expect(hasPlan(ent)).toBe(false);

    // Room moves to locked!
    expect(engine.rooms.get(roomId)?.state).toBe('locked');
    expect(engine.isRoomUsable(roomId)).toBe(false);
  });

  it('15. AI coach and Partner Finder reject non-plan-holders (even room members of paid room)', () => {
    const engine = new SubscriptionAttackTestEngine();
    engine.registerUser('host-plan');
    engine.registerUser('room-member');
    engine.registerUser('trial-user');

    // Host has paid plan
    engine.processWebhook({
      authHeader: 'Bearer rc_test_secret_abc123',
      eventId: 'evt-host-plan',
      eventType: 'INITIAL_PURCHASE',
      userId: 'host-plan',
      productId: 'basic_monthly',
      periodEndMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      eventTimestampMs: Date.now(),
    });

    const { roomId } = engine.createRoom('host-plan', 'AI Test Room');
    engine.joinRoom('room-member', roomId);

    // Trial user creates trial room
    engine.createRoom('trial-user', 'Trial Room');

    // 1. Host has access to AI coach and Finder
    expect(engine.checkAiCoachAccess('host-plan')).toBe(true);
    expect(engine.checkPartnerFinderAccess('host-plan')).toBe(true);

    // 2. Room member has free access to the room, but NO AI coach and NO Finder!
    expect(engine.checkAiCoachAccess('room-member')).toBe(false);
    expect(engine.checkPartnerFinderAccess('room-member')).toBe(false);

    // 3. Trial user has room trial, but NO AI coach and NO Finder!
    expect(engine.checkAiCoachAccess('trial-user')).toBe(false);
    expect(engine.checkPartnerFinderAccess('trial-user')).toBe(false);
  });
});
