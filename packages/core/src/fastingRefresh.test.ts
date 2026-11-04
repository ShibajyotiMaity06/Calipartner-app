import { expect, it } from 'vitest';
import {
  calculateScheduledWindow,
  fastingTimeToUtc,
  fastingWindowForProtocol,
  validateFastingSettings,
  DEFAULT_FASTING_SETTINGS,
  buildFastingReminderSchedules,
} from './fasting';
import { filterRecipes } from './recipes';
import { ownerRecipeToRecipe } from './ownerRecipes';
import supplied from '../../../datasets/owner_recipes.json';
it('filters only actual high-protein/high-carb tags and Indian catalog regions without including countries', () => {
  const recipes = supplied.map((recipe) => ownerRecipeToRecipe(recipe, recipe.id));
  const indian = filterRecipes(recipes, { cuisine_group: 'indian' });
  expect(indian).toHaveLength(197);
  expect(
    indian.every((recipe) => ['North', 'South', 'East', 'West'].includes(recipe.cuisine)),
  ).toBe(true);
  for (const focus of ['high-protein', 'high-carb']) {
    const results = filterRecipes(recipes, { nutrition_focus: focus, cuisine_group: 'indian' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((recipe) => recipe.nutrition_focus?.includes(focus))).toBe(true);
  }
});
it('uses the stored local clock, overnight windows and DST-correct next transitions', () => {
  const local = calculateScheduledWindow({
    eatingWindowStart: '12:00',
    eatingWindowEnd: '20:00',
    timezone: 'Asia/Kolkata',
    referenceTime: '2026-11-03T08:00:00Z',
  });
  expect(local.isEatingWindow).toBe(true);
  expect(local.nextEatingWindowEnd).toBe('2026-11-03T14:30:00.000Z');
  const dst = calculateScheduledWindow({
    eatingWindowStart: '12:00',
    eatingWindowEnd: '20:00',
    timezone: 'America/New_York',
    referenceTime: '2026-10-31T23:00:00Z',
  });
  expect(dst.nextFastingWindowStart).toBe('2026-11-01T00:00:00.000Z');
  expect(dst.nextFastingWindowEnd).toBe('2026-11-01T17:00:00.000Z');
  expect(
    calculateScheduledWindow({
      eatingWindowStart: '20:00',
      eatingWindowEnd: '02:00',
      timezone: 'Asia/Kolkata',
      referenceTime: '2026-11-03T19:30:00Z',
    }).isEatingWindow,
  ).toBe(true);
  expect(fastingTimeToUtc('2026-11-03', '09:30', 'Asia/Kolkata').toISOString()).toBe(
    '2026-11-03T04:00:00.000Z',
  );
});
it('keeps supported protocols aligned and rejects invalid or over-20h planned windows', () => {
  expect(fastingWindowForProtocol('18:6')).toEqual({ start: '14:00', end: '20:00' });
  expect(
    validateFastingSettings({ ...DEFAULT_FASTING_SETTINGS, eating_window_start: '25:00' }),
  ).toBe(false);
  expect(
    validateFastingSettings({ ...DEFAULT_FASTING_SETTINGS, eating_window_start: '18:00' }),
  ).toBe(false);
  expect(
    validateFastingSettings({
      ...DEFAULT_FASTING_SETTINGS,
      protocol: 'custom',
      custom_fasting_hours: 21,
    }),
  ).toBe(false);
  expect(
    validateFastingSettings({
      ...DEFAULT_FASTING_SETTINGS,
      protocol: 'custom',
      custom_fasting_hours: 18,
      eating_window_start: '14:00',
    }),
  ).toBe(true);
});
it('schedules start and closing reminders, respects quiet hours and routes to fasting', () => {
  const all = buildFastingReminderSchedules({
    settings: { ...DEFAULT_FASTING_SETTINGS, user_id: 'owner', enabled: true },
  });
  expect(all.map((item) => item.id)).toContain('fasting_start');
  expect(all.every((item) => item.data?.url === '/fasting')).toBe(true);
  const quiet = buildFastingReminderSchedules({
    settings: { ...DEFAULT_FASTING_SETTINGS, user_id: 'owner', enabled: true },
    quietHoursSettings: { enabled: true, start: '19:00', end: '21:00' },
  });
  expect(quiet).toHaveLength(0);
});
