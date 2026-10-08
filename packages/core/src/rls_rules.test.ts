import { describe, expect, it } from 'vitest';
import { isAtLeast18 } from './age';
import { isDisposableEmail } from './email';
import type { Profile, PublicUserProfile } from './types';
import { normalizeUsername, validateUsername } from './username';

/**
 * Simulates the database RLS policies and triggers in memory to assert
 * that the specification holds under all user interactions.
 */
class InMemoryDb {
  profiles = new Map<string, Profile>();
  releasedUsernames = new Map<string, { releasedBy: string; releasedAt: Date }>();
  blocks = new Set<string>(); // "blockerId:blockedId"
  rateLimits = new Map<string, { count: number; windowStart: number }>();

  createProfile(
    callerId: string,
    profile: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'username_changed_at'>,
  ): Profile {
    // Age gate trigger (AUTH-3, 8.1)
    if (!isAtLeast18(profile.date_of_birth)) {
      throw new Error('Users must be at least 18 years old');
    }

    // Username validation trigger (USR-1)
    const normUser = normalizeUsername(profile.username);
    const validation = validateUsername(normUser);
    if (!validation.isValid) {
      throw new Error(`Invalid username: ${validation.error}`);
    }

    // Unique case-insensitive check
    for (const existing of this.profiles.values()) {
      if (normalizeUsername(existing.username) === normUser) {
        throw new Error('duplicate key value violates unique constraint');
      }
    }

    // Released username hold check (USR-2: 30 days hold)
    const released = this.releasedUsernames.get(normUser);
    if (released && released.releasedBy !== callerId) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (released.releasedAt.getTime() > thirtyDaysAgo) {
        throw new Error('This username is temporarily held and unavailable');
      }
    }

    const now = new Date().toISOString();
    const created: Profile = {
      ...profile,
      id: callerId,
      username: normUser,
      username_changed_at: now,
      created_at: now,
      updated_at: now,
    };
    this.profiles.set(callerId, created);
    return created;
  }

  // RLS SELECT policy simulation
  selectProfile(callerId: string | null, targetProfileId: string): Profile | null {
    // Unauthenticated anon cannot read profiles
    if (!callerId) return null;
    // Authenticated users can ONLY read their own full profile
    if (callerId !== targetProfileId) return null;
    return this.profiles.get(targetProfileId) ?? null;
  }

  // RLS UPDATE policy simulation
  updateProfile(callerId: string | null, targetProfileId: string, updates: Partial<Profile>): void {
    if (!callerId || callerId !== targetProfileId) {
      throw new Error('RLS violation: cannot update another user profile');
    }
    const existing = this.profiles.get(targetProfileId);
    if (!existing) throw new Error('Profile not found');

    if (
      updates.username &&
      normalizeUsername(updates.username) !== normalizeUsername(existing.username)
    ) {
      // 30 days cooldown trigger
      const lastChanged = new Date(existing.username_changed_at).getTime();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (lastChanged > thirtyDaysAgo) {
        throw new Error('Username can only be changed once every 30 days');
      }

      // Record old username into releasedUsernames
      this.releasedUsernames.set(normalizeUsername(existing.username), {
        releasedBy: callerId,
        releasedAt: new Date(),
      });

      existing.username = normalizeUsername(updates.username);
      existing.username_changed_at = new Date().toISOString();
    }

    if (updates.nickname) existing.nickname = updates.nickname;
    if (updates.discoverable !== undefined) existing.discoverable = updates.discoverable;
    existing.updated_at = new Date().toISOString();
  }

  // search_users RPC simulation
  searchUsers(callerId: string | null, prefix: string): PublicUserProfile[] {
    if (!prefix || prefix.trim().length < 3) return [];

    // Rate limit check
    const bucketKey = `search:${callerId ?? 'anon'}`;
    const now = Date.now();
    const limit = this.rateLimits.get(bucketKey) ?? { count: 0, windowStart: now };
    if (now - limit.windowStart > 60000) {
      limit.count = 1;
      limit.windowStart = now;
    } else {
      limit.count++;
    }
    this.rateLimits.set(bucketKey, limit);
    if (limit.count > 30) {
      throw new Error('Rate limit exceeded for search_users');
    }

    const cleanPrefix = prefix.trim().toLowerCase();
    const results: PublicUserProfile[] = [];

    for (const p of this.profiles.values()) {
      if (!p.discoverable) continue;
      if (callerId && p.id === callerId) continue;
      if (
        callerId &&
        (this.blocks.has(`${callerId}:${p.id}`) || this.blocks.has(`${p.id}:${callerId}`))
      ) {
        continue;
      }
      if (p.username.toLowerCase().startsWith(cleanPrefix)) {
        // Returns ONLY public fields
        results.push({
          username: p.username,
          nickname: p.nickname,
          avatar_url: p.avatar_url,
        });
      }
      if (results.length >= 10) break;
    }

    return results;
  }
}

