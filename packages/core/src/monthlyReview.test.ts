import { describe, expect, it } from 'vitest';
import { isMonthlyReviewDue, nextMonthlyReviewAt } from './monthlyReview';
import type { Entitlement } from './types';

describe('monthly plan check-ins', () => {
  it('clamps January 31 to February 28 and preserves UTC time', () => {
    expect(nextMonthlyReviewAt('2027-01-31T12:30:00Z')?.toISOString()).toBe(
      '2027-02-28T12:30:00.000Z',
    );
    expect(nextMonthlyReviewAt('2028-01-31T12:30:00Z')?.toISOString()).toBe(
      '2028-02-29T12:30:00.000Z',
    );
  });
  it('prompts only active Pro members at or after the monthly deadline', () => {
    const pro = { tier: 'pro', status: 'paid', period_end: '2027-12-01T00:00:00Z' } as Entitlement;
    expect(isMonthlyReviewDue('2027-01-31T12:30:00Z', pro, new Date('2027-02-28T12:29:59Z'))).toBe(
      false,
    );
    expect(isMonthlyReviewDue('2027-01-31T12:30:00Z', pro, new Date('2027-02-28T12:30:00Z'))).toBe(
      true,
    );
    expect(
      isMonthlyReviewDue('2027-01-31T12:30:00Z', { ...pro, tier: 'plus' }, new Date('2027-03-01')),
    ).toBe(false);
    expect(
      isMonthlyReviewDue(
        '2027-01-31T12:30:00Z',
        { ...pro, status: 'lapsed' },
        new Date('2027-03-01'),
      ),
    ).toBe(false);
    expect(isMonthlyReviewDue('bad date', pro, new Date('2027-03-01'))).toBe(false);
  });
});
