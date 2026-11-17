-- Owner-requested independent target entries; retain paid gates, stable bounds,
-- calorie floors, goal direction and rate safeguards in the existing functions.
do $$
declare definition text; old_clause text;
begin
  select pg_get_functiondef('public.guard_custom_macros()'::regprocedure) into definition;
  old_clause := 'or new.daily_calorie_target <> new.protein_grams*4+new.carb_grams*4+new.fat_grams*9';
  if position(old_clause in definition)=0 then raise exception 'Expected custom macro guard missing'; end if;
  execute replace(definition,old_clause,'');

  select pg_get_functiondef('public.valid_workout_routine(jsonb)'::regprocedure) into definition;
  if position('not between 0 and 90' in definition)=0 then raise exception 'Expected workout duration guard missing'; end if;
  execute replace(definition,'not between 0 and 90','not between 0 and 120');
end; $$;
notify pgrst, 'reload schema';
