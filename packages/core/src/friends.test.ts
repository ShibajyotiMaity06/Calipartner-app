import { describe, expect, it } from 'vitest';
import {
  friendRequestQuota,
  isSocialQueryValid,
  normalizeSocialQuery,
  validateSocialProfile,
} from './friends';

describe('friend requests and public profile validation', () => {
  it('normalizes username search and treats separators literally', () => {
    expect(normalizeSocialQuery(' @Ari_fit ')).toBe('ari_fit');
    expect(isSocialQueryValid('@ari_fit')).toBe(true);
    expect(isSocialQueryValid('ab')).toBe(false);
    expect(isSocialQueryValid('ari%')).toBe(false);
  });
  it('allows three requests per rolling seven days with exact expiration', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    const sent = [
      '2026-10-17T12:00:00Z',
      '2026-10-18T12:00:00Z',
      '2026-10-19T12:00:00Z',
      '2026-10-20T12:00:00Z',
    ];
    expect(friendRequestQuota(sent, false, now)).toEqual({
      premium: false,
      sent: 3,
      remaining: 0,
      resets_at: '2026-10-25T12:00:00.000Z',
    });
    expect(friendRequestQuota(sent, true, now).remaining).toBe(null);
    expect(friendRequestQuota(['invalid', '2099-01-01'], false, now).remaining).toBe(3);
  });
  it('waits until fewer than three recent sends remain after a paid user downgrades', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(
      friendRequestQuota(
        [
          '2026-10-18T12:00:00Z',
          '2026-10-19T12:00:00Z',
          '2026-10-20T12:00:00Z',
          '2026-10-21T12:00:00Z',
        ],
        false,
        now,
      ).resets_at,
    ).toBe('2026-10-26T12:00:00.000Z');
  });
  it('rejects executable URLs, credentials, oversized bios and invalid handles', () => {
    const draft = {
      bio: 'Hello',
      training_style: 'Strength',
      instagram_handle: '@ari.fit',
      website_url: 'https://example.com/ari',
      is_public: true,
    };
    expect(validateSocialProfile(draft).valid).toBe(true);
    for (const url of [
      'javascript:alert(1)',
      'http://example.com',
      'https://user:pass@example.com',
      'file:///tmp/a',
    ])
      expect(validateSocialProfile({ ...draft, website_url: url }).valid).toBe(false);
    expect(validateSocialProfile({ ...draft, bio: 'a'.repeat(241) }).field).toBe('bio');
    expect(validateSocialProfile({ ...draft, instagram_handle: 'ari/redirect' }).field).toBe(
      'instagram_handle',
    );
  });
});
