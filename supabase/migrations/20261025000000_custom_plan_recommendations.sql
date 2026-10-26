-- Owner request 25 October 2026: pace and calorie adjustments are personal choices.
-- Recommendations stay in the shared calculator. Keep valid inputs, positive calories,
-- macro consistency, ownership/RLS, and maintenance validation.
create or replace function public.check_gym_plan_safety()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_sex text;
  v_height numeric;
begin
  if new.gym_days is null then return new; end if;
  select sex, height_cm into v_sex, v_height from public.profiles where id = new.user_id;
  v_height := coalesce(new.input_height_cm, v_height);
  if v_sex is null or v_height is null or v_height <= 0 then
    raise exception 'Complete your profile before saving targets';
  end if;
  if new.current_weight_kg is null or new.current_weight_kg::text = 'NaN'
    or new.current_weight_kg not between 20 and 500
    or new.weekly_rate_kg is null or new.weekly_rate_kg::text in ('NaN','Infinity','-Infinity')
    or new.weekly_rate_kg < 0
    or new.tdee is null or new.tdee <= 0
    or abs(abs(new.daily_calorie_target - new.tdee) - new.weekly_rate_kg * 1100) > 1
    or new.daily_calorie_target is null or new.daily_calorie_target <= 0
    or new.protein_grams * 4 + new.fat_grams * 9 > new.daily_calorie_target + 7 then
    raise exception 'Invalid calorie or macro totals';
  end if;
  if new.goal = 'maintain' and new.weekly_rate_kg <> 0 then
    raise exception 'Maintenance plans must have zero weekly change';
  end if;
  return new;
end;
$$;
revoke all on function public.check_gym_plan_safety() from public;
