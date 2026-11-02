"""Import the owner's concatenated JSON arrays; never infer missing recipe fields."""
import argparse
import json
from pathlib import Path
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--migration', type=Path)
args = parser.parse_args()
text = args.source.read_text(encoding='utf-8-sig')
decoder = json.JSONDecoder()
records = []
while text.strip():
    text = text.lstrip()
    batch, end = decoder.raw_decode(text)
    if not isinstance(batch, list):
        raise ValueError('Expected an array of recipes')
    records.extend(batch)
    text = text[end:]
names = set()
for recipe in records:
    if recipe['name'] in names:
        raise ValueError('Duplicate recipe name: ' + recipe['name'])
    names.add(recipe['name'])
    recipe['id'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'calipartner:owner-recipe:' + recipe['name']))
data = json.dumps(records, ensure_ascii=False, indent=2) + '\n'
Path('datasets/owner_recipes.json').write_text(data, encoding='utf-8')
if args.migration:
    if '$recipes$' in data:
        raise ValueError('Reserved SQL delimiter in source data')
    if args.migration.exists():
        raise ValueError('Refusing to overwrite an existing migration')
    args.migration.write_text("""-- Preserve the supplied recipe data, including unmapped ingredient amounts.
alter table public.recipes add column source_recipe jsonb;
alter table public.recipes drop constraint recipes_meal_type_check;
alter table public.recipes add constraint recipes_meal_type_check check(meal_type in ('breakfast','lunch','dinner','snack','dessert','beverage','unspecified'));
alter table public.recipes drop constraint recipes_difficulty_check;
alter table public.recipes add constraint recipes_difficulty_check check(difficulty in ('easy','medium','hard','unspecified'));
insert into public.recipes(id,title,cuisine,diet_tags,meal_type,prep_minutes,cook_minutes,difficulty,servings,steps,tips,image_urls,status,nutrition_per_serving,nutrition_override_reason,source_recipe)
select (r->>'id')::uuid,r->>'name',r->>'region',
 array[case lower(r->>'type') when 'veg' then 'vegetarian' when 'egg' then 'eggetarian' else 'non_vegetarian' end],
 'unspecified',0,(r->>'time_minutes')::integer,'unspecified',(r->>'serves')::numeric,r->'steps','[]'::jsonb,'[]'::jsonb,'published',
 jsonb_build_object('calories',r->'macros'->'calories','protein',r->'macros'->'protein_g','carbs',r->'macros'->'carbs_g','fat',r->'macros'->'fat_g','fiber',r->'macros'->'fiber_g'),
 'Owner-supplied reci.txt nutrition per '||(r->'macros'->>'per'),r
from jsonb_array_elements($recipes$""" + data + """$recipes$::jsonb) r
on conflict(id) do nothing;

-- A retry-safe favorite command avoids treating the composite key as an id column.
create or replace function public.set_recipe_favorite(p_recipe_id uuid,p_favorite boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_favorite then
   if not public.can_read_recipe(p_recipe_id) or not exists(select 1 from public.recipes where id=p_recipe_id and status='published' and deleted_at is null) then raise exception 'RECIPE_UNAVAILABLE'; end if;
   insert into public.recipe_favorites(user_id,recipe_id) values(auth.uid(),p_recipe_id) on conflict do nothing;
 else
   delete from public.recipe_favorites where user_id=auth.uid() and recipe_id=p_recipe_id;
 end if;
end; $$;
revoke all on function public.set_recipe_favorite(uuid,boolean) from public,anon;
grant execute on function public.set_recipe_favorite(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
""", encoding='utf-8')
print(f'Imported recipes: {len(records)}; unique stable IDs: {len(names)}')
