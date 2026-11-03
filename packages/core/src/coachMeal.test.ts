import { describe, expect, it } from 'vitest';
import { parseCoachMealReply, validateCoachMealDraft } from './coachMeal';
const item = {
  name: 'Boiled eggs',
  quantity: 2,
  unit: 'eggs',
  calories: 156,
  protein: 13,
  carbs: 1,
  fat: 11,
  fiber: 0,
  sugar: 0,
  sodium_mg: 124,
};
const meal = {
  status: 'ready',
  description: '2 boiled eggs',
  mealSection: 'lunch',
  detailsConfirmed: true,
  sectionConfirmed: true,
  items: [item],
};
describe('Confirmed coach meal drafts', () => {
  it('accepts a JSON fence without accepting incomplete meal content', () => {
    const fence = String.fromCharCode(96).repeat(3);
    expect(
      parseCoachMealReply(
        fence + 'json\n' + JSON.stringify({ content: 'Estimate', meal }) + '\n' + fence,
        '2026-11-03',
      ).mealDraft?.items,
    ).toHaveLength(1);
  });
  it.each(['needs_details', 'needs_section'])('withholds logging while %s', (status) => {
    const result = parseCoachMealReply(
      JSON.stringify({ content: 'Which portion or meal section?', meal: { status } }),
      '2026-11-03',
    );
    expect(result.mealDraft).toBeNull();
  });
  it('requires explicit detail and section confirmation before returning a draft', () => {
    for (const patch of [
      { detailsConfirmed: false },
      { sectionConfirmed: false },
      { mealSection: 'unknown' },
    ]) {
      expect(() =>
        parseCoachMealReply(
          JSON.stringify({ content: 'Estimate', meal: { ...meal, ...patch } }),
          '2026-11-03',
        ),
      ).toThrow();
    }
    expect(
      parseCoachMealReply(
        JSON.stringify({ content: 'Estimated meal. Review before logging.', meal }),
        '2026-11-03',
      ).mealDraft,
    ).toMatchObject({ localDate: '2026-11-03', items: [item] });
  });
  it.each([NaN, Infinity, -1, 100001])(
    'rejects invalid nutrition %s instead of enabling a log action',
    (calories) => {
      expect(() =>
        validateCoachMealDraft({
          ...meal,
          localDate: '2026-11-03',
          items: [{ ...item, calories }],
        }),
      ).toThrow();
    },
  );
  it('rejects missing portions, absent foods, invalid dates and absent nutrition', () => {
    for (const patch of [
      { items: [] },
      { items: [{ ...item, quantity: 0 }] },
      { items: [{ name: 'Food' }] },
      { localDate: '2026-02-30' },
    ]) {
      expect(() =>
        validateCoachMealDraft({ ...meal, localDate: '2026-11-03', ...patch }),
      ).toThrow();
    }
  });
});
