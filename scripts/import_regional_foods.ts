// node --experimental-strip-types scripts/import_regional_foods.ts [--check]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { format } from 'prettier';
import {
  suppliedRegionalFoodToCatalog,
  type SuppliedRegionalFood,
} from '../packages/core/src/suppliedRegionalFoods.ts';

type Nutrients = Pick<
  SuppliedRegionalFood,
  'calories_kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fibre_g' | 'sugar_g'
>;
const grocery = JSON.parse(fs.readFileSync('datasets/dmart_food_items.json', 'utf8')) as {
  metadata: { count: number; note: string };
  items: (Nutrients & {
    id: number;
    item: string;
    brand: string;
    basis: string;
    category: string;
  })[];
};
const regional = JSON.parse(fs.readFileSync('datasets/indian_states_top20_foods.json', 'utf8')) as {
  metadata: { states: number; dishes: number; note: string };
  states: {
    state: string;
    dishes: (Nutrients & { rank: number; dish: string; serving_size: number; unit: 'g' | 'ml' })[];
  }[];
};
if (
  grocery.items.length !== 90 ||
  grocery.metadata.count !== 90 ||
  regional.states.length !== 28 ||
  regional.states.some((state) => state.dishes.length !== 20) ||
  regional.metadata.dishes !== 560
)
  throw new Error('INCOMPLETE_SUPPLIED_DATA');
function id(key: string) {
  const bytes = crypto
    .createHash('sha1')
    .update('calipartner.supplied.2026-11-07/' + key)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const foods = [
  ...grocery.items.map((item) => {
    if (!['per 100 g', 'per 100 ml'].includes(item.basis)) throw new Error('UNKNOWN_SERVING_BASIS');
    return suppliedRegionalFoodToCatalog(
      {
        ...item,
        name: item.item,
        amount: 100,
        unit: item.basis === 'per 100 ml' ? 'ml' : 'g',
        attribution: `Owner-supplied dmart_food_items.json; ${item.category}; ${grocery.metadata.note}`,
      },
      id(`grocery/${item.id}`),
    );
  }),
  ...regional.states.flatMap((state) =>
    state.dishes.map((dish) =>
      suppliedRegionalFoodToCatalog(
        {
          ...dish,
          name: dish.dish,
          brand: null,
          amount: dish.serving_size,
          attribution: `Owner-supplied indian_states_top20_foods.json; ${state.state}; ${regional.metadata.note}`,
        },
        id(`regional/${state.state}/${dish.rank}`),
      ),
    ),
  ),
];
if (foods.length !== 650 || new Set(foods.map((food) => food.id)).size !== 650)
  throw new Error('DUPLICATE_SUPPLIED_FOOD');
const json = await format(JSON.stringify(foods), { parser: 'json', printWidth: 100 });
const sql = `-- All 90 groceries and 560 regional dishes are catalogue foods, never recipes.
-- Preserve supplied estimates, ml units and unknown nutrient markers. Never overwrite existing records.
insert into public.foods(id,source,name,brand,barcode,serving_units,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,sodium_mg_per_100g,nutrition_details,attribution)
select (item->>'id')::uuid,item->>'source',item->>'name',item->>'brand',null,item->'serving_units',
 (item->>'calories_per_100g')::numeric,(item->>'protein_per_100g')::numeric,(item->>'carbs_per_100g')::numeric,(item->>'fat_per_100g')::numeric,
 (item->>'fiber_per_100g')::numeric,(item->>'sugar_per_100g')::numeric,(item->>'sodium_mg_per_100g')::numeric,item->'nutrition_details',item->>'attribution'
from jsonb_array_elements($regional$${json.trim()}$regional$::jsonb) item
on conflict(id) do nothing;
`;
for (const [path, data] of [
  ['app/assets/supplied_regional_foods.json', json],
  ['supabase/migrations/20261107000200_supplied_regional_foods.sql', sql],
]) {
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(path!, 'utf8').replaceAll('\r\n', '\n') !== data)
      throw new Error(`OUTDATED_IMPORT: ${path}`);
  } else fs.writeFileSync(path!, data!);
}
console.log('Regional food import: 90 groceries + 560 dishes = 650 deterministic catalogue foods.');
