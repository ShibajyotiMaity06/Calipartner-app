import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { mapUsdaFoodItem } from '@calipartner/core';

/** Verify the caller owns an affected log, then match exact upstream nutrition, never food-name guesses. */
export async function recoverFoodEnergy(
  req: Request,
  admin: SupabaseClient,
  foodId: string,
  remoteFetch: typeof fetch,
): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !/^[0-9a-f-]{36}$/i.test(foodId)) throw new Error('UNAUTHENTICATED');
  const auth = await admin.auth.getUser(token);
  if (auth.error || !auth.data.user) throw new Error('UNAUTHENTICATED');
  const owned = await admin
    .from('food_entries')
    .select('id')
    .eq('user_id', auth.data.user.id)
    .eq('food_id', foodId)
    .is('deleted_at', null)
    .limit(1);
  if (owned.error || !owned.data?.length) throw new Error('NOT_AUTHORIZED');
  const result = await admin
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .is('owner_id', null)
    .is('deleted_at', null)
    .maybeSingle();
  const food = result.data;
  if (result.error || !food) throw new Error('FOOD_UNAVAILABLE');
  let calories = Number(food.calories_per_100g);
  if (!calories && food.source === 'usda') {
    const key = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY';
    const response = await remoteFetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food.name)}&pageSize=25&api_key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error('FOOD_UNAVAILABLE');
    const data = await response.json();
    const matches = (data.foods ?? [])
      .flatMap((item: Record<string, unknown>) => {
        try {
          return [mapUsdaFoodItem(item)];
        } catch {
          return [];
        }
      })
      .filter(
        (candidate: ReturnType<typeof mapUsdaFoodItem>) =>
          candidate.name.trim().toLowerCase() === food.name.trim().toLowerCase() &&
          (candidate.brand ?? '') === (food.brand ?? '') &&
          (['protein_per_100g', 'carbs_per_100g', 'fat_per_100g'] as const).every(
            (key) => Math.abs(Number(food[key]) - candidate[key]) < 0.11,
          ),
      );
    if (
      !matches.length ||
      matches.some(
        (match: ReturnType<typeof mapUsdaFoodItem>) =>
          Math.abs(match.calories_per_100g - matches[0].calories_per_100g) > 1,
      )
    )
      throw new Error('FOOD_UNAVAILABLE');
    calories = matches[0].calories_per_100g;
  }
  if (!calories) throw new Error('FOOD_UNAVAILABLE');
  const saved = await admin.rpc('recover_food_energy', { p_food_id: foodId, p_calories: calories });
  if (saved.error) throw new Error('FOOD_UNAVAILABLE');
  return true;
}
