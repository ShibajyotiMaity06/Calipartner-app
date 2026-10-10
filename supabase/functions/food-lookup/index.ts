import { createClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory sliding-window rate limiter (60 requests per minute per IP / token)
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(clientId, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

export interface ServingUnitInput {
  unit: string;
  grams: number;
  description?: string;
}

export interface FoodLookupResult {
  id?: string;
  source: 'ifct' | 'off' | 'usda' | 'user';
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_units: ServingUnitInput[];
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  sugar_per_100g: number;
  sodium_mg_per_100g: number;
  attribution: string | null;
}

/**
 * Maps an Open Food Facts product JSON to our standard food schema.
 */
export function mapOpenFoodFactsProduct(
  barcode: string,
  product: Record<string, any>,
): FoodLookupResult {
  const nutriments = product.nutriments || {};

  const name =
    product.product_name ||
    product.product_name_en ||
    product.generic_name ||
    'Unknown Product';
  const brand = product.brands || product.brand_owner || null;

  // Energy in kcal
  let calories = Number(
    nutriments['energy-kcal_100g'] ??
      nutriments['energy-kcal'] ??
      (nutriments['energy_100g'] ? Number(nutriments['energy_100g']) / 4.184 : 0),
  );
  if (isNaN(calories) || calories < 0) calories = 0;

  const protein = Math.max(0, Number(nutriments.proteins_100g ?? 0) || 0);
  const carbs = Math.max(0, Number(nutriments.carbohydrates_100g ?? 0) || 0);
  const fat = Math.max(0, Number(nutriments.fat_100g ?? 0) || 0);
  const fiber = Math.max(0, Number(nutriments.fiber_100g ?? 0) || 0);
  const sugar = Math.max(0, Number(nutriments.sugars_100g ?? 0) || 0);

  // Sodium in mg
  let sodiumMg = 0;
  if (nutriments.sodium_100g !== undefined) {
    sodiumMg = Number(nutriments.sodium_100g) * 1000;
  } else if (nutriments.salt_100g !== undefined) {
    sodiumMg = Number(nutriments.salt_100g) * 400; // ~400mg sodium per 1g salt
  }
  if (isNaN(sodiumMg) || sodiumMg < 0) sodiumMg = 0;

  const servingUnits: ServingUnitInput[] = [{ unit: 'g', grams: 1 }];

  if (product.serving_quantity) {
    const qty = Number(product.serving_quantity);
    if (!isNaN(qty) && qty > 0) {
      servingUnits.push({
        unit: 'serving',
        grams: qty,
        description: product.serving_size || `1 serving (${qty}g)`,
      });
    }
  }

  return {
    source: 'off',
    name: name.trim(),
    brand: brand ? String(brand).trim() : null,
    barcode: barcode.trim(),
    serving_units: servingUnits,
    calories_per_100g: Math.round(calories * 10) / 10,
    protein_per_100g: Math.round(protein * 10) / 10,
    carbs_per_100g: Math.round(carbs * 10) / 10,
    fat_per_100g: Math.round(fat * 10) / 10,
    fiber_per_100g: Math.round(fiber * 10) / 10,
    sugar_per_100g: Math.round(sugar * 10) / 10,
    sodium_mg_per_100g: Math.round(sodiumMg * 10) / 10,
    attribution: 'Open Food Facts (ODbL)',
  };
}

/**
 * Maps a USDA FoodData Central item JSON to our standard food schema.
 */
export function mapUsdaFoodItem(item: Record<string, any>): FoodLookupResult {
  const nutrients = (item.foodNutrients || []) as Array<{
    nutrientId?: number;
    nutrientNumber?: string;
    value?: number;
  }>;

  const getNutrient = (id: number): number => {
    const found = nutrients.find((n) => n.nutrientId === id);
    return found?.value && !isNaN(found.value) && found.value >= 0 ? found.value : 0;
  };

  const calories = getNutrient(1008); // Energy (kcal)
  const protein = getNutrient(1003); // Protein (g)
  const fat = getNutrient(1004); // Total lipid (fat) (g)
  const carbs = getNutrient(1005); // Carbohydrate, by difference (g)
  const fiber = getNutrient(1079); // Fiber, total dietary (g)
  const sugar = getNutrient(2000); // Sugars, total (g)
  const sodium = getNutrient(1093); // Sodium, Na (mg)

  const servingUnits: ServingUnitInput[] = [{ unit: 'g', grams: 1 }];

  if (item.servingSize && Number(item.servingSize) > 0) {
    const sGrams = Number(item.servingSize);
    servingUnits.push({
      unit: 'serving',
      grams: sGrams,
      description: item.householdServingFullText || `1 serving (${sGrams}g)`,
    });
  }

  return {
    source: 'usda',
    name: (item.description || 'Unknown Food').trim(),
    brand: item.brandOwner || item.brandName || null,
    barcode: item.gtinUpc || null,
    serving_units: servingUnits,
    calories_per_100g: Math.round(calories * 10) / 10,
    protein_per_100g: Math.round(protein * 10) / 10,
    carbs_per_100g: Math.round(carbs * 10) / 10,
    fat_per_100g: Math.round(fat * 10) / 10,
    fiber_per_100g: Math.round(fiber * 10) / 10,
    sugar_per_100g: Math.round(sugar * 10) / 10,
    sodium_mg_per_100g: Math.round(sodium * 10) / 10,
    attribution: 'USDA FoodData Central',
  };
}

export async function handleFoodLookup(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate Limiting
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown-client';

  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again in 1 minute.' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      },
    );
  }

  let barcode: string | null = null;
  let query: string | null = null;
  let pageSize = 10;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    barcode = url.searchParams.get('barcode');
    query = url.searchParams.get('query');
    const pSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    if (!isNaN(pSize)) pageSize = Math.min(Math.max(pSize, 1), 25);
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      barcode = body.barcode || null;
      query = body.query || null;
      if (body.pageSize) pageSize = Math.min(Math.max(Number(body.pageSize), 1), 25);
    } catch {
      // empty or non-JSON body
    }
  }

  if (!barcode && !query) {
    return new Response(
      JSON.stringify({ error: 'Either "barcode" or "query" parameter is required.' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Prepare Supabase admin client for caching
  declare const Deno: { env: { get: (key: string) => string | undefined } } | undefined;
  const envGetter = typeof Deno !== 'undefined' ? Deno.env.get : (k: string) => process.env[k];

  const supabaseUrl = envGetter('SUPABASE_URL');
  const supabaseServiceKey = envGetter('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient =
    supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  try {
    // -------------------------------------------------------------------------
    // 1. BARCODE LOOKUP
    // -------------------------------------------------------------------------
    if (barcode) {
      const cleanBarcode = barcode.trim();

      // Check DB cache first
      if (adminClient) {
        const { data: cached } = await adminClient
          .from('foods')
          .select('*')
          .eq('barcode', cleanBarcode)
          .is('deleted_at', null)
          .limit(1);

        if (cached && cached.length > 0) {
          return new Response(
            JSON.stringify({ found: true, source: 'cache', food: cached[0] }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }

      // Query Open Food Facts API
      const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json`;
      const offRes = await fetch(offUrl, {
        headers: {
          'User-Agent': 'CaliPartnerApp - Mobile/Web - Version 1.0 - contact@calipartner.com',
        },
      });

      if (!offRes.ok) {
        return new Response(
          JSON.stringify({ found: false, barcode: cleanBarcode, message: 'Not found in Open Food Facts' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const offData = await offRes.json();
      if (offData.status !== 1 || !offData.product) {
        return new Response(
          JSON.stringify({ found: false, barcode: cleanBarcode, message: 'Product not registered in OFF' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const mapped = mapOpenFoodFactsProduct(cleanBarcode, offData.product);

      // Cache into database foods table
      let savedFood = mapped;
      if (adminClient) {
        const { data: inserted, error: insertErr } = await adminClient
          .from('foods')
          .insert({
            ...mapped,
            owner_id: null,
          })
          .select('*')
          .single();

        if (!insertErr && inserted) {
          savedFood = inserted;
        }
      }

      return new Response(
        JSON.stringify({ found: true, source: 'off', food: savedFood }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // -------------------------------------------------------------------------
    // 2. TEXT SEARCH LOOKUP (USDA Fallback)
    // -------------------------------------------------------------------------
    if (query) {
      const cleanQuery = query.trim();

      // Check DB cache first
      let cachedFoods: any[] = [];
      if (adminClient) {
        const { data } = await adminClient
          .from('foods')
          .select('*')
          .is('owner_id', null)
          .ilike('name', `%${cleanQuery}%`)
          .is('deleted_at', null)
          .limit(pageSize);

        if (data) {
          cachedFoods = data;
        }
      }

      if (cachedFoods.length >= 5) {
        return new Response(
          JSON.stringify({ source: 'cache', foods: cachedFoods }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      // Query USDA FoodData Central
      const usdaApiKey = envGetter('USDA_API_KEY') || 'DEMO_KEY';
      const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(cleanQuery)}&pageSize=${pageSize}&api_key=${encodeURIComponent(usdaApiKey)}`;

      const usdaRes = await fetch(usdaUrl);
      if (!usdaRes.ok) {
        // Return whatever cached foods we found
        return new Response(
          JSON.stringify({ source: 'cache', foods: cachedFoods }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const usdaData = await usdaRes.json();
      const usdaItems = (usdaData.foods || []) as Array<Record<string, any>>;

      const mappedList = usdaItems.map(mapUsdaFoodItem);

      // Cache newly fetched foods into Supabase
      const results = [...cachedFoods];
      if (adminClient && mappedList.length > 0) {
        for (const item of mappedList) {
          const { data: saved, error } = await adminClient
            .from('foods')
            .insert({
              ...item,
              owner_id: null,
            })
            .select('*')
            .single();

          if (!error && saved) {
            results.push(saved);
          } else {
            results.push(item);
          }
        }
      } else {
        results.push(...mappedList);
      }

      return new Response(
        JSON.stringify({ source: 'usda', foods: results }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Food lookup failed', details: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response> | Response) => void;
    }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(handleFoodLookup);
}
