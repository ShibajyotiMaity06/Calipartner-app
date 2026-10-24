-- Approved onboarding redesign: private place and version-2 gym inputs.
-- Existing targets and their calculation version remain unchanged.
alter table public.profiles add column place text check (char_length(place) <= 120);
alter table public.goal_profiles add column gym_days integer check (gym_days between 0 and 7);
alter table public.goal_profiles add column input_height_cm numeric check (input_height_cm between 50 and 300 and input_height_cm::text <> 'NaN');
-- Preserve custom adjustments such as +300 kcal (= 0.272727... kg/week).
alter table public.goal_profiles alter column weekly_rate_kg type numeric;

-- These columns inherit the tables' existing owner-only RLS. Public profile and
-- room functions keep their explicit privacy-filtered projections.
create or replace function public.check_gym_plan_safety()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_sex text;
  v_height numeric;
  v_floor integer;
begin
  if new.gym_days is null then return new; end if;
  select sex, height_cm into v_sex, v_height from public.profiles where id = new.user_id;
  v_height := coalesce(new.input_height_cm, v_height);
  if v_sex is null or v_height is null or v_height <= 0 then
    raise exception 'Complete your profile before saving targets';
  end if;
  v_floor := case v_sex when 'male' then 1500 when 'female' then 1200 else 1350 end;
  if new.current_weight_kg is null or new.current_weight_kg::text = 'NaN'
    or new.current_weight_kg not between 20 and 500
    or new.weekly_rate_kg is null or new.weekly_rate_kg::text = 'NaN'
    or new.weekly_rate_kg < 0 or new.weekly_rate_kg > new.current_weight_kg * 0.01
    or new.daily_calorie_target is null or new.daily_calorie_target < v_floor
    or abs(new.daily_calorie_target - new.tdee) > new.current_weight_kg * 0.01 * 1100 + 1
    or new.protein_grams * 4 + new.fat_grams * 9 > new.daily_calorie_target + 7 then
    raise exception 'Plan exceeds calorie floor or weekly rate limit';
  end if;
  if new.goal = 'cut' and new.current_weight_kg / power(v_height / 100.0, 2) < 18.5 then
    raise exception 'Cut plans are unavailable below BMI 18.5';
  end if;
  if new.goal = 'maintain' and new.weekly_rate_kg <> 0 then
    raise exception 'Maintenance plans must have zero weekly change';
  end if;
  return new;
end;
$$;
revoke all on function public.check_gym_plan_safety() from public;
create trigger check_gym_plan_safety before insert or update on public.goal_profiles
for each row execute function public.check_gym_plan_safety();
