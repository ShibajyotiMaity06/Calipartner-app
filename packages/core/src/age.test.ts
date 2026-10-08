import { describe, expect, it } from 'vitest';
import { calculateAge, isAtLeast18 } from './age';

describe('calculateAge and isAtLeast18', () => {
  const refDate = new Date('2026-10-07T00:00:00Z');

  it('accurately calculates age on exact birthday', () => {
    // Born on 2008-10-07 -> exactly 18 on 2026-10-07
    expect(calculateAge('2008-10-07', refDate)).toBe(18);
    expect(isAtLeast18('2008-10-07', refDate)).toBe(true);
  });

  it('rejects a person one day shy of 18th birthday', () => {
    // Born on 2008-10-08 -> 17 on 2026-10-07
    expect(calculateAge('2008-10-08', refDate)).toBe(17);
    expect(isAtLeast18('2008-10-08', refDate)).toBe(false);
  });

  it('accepts adults older than 18', () => {
    expect(calculateAge('2000-01-01', refDate)).toBe(26);
    expect(isAtLeast18('2000-01-01', refDate)).toBe(true);
  });

  it('rejects younger minors (e.g. 15 years old)', () => {
    expect(calculateAge('2011-05-15', refDate)).toBe(15);
    expect(isAtLeast18('2011-05-15', refDate)).toBe(false);
  });

  it('handles invalid date strings safely', () => {
    expect(calculateAge('invalid-date', refDate)).toBe(-1);
    expect(isAtLeast18('invalid-date', refDate)).toBe(false);
  });

  it('handles leap day birthdays correctly', () => {
    // Born on leap day 2004-02-29, reference date 2022-02-28 (17) vs 2022-03-01 (18)
    const refFeb28 = new Date('2022-02-28T00:00:00Z');
    const refMar01 = new Date('2022-03-01T00:00:00Z');
    expect(calculateAge('2004-02-29', refFeb28)).toBe(17);
    expect(isAtLeast18('2004-02-29', refFeb28)).toBe(false);
    expect(calculateAge('2004-02-29', refMar01)).toBe(18);
    expect(isAtLeast18('2004-02-29', refMar01)).toBe(true);
  });
});
