-- pgTAP test harness for Phase 3: foods, food_entries, user_food_stats, saved_meals RLS policies
begin;
select plan(16);

-- -----------------------------------------------------------------------------
-- Fixtures setup
-- -----------------------------------------------------------------------------
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

-- 1-4. Test RLS is enabled on all tables
select ok((select relrowsecurity from pg_class where oid = 'public.foods'::regclass), 'RLS enabled on foods');
select ok((select relrowsecurity from pg_class where oid = 'public.food_entries'::regclass), 'RLS enabled on food_entries');
select ok((select relrowsecurity from pg_class where oid = 'public.user_food_stats'::regclass), 'RLS enabled on user_food_stats');
select ok((select relrowsecurity from pg_class where oid = 'public.saved_meals'::regclass), 'RLS enabled on saved_meals');

-- Insert a public global food as service/postgres role
insert into public.foods (
  id, source, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, owner_id
) values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  'ifct',
  'Global Apple',
  52, 0.3, 14, 0.2, null
);

-- Switch to User A context
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- 5. User A can insert and see their own custom food
insert into public.foods (
  id, source, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, owner_id
) values (
  'a1111111-0000-0000-0000-000000000001'::uuid,
  'user',
  'User A Custom Shake',
  250, 25, 10, 5,
  '11111111-1111-1111-1111-111111111111'::uuid
);

select results_eq(
  'select count(*)::integer from public.foods where id = ''a1111111-0000-0000-0000-000000000001''::uuid',
  ARRAY[1],
  'User A can see their own custom food'
);

-- 6. User A can see global foods
select results_eq(
  'select count(*)::integer from public.foods where id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid',
  ARRAY[1],
  'User A can read global public foods'
);

-- 7. User A can log food entry
insert into public.food_entries (
  id, user_id, food_id, meal_section, quantity, unit,
  calories, protein, carbs, fat, food_name, logged_at, local_date, source
) values (
  'a1111111-eeee-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  'breakfast', 1, 'piece',
  52, 0.3, 14, 0.2, 'Global Apple', now(), current_date, 'search'
);

select results_eq(
  'select count(*)::integer from public.food_entries where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[1],
  'User A can select their own food entry'
);

-- 8. User A cannot insert food entry for User B
prepare insert_user_b_entry as
insert into public.food_entries (
  id, user_id, meal_section, quantity, unit,
  calories, protein, carbs, fat, food_name, logged_at, local_date, source
) values (
  'b2222222-eeee-0000-0000-000000000001'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  'lunch', 1, 'piece',
  100, 10, 10, 10, 'Unauthorized Food', now(), current_date, 'search'
);
select throws_ok('insert_user_b_entry', '42501', NULL, 'User A cannot insert food entry for User B');

-- Switch to User B context
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- 9. User B CANNOT see User A custom food (private to owner)
select results_eq(
  'select count(*)::integer from public.foods where id = ''a1111111-0000-0000-0000-000000000001''::uuid',
  ARRAY[0],
  'User B cannot see User A custom food'
);

-- 10. User B CAN see global food
select results_eq(
  'select count(*)::integer from public.foods where id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid',
  ARRAY[1],
  'User B can see global food'
);

-- 11. User B CANNOT see User A food entries
select results_eq(
  'select count(*)::integer from public.food_entries where user_id = ''11111111-1111-1111-1111-111111111111''::uuid',
  ARRAY[0],
  'User B sees 0 of User A food entries'
);

-- 12. User B cannot update User A food entry
update public.food_entries
set calories = 9999
where id = 'a1111111-eeee-0000-0000-000000000001'::uuid;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  'select calories from public.food_entries where id = ''a1111111-eeee-0000-0000-000000000001''::uuid',
  ARRAY[52::numeric(7,2)],
  'User A entry calories unchanged by User B update attempt'
);

-- 13. User B cannot delete User A food entry
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
delete from public.food_entries where id = 'a1111111-eeee-0000-0000-000000000001'::uuid;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  'select count(*)::integer from public.food_entries where id = ''a1111111-eeee-0000-0000-000000000001''::uuid',
  ARRAY[1],
  'User A entry not deleted by User B delete attempt'
);

-- 14. Anon cannot read food entries
set local role anon;
reset "request.jwt.claims";
select results_eq(
  'select count(*)::integer from public.food_entries',
  ARRAY[0],
  'Anon cannot read food entries'
);

-- 15. Anon cannot read custom foods
select results_eq(
  'select count(*)::integer from public.foods where owner_id is not null',
  ARRAY[0],
  'Anon cannot read custom foods'
);

-- 16. Anon cannot read saved_meals or user_food_stats
select results_eq(
  'select count(*)::integer from public.saved_meals',
  ARRAY[0],
  'Anon cannot read saved_meals'
);

select * from finish();
rollback;
