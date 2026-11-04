import { PLAN_EQUIPMENT } from '@calipartner/core';

// Groq strict structured output constrains JSON shape; core still checks safety and arithmetic.
const string = { type: 'string' };
const integer = { type: 'integer' };
const number = { type: 'number' };
const array = (items: unknown) => ({ type: 'array', items });
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const weeklyPlanSchema = object({
  days: array(
    object({
      day: integer,
      workout: object({
        title: string,
        minutes: integer,
        exercises: array(
          object({
            name: string,
            equipment: { type: 'string', enum: [...PLAN_EQUIPMENT] },
            sets: integer,
            reps: integer,
            rest_seconds: integer,
          }),
        ),
      }),
      meals: array(
        object({
          name: string,
          ingredients: array(string),
          portion: string,
          calories: number,
          protein: number,
          carbs: number,
          fat: number,
        }),
      ),
    }),
  ),
  workout_tips: array(string),
  diet_tips: array(string),
});

export function weeklyPlanResponseFormat(provider: string, model: string) {
  return provider === 'groq' &&
    [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'meta-models/muse-spark-open',
    ].includes(model)
    ? {
        type: 'json_schema',
        json_schema: { name: 'weekly_plan', strict: true, schema: weeklyPlanSchema },
      }
    : { type: 'json_object' };
}
