import { expect, it } from 'vitest';
import { cardioGoalReached, estimateOutdoorCardioCalories, paceForSpeed, speedKmh } from './cardio';

it('converts speed into pace without displaying sixty seconds', () => {
  expect(speedKmh(5, 1800)).toBe(10);
  expect(paceForSpeed(3600 / 359.9)).toEqual({ minutes: 6, seconds: 0 });
  expect(speedKmh(5, 0)).toBeNull();
  expect(paceForSpeed(0)).toBeNull();
});

it('estimates running and cycling calories from the measured session and known weight', () => {
  expect(estimateOutdoorCardioCalories('running', 70, 5, 1800)).toBe(363);
  expect(estimateOutdoorCardioCalories('cycling', 70, 20, 3600)).toBe(588);
  expect(estimateOutdoorCardioCalories('cycling', 0, 20, 3600)).toBeNull();
});

it('checks an exact target using metres for GPS sessions and steps for walks', () => {
  const run = {
    mode: 'running' as const,
    distance_m: 999,
    duration_seconds: 300,
    step_count: null,
    target: 1000,
    estimated_calories: null,
  };
  expect(cardioGoalReached(run)).toBe(false);
  expect(cardioGoalReached({ ...run, distance_m: 1000 })).toBe(true);
  expect(cardioGoalReached({ ...run, mode: 'steps', step_count: 1000, distance_m: null })).toBe(
    true,
  );
});
