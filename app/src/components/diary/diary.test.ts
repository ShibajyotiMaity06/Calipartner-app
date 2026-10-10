import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';

describe('Diary UI Calculations and Formatting', () => {
  it('formats calorie remaining vs over correctly', () => {
    const target = 2000;
    const eatenUnder = 1600;
    const remaining = Math.max(0, target - eatenUnder);
    expect(remaining).toBe(400);

    const eatenOver = 2300;
    const over = eatenOver - target;
    expect(over).toBe(300);
  });

  it('computes macro bar fill percentages accurately', () => {
    const computePercent = (current: number, target: number) =>
      target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    expect(computePercent(70, 140)).toBe(50);
    expect(computePercent(140, 140)).toBe(100);
    expect(computePercent(200, 140)).toBe(100); // capped at 100%
    expect(computePercent(0, 140)).toBe(0);
    expect(computePercent(50, 0)).toBe(0);
  });

  it('verifies all 5 diary meal section translation keys exist', () => {
    expect(en.diary.sections.breakfast).toBe('Breakfast');
    expect(en.diary.sections.lunch).toBe('Lunch');
    expect(en.diary.sections.dinner).toBe('Dinner');
    expect(en.diary.sections.snacks).toBe('Snacks');
    expect(en.diary.sections.extra).toBe('Extra');
  });

  it('verifies all food log tab labels are present', () => {
    expect(en.foodLog.tabs.search).toBe('Search');
    expect(en.foodLog.tabs.scan).toBe('Scan');
    expect(en.foodLog.tabs.photo).toBe('Photo');
    expect(en.foodLog.tabs.history).toBe('History');
    expect(en.foodLog.tabs.myFoods).toBe('My Foods');
  });
});
