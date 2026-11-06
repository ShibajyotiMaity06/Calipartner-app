import { describe, expect, it } from 'vitest';
import { plannedMealSection, weeklyGroceryItems, type PlanDay } from './weeklyPlan';
import { squadTogetherProgress } from './squad';
import { cardioSessionMetrics } from './workouts';

describe('weekly habit shortcuts', () => {
  it('keeps cardio duration and distance in canonical set units', () => {
    expect(cardioSessionMetrics(30, 12.5)).toEqual({
      durationSeconds: 1800,
      distanceMeters: 12500,
    });
    expect(() => cardioSessionMetrics(30, -1)).toThrow('INVALID_CARDIO_SESSION');
    expect(() => cardioSessionMetrics(Number.NaN, 1)).toThrow('INVALID_CARDIO_SESSION');
  });
  it('uses explicit labels before food heuristics and falls back for ambiguous dishes', () => {
    expect(plannedMealSection('Lunch chicken curry', 'snacks')).toBe('lunch');
    expect(plannedMealSection('Oats and fruit', 'snacks')).toBe('breakfast');
    expect(plannedMealSection('Tofu wrap', 'breakfast')).toBe('lunch');
    expect(plannedMealSection('Rice curry', 'snacks')).toBe('dinner');
    expect(plannedMealSection('Yogurt', 'snacks')).toBe('snacks');
  });
  it('normalizes duplicates without inventing or merging ingredient quantities', () => {
    const day = (ingredients: string[]) => ({ meals: [{ ingredients }] }) as PlanDay;
    expect(
      weeklyGroceryItems([
        day([' Olive  oil ', 'Rice 100 g', '']),
        day(['olive oil', 'rice 100 g', 'Rice 200 g']),
      ]),
    ).toEqual(['Olive oil', 'Rice 100 g', 'Rice 200 g']);
  });
  it('handles an empty plan', () => expect(weeklyGroceryItems([])).toEqual([]));
  it('combines percentages of individual goals without counting missing goals as zero', () => {
    expect(squadTogetherProgress([{ score: 100 }, { score: 50 }, { score: null }])).toEqual({
      percent: 75,
      available: 2,
      total: 3,
    });
    expect(squadTogetherProgress([{ score: null }]).percent).toBeNull();
    expect(squadTogetherProgress([]).percent).toBeNull();
    expect(squadTogetherProgress([{ score: 150 }, { score: 0 }]).percent).toBe(50);
  });
});
