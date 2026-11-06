import { describe, expect, it } from 'vitest';
import { projectWeightPaths, type WeightProjectionInput } from './weightProjection';
const input: WeightProjectionInput = {
  weight: 80,
  height: 180,
  sex: 'male',
  gymDays: 3,
  tdee: 2500,
  calories: 2000,
  goal: 'cut',
  rate: 0.5,
  targetWeight: 74,
};
describe('illustrative weight trajectories', () => {
  it('is deterministic, starts at actual weight and does not invent a Plus metabolic advantage', () => {
    const paths = projectWeightPaths(input);
    expect(paths).toEqual(projectWeightPaths(input));
    expect(paths).toHaveLength(3);
    expect(paths[0]!.points).toEqual(paths[1]!.points);
    for (const path of paths) {
      expect(path.points).toHaveLength(13);
      expect(path.points[0]).toEqual({ week: 0, weight: 80 });
    }
  });
  it('keeps all tiers identical until the first accepted-review assumption', () => {
    const paths = projectWeightPaths(input);
    expect(paths[0]!.points.slice(0, 5)).toEqual(paths[2]!.points.slice(0, 5));
  });
  it('shows sensitivity instead of guaranteeing any tier result', () => {
    const lower = projectWeightPaths({ ...input, maintenanceBias: -0.1 }),
      higher = projectWeightPaths({ ...input, maintenanceBias: 0.1 });
    expect(lower[0]!.points.at(-1)!.weight).toBeGreaterThan(higher[0]!.points.at(-1)!.weight);
  });
  it('stops at the goal, handles gain and maintenance, and never forecasts below the BMI floor', () => {
    for (const path of projectWeightPaths({ ...input, targetWeight: 79 }))
      expect(path.points.at(-1)!.weight).toBe(79);
    for (const path of projectWeightPaths({
      ...input,
      calories: 2500,
      goal: 'maintain',
      rate: 0,
      targetWeight: null,
    }))
      expect(path.points.at(-1)!.weight).toBe(80);
    for (const path of projectWeightPaths({
      ...input,
      calories: 2800,
      goal: 'bulk',
      targetWeight: 82,
    }))
      expect(path.points.at(-1)!.weight).toBeGreaterThan(80);
    for (const path of projectWeightPaths({
      ...input,
      weight: 61,
      calories: 1500,
      targetWeight: null,
    }))
      expect(path.points.at(-1)!.weight).toBeGreaterThanOrEqual(59.93);
  });
  it.each([{ weight: NaN }, { tdee: 0 }, { maintenanceBias: 0.5 }, { gymDays: 9 }])(
    'rejects invalid input %j',
    (patch) =>
      expect(() => projectWeightPaths({ ...input, ...patch })).toThrow('INVALID_PROJECTION'),
  );
});
