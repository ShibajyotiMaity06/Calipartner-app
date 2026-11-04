-- Only a trusted upstream re-import may repair energy. No macro-based energy estimates.
create function public.recover_food_energy(p_food_id uuid,p_calories numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_calories is null or p_calories<=0 or p_calories>1000 then raise exception 'INVALID_ENERGY'; end if;
 update public.foods set calories_per_100g=p_calories,updated_at=now() where id=p_food_id and owner_id is null and source='usda' and calories_per_100g=0;
 with matched as (
  select e.id,f.calories_per_100g,case when f.protein_per_100g>0 then e.protein/f.protein_per_100g when f.carbs_per_100g>0 then e.carbs/f.carbs_per_100g when f.fat_per_100g>0 then e.fat/f.fat_per_100g end factor,
   e.protein,e.carbs,e.fat,f.protein_per_100g p,f.carbs_per_100g c,f.fat_per_100g f
  from public.food_entries e join public.foods f on f.id=e.food_id where f.id=p_food_id and f.owner_id is null and e.calories=0 and e.deleted_at is null and f.calories_per_100g>0
 ) update public.food_entries e set calories=round(m.calories_per_100g*m.factor,1),updated_at=now() from matched m where e.id=m.id and m.factor>0
  and abs(m.protein-m.p*m.factor)<=0.11 and abs(m.carbs-m.c*m.factor)<=0.11 and abs(m.fat-m.f*m.factor)<=0.11;
end; $$;
revoke all on function public.recover_food_energy(uuid,numeric) from public,anon,authenticated;
grant execute on function public.recover_food_energy(uuid,numeric) to service_role;
