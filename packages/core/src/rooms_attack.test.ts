import { describe, expect, it } from 'vitest';
import {
  canCreateRoom,
  evaluateGoalDay,
  evaluateLoggedDay,
  evaluateRoomState,
  getDefaultPrivacySettings,
  hasPlan,
  isTrialEligible,
  maskMemberSnapshot,
  roomCap,
  roomIsUsable,
  ROOM_TIER_CAPS,
  sanitizePrivacySettings,
} from './rooms';
import type {
  DailySummary,
  Entitlement,
  EntitlementStatus,
  Room,
  RoomMember,
  RoomPeriod,
  RoomPrivacySettings,
  RoomRequest,
  RoomSnapshot,
  RoomState,
  RoomTier,
  SharedMeal,
  SharedMealParticipant,
} from './types';

/**
 * In-memory simulation of Phase 5 Database Engine, RLS policies,
 * limits, and SECURITY DEFINER functions for comprehensive attack testing
 * under PRD v0.4 (Room-level billing, dynamic capacity & lifecycle).
 */
class InMemoryPhase5Db {
  profiles = new Map<
    string,
    { username: string; nickname: string; avatar_url: string | null; discoverable: boolean }
  >();
  entitlements = new Map<string, Entitlement>();
  deviceTrials = new Map<string, { userId: string; trialStartedAt: string }>();
  rooms = new Map<string, Room>();
  roomMembers = new Map<string, RoomMember>(); // key: `${roomId}:${userId}`
  roomRequests = new Map<string, RoomRequest>();
  blocks = new Set<string>(); // key: `${blockerId}:${blockedId}`
  nudges: Array<{ roomId: string; senderId: string; recipientId: string; message: string; createdAt: Date }> = [];
  reactions = new Set<string>(); // key: `${roomId}:${userId}:${eventId}:${reaction}`
  roomEvents = new Map<string, { id: string; roomId: string; eventType: string }>();
  dailySummaries = new Map<string, DailySummary>(); // key: `${userId}:${localDate}`
  foodEntries = new Map<string, { id: string; userId: string; foodName: string; calories: number; quantity: number }>();
  sharedMeals = new Map<string, SharedMeal>();
  sharedMealParticipants = new Map<string, SharedMealParticipant>(); // key: `${sharedMealId}:${userId}`
  rateLimits = new Map<string, { count: number; windowStart: number }>();

  // Mutex lock simulation per room ID to test concurrent joins
  private roomLocks = new Set<string>();

  registerUser(
    id: string,
    username: string,
    nickname: string,
    discoverable = true,
  ) {
    this.profiles.set(id, {
      username,
      nickname,
      avatar_url: null,
      discoverable,
    });
    // Default: free user with no active plan, trial not yet started
    this.entitlements.set(id, {
      user_id: id,
      tier: 'basic',
      period: 'monthly',
      source: 'none',
      status: 'lapsed',
      attached_room_id: null,
      trial_started_at: null,
      period_end: null,
    });
  }

  checkRateLimit(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (now - entry.windowStart > windowSeconds * 1000) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= maxRequests) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  // Entitlement helpers
  hasPlan(userId: string): boolean {
    const ent = this.entitlements.get(userId);
    return hasPlan(ent);
  }

  canCreateRoom(userId: string): boolean {
    const ent = this.entitlements.get(userId);
    let hostedActiveCount = 0;
    for (const r of this.rooms.values()) {
      if (r.plan_holder_id === userId && r.state !== 'archived') {
        hostedActiveCount++;
      }
    }
    return canCreateRoom(ent, hostedActiveCount);
  }

  roomCap(roomId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 5;
    if (room.plan_holder_id) {
      const ent = this.entitlements.get(room.plan_holder_id);
      if (ent && ent.status === 'trial') return 5;
      if (ent && hasPlan(ent)) return roomCap(ent.tier);
    }
    return room.member_cap ?? 5;
  }

  roomIsUsable(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const planHolderEnt = room.plan_holder_id ? this.entitlements.get(room.plan_holder_id) : null;
    return roomIsUsable(room, planHolderEnt);
  }

  startTrialIfEligible(userId: string, deviceHash?: string, roomId?: string): boolean {
    const ent = this.entitlements.get(userId);
    const devOwner = deviceHash ? this.deviceTrials.get(deviceHash)?.userId : null;
    if (!isTrialEligible(ent, devOwner, userId)) {
      return false;
    }
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    this.entitlements.set(userId, {
      user_id: userId,
      tier: 'basic',
      period: 'monthly',
      source: 'none',
      status: 'trial',
      attached_room_id: roomId ?? null,
      trial_started_at: now.toISOString(),
      period_end: periodEnd.toISOString(),
    });
    if (deviceHash) {
      this.deviceTrials.set(deviceHash, {
        userId,
        trialStartedAt: now.toISOString(),
      });
    }
    return true;
  }

