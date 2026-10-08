-- pgTAP test harness for Phase 2: goal_profiles, health_screening, and RLS policies
begin;
select plan(12);

-- -----------------------------------------------------------------------------
-- Helper: setup test fixtures
-- -----------------------------------------------------------------------------
create temporary table _test_fixtures (
  user_a uuid,
  user_b uuid
);

insert into _test_fixtures values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

do $$
declare
  u_a uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  u_b uuid := '22222222-2222-2222-2222-222222222222'::uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email)
    values
      (u_a, 'user_a@example.com'),
      (u_b, 'user_b@example.com')
    on conflict (id) do nothing;
  end if;
end;
$$;

-- 1. Test RLS is enabled on goal_profiles
select ok(
  (select relrowsecurity from pg_class where oid = 'public.goal_profiles'::regclass),
  'RLS is enabled on public.goal_profiles'
);

-- 2. Test RLS is enabled on health_screening
select ok(
  (select relrowsecurity from pg_class where oid = 'public.health_screening'::regclass),
  'RLS is enabled on public.health_screening'
);

-- Switch to User A context
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- 3. User A can insert their own goal profile
insert into public.goal_profiles (
  user_id, goal, activity_level, current_weight_kg, weekly_rate_kg,
  daily_calorie_target, protein_grams, fat_grams, carb_grams, bmr, tdee
) values (
  '11111111-1111-1111-1111-111111111111'::uuid, 'cut', 'moderate', 70.0, 0.5,
  2044, 140, 57, 243, 1674, 2594
);

select results_eq(
  'select count(*)::integer from public.goal_profiles where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[1],
  'User A can select their own goal profile'
);

-- 4. User A can insert their own health screening
insert into public.health_screening (
  user_id, pregnant_or_breastfeeding, has_diabetes_or_medication, has_eating_disorder_history
) values (
  '11111111-1111-1111-1111-111111111111'::uuid, false, false, false
);

select results_eq(
  'select count(*)::integer from public.health_screening where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[1],
  'User A can select their own health screening'
);

-- 5. User A cannot insert goal profile for User B
prepare insert_user_b_goal as
insert into public.goal_profiles (
  user_id, goal, activity_level, current_weight_kg, weekly_rate_kg,
  daily_calorie_target, protein_grams, fat_grams, carb_grams, bmr, tdee
) values (
  '22222222-2222-2222-2222-222222222222'::uuid, 'cut', 'moderate', 75.0, 0.5,
  2100, 150, 60, 250, 1700, 2600
);
select throws_ok(
  'insert_user_b_goal',
  '42501',
  NULL,
  'User A cannot insert goal profile for User B (RLS blocks with check)'
);

-- Switch to User B context
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- 6. User B cannot see User A goal profile
select results_eq(
  'select count(*)::integer from public.goal_profiles where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[0],
  'User B cannot read User A goal profile (returns 0 rows)'
);

-- 7. User B cannot see User A health screening
select results_eq(
  'select count(*)::integer from public.health_screening where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[0],
  'User B cannot read User A health screening (returns 0 rows)'
);

-- 8. User B cannot update User A goal profile
update public.goal_profiles
set daily_calorie_target = 3000
where user_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Switch back to User A to verify no change was made
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  'select daily_calorie_target from public.goal_profiles where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[2044],
  'User A target calories unchanged by User B update attempt'
);

-- 9. User B cannot delete User A goal profile
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

delete from public.goal_profiles where user_id = '11111111-1111-1111-1111-111111111111'::uuid;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  'select count(*)::integer from public.goal_profiles where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[1],
  'User A goal profile not deleted by User B delete attempt'
);

-- 10. Anon cannot read goal profiles
set local role anon;
reset "request.jwt.claims";

select results_eq(
  'select count(*)::integer from public.goal_profiles',
  ARRAY[0],
  'Anon cannot read goal_profiles'
);

-- 11. Anon cannot read health screening
select results_eq(
  'select count(*)::integer from public.health_screening',
  ARRAY[0],
  'Anon cannot read health_screening'
);

-- 12. Security invoker on current_goal_profiles view prevents cross-user access
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select results_eq(
  'select count(*)::integer from public.current_goal_profiles',
  ARRAY[0],
  'User B sees 0 rows from current_goal_profiles when only User A has a profile'
);

select * from finish();
rollback;
