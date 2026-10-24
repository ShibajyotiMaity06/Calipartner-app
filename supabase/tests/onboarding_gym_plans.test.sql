begin;
select plan(12);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'onboard_a@example.com'),
  ('a0000000-0000-4000-8000-000000000002', 'onboard_b@example.com');
insert into public.profiles (id, username, nickname, date_of_birth, sex, height_cm, place) values
  ('a0000000-0000-4000-8000-000000000001', 'onboard_a', 'Ari', '2001-01-01', 'male', 175, 'Private city'),
  ('a0000000-0000-4000-8000-000000000002', 'onboard_b', 'Bea', '2001-01-01', 'female', 165, 'Another private city');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'Profile RLS remains enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.goal_profiles'::regclass), 'Goal RLS remains enabled');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq('select place from public.profiles', array['Private city'::text], 'A user can only read their own private place');
select lives_ok($sql$
  insert into public.goal_profiles (id, user_id, goal, activity_level, current_weight_kg, weekly_rate_kg, daily_calorie_target, protein_grams, fat_grams, carb_grams, bmr, tdee, gym_days, input_height_cm)
  values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'bulk', 'moderate', 47, 300.0/1100, 2392, 103, 56, 368, 1349, 2092, 5, 157.5)
$sql$, 'A safe reference plan can be saved');
select ok((select abs(weekly_rate_kg * 1100 - 300) < 0.000001 from public.goal_profiles where id = 'b0000000-0000-4000-8000-000000000001'), 'Custom surplus precision survives persistence');
select lives_ok($sql$
  update public.goal_profiles set gym_days = 5 where id = 'b0000000-0000-4000-8000-000000000001'
$sql$, 'Idempotent updates remain valid');
select throws_ok($sql$
  update public.goal_profiles set daily_calorie_target = 1400 where id = 'b0000000-0000-4000-8000-000000000001'
$sql$, 'P0001', null, 'The database rejects an intake below the male floor');
select throws_ok($sql$
  update public.goal_profiles set weekly_rate_kg = 0.5 where id = 'b0000000-0000-4000-8000-000000000001'
$sql$, 'P0001', null, 'The database rejects a pace above the strict 1% cap');
select throws_ok($sql$
  update public.goal_profiles set gym_days = 8 where id = 'b0000000-0000-4000-8000-000000000001'
$sql$, '23514', null, 'The database rejects invalid training days');
select throws_ok($sql$
  update public.goal_profiles set goal = 'cut', input_height_cm = 175, weekly_rate_kg = 0.2, daily_calorie_target = 1800 where id = 'b0000000-0000-4000-8000-000000000001'
$sql$, 'P0001', null, 'The database rejects a low-BMI cut using the actual input height');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq('select count(*)::integer from public.goal_profiles', array[0], 'Another user cannot read gym inputs or targets');
select is((with edited as (update public.goal_profiles set gym_days = 1 returning id) select count(*)::integer from edited), 0, 'Another user cannot alter the plan');

select * from finish();
rollback;
