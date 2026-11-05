// Run with: node --experimental-strip-types scripts/import_supplied_products.ts [--check]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import {
  suppliedProductToFood,
  type SuppliedFoodProduct,
} from '../packages/core/src/suppliedProducts.ts';

const input = JSON.parse(
  fs.readFileSync('datasets/supplied_food_products_2026_11_05.json', 'utf8'),
) as { metadata: { count: number }; products: SuppliedFoodProduct[] };
if (
  input.products.length !== input.metadata.count ||
  input.products.length !== 156 ||
  new Set(input.products.map((p) => p.id)).size !== 156
)
  throw new Error('INCOMPLETE_PRODUCT_DATA');
const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
const foods = input.products.map((product) => {
  const digest = crypto
    .createHash('sha1')
    .update(namespace)
    .update(
      `calipartner.app/foods/supplied-products/${product.brand.trim().toLowerCase()}/${product.product.trim().toLowerCase()}`,
    )
    .digest();
  digest[6] = (digest[6]! & 15) | 80;
  digest[8] = (digest[8]! & 63) | 128;
  const hex = digest.subarray(0, 16).toString('hex');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return suppliedProductToFood(product, id);
});
if (new Set(foods.map((food) => food.id)).size !== 156) throw new Error('DUPLICATE_PRODUCT');
const json = await format(JSON.stringify(foods), {
  ...(await resolveConfig('app/assets/supplied_food_products.json')),
  parser: 'json',
});
if (json.includes('$products$')) throw new Error('UNSAFE_SQL_DELIMITER');
const sql = `-- Additional owner-supplied individual foods, not recipes. Existing rows remain unchanged.
create or replace function public.valid_nutrition_details(p_value jsonb,p_portion boolean default false)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare key text; maximum numeric; missing jsonb;
begin
 if p_value is null then return true; end if;
 if jsonb_typeof(p_value)<>'object' then return false; end if;
 if p_value-array['saturated_fat','cholesterol_mg','locked','bcaa_g','label_protein_per_100g','not_provided']<>'{}'::jsonb then return false; end if;
 if p_value ? 'locked' and jsonb_typeof(p_value->'locked')<>'boolean' then return false; end if;
 if p_value ? 'not_provided' then
  if jsonb_typeof(p_value->'not_provided')<>'array' then return false; end if;
  if jsonb_array_length(p_value->'not_provided')>3 then return false; end if;
  for missing in select value from jsonb_array_elements(p_value->'not_provided') loop
   if jsonb_typeof(missing)<>'string' or (missing#>>'{}') not in ('fiber','sugar','sodium_mg') then return false; end if;
  end loop;
 end if;
 foreach key in array array['saturated_fat','cholesterol_mg','bcaa_g','label_protein_per_100g'] loop
  if p_value->key is not null and p_value->key<>'null'::jsonb then
   if jsonb_typeof(p_value->key)<>'number' then return false; end if;
   maximum:=case when key='label_protein_per_100g' or (key in ('saturated_fat','bcaa_g') and not p_portion) then 100 else 100000 end;
   if (p_value->>key)::numeric<0 or (p_value->>key)::numeric>maximum then return false; end if;
  end if;
 end loop;
 return true;
end; $$;
alter table public.foods drop constraint foods_source_check;
alter table public.foods add constraint foods_source_check check(source in ('ifct','off','usda','user','supplied'));
insert into public.foods(id,source,name,brand,barcode,serving_units,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,sodium_mg_per_100g,nutrition_details,attribution)
select (item->>'id')::uuid,item->>'source',item->>'name',item->>'brand',null,item->'serving_units',
 (item->>'calories_per_100g')::numeric,(item->>'protein_per_100g')::numeric,(item->>'carbs_per_100g')::numeric,(item->>'fat_per_100g')::numeric,
 (item->>'fiber_per_100g')::numeric,(item->>'sugar_per_100g')::numeric,(item->>'sodium_mg_per_100g')::numeric,item->'nutrition_details',item->>'attribution'
from jsonb_array_elements($products$${json.trim()}$products$::jsonb) item
on conflict(id) do nothing;
`;
for (const [path, data] of [
  ['app/assets/supplied_food_products.json', json],
  ['supabase/migrations/20261105000100_supplied_food_products.sql', sql],
]) {
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(path!, 'utf8').replaceAll('\r\n', '\n') !== data)
      throw new Error(`OUTDATED_PRODUCT_OUTPUT: ${path}`);
  } else fs.writeFileSync(path!, data!);
}
console.log(
  `Supplied products: ${foods.length} deterministic individual foods; source nulls retained.`,
);
