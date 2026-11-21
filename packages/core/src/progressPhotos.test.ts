import { expect, it } from 'vitest';
import { progressPhotoDelta, selectJourneyPhotos } from './progress';

it('uses the newest photo per Monday-start week or calendar month in chronological order', () => {
  const dates = ['2026-11-02', '2026-10-31', '2026-11-01', '2026-11-06'];
  const photos = dates.map((date) => ({ captured_date: date, created_at: date }));
  const inPeriod = (period: 'weekly' | 'monthly' | 'all') =>
    selectJourneyPhotos(photos, period).map((photo) => photo.captured_date);
  expect(inPeriod('weekly')).toEqual(['2026-11-01', '2026-11-06']);
  expect(inPeriod('monthly')).toEqual(['2026-10-31', '2026-11-06']);
  expect(inPeriod('all')).toEqual([...dates].sort());
});

it('compares date-only captures across a clock change and includes weight only when both have it', () => {
  const baseline = { captured_date: '2026-10-31', weight_kg: 72 };
  const current = { captured_date: '2026-11-02', weight_kg: 71 };
  expect(progressPhotoDelta(baseline, current)).toEqual({ days: 2, weightKg: -1 });
  expect(progressPhotoDelta(baseline, { ...current, weight_kg: null })).toEqual({
    days: 2,
    weightKg: null,
  });
});
