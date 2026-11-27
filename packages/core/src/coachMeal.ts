import type { MealSection, NutrientSnapshot } from './types';

export interface CoachCardPoint {
  kind: 'positive' | 'note';
  lead: string;
  detail?: string;
}
export interface CoachCardAction {
  label: string;
  prompt: string;
  primary?: boolean;
}
export interface CoachStructuredCard {
  eyebrow?: string;
  points: CoachCardPoint[];
  actions?: CoachCardAction[];
}
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
function parseStructuredCard(value: unknown): CoachStructuredCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.points) || !raw.points.length) return null;
  const points: CoachCardPoint[] = [];
  for (const item of raw.points.slice(0, 6)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const lead = typeof rec.lead === 'string' ? rec.lead.trim().slice(0, 120) : '';
    if (!lead) continue;
    const detail = typeof rec.detail === 'string' ? rec.detail.trim().slice(0, 160) : '';
    const kind = rec.kind === 'positive' ? 'positive' : 'note';
    points.push(detail ? { kind, lead, detail } : { kind, lead });
  }
  if (!points.length) return null;
  const eyebrow = typeof raw.eyebrow === 'string' ? raw.eyebrow.trim().slice(0, 48) : undefined;
  const actions: CoachCardAction[] = [];
  if (Array.isArray(raw.actions)) {
    for (const act of raw.actions.slice(0, 3)) {
      if (!act || typeof act !== 'object' || Array.isArray(act)) continue;
      const rec = act as Record<string, unknown>;
      const label = typeof rec.label === 'string' ? rec.label.trim().slice(0, 40) : '';
      const prompt = typeof rec.prompt === 'string' ? rec.prompt.trim().slice(0, 200) : '';
      if (!label || !prompt) continue;
      actions.push({ label, prompt, ...(rec.primary === true ? { primary: true } : {}) });
    }
  }
  return {
    ...(eyebrow ? { eyebrow } : {}),
    points,
    ...(actions.length ? { actions } : {}),
  };
}
function parseQuickReplies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const clean = entry.trim().slice(0, 40);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= 4) break;
  }
  return out;
}
/** The provider proposes a draft; it can never perform a save. Incomplete meals have no action. */
export function parseCoachMealReply(
  output: string,
  localDate: string,
): {
  content: string;
  mealDraft: CoachMealDraft | null;
  card: CoachStructuredCard | null;
  quickReplies: string[];
} {
  const fence = String.fromCharCode(96).repeat(3);
  let source = output.trim();
  if (source.startsWith(fence) && source.endsWith(fence))
    source = source
      .slice(fence.length, -fence.length)
      .replace(/^json\s*/i, '')
      .trim();
  const raw = object(JSON.parse(source));
  const content = text(raw.content, 6000);
  const card = parseStructuredCard(raw.card);
  const quickReplies = parseQuickReplies(raw.quick_replies ?? raw.quickReplies);
  if (raw.meal == null) return { content, mealDraft: null, card, quickReplies };
  const meal = object(raw.meal);
  if (meal.status === 'needs_details' || meal.status === 'needs_section')
    return { content, mealDraft: null, card, quickReplies };
  if (meal.status !== 'ready' || meal.detailsConfirmed !== true || meal.sectionConfirmed !== true)
    throw new Error('INVALID_COACH_MEAL');
  return {
    content,
    mealDraft: validateCoachMealDraft({ ...meal, localDate }),
    card,
    quickReplies,
  };
}

export const coachMealInstructions = [
  'Return ONLY a JSON object {"content":"plain text answer","meal":null} (you may also include optional "card" and "quick_replies" fields when helpful).',
  'When giving meal feedback, macro review, or weekly analysis, you may include "card":{"eyebrow":"OPTIONAL LABEL","points":[{"kind":"positive"|"note","lead":"Short metric or headline","detail":"concise actionable note"}],"actions":[{"label":"2-3 word action","prompt":"Full prompt when tapped","primary":true}]} so the user gets scannable takeaways.',
  'You may also include up to 3 short follow-up suggestions in "quick_replies":["Swap the rice","More protein","Lighter option"] when relevant.',
  'When the user asks for a meal idea or says "Plan my breakfast/lunch/dinner/snack", suggest one concrete meal matching their calorie/macro targets AND return a ready meal draft with "detailsConfirmed":true,"sectionConfirmed":true using the requested section and clear meal idea label in content ("AI estimate").',
  'When the user says they ate/drank food or asks to log what they ate, prepare a meal draft by confirming portions and section first.',
  'Read all user messages in this conversation before asking anything. A meal section already supplied by the user remains confirmed while portions are clarified. If the first message provides foods, clear portions and a meal section, return the ready draft immediately.',
  'First ask which foods, their amounts/portions, and relevant preparation/oil/sauce details if unclear.',
  'Never assume missing portions or replace unknown food with an invented catalog match.',
  'Use meal {"status":"needs_details"} while clarification is needed; ask a concise specific question in content.',
  'Once foods and portions are clear, ask whether this was breakfast, lunch, dinner, snacks or extra.',
  'Use meal {"status":"needs_section"} until the USER explicitly supplies the meal section; never infer it from the clock.',
  'Only after both steps, return meal {"status":"ready","detailsConfirmed":true,"sectionConfirmed":true,"description":"foods and portions","mealSection":"lunch","items":[{"name":"food and preparation","quantity":1,"unit":"bowl","calories":250,"protein":10,"carbs":35,"fat":8,"fiber":3,"sugar":2,"sodium_mg":200}]}.',
  'Use the actual amounts/nutrition estimates for the whole stated portion of EACH item, not per 100g.',
  'Values must be finite and nonnegative. Include every nutrient field and at most 20 foods.',
  'Food estimates are uncertain: label them estimates, do not claim exact measurements or medical benefits.',
  'When the user asks to log or says yes after a complete meal discussion, return the ready draft. Do not just describe a button or say you cannot log; the app supplies that action.',
  'The app shows a Log button after this reply. Never say a meal was saved or logged.',
  'Your output cannot write to the diary. Only the user pressing the button can save it.',
  'When the user corrects food/portions/section, revise the draft; do not repeat a previously logged meal unless explicitly asked.',
  'Drafts are for today. If another day is requested, ask the user to use the dated food diary.',
].join('\n');
