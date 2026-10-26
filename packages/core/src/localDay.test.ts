import { describe, expect, it } from 'vitest';
import { getCalendarWeek, getLocalDayBounds, formatCalendarDate } from './localDay';
describe('calendar days use the user time zone', () => {
  it.each([
    ['2026-03-08', 'America/New_York', '2026-03-08T05:00:00.000Z', 23],
    ['2026-11-01', 'America/New_York', '2026-11-01T04:00:00.000Z', 25],
    ['2026-10-26', 'Asia/Kolkata', '2026-10-25T18:30:00.000Z', 24],
    ['2026-10-26', 'Pacific/Kiritimati', '2026-10-25T10:00:00.000Z', 24],
  ])('queries the actual local day for %s in %s', (day, zone, start, hours) => {
    const range = getLocalDayBounds(day, zone);
    expect(range.start.toISOString()).toBe(start);
    expect(range.end.getTime() - range.start.getTime()).toBe(Number(hours) * 3600000);
  });
  it('uses real Monday–Sunday dates across month and year boundaries', () => {
    expect(getCalendarWeek('2027-01-01')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(formatCalendarDate('2026-10-26')).toContain('26 Oct 2026');
  });
  it('rejects invalid dates and time zones', () => {
    expect(() => getLocalDayBounds('2026-02-31', 'UTC')).toThrow();
    expect(() => getLocalDayBounds('2026-10-26', 'bad-zone')).toThrow();
  });
});
