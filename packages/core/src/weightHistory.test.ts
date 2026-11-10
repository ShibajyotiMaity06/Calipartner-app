import { describe, expect, it } from 'vitest';
import { isValidWeightDate, weeklyWeightHistory, weightChange } from './weightHistory';
import type { WeightLog } from './types';

const entry = (date: string, kg = 80): WeightLog => ({
  id: date,
  user_id: 'owner',
  weight_kg: kg,
  local_date: date,
  logged_at: date + 'T12:00:00Z',
  created_at: date,
  updated_at: date,
  deleted_at: null,
  notes: null,
});
describe('weight history', () => {
  it('rejects future days and invalid calendar dates and accepts the stored-zone current day', () => {
    expect(isValidWeightDate('2026-11-10', '2026-11-09')).toBe(false);
    expect(isValidWeightDate('2026-02-30', '2026-11-09')).toBe(false);
    expect(isValidWeightDate('2026-11-09', '2026-11-09')).toBe(true);
  });
  it('uses actual weekly anchors or the closest earlier weigh-in without filling missing weeks', () => {
    const rows = ['2026-11-09', '2026-11-08', '2026-11-01', '2026-10-25', '2026-09-01'].map((d) =>
      entry(d),
    );
    expect(weeklyWeightHistory(rows, '2026-11-09').map((row) => row.local_date)).toEqual([
      '2026-11-09',
      '2026-11-01',
      '2026-10-25',
      '2026-09-01',
    ]);
  });
  it('caps at three calendar years, excludes future/deleted entries and never invents a longer history', () => {
    const rows = [
      entry('2023-11-09'),
      entry('2023-11-08'),
      entry('2026-11-10'),
      { ...entry('2026-11-09'), deleted_at: 'now' },
    ];
    expect(weeklyWeightHistory(rows, '2026-11-09').map((row) => row.local_date)).toEqual([
      '2023-11-09',
    ]);
    expect(weeklyWeightHistory([entry('2026-11-09')], '2026-11-09')).toHaveLength(1);
  });
  it('compares the latest weigh-in against the preserved starting baseline', () => {
    expect(weightChange(79, 80)).toBe(-1);
    expect(weightChange(81, 80)).toBe(1);
    expect(weightChange(null, 80)).toBeNull();
  });
});
