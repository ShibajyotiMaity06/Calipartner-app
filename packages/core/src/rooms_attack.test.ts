import { describe, expect, it } from 'vitest';
import {
  canCreateRoom,
  roomCap,
  roomIsUsable,
  evaluateRoomState,
  getDefaultPrivacySettings,
  maskMemberSnapshot,
} from './rooms';
import type { Entitlement, RoomMember } from './types';

// Database/RLS attacks run against the complete migration chain in npm run test:db.
// These tests cover the shared offline permission helpers without simulating SQL.
describe('Rooms v3 permission boundaries', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const entitlement = (
    tier: Entitlement['tier'],
    status: Entitlement['status'] = 'paid',
  ): Entitlement => ({
    user_id: 'host',
    tier,
    status,
    period: 'monthly',
    source: 'apple',
    trial_started_at: null,
    period_end: '2026-11-24T12:00:00Z',
  });
  it.each([
    ['free', 2],
    ['basic', 2],
    ['plus', 5],
    ['pro', 20],
  ] as const)('%s capacity is %i', (tier, cap) => expect(roomCap(tier)).toBe(cap));
  it('allows one free pair even after a trial has been used', () => {
    const expired = { ...entitlement('plus', 'lapsed'), trial_started_at: '2026-01-01T00:00:00Z' };
    expect(canCreateRoom(null, 0, now)).toBe(true);
    expect(canCreateRoom(expired, 0, now)).toBe(true);
    expect(canCreateRoom(expired, 1, now)).toBe(false);
  });
  it('enforces Plus and Pro hosted room limits and expiry', () => {
    expect(canCreateRoom(entitlement('plus'), 1, now)).toBe(true);
    expect(canCreateRoom(entitlement('plus'), 2, now)).toBe(true);
    expect(canCreateRoom(entitlement('plus'), 3, now)).toBe(false);
    expect(canCreateRoom(entitlement('pro'), 4, now)).toBe(true);
    expect(canCreateRoom(entitlement('pro'), 5, now)).toBe(false);
    expect(canCreateRoom({ ...entitlement('pro'), period_end: now.toISOString() }, 1, now)).toBe(
      false,
    );
  });
  it('never makes locked or archived rooms usable', () => {
    expect(roomIsUsable({ state: 'locked' }, entitlement('pro'), now)).toBe(false);
    expect(roomIsUsable({ state: 'archived' }, entitlement('pro'), now)).toBe(false);
    expect(roomIsUsable({ state: 'active' }, null, now)).toBe(true);
  });
  it('ends the frozen recovery window at 30 days', () => {
    expect(
      evaluateRoomState({
        hasActivePlan: false,
        activeMemberCount: 3,
        memberCap: 2,
        lockedSince: new Date('2026-09-24T12:00:00Z'),
        now,
      }),
    ).toBe('archived');
    expect(
      evaluateRoomState({
        hasActivePlan: false,
        activeMemberCount: 3,
        memberCap: 2,
        lockedSince: new Date('2026-09-24T12:00:01Z'),
        now,
      }),
    ).toBe('locked');
  });
  it('preserves privacy defaults and never turns hidden nutrition into zero', () => {
    const privacy = getDefaultPrivacySettings();
    expect(privacy.share_calories_macros).toBe(false);
    expect(privacy.share_weight_number).toBe(false);
    const member = {
      id: 'm',
      room_id: 'r',
      user_id: 'other',
      role: 'member',
      status: 'active',
      privacy_settings: privacy,
    } as RoomMember;
    const snapshot = maskMemberSnapshot(
      member,
      { nickname: 'Other', username: 'other', avatar_url: null },
      null,
      {},
      2000,
      false,
    );
    expect(snapshot.metrics.calories).toBe('locked');
    expect(snapshot.metrics.macros).toBe('locked');
    expect(snapshot.metrics.weight_kg).toBe('locked');
  });
});
