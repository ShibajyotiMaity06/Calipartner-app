import { describe, expect, it } from 'vitest';
import { CHALLENGE_METRICS } from './challengeEngine';
import { buildChallengeHome } from './challengeViewModel';
import { getLocalDateString } from './localDay';
import { getDefaultPrivacySettings, sanitizePrivacySettings } from './rooms';
import type { ChallengeHome } from './challengeTypes';

describe('retired activity compatibility', () => {
  it('removes old activity challenges and templates from cached presentation data', () => {
    const makeItem = (id: string, tasks: string[]) => ({
      challenge: { id, rules_snapshot: { tasks } },
      self: { status: 'completed' },
      participants: [],
    });
    const home = {
      items: [makeItem('retired', ['focus_minutes']), makeItem('steps', ['steps'])],
      catalog: {
        templates: [
          { id: 'old', tasks: ['focus_minutes'] },
          { id: 'current', tasks: ['water_ml'] },
        ],
        seasons: [],
      },
    } as unknown as ChallengeHome;
    const result = buildChallengeHome(home);
    expect(result.items.map((item) => item.challenge.id)).toEqual(['steps']);
    expect(result.catalog.templates.map((template) => template.id)).toEqual(['current']);
    expect(CHALLENGE_METRICS).not.toContain('focus_minutes');
    expect(home.items).toHaveLength(2);
  });
  it('ignores retired privacy keys while retaining every current setting', () => {
    expect(getDefaultPrivacySettings()).not.toHaveProperty('share_focus_status');
    expect(
      sanitizePrivacySettings({
        ...getDefaultPrivacySettings(),
        share_steps: false,
        share_focus_status: true,
      } as Parameters<typeof sanitizePrivacySettings>[0]),
    ).toEqual({ ...getDefaultPrivacySettings(), share_steps: false });
  });
  it('keeps the shared local-date helper independent of removed session logic', () => {
    expect(getLocalDateString(new Date('2026-10-30T01:00:00Z'), 'America/New_York')).toBe(
      '2026-10-29',
    );
    expect(getLocalDateString(new Date('2026-10-30T01:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-30');
  });
});
