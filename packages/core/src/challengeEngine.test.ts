import { describe, it, expect } from 'vitest';
import {
  CHALLENGE_FORMATS,
  CHALLENGE_METRICS,
  challengeDateAdd,
  challengeMidnight,
  evaluateChallengeDays,
  personalChallengeTarget,
  challengeTeamScore,
  safeOccasionMilestones,
  gentlerChallengeTargets,
  summarizeChallenge,
  type ChallengeRules,
} from './challengeEngine';
import fixture from './__fixtures__/challengeConfig.json';
const rules: ChallengeRules = {
  format: 'streak',
  tasks: ['steps'],
  duration_days: 7,
  pass_days: 7,
  weekly_days: 5,
  rest_weekdays: [],
  daily_cap_pct: 100,
  finalize_delay_hours: 12,
  minimum_meals: 3,
  protein_min_pct: 80,
  protein_max_pct: 150,
  shield_every: 7,
  shield_max: 2,
  pause_max: 3,
  cover_max: 1,
  allow_manual: true,
  stretch_pct: 10,
  min_history_days: 7,
  target_adjust_pct: 10,
  metrics: Object.fromEntries(
    CHALLENGE_METRICS.map((metric) => [
      metric,
      { min: 1, max: 20000, plausible_max: 100000, fallback: { default: 5000 } },
    ]),
  ) as unknown as ChallengeRules['metrics'],
};
const input = {
  rules,
  targets: { steps: 5000 },
  start_date: '2026-10-01',
  tz: 'UTC',
  now: new Date('2026-10-10T12:00:00Z'),
  source_days: Array.from({ length: 7 }, (_, i) => ({
    local_date: challengeDateAdd('2026-10-01', i),
    values: { steps: 5000 },
    sources: { steps: 'health_platform' },
  })),
};
describe('configured challenge engine', () => {
  it.each([30, 60, 75])(
    'finishes a real configured %i-day clock and freezes its completed history',
    (duration) => {
      const start = '2026-12-01';
      const configured = { ...rules, duration_days: duration, pass_days: duration };
      const source = Array.from({ length: duration }, (_, index) => ({
        local_date: challengeDateAdd(start, index),
        values: { steps: 5000 },
        sources: { steps: 'health_platform' },
      }));
      const args = {
        ...input,
        rules: configured,
        start_date: start,
        now: new Date(`${challengeDateAdd(start, duration + 1)}T12:00:00Z`),
        source_days: source,
      };
      const result = evaluateChallengeDays(args);
      expect(result.outcome).toBe('completed');
      expect(result.days).toHaveLength(duration);
      expect(result.passed).toBe(duration);
      expect(
        evaluateChallengeDays({ ...args, source_days: [], existing: result.days }).outcome,
      ).toBe('completed');
    },
  );
  it.each(CHALLENGE_METRICS)('scores supported metric %s with the seeded safe bounds', (metric) => {
    const value = fixture.rules.metrics[metric].fallback.default;
    const configured: ChallengeRules = { ...rules, ...fixture.rules, tasks: [metric] };
    const result = evaluateChallengeDays({
      ...input,
      rules: configured,
      targets: { [metric]: value },
      source_days: input.source_days.map((day) => ({
        local_date: day.local_date,
        values: { [metric]: value },
        sources: { [metric]: 'log' },
      })),
    });
    expect(result.percent).toBe(100);
    expect(result.outcome).toBe('completed');
  });
  it('keeps chapter rewards paid, shares only verified consistency and reduces targets within safe floors', () => {
    const result = evaluateChallengeDays(input);
    const withChapter = { ...rules, chapters: [{ day: 1, text_key: 'foundation' }] };
    const base = { result, rules: withChapter, now: input.now, tz: input.tz };
    expect(summarizeChallenge({ ...base, benefits: { custom: false } }).chapters).toEqual([]);
    expect(summarizeChallenge({ ...base, benefits: { custom: true } }).chapters).toEqual([
      'foundation',
    ]);
    expect(gentlerChallengeTargets({ steps: 5000 }, rules).steps).toBe(4500);
  });
  it('applies lighter event-week targets and rejects unsafe or non-finite private body goals', () => {
    const eventRules = {
      ...rules,
      event_date: '2026-10-07',
      event_week_days: 7,
      event_week_factor: 0.75,
      recovery_days: 3,
    };
    const event = evaluateChallengeDays({ ...input, rules: eventRules });
    expect(event.days[0]?.tasks[0]?.target).toBe(3750);
    const body = {
      current_weight: 70,
      target_weight: 45,
      height_cm: 175,
      start_date: '2026-10-01',
      event_date: '2027-10-01',
      event_week_days: 7,
      event_week_factor: 0.75,
      screened: false,
    };
    expect(() => safeOccasionMilestones(body)).toThrow('UNSAFE_OCCASION_TARGET');
    expect(() => safeOccasionMilestones({ ...body, target_weight: NaN })).toThrow(
      'INVALID_OCCASION',
    );
  });
  it.each(CHALLENGE_FORMATS)('scores %s from real source days and caps huge days', (format) => {
    const result = evaluateChallengeDays({
      ...input,
      rules: { ...rules, format },
      source_days: input.source_days.map((day) => ({ ...day, values: { steps: 500000 } })),
    });
    expect(result.percent).toBe(100);
    expect(result.outcome).toBe('completed');
    expect(result.days.every((day) => day.verified === false)).toBe(true);
  });
  it('uses median history, fallback activity targets and safe caps', () => {
    const metric = rules.metrics.steps;
    expect(
      personalChallengeTarget([100, 200, 300, 400, 500, 600, 10000], metric, 'default', rules),
    ).toEqual({ target: 440, based_on_history: true });
    expect(personalChallengeTarget([], metric, 'default', rules)).toEqual({
      target: 5000,
      based_on_history: false,
    });
    expect(personalChallengeTarget(Array(7).fill(100000), metric, 'default', rules).target).toBe(
      metric.max,
    );
  });
  it('handles DST local midnight and rejects invented unsafe metrics', () => {
    expect(
      challengeMidnight('2026-03-09', 'America/New_York') -
        challengeMidnight('2026-03-08', 'America/New_York'),
    ).toBe(23 * 3600000);
    expect(
      challengeMidnight('2026-11-02', 'America/New_York') -
        challengeMidnight('2026-11-01', 'America/New_York'),
    ).toBe(25 * 3600000);
    expect(() =>
      evaluateChallengeDays({ ...input, rules: { ...rules, tasks: ['calories' as never] } }),
    ).toThrow('INVALID_CHALLENGE_RULES');
  });
  it('keeps late days pending until the configured delay; frozen results ignore late sync', () => {
    const current = evaluateChallengeDays({
      ...input,
      now: new Date('2026-10-02T08:00Z'),
      source_days: [],
    });
    expect(current.days[0]?.status).toBe('pending');
    expect(current.days[1]?.status).toBe('pending');
    expect(current.days[2]?.status).toBe('upcoming');
    const missed = evaluateChallengeDays({ ...input, source_days: [] });
    const late = evaluateChallengeDays({ ...input, existing: missed.days });
    expect(late.passed).toBe(0);
    expect(late.outcome).toBe('finished');
  });
  it('checks every checklist task and weekly rhythm by eligible days', () => {
    const check = evaluateChallengeDays({
      ...input,
      rules: { ...rules, format: 'checklist', tasks: ['steps', 'water_ml'] },
      targets: { steps: 5000, water_ml: 2000 },
    });
    expect(check.passed).toBe(0);
    expect(check.percent).toBe(50);
    const rhythm = evaluateChallengeDays({
      ...input,
      rules: { ...rules, format: 'weekly_rhythm', weekly_days: 3 },
      pauses: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    });
    expect(rhythm.eligible).toBe(3);
    expect(rhythm.outcome).toBe('completed');
  });
  it('earns capped shields from finalized passes and allows explicit cover without volume scoring', () => {
    const days = input.source_days.slice(0, 2);
    const result = evaluateChallengeDays({
      ...input,
      rules: { ...rules, shield_every: 2, shield_max: 1 },
      source_days: days,
      covered: ['2026-10-04'],
    });
    expect(result.days[2]?.status).toBe('shield');
    expect(result.days[3]?.status).toBe('covered');
    expect(result.days[4]?.status).toBe('miss');
    expect(challengeTeamScore([500, 0])).toBe(50);
  });
  it('honors rest days and rejects manual contributions where not allowed', () => {
    const rest = evaluateChallengeDays({ ...input, rules: { ...rules, rest_weekdays: [0, 6] } });
    expect(rest.eligible).toBe(5);
    const manual = evaluateChallengeDays({
      ...input,
      rules: { ...rules, allow_manual: false },
      source_days: input.source_days.map((day) => ({ ...day, sources: { steps: 'manual' } })),
    });
    expect(manual.percent).toBe(0);
    expect(manual.days.every((d) => !d.verified)).toBe(true);
  });
  it('uses the existing safe-rate calculator for optional occasion goals and protects screening', () => {
    const args = {
      current_weight: 70,
      height_cm: 175,
      target_weight: 69,
      start_date: '2026-10-01',
      event_date: '2026-11-01',
      event_week_days: 7,
      event_week_factor: 0.75,
      screened: false,
    };
    expect(safeOccasionMilestones(args).at(-1)?.weight).toBe(69);
    expect(() => safeOccasionMilestones({ ...args, target_weight: 40 })).toThrow(
      'UNSAFE_OCCASION_TARGET',
    );
    expect(() => safeOccasionMilestones({ ...args, screened: true })).toThrow(
      'HEALTH_SCREENING_RESTRICTED',
    );
  });
});
