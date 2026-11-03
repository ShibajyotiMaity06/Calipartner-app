import type { MealSection, NutrientSnapshot } from './types';

export interface CoachMealItem extends NutrientSnapshot {
  name: string;
  quantity: number;
  unit: string;
}
export interface CoachMealDraft {
  description: string;
  mealSection: MealSection;
  localDate: string;
  items: CoachMealItem[];
}
const sections = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'] as const;
const limits = {
  calories: 10000,
  protein: 2000,
  carbs: 2000,
  fat: 2000,
  fiber: 1000,
  sugar: 2000,
  sodium_mg: 99000,
} as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_COACH_MEAL');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('INVALID_COACH_MEAL');
  return value.trim();
}
export function validateCoachMealDraft(value: unknown): CoachMealDraft {
  const raw = object(value);
  const description = text(raw.description, 1000);
  if (!sections.includes(raw.mealSection as MealSection)) throw new Error('INVALID_COACH_MEAL');
  const localDate = text(raw.localDate, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
    new Date(localDate + 'T12:00:00Z').toISOString().slice(0, 10) !== localDate
  )
    throw new Error('INVALID_COACH_MEAL');
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 20)
    throw new Error('INVALID_COACH_MEAL');
  const items = raw.items.map((value): CoachMealItem => {
    const item = object(value);
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    )
      throw new Error('INVALID_COACH_MEAL');
    const nutrients = {} as NutrientSnapshot;
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      const number = item[key];
      if (
        typeof number !== 'number' ||
        !Number.isFinite(number) ||
        number < 0 ||
        number > limits[key]
      )
        throw new Error('INVALID_COACH_MEAL');
      nutrients[key] = number;
    }
    if (nutrients.calories === 0 && nutrients.protein + nutrients.carbs + nutrients.fat > 0)
      throw new Error('INVALID_COACH_MEAL');
    return {
      name: text(item.name, 200),
      unit: text(item.unit, 40),
      quantity: item.quantity,
      ...nutrients,
    };
  });
  return { description, mealSection: raw.mealSection as MealSection, localDate, items };
}
/** The provider proposes a draft; it can never perform a save. Incomplete meals have no action. */
export function parseCoachMealReply(
  output: string,
  localDate: string,
): { content: string; mealDraft: CoachMealDraft | null } {
  const fence = String.fromCharCode(96).repeat(3);
  let source = output.trim();
  if (source.startsWith(fence) && source.endsWith(fence))
    source = source
      .slice(fence.length, -fence.length)
      .replace(/^json\s*/i, '')
      .trim();
  const raw = object(JSON.parse(source));
  const content = text(raw.content, 6000);
  if (raw.meal == null) return { content, mealDraft: null };
  const meal = object(raw.meal);
  if (meal.status === 'needs_details' || meal.status === 'needs_section')
    return { content, mealDraft: null };
  if (meal.status !== 'ready' || meal.detailsConfirmed !== true || meal.sectionConfirmed !== true)
    throw new Error('INVALID_COACH_MEAL');
  return { content, mealDraft: validateCoachMealDraft({ ...meal, localDate }) };
}

export const coachMealInstructions = [
  'Return ONLY a JSON object {"content":"plain text answer","meal":null} for normal coaching.',
  'When the user says they ate/drank food or asks to log a meal, prepare a meal draft.',
  'First ask which foods, their amounts/portions, and relevant preparation/oil/sauce details if unclear.',
  'Never assume missing portions or replace unknown food with an invented catalog match.',
  'Use meal {"status":"needs_details"} while clarification is needed; ask a concise specific question in content.',
  'Once foods and portions are clear, ask whether this was breakfast, lunch, dinner, snacks or extra.',
  'Use meal {"status":"needs_section"} until the USER explicitly supplies the meal section; never infer it from the clock.',
  'Only after both steps, return meal {"status":"ready","detailsConfirmed":true,"sectionConfirmed":true,"description":"foods and portions","mealSection":"lunch","items":[{"name":"food and preparation","quantity":1,"unit":"bowl","calories":250,"protein":10,"carbs":35,"fat":8,"fiber":3,"sugar":2,"sodium_mg":200}]}.',
  'Use the actual amounts/nutrition estimates for the whole stated portion of EACH item, not per 100g.',
  'Values must be finite and nonnegative. Include every nutrient field and at most 20 foods.',
  'Food estimates are uncertain: label them estimates, do not claim exact measurements or medical benefits.',
  'The app shows a Log button after this reply. Never say a meal was saved or logged.',
  'Your output cannot write to the diary. Only the user pressing the button can save it.',
  'When the user corrects food/portions/section, revise the draft; do not repeat a previously logged meal unless explicitly asked.',
  'Drafts are for today. If another day is requested, ask the user to use the dated food diary.',
].join('\n');