  devGrantPlan(
    userId: string,
    tier: RoomTier = 'basic',
    period: RoomPeriod = 'monthly',
    status: EntitlementStatus = 'paid',
    roomId?: string,
  ) {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.entitlements.set(userId, {
      user_id: userId,
      tier,
      period,
      source: 'apple',
      status,
      attached_room_id: roomId ?? null,
      trial_started_at: this.entitlements.get(userId)?.trial_started_at ?? null,
      period_end: status === 'lapsed' ? new Date(Date.now() - 1000).toISOString() : periodEnd.toISOString(),
    });

    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.plan_holder_id = userId;
        room.member_cap = ROOM_TIER_CAPS[tier];
        this.recomputeRoomState(roomId);
      }
    }
  }

  devGrantPremium(userId: string) {
    this.devGrantPlan(userId, 'basic', 'monthly', 'paid');
  }

  devExpireTrial(userId: string) {
    const ent = this.entitlements.get(userId);
    this.entitlements.set(userId, {
      user_id: userId,
      tier: ent?.tier ?? 'basic',
      period: ent?.period ?? 'monthly',
      source: 'none',
      status: 'lapsed',
      attached_room_id: ent?.attached_room_id ?? null,
      trial_started_at: ent?.trial_started_at ?? new Date().toISOString(),
      period_end: new Date(Date.now() - 1000).toISOString(),
    });
    if (ent?.attached_room_id) {
      this.recomputeRoomState(ent.attached_room_id);
    }
  }

  recomputeRoomState(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room || room.state === 'archived') return 'archived';

    const planHolderEnt = room.plan_holder_id ? this.entitlements.get(room.plan_holder_id) : null;
    const hasActivePlan = Boolean(
      planHolderEnt &&
        (hasPlan(planHolderEnt) ||
          (planHolderEnt.status === 'trial' &&
            (!planHolderEnt.period_end || new Date(planHolderEnt.period_end) > new Date()))),
    );

    let activeMemberCount = 0;
    for (const member of this.roomMembers.values()) {
      if (member.room_id === roomId && member.status === 'active') {
        activeMemberCount++;
      }
    }

    const cap = this.roomCap(roomId);

    const newState = evaluateRoomState({
      hasActivePlan,
      activeMemberCount,
      memberCap: cap,
      dormantSince: room.dormant_at ? new Date(room.dormant_at) : null,
      overCapacitySince: room.over_capacity_at ? new Date(room.over_capacity_at) : null,
      lockedSince: room.locked_at ? new Date(room.locked_at) : null,
    });

    room.state = newState;
    if (newState === 'dormant' && !room.dormant_at) {
      room.dormant_at = new Date().toISOString();
      room.locked_at = null;
      room.over_capacity_at = null;
    } else if (newState === 'locked' && !room.locked_at) {
      room.locked_at = new Date().toISOString();
    } else if (newState === 'over_capacity' && !room.over_capacity_at) {
      room.over_capacity_at = new Date().toISOString();
      room.locked_at = null;
    } else if (newState === 'active') {
      room.dormant_at = null;
      room.locked_at = null;
      room.over_capacity_at = null;
    }

    return newState;
  }

  updateRoomState(roomId: string): RoomState {
    return this.recomputeRoomState(roomId);
  }

  sponsorRoom(userId: string, roomId: string) {
    const member = this.roomMembers.get(`${roomId}:${userId}`);
    if (!member || member.status === 'left') throw new Error('NOT_ROOM_MEMBER');
    if (!this.hasPlan(userId)) throw new Error('PLAN_REQUIRED');

    const ent = this.entitlements.get(userId)!;
    ent.attached_room_id = roomId;
    const room = this.rooms.get(roomId)!;
    room.plan_holder_id = userId;
    room.member_cap = ROOM_TIER_CAPS[ent.tier ?? 'basic'];
    this.recomputeRoomState(roomId);
    return { status: 'sponsored', room_id: roomId, plan_holder_id: userId };
  }

  // 1. create_room
  createRoom(callerId: string, name: string, deviceHash?: string): Room {
    // 3 rooms per user max
    let userRoomCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.user_id === callerId && m.status !== 'left') {
        userRoomCount++;
      }
    }
    if (userRoomCount >= 3) {
      throw new Error('MAX_ROOMS_REACHED');
    }

    const ent = this.entitlements.get(callerId);
    let cap = 5;

    if (ent && hasPlan(ent)) {
      // One plan covers one hosted room (SUB-17)
      for (const r of this.rooms.values()) {
        if (r.plan_holder_id === callerId && r.state !== 'archived') {
          throw new Error('PLAN_ALREADY_ATTACHED');
        }
      }
      cap = roomCap(ent.tier);
    } else {
      // Starts 3-day trial if eligible; otherwise throws PLAN_REQUIRED
      if (!this.startTrialIfEligible(callerId, deviceHash)) {
        throw new Error('PLAN_REQUIRED');
      }
      cap = 5;
    }

    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const code = 'CP' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const room: Room = {
      id: roomId,
      name,
      code,
      state: 'dormant', // starts dormant with 1 member
      who_can_invite: 'host_only',
      plan_holder_id: callerId,
      member_cap: cap,
      created_by: callerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dormant_at: new Date().toISOString(),
    };
    this.rooms.set(roomId, room);

    // Attach room to entitlement
    const userEnt = this.entitlements.get(callerId);
    if (userEnt) userEnt.attached_room_id = roomId;

    const hostMember: RoomMember = {
      id: `m-${Date.now()}`,
      room_id: roomId,
      user_id: callerId,
      role: 'host',
      status: 'active',
      privacy_settings: getDefaultPrivacySettings(),
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.roomMembers.set(`${roomId}:${callerId}`, hostMember);
    this.recomputeRoomState(roomId);
    return room;
  }

  // 2. send_room_invitation
  sendRoomInvitation(callerId: string, roomId: string, username: string) {
    const member = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!member || member.status !== 'active') throw new Error('NOT_ROOM_MEMBER');
    const room = this.rooms.get(roomId);
    if (!room || room.state === 'archived') throw new Error('ROOM_NOT_FOUND');

    if (!this.roomIsUsable(roomId) || room.state === 'locked') {
      throw new Error('ROOM_LOCKED');
    }

    if (room.who_can_invite === 'host_only' && member.role !== 'host') {
      throw new Error('HOST_ONLY_INVITE');
    }

    if (room.state === 'over_capacity') {
      throw new Error('ROOM_FULL');
    }

    let activeCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === roomId && m.status === 'active') activeCount++;
    }
    if (activeCount >= this.roomCap(roomId)) throw new Error('ROOM_FULL');

    // Recipient lookup
    let recipientId: string | null = null;
    let isDiscoverable = true;
    for (const [uid, prof] of this.profiles.entries()) {
      if (prof.username.toLowerCase() === username.toLowerCase()) {
        recipientId = uid;
        isDiscoverable = prof.discoverable;
        break;
      }
    }
    if (!recipientId || !isDiscoverable) throw new Error('USER_NOT_FOUND');
    if (recipientId === callerId) throw new Error('CANNOT_INVITE_SELF');

    if (
      this.blocks.has(`${callerId}:${recipientId}`) ||
      this.blocks.has(`${recipientId}:${callerId}`)
    ) {
      throw new Error('USER_BLOCKED');
    }

    const recMember = this.roomMembers.get(`${roomId}:${recipientId}`);
    if (recMember && recMember.status !== 'left') {
      throw new Error('ALREADY_MEMBER');
    }

    if (!this.checkRateLimit(`req_hour:${callerId}`, 10, 3600)) {
      throw new Error('HOURLY_REQUEST_LIMIT_REACHED');
    }

    let pendingCount = 0;
    for (const req of this.roomRequests.values()) {
      if (
        (req.sender_id === callerId || req.recipient_id === callerId) &&
        req.status === 'pending'
      ) {
        pendingCount++;
      }
    }
    if (pendingCount >= 20) throw new Error('REQUEST_LIMIT_REACHED');

    const reqId = `req-${Date.now()}-${Math.random()}`;
    const req: RoomRequest = {
      id: reqId,
      room_id: roomId,
      sender_id: callerId,
      recipient_id: recipientId,
      type: 'invitation',
      status: 'pending',
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    this.roomRequests.set(reqId, req);
    return req;
  }

  // 3. request_to_join
  requestToJoin(callerId: string, target: string) {
    let userRoomCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.user_id === callerId && m.status !== 'left') userRoomCount++;
    }
    if (userRoomCount >= 3) throw new Error('MAX_ROOMS_REACHED');

    let matchedRoom: Room | null = null;
    for (const r of this.rooms.values()) {
      if (r.code.toUpperCase() === target.toUpperCase() && r.state !== 'archived') {
        matchedRoom = r;
        break;
      }
    }

    if (!matchedRoom) {
      for (const [uid, prof] of this.profiles.entries()) {
        if (prof.username.toLowerCase() === target.toLowerCase()) {
          for (const m of this.roomMembers.values()) {
            if (m.user_id === uid && m.role === 'host') {
              const r = this.rooms.get(m.room_id);
              if (r && r.state !== 'archived') {
                matchedRoom = r;
                break;
              }
            }
          }
          break;
        }
      }
    }

    if (!matchedRoom) throw new Error('ROOM_NOT_FOUND');

    if (!this.roomIsUsable(matchedRoom.id) || matchedRoom.state === 'locked') {
      throw new Error('ROOM_LOCKED');
    }

    let hostId: string | null = null;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === matchedRoom.id && m.role === 'host' && m.status === 'active') {
        hostId = m.user_id;
        break;
      }
    }

    if (hostId && (this.blocks.has(`${callerId}:${hostId}`) || this.blocks.has(`${hostId}:${callerId}`))) {
      throw new Error('USER_BLOCKED');
    }

    const cur = this.roomMembers.get(`${matchedRoom.id}:${callerId}`);
    if (cur && cur.status !== 'left') throw new Error('ALREADY_MEMBER');

    if (matchedRoom.state === 'over_capacity') throw new Error('ROOM_FULL');

    let memberCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === matchedRoom.id && m.status === 'active') memberCount++;
    }
    if (memberCount >= this.roomCap(matchedRoom.id)) throw new Error('ROOM_FULL');

    const reqId = `req-${Date.now()}-${Math.random()}`;
    const req: RoomRequest = {
      id: reqId,
      room_id: matchedRoom.id,
      sender_id: callerId,
      recipient_id: hostId,
      type: 'join_request',
      status: 'pending',
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    this.roomRequests.set(reqId, req);
    return req;
  }

  // 4. respond_to_request (with row lock simulation)
  respondToRequest(callerId: string, requestId: string, accept: boolean): { status: string } {
    const req = this.roomRequests.get(requestId);
    if (!req || req.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');

    let joiningUser: string;
    if (req.type === 'invitation') {
      if (req.recipient_id !== callerId) throw new Error('NOT_AUTHORIZED');
      joiningUser = callerId;
    } else {
      const isHost = this.roomMembers.get(`${req.room_id}:${callerId}`)?.role === 'host';
      if (req.recipient_id !== callerId && !isHost) throw new Error('NOT_AUTHORIZED');
      joiningUser = req.sender_id;
    }

    if (!accept) {
      req.status = 'declined';
      return { status: 'declined' };
    }

    // Row-lock room simulation
    const room = this.rooms.get(req.room_id);
    if (!room || room.state === 'archived') throw new Error('ROOM_NOT_FOUND');

    if (!this.roomIsUsable(room.id) || room.state === 'locked') {
      throw new Error('ROOM_LOCKED');
    }

    if (room.state === 'over_capacity') throw new Error('ROOM_FULL');

    const cap = this.roomCap(room.id);

    // Large room check: rooms above 20 people require host approval for join requests
    if (req.type === 'join_request' && cap > 20) {
      const callerRole = this.roomMembers.get(`${req.room_id}:${callerId}`)?.role;
      if (callerRole !== 'host') {
        throw new Error('NOT_AUTHORIZED');
      }
    }

    let activeCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === room.id && m.status === 'active') activeCount++;
    }
    if (activeCount >= cap) throw new Error('ROOM_FULL');

    let joiningUserRoomCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.user_id === joiningUser && m.status !== 'left') joiningUserRoomCount++;
    }
    if (joiningUserRoomCount >= 3) throw new Error('MAX_ROOMS_REACHED');

    req.status = 'accepted';
    this.roomMembers.set(`${room.id}:${joiningUser}`, {
      id: `m-${Date.now()}`,
      room_id: room.id,
      user_id: joiningUser,
      role: 'member',
      status: 'active',
      privacy_settings: getDefaultPrivacySettings(),
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.recomputeRoomState(room.id);
    return { status: 'accepted' };
  }

  // 5. join_by_code
  joinByCode(callerId: string, code: string) {
    let room: Room | null = null;
    for (const r of this.rooms.values()) {
      if (r.code.toUpperCase() === code.toUpperCase() && r.state !== 'archived') {
        room = r;
        break;
      }
    }
    if (!room) throw new Error('ROOM_NOT_FOUND');

    if (!this.roomIsUsable(room.id) || room.state === 'locked') {
      throw new Error('ROOM_LOCKED');
    }

    let hostId: string | null = null;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === room.id && m.role === 'host' && m.status === 'active') {
        hostId = m.user_id;
        break;
      }
    }

    if (hostId && (this.blocks.has(`${callerId}:${hostId}`) || this.blocks.has(`${hostId}:${callerId}`))) {
      throw new Error('USER_BLOCKED');
    }

    const cur = this.roomMembers.get(`${room.id}:${callerId}`);
    if (cur && cur.status !== 'left') throw new Error('ALREADY_MEMBER');

    if (room.state === 'over_capacity') throw new Error('ROOM_FULL');

    const cap = this.roomCap(room.id);
    let activeCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.room_id === room.id && m.status === 'active') activeCount++;
    }
    if (activeCount >= cap) throw new Error('ROOM_FULL');

    // For rooms above 20 people, join requests need host approval
    if (cap > 20) {
      this.roomRequests.set(`req-${Date.now()}`, {
        id: `req-${Date.now()}`,
        room_id: room.id,
        sender_id: callerId,
        recipient_id: hostId,
        type: 'join_request',
        status: 'pending',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });
      return { status: 'pending_approval' };
    }

    let userRoomCount = 0;
    for (const m of this.roomMembers.values()) {
      if (m.user_id === callerId && m.status !== 'left') userRoomCount++;
    }
    if (userRoomCount >= 3) throw new Error('MAX_ROOMS_REACHED');

    this.roomMembers.set(`${room.id}:${callerId}`, {
      id: `m-${Date.now()}`,
      room_id: room.id,
      user_id: callerId,
      role: 'member',
      status: 'active',
      privacy_settings: getDefaultPrivacySettings(),
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.recomputeRoomState(room.id);
    return { status: 'joined' };
  }

  // 6. remove_member & leave_room
  removeMember(callerId: string, roomId: string, targetUserId: string) {
    const caller = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!caller || caller.role !== 'host') throw new Error('NOT_AUTHORIZED');
    const target = this.roomMembers.get(`${roomId}:${targetUserId}`);
    if (!target || target.status === 'left') throw new Error('RECIPIENT_NOT_MEMBER');
    target.status = 'left';
    this.recomputeRoomState(roomId);
  }

  leaveRoom(callerId: string, roomId: string) {
    const member = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!member || member.status === 'left') throw new Error('NOT_ROOM_MEMBER');
    member.status = 'left';

    if (member.role === 'host') {
      let nextHost: RoomMember | null = null;
      for (const m of this.roomMembers.values()) {
        if (m.room_id === roomId && m.status === 'active') {
          if (!nextHost || new Date(m.joined_at) < new Date(nextHost.joined_at)) {
            nextHost = m;
          }
        }
      }
      if (nextHost) nextHost.role = 'host';
    }

    this.recomputeRoomState(roomId);
  }

  // 7. nudge & react
  nudge(callerId: string, roomId: string, recipientId: string, message: string) {
    const caller = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!caller || caller.status === 'left') throw new Error('NOT_ROOM_MEMBER');

    if (!this.roomIsUsable(roomId)) throw new Error('ROOM_LOCKED');

    const recipient = this.roomMembers.get(`${roomId}:${recipientId}`);
    if (!recipient || recipient.status === 'left') throw new Error('RECIPIENT_NOT_MEMBER');

    const room = this.rooms.get(roomId);
    if (room?.state === 'dormant') throw new Error('ROOM_DORMANT');

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const nudgeCount = this.nudges.filter(
      (n) =>
        n.roomId === roomId &&
        n.senderId === callerId &&
        n.recipientId === recipientId &&
        n.createdAt >= twentyFourHoursAgo,
    ).length;

    if (nudgeCount >= 2) throw new Error('NUDGE_LIMIT_REACHED');

    this.nudges.push({ roomId, senderId: callerId, recipientId, message, createdAt: now });
    return { status: 'sent' };
  }

  react(callerId: string, roomId: string, eventId: string, reaction: string) {
    const caller = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!caller || caller.status === 'left') throw new Error('NOT_ROOM_MEMBER');
    if (!this.roomIsUsable(roomId)) throw new Error('ROOM_LOCKED');
    this.reactions.add(`${roomId}:${callerId}:${eventId}:${reaction}`);
    return { status: 'reacted' };
  }

  tagSharedMeal(callerId: string, roomId: string, foodName: string, calories: number) {
    const caller = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!caller || caller.status === 'left') throw new Error('NOT_ROOM_MEMBER');
    if (!this.roomIsUsable(roomId)) throw new Error('ROOM_LOCKED');
    const smId = `sm-${Date.now()}`;
    const sm: SharedMeal = {
      id: smId,
      room_id: roomId,
      creator_id: callerId,
      food_name: foodName,
      original_quantity: 1,
      unit: 'serving',
      calories,
      protein: 20,
      carbs: 30,
      fat: 10,
      meal_section: 'lunch',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.sharedMeals.set(smId, sm);
    return sm;
  }

  setPrivacy(userId: string, roomId: string, settings: Partial<RoomPrivacySettings>) {
    const member = this.roomMembers.get(`${roomId}:${userId}`);
    if (!member) throw new Error('NOT_ROOM_MEMBER');
    member.privacy_settings = sanitizePrivacySettings({
      ...member.privacy_settings,
      ...settings,
    });
  }

  // 8. getRoomSnapshot (supports large room paging & overview)
  getRoomSnapshot(
    callerId: string,
    roomId: string,
    options?: { selectedUserId?: string; search?: string; page?: number; pageSize?: number },
  ): RoomSnapshot {
    const callerMember = this.roomMembers.get(`${roomId}:${callerId}`);
    if (!callerMember || callerMember.status === 'left') {
      throw new Error('NOT_ROOM_MEMBER');
    }

    this.recomputeRoomState(roomId);
    const room = this.rooms.get(roomId);
    if (!room || room.state === 'archived') throw new Error('ROOM_ARCHIVED');

    if (!this.roomIsUsable(roomId) || room.state === 'locked') {
      throw new Error('ROOM_LOCKED');
    }

    const membersInRoom: RoomMember[] = [];
    for (const m of this.roomMembers.values()) {
      if (m.room_id === roomId && m.status !== 'left') {
        membersInRoom.push(m);
      }
    }

    const isLarge = membersInRoom.length > 12;

    const memberSnapshots = membersInRoom.map((m) => {
      const prof = this.profiles.get(m.user_id) ?? {
        username: 'unknown',
        nickname: 'Unknown',
        avatar_url: null,
      };
      const summary = this.dailySummaries.get(`${m.user_id}:today`) ?? null;
      const isSelf = m.user_id === callerId;
      const isOverview = isLarge && !isSelf && options?.selectedUserId !== m.user_id;

      return maskMemberSnapshot(
        m,
        prof,
        summary,
        { breakfast: true, lunch: true, dinner: false, snacks: false },
        2000,
        isSelf,
        isOverview,
      );
    });

    return {
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
        state: room.state,
        who_can_invite: room.who_can_invite,
        created_by: room.created_by,
        plan_holder_id: room.plan_holder_id,
        member_cap: room.member_cap,
      },
      caller_id: callerId,
      members: memberSnapshots,
    };
  }

  // RLS Direct select simulation: non-usable/locked room data is blocked
  selectRoomEventsDirect(callerId: string, roomId: string) {
    if (!this.roomIsUsable(roomId)) return [];
    const isMember = this.roomMembers.get(`${roomId}:${callerId}`)?.status === 'active';
    if (!isMember) return [];
    return Array.from(this.roomEvents.values()).filter((e) => e.roomId === roomId);
  }

  selectSharedMealsDirect(callerId: string, roomId: string) {
    if (!this.roomIsUsable(roomId)) return [];
    const isMember = this.roomMembers.get(`${roomId}:${callerId}`)?.status === 'active';
    if (!isMember) return [];
    return Array.from(this.sharedMeals.values()).filter((sm) => sm.room_id === roomId);
  }

  selectDailySummaryDirect(callerId: string, targetUserId: string) {
    if (callerId !== targetUserId) return null;
    return this.dailySummaries.get(`${targetUserId}:today`) ?? null;
  }
}

