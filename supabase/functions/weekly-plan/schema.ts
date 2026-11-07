import { PLAN_EQUIPMENT } from '@calipartner/core';

// Groq strict structured output constrains JSON shape; core still checks safety and arithmetic.
const string = { type: 'string' };
const integer = { type: 'integer' };
const number = { type: 'number' };
const array = (items: unknown) => ({ type: 'array', items });
const object = <T extends Record<string, unknown>>(properties: T) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const mealProperties = {
  name: string,
  ingredients: array(string),
  portion: string,
  protein: { ...number, minimum: 0, maximum: 200 },
  carbs: { ...number, minimum: 0, maximum: 400 },
  fat: { ...number, minimum: 0, maximum: 150 },
  calories: { ...number, minimum: 50, maximum: 3000 },
};
const planSchema = (singleDay: boolean) =>
  object({
    days: {
      ...array(
        object({
          day: { ...integer, enum: singleDay ? [0] : [0, 1, 2, 3, 4, 5, 6] },
          workout: object({
            title: string,
            minutes: integer,
            exercises: array(
              object({
                name: string,
                equipment: { type: 'string', enum: [...PLAN_EQUIPMENT] },
                sets: { ...integer, minimum: 1, maximum: 5 },
                reps: { ...integer, minimum: 5, maximum: 30 },
                rest_seconds: { ...integer, minimum: 30, maximum: 180 },
              }),
            ),
          }),
          meals: {
            ...array(
              object({
                ...mealProperties,
                ...(singleDay
                  ? {
                      section: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
                    }
                  : {}),
              }),
            ),
            minItems: singleDay ? 4 : 3,
            maxItems: singleDay ? 4 : 5,
          },
        }),
      ),
      minItems: singleDay ? 1 : 7,
      maxItems: singleDay ? 1 : 7,
    },
    workout_tips: array(string),
    diet_tips: array(string),
  });

export const weeklyPlanSchema = planSchema(false);

export function weeklyPlanResponseFormat(provider: string, model: string, singleDay = false) {
  return provider === 'groq' &&
    [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'meta-models/muse-spark-open',
    ].includes(model)
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'weekly_plan',
          strict: true,
          schema: singleDay ? planSchema(true) : weeklyPlanSchema,
        },
      }
    : { type: 'json_object' };
}