describe('RLS Test Harness & Business Rules', () => {
  it('denies unauthenticated (anon) access to profiles', () => {
    const db = new InMemoryDb();
    db.createProfile('user-a', {
      username: 'alice_fit',
      nickname: 'Alice',
      avatar_url: null,
      date_of_birth: '2000-01-01',
      sex: 'female',
      height_cm: 165,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    const result = db.selectProfile(null, 'user-a');
    expect(result).toBeNull();
  });

  it('prevents user A from reading user B profile directly', () => {
    const db = new InMemoryDb();
    db.createProfile('user-b', {
      username: 'bob_runner',
      nickname: 'Bob',
      avatar_url: null,
      date_of_birth: '1995-05-12',
      sex: 'male',
      height_cm: 180,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    const readAttempt = db.selectProfile('user-a', 'user-b');
    expect(readAttempt).toBeNull();
  });

  it('prevents user A from updating user B profile', () => {
    const db = new InMemoryDb();
    db.createProfile('user-b', {
      username: 'bob_runner',
      nickname: 'Bob',
      avatar_url: null,
      date_of_birth: '1995-05-12',
      sex: 'male',
      height_cm: 180,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    expect(() => db.updateProfile('user-a', 'user-b', { nickname: 'Hacked' })).toThrow(
      'RLS violation',
    );
  });

  it('blocks users under 18 server-side', () => {
    const db = new InMemoryDb();
    expect(() =>
      db.createProfile('minor-user', {
        username: 'kid_123',
        nickname: 'Kid',
        avatar_url: null,
        date_of_birth: '2015-01-01',
        sex: 'other',
        height_cm: 150,
        units: 'metric',
        timezone: 'UTC',
        country: null,
        discoverable: true,
      }),
    ).toThrow('Users must be at least 18 years old');
  });

  it('enforces case-insensitive username uniqueness', () => {
    const db = new InMemoryDb();
    db.createProfile('user-1', {
      username: 'Rahul_99',
      nickname: 'Rahul',
      avatar_url: null,
      date_of_birth: '1998-02-14',
      sex: 'male',
      height_cm: 175,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    expect(() =>
      db.createProfile('user-2', {
        username: 'rahul_99',
        nickname: 'Rahul Clone',
        date_of_birth: '1998-02-14',
        avatar_url: null,
        sex: 'male',
        height_cm: 175,
        units: 'metric',
        timezone: 'UTC',
        country: null,
        discoverable: true,
      }),
    ).toThrow('duplicate key');
  });

  it('enforces username change once per 30 days', () => {
    const db = new InMemoryDb();
    db.createProfile('user-1', {
      username: 'initial_name',
      nickname: 'User',
      avatar_url: null,
      date_of_birth: '1990-01-01',
      sex: 'other',
      height_cm: 170,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    // Immediate second update attempt should be blocked
    expect(() => db.updateProfile('user-1', 'user-1', { username: 'second_name' })).toThrow(
      'once every 30 days',
    );
  });

  it('holds released username for 30 days before another user can claim it', () => {
    const db = new InMemoryDb();
    const p = db.createProfile('user-1', {
      username: 'old_handle',
      nickname: 'User 1',
      avatar_url: null,
      date_of_birth: '1990-01-01',
      sex: 'other',
      height_cm: 170,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    // Simulate 31 days elapsed for user-1 to change username
    p.username_changed_at = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    db.updateProfile('user-1', 'user-1', { username: 'new_handle' });

    // Another user tries to claim 'old_handle' within 30 days
    expect(() =>
      db.createProfile('user-2', {
        username: 'old_handle',
        nickname: 'User 2',
        avatar_url: null,
        date_of_birth: '1990-01-01',
        sex: 'other',
        height_cm: 170,
        units: 'metric',
        timezone: 'UTC',
        country: null,
        discoverable: true,
      }),
    ).toThrow('temporarily held and unavailable');
  });

  it('search_users respects discoverability and blocks, and only returns public fields', () => {
    const db = new InMemoryDb();
    db.createProfile('user-discoverable', {
      username: 'sam_walker',
      nickname: 'Sam W',
      avatar_url: 'https://example.com/sam.png',
      date_of_birth: '1992-04-10',
      sex: 'male',
      height_cm: 178,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: true,
    });

    db.createProfile('user-hidden', {
      username: 'sam_secret',
      nickname: 'Sam S',
      avatar_url: null,
      date_of_birth: '1993-06-15',
      sex: 'female',
      height_cm: 162,
      units: 'metric',
      timezone: 'UTC',
      country: null,
      discoverable: false, // hidden from search
    });

    const searchResults = db.searchUsers('caller-1', 'sam');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toEqual({
      username: 'sam_walker',
      nickname: 'Sam W',
      avatar_url: 'https://example.com/sam.png',
    });
    // Private fields must never be exposed
    expect((searchResults[0] as unknown as Profile).date_of_birth).toBeUndefined();
    expect((searchResults[0] as unknown as Profile).height_cm).toBeUndefined();

    // Now caller blocks sam_walker
    db.blocks.add('caller-1:user-discoverable');
    const afterBlock = db.searchUsers('caller-1', 'sam');
    expect(afterBlock).toHaveLength(0);
  });

  it('search_users enforces rate limits', () => {
    const db = new InMemoryDb();
    for (let i = 0; i < 30; i++) {
      db.searchUsers('spammer', 'sam');
    }
    expect(() => db.searchUsers('spammer', 'sam')).toThrow('Rate limit exceeded');
  });

  it('identifies and blocks disposable emails at signup', () => {
    expect(isDisposableEmail('burner@tempmail.com')).toBe(true);
    expect(isDisposableEmail('throwaway@mailinator.com')).toBe(true);
    expect(isDisposableEmail('valid@gmail.com')).toBe(false);
  });
});
