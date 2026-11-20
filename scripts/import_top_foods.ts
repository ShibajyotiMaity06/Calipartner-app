// node --experimental-strip-types scripts/import_top_foods.ts [--check]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { format } from 'prettier';
import { suppliedRegionalFoodToCatalog } from '../packages/core/src/suppliedRegionalFoods.ts';
import type { Food } from '../packages/core/src/types.ts';

type FoodItem = {
  id: number;
  dish: string;
  origin?: string;
  category?: string;
  serving_size: number;
  unit: 'g' | 'ml';
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fibre_g: number;
  calories_per_100?: number;
  protein_per_100?: number | null;
};

type Dataset = {
  metadata: { count: number; note: string; [key: string]: unknown };
  items: FoodItem[];
};

const top500 = JSON.parse(fs.readFileSync('datasets/top_500_foods.json', 'utf8')) as Dataset;
const top500Set2 = JSON.parse(
  fs.readFileSync('datasets/top_500_foods_set2_all_states.json', 'utf8'),
) as Dataset;

if (top500.items.length !== 500 || top500Set2.items.length !== 500) {
  throw new Error('INCOMPLETE_TOP_FOODS_DATA');
}

const bundled = JSON.parse(fs.readFileSync('app/assets/bundled_foods.json', 'utf8')) as Food[];
const supplied = JSON.parse(fs.readFileSync('app/assets/supplied_foods.json', 'utf8')) as Food[];
const products = JSON.parse(
  fs.readFileSync('app/assets/supplied_food_products.json', 'utf8'),
) as Food[];
const regional = JSON.parse(
  fs.readFileSync('app/assets/supplied_regional_foods.json', 'utf8'),
) as Food[];

const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const existingNames = new Set<string>();
for (const food of [...bundled, ...supplied, ...products, ...regional]) {
  existingNames.add(normalize(food.name));
}

function id(key: string) {
  const bytes = crypto
    .createHash('sha1')
    .update('calipartner.supplied.2026-11-20/' + key)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const foods: Food[] = [];

for (const item of top500.items) {
  const norm = normalize(item.dish);
  if (existingNames.has(norm)) continue;
  existingNames.add(norm);

  const catalogFood = suppliedRegionalFoodToCatalog(
    {
      name: item.dish,
      brand: null,
      amount: item.serving_size,
      unit: item.unit,
      calories_kcal: item.calories_kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fibre_g: item.fibre_g,
      attribution: `Owner-supplied top_500_foods.json; ${item.category ?? ''}; ${item.origin ?? ''}; ${top500.metadata.note}`,
    },
    id(`top500/${item.id}`),
  );
  foods.push(catalogFood);
}

for (const item of top500Set2.items) {
  const norm = normalize(item.dish);
  if (existingNames.has(norm)) continue;
  existingNames.add(norm);

  const catalogFood = suppliedRegionalFoodToCatalog(
    {
      name: item.dish,
      brand: null,
      amount: item.serving_size,
      unit: item.unit,
      calories_kcal: item.calories_kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fibre_g: item.fibre_g,
      attribution: `Owner-supplied top_500_foods_set2_all_states.json; ${item.origin ?? ''}; ${item.category ?? ''}; ${top500Set2.metadata.note}`,
    },
    id(`set2/${item.id}`),
  );
  foods.push(catalogFood);
}

if (foods.length !== 604 || new Set(foods.map((f) => f.id)).size !== 604) {
  throw new Error(`UNEXPECTED_FOOD_COUNT: expected 604 foods, got ${foods.length}`);
}

const json = await format(JSON.stringify(foods), { parser: 'json', printWidth: 100 });
const sql = `-- All 604 popular Indian foods and state dishes are catalogue foods, never recipes.
-- Filtered out 396 duplicate dishes that already exist in the food catalogue.
-- Preserve supplied estimates, ml units and unknown nutrient markers. Never overwrite existing records.
insert into public.foods(id,source,name,brand,barcode,serving_units,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,sodium_mg_per_100g,nutrition_details,attribution)
select (item->>'id')::uuid,item->>'source',item->>'name',item->>'brand',null,item->'serving_units',
 (item->>'calories_per_100g')::numeric,(item->>'protein_per_100g')::numeric,(item->>'carbs_per_100g')::numeric,(item->>'fat_per_100g')::numeric,
 (item->>'fiber_per_100g')::numeric,(item->>'sugar_per_100g')::numeric,(item->>'sodium_mg_per_100g')::numeric,item->'nutrition_details',item->>'attribution'
from jsonb_array_elements($topfoods$${json.trim()}$topfoods$::jsonb) item
on conflict(id) do nothing;
`;

for (const [path, data] of [
  ['app/assets/supplied_top_foods.json', json],
  ['supabase/migrations/20261120000000_supplied_top_foods.sql', sql],
]) {
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(path!, 'utf8').replaceAll('\r\n', '\n') !== data)
      throw new Error(`OUTDATED_IMPORT: ${path}`);
  } else fs.writeFileSync(path!, data!);
}
console.log(
  `Top food import: 104 popular + 500 state dishes = ${foods.length} deterministic catalogue foods.`,
);
