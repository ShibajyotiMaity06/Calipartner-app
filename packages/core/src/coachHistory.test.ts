import { describe, expect, it } from 'vitest';
import { coachHistoryWindow } from './coachHistory';
import { getMealSectionForTime } from './food';
describe('Coach diary context windows', () => {
  it('resolves yesterday across a month boundary without using the machine time zone', () => {
    expect(coachHistoryWindow('2026-11-01', 'What did I eat yesterday?')).toEqual({
      start: '2026-10-31',
      end: '2026-10-31',
    });
  });
  it('looks up an explicitly requested historical day and caps a range at 90 days', () => {
    expect(coachHistoryWindow('2026-11-03', 'My workouts on 2025-05-12')).toEqual({
      start: '2025-05-12',
      end: '2025-05-12',
    });
    expect(coachHistoryWindow('2026-11-03', 'From 2020-01-01 to 2026-11-03')).toEqual({
      start: '2026-08-06',
      end: '2026-11-03',
    });
  });
  it('rejects invalid/future dates and supports week/month/90-day questions', () => {
    expect(coachHistoryWindow('2026-11-03', '2026-02-30 or 2027-01-01')).toEqual({
      start: '2026-10-28',
      end: '2026-11-03',
    });
    expect(coachHistoryWindow('2026-11-03', 'My week')).toEqual({
      start: '2026-10-28',
      end: '2026-11-03',
    });
    expect(coachHistoryWindow('2026-11-03', 'My 90 days')).toEqual({
      start: '2026-08-06',
      end: '2026-11-03',
    });
  });
});
describe('Local breakfast prompt', () => {
  it('uses breakfast at 9am in both New York and India regardless of UTC hour', () => {
    expect(getMealSectionForTime('2026-11-03T14:00:00Z', 'America/New_York')).toBe('breakfast');
    expect(getMealSectionForTime('2026-11-03T03:30:00Z', 'Asia/Kolkata')).toBe('breakfast');
  });
});