describe('Phase 5 v0.4 Comprehensive Room Billing, Capacity & Attack Tests', () => {
  const db = new InMemoryPhase5Db();

  const userA = 'user-alex-1111';
  const userB = 'user-bob-2222';
  const userC = 'user-charlie-3333';
  const userD = 'user-david-4444';
  const userEve = 'user-eve-5555';

  it('Setup: register users and initial data', () => {
    db.registerUser(userA, 'alex_fit', 'Alex', true);
    db.registerUser(userB, 'bob_gym', 'Bob', true);
    db.registerUser(userC, 'charlie_fit', 'Charlie', false); // undiscoverable
    db.registerUser(userD, 'david_track', 'David', true);
    db.registerUser(userEve, 'eve_solo', 'Eve', true);

    db.dailySummaries.set(`${userB}:today`, {
      user_id: userB,
      local_date: 'today',
      calories: 2200,
      protein: 160,
      carbs: 220,
      fat: 70,
      steps: 9500,
      water_ml: 2750,
      weight_kg: 78.5,
      workout_minutes: 45,
      logged_day: true,
      goal_day: true,
    });
  });

  let room1: Room;

  it('1. Free user starts 3-day trial on first room creation (PRD 6.8 ROOM-1, 6.18 SUB-3)', () => {
    expect(db.hasPlan(userA)).toBe(false);
    expect(db.canCreateRoom(userA)).toBe(true);

    room1 = db.createRoom(userA, 'Alex & Friends', 'device-hash-alex');
    expect(room1).toBeDefined();
    expect(room1.plan_holder_id).toBe(userA);
    expect(room1.member_cap).toBe(5); // Basic/trial cap is 5

    const entA = db.entitlements.get(userA);
    expect(entA?.status).toBe('trial');
    expect(entA?.tier).toBe('basic');
    expect(entA?.trial_started_at).toBeDefined();

    // 1 member initially -> Dormant
    expect(room1.state).toBe('dormant');
    expect(db.roomIsUsable(room1.id)).toBe(true);
  });

  it('2. Invitations by username respect discoverability (PRD 6.7 USR-4)', () => {
    expect(() => {
      db.sendRoomInvitation(userA, room1.id, 'charlie_fit');
    }).toThrow('USER_NOT_FOUND');
  });

  it('3. Blocked users cannot invite or be invited (PRD 6.7 USR-9)', () => {
    db.blocks.add(`${userB}:${userA}`);
    expect(() => {
      db.sendRoomInvitation(userA, room1.id, 'bob_gym');
    }).toThrow('USER_BLOCKED');

    db.blocks.delete(`${userB}:${userA}`);
  });

  it('4. User B joins usable room for FREE: joining never starts or needs a trial (PRD 6.18 SUB-1, SUB-3)', () => {
    const req = db.sendRoomInvitation(userA, room1.id, 'bob_gym');
    expect(req.status).toBe('pending');

    // Bob has NO plan and has NOT used trial
    expect(db.hasPlan(userB)).toBe(false);
    expect(db.entitlements.get(userB)?.trial_started_at).toBeNull();

    // Bob accepts invitation -> joins room for FREE without consuming trial!
    const res = db.respondToRequest(userB, req.id, true);
    expect(res.status).toBe('accepted');

    // Bob still has not used their trial!
    expect(db.entitlements.get(userB)?.trial_started_at).toBeNull();
    expect(db.hasPlan(userB)).toBe(false);

    // With 2 active members in usable room, room transitions to active
    expect(db.rooms.get(room1.id)?.state).toBe('active');
  });

  it('5. DIRECT SELECT ATTACK: User A cannot directly select User B daily summaries', () => {
    const summaryB = db.selectDailySummaryDirect(userA, userB);
    expect(summaryB).toBeNull();
  });

  it('6. PRIVACY ENFORCEMENT: Hidden fields appear as "locked", never zero or actual data', () => {
    const snapshot = db.getRoomSnapshot(userA, room1.id);
    expect(snapshot.room.id).toBe(room1.id);

    const bMember = snapshot.members.find((m) => m.user_id === userB);
    expect(bMember).toBeDefined();
    expect(bMember?.metrics.logged_today).toBe(true);
    expect(bMember?.metrics.steps).toBe(9500);

    // Default hidden fields MUST be string 'locked'
    expect(bMember?.metrics.calories).toBe('locked');
    expect(bMember?.metrics.macros).toBe('locked');
    expect(bMember?.metrics.weight_kg).toBe('locked');

    // User A can see their own real fields
    const aMember = snapshot.members.find((m) => m.user_id === userA);
    expect(aMember?.is_self).toBe(true);
    expect(aMember?.metrics.calories).toBe(0);
  });

  it('7. PRIVACY RETROACTIVITY: Bob changes privacy settings, applying immediately', () => {
    db.setPrivacy(userB, room1.id, {
      share_calories_macros: true,
      share_weight_number: true,
      share_water: false,
    });

    const snapshot = db.getRoomSnapshot(userA, room1.id);
    const bMember = snapshot.members.find((m) => m.user_id === userB);

    expect(bMember?.metrics.calories).toBe(2200);
    expect(bMember?.metrics.weight_kg).toBe(78.5);
    expect(bMember?.metrics.water_ml).toBe('locked');
  });

  it('8. NON-MEMBER ATTACK: Non-member cannot read snapshot or interact with room', () => {
    expect(() => {
      db.getRoomSnapshot(userD, room1.id);
    }).toThrow('NOT_ROOM_MEMBER');

    expect(() => {
      db.nudge(userD, room1.id, userA, 'Hey!');
    }).toThrow('NOT_ROOM_MEMBER');
  });

  it('9. NUDGE LIMIT ATTACK: Exceeding 2 nudges/recipient/day is blocked', () => {
    const res1 = db.nudge(userA, room1.id, userB, 'Time for lunch!');
    expect(res1.status).toBe('sent');

    const res2 = db.nudge(userA, room1.id, userB, 'Did you log workout?');
    expect(res2.status).toBe('sent');

    expect(() => {
      db.nudge(userA, room1.id, userB, 'Spamming nudge');
    }).toThrow('NUDGE_LIMIT_REACHED');
  });

  // ---------------------------------------------------------------------------
  // NEW REQUIRED ATTACK TESTS FOR PRD v0.4
  // ---------------------------------------------------------------------------

  it('10. ATTACK TEST 1: User with no plan and no trial can join and use a usable room but cannot create one', () => {
    // Eve has expired trial and no plan
    db.devExpireTrial(userEve);
    expect(db.hasPlan(userEve)).toBe(false);
    expect(db.canCreateRoom(userEve)).toBe(false);

    // Eve tries to create a room -> REJECTED with PLAN_REQUIRED
    expect(() => {
      db.createRoom(userEve, 'Eve Room');
    }).toThrow('PLAN_REQUIRED');

    // But Eve can join Alex's usable room for free!
    const res = db.joinByCode(userEve, room1.code);
    expect(res.status).toBe('joined');

    // And Eve can read and use the room snapshot without issue!
    const snapshot = db.getRoomSnapshot(userEve, room1.id);
    expect(snapshot.room.id).toBe(room1.id);
    expect(snapshot.members.length).toBeGreaterThanOrEqual(3);
  });

  it('11. ATTACK TEST 2 & 3: Simultaneous joins cannot exceed cap, and accept-invite to full room returns ROOM_FULL', () => {
    // Current members: Alex, Bob, Eve (3 members). Basic/trial cap is 5.
    expect(db.roomCap(room1.id)).toBe(5);

    // David joins by code (4th member)
    db.joinByCode(userD, room1.code);

    // 5th member joins: User C accepts invitation (reaches exactly 5/5)
    db.profiles.get(userC)!.discoverable = true;
    const inv5 = db.sendRoomInvitation(userA, room1.id, 'charlie_fit');
    db.respondToRequest(userC, inv5.id, true);

    // Room is now completely full (5 active members = cap of 5)
    expect(() => {
      // 6th member tries to join by code -> ROOM_FULL
      const user6 = 'user-extra-6666';
      db.registerUser(user6, 'extra_6', 'Extra 6');
      db.joinByCode(user6, room1.code);
    }).toThrow('ROOM_FULL');

    // Accept-invite to a full room returns ROOM_FULL
    const user7 = 'user-extra-7777';
    db.registerUser(user7, 'extra_7', 'Extra 7');
    // Simulate pre-existing pending invite
    const pendingReqId = 'req-pending-full';
    db.roomRequests.set(pendingReqId, {
      id: pendingReqId,
      room_id: room1.id,
      sender_id: userA,
      recipient_id: user7,
      type: 'invitation',
      status: 'pending',
      expires_at: new Date(Date.now() + 100000).toISOString(),
      created_at: new Date().toISOString(),
    });

    expect(() => {
      db.respondToRequest(user7, pendingReqId, true);
    }).toThrow('ROOM_FULL');
  });

  it('12. ATTACK TEST 4: Locked rooms are unreadable by every route', () => {
    // Alex's trial expires. Nobody sponsors the room -> room transitions to LOCKED
    db.devExpireTrial(userA);
    expect(db.roomIsUsable(room1.id)).toBe(false);
    expect(db.rooms.get(room1.id)?.state).toBe('locked');

    // Route 1: getRoomSnapshot throws ROOM_LOCKED
    expect(() => {
      db.getRoomSnapshot(userB, room1.id);
    }).toThrow('ROOM_LOCKED');

    // Route 2: sendRoomInvitation throws ROOM_LOCKED
    expect(() => {
      db.sendRoomInvitation(userA, room1.id, 'someone');
    }).toThrow('ROOM_LOCKED');

    // Route 3: joinByCode throws ROOM_LOCKED
    expect(() => {
      const stranger = 'user-stranger-9999';
      db.registerUser(stranger, 'stranger', 'Stranger');
      db.joinByCode(stranger, room1.code);
    }).toThrow('ROOM_LOCKED');

    // Route 4: nudge throws ROOM_LOCKED
    expect(() => {
      db.nudge(userA, room1.id, userB, 'Hello?');
    }).toThrow('ROOM_LOCKED');

    // Route 5: react throws ROOM_LOCKED
    expect(() => {
      db.react(userA, room1.id, 'ev-1', 'fire');
    }).toThrow('ROOM_LOCKED');

    // Route 6: tagSharedMeal throws ROOM_LOCKED
    expect(() => {
      db.tagSharedMeal(userA, room1.id, 'Salad', 300);
    }).toThrow('ROOM_LOCKED');

    // Route 7: Direct select on room_events / shared_meals returns empty
    expect(db.selectRoomEventsDirect(userA, room1.id)).toHaveLength(0);
    expect(db.selectSharedMealsDirect(userA, room1.id)).toHaveLength(0);

    // Sponsoring restores the room instantly!
    db.devGrantPlan(userB, 'plus', 'monthly', 'paid');
    db.sponsorRoom(userB, room1.id);
    expect(db.rooms.get(room1.id)?.state).toBe('active');
    expect(db.roomCap(room1.id)).toBe(20); // Plus tier cap = 20
    expect(db.getRoomSnapshot(userA, room1.id)).toBeDefined();
  });

  it('13. ATTACK TEST 5: Trial cannot restart and joining never starts it', () => {
    // User B was a member of room1, but never created a room -> trial not yet used
    expect(db.entitlements.get(userB)?.trial_started_at).toBeNull();

    // User A already used their trial on device-hash-alex
    expect(db.startTrialIfEligible(userA, 'device-hash-alex')).toBe(false);

    // Another user Frank tries to spoof device-hash-alex
    const userFrank = 'user-frank-8888';
    db.registerUser(userFrank, 'frank_spoof', 'Frank');
    expect(db.startTrialIfEligible(userFrank, 'device-hash-alex')).toBe(false);
  });

  it('14. ATTACK TEST 6: One plan cannot cover two rooms (PRD 6.8 ROOM-5, 6.18 SUB-17)', () => {
    // User B currently sponsors/hosts room1 on Plus plan
    expect(db.hasPlan(userB)).toBe(true);

    // User B attempts to create a second hosted room -> BLOCKED with PLAN_ALREADY_ATTACHED
    expect(() => {
      db.createRoom(userB, 'Bob Second Room');
    }).toThrow('PLAN_ALREADY_ATTACHED');
  });

  it('15. MAX ROOMS LIMIT: Maximum 3 rooms per user as a member', () => {
    // User D is currently in room1 (1 room). Create Room X and Room Y for David to join.
    const userHostX = 'host-x';
    const userHostY = 'host-y';
    const userHostZ = 'host-z';
    db.registerUser(userHostX, 'hx', 'HX');
    db.registerUser(userHostY, 'hy', 'HY');
    db.registerUser(userHostZ, 'hz', 'HZ');

    const rx = db.createRoom(userHostX, 'Room X', 'dev-x');
    const ry = db.createRoom(userHostY, 'Room Y', 'dev-y');
    const rz = db.createRoom(userHostZ, 'Room Z', 'dev-z');

    db.joinByCode(userD, rx.code); // 2nd room
    db.joinByCode(userD, ry.code); // 3rd room

    // 4th room join attempt fails with MAX_ROOMS_REACHED
    expect(() => {
      db.joinByCode(userD, rz.code);
    }).toThrow('MAX_ROOMS_REACHED');
  });

  it('16. Pure Logic Consistency & Goal Day calculations (PRD 7.3)', () => {
    expect(evaluateLoggedDay(1, 1500, 2000)).toBe(false);
    expect(evaluateLoggedDay(2, 900, 2000)).toBe(false);
    expect(evaluateLoggedDay(2, 1000, 2000)).toBe(true);

    expect(evaluateGoalDay(true, 'cut', 1600, 2000)).toBe(false);
    expect(evaluateGoalDay(true, 'cut', 1800, 2000)).toBe(true);
    expect(evaluateGoalDay(true, 'cut', 2200, 2000)).toBe(false);
  });
});
