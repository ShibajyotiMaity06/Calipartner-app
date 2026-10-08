-- pgTAP test harness for Phase 1 RLS, Age Gate, Username Rules, and Functions
begin;
select plan(16);

-- -----------------------------------------------------------------------------
-- Helper: setup test fixtures
-- -----------------------------------------------------------------------------
create temporary table _test_fixtures (
  user_a uuid,
  user_b uuid,
  user_c uuid,
  minor_user uuid
);

insert into _test_fixtures values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);

-- Insert dummy auth users for foreign keys
do $$
declare
  u_a uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  u_b uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  u_c uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  u_minor uuid := '44444444-4444-4444-4444-444444444444'::uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email)
    values
      (u_a, 'user_a@example.com'),
      (u_b, 'user_b@example.com'),
      (u_c, 'user_c@example.com'),
      (u_minor, 'minor@example.com')
    on conflict (id) do nothing;
  end if;
end;
$$;

-- 1. Test RLS is enabled on all tables
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on public.profiles'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.blocks'::regclass),
  'RLS is enabled on public.blocks'
);

-- Seed profile for user A (25 years old)
insert into public.profiles (
  id, username, nickname, date_of_birth, sex, height_cm, discoverable
) values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'alex_fit',
  'Alex F',
  current_date - interval '25 years',
  'other',
  175,
  true
);

-- Seed profile for user B (30 years old)
insert into public.profiles (
  id, username, nickname, date_of_birth, sex, height_cm, discoverable
) values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'bob_runner',
  'Bob R',
  current_date - interval '30 years',
  'male',
  180,
  false -- Non-discoverable
);

-- 2. Test: Unauthenticated access denied to profiles
set local role anon;
set local "request.jwt.claims" to '{}';

select is(
  (select count(*)::int from public.profiles),
  0,
  'Unauthenticated anon role cannot read any profile'
);

-- 3. Test: Authenticated User A can read own profile
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'::uuid),
  1,
  'User A can read own profile'
);

-- 4. Test: User A cannot read User B profile directly
select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'::uuid),
  0,
  'User A cannot read User B profile directly'
);

-- 5. Test: User A cannot update User B profile
update public.profiles
set nickname = 'Hacked'
where id = '22222222-2222-2222-2222-222222222222'::uuid;

select is(
  (select nickname from public.profiles where id = '22222222-2222-2222-2222-222222222222'::uuid),
  null,
  'User A cannot update User B profile'
);

-- 6. Test: Under-18 is blocked server-side (DB trigger)
reset role;
prepare insert_minor as
  insert into public.profiles (
    id, username, nickname, date_of_birth, sex, height_cm
  ) values (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'minor_user',
    'Minor',
    current_date - interval '17 years', -- 17 years old
    'female',
    160
  );

select throws_ok(
  'insert_minor',
  'P0001',
  'Users must be at least 18 years old',
  'Under-18 profile insertion is rejected server-side'
);

-- 7. Test: Username uniqueness is case-insensitive
prepare insert_case_duplicate as
  insert into public.profiles (
    id, username, nickname, date_of_birth, sex, height_cm
  ) values (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'ALEX_FIT', -- Clashes with alex_fit
    'Another Alex',
    current_date - interval '20 years',
    'male',
    170
  );

select throws_like(
  'insert_case_duplicate',
  '%duplicate key value violates unique constraint%',
  'Username uniqueness is case-insensitive (citext)'
);

-- 8. Test: Reserved username is rejected
prepare insert_reserved as
  insert into public.profiles (
    id, username, nickname, date_of_birth, sex, height_cm
  ) values (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'admin',
    'Admin User',
    current_date - interval '20 years',
    'male',
    170
  );

select throws_ok(
  'insert_reserved',
  'P0001',
  'This username is reserved',
  'Reserved username is rejected server-side'
);

-- 9. Test: Consecutive periods in username are rejected
prepare insert_double_dot as
  insert into public.profiles (
    id, username, nickname, date_of_birth, sex, height_cm
  ) values (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'john..doe',
    'John Doe',
    current_date - interval '20 years',
    'male',
    170
  );

select throws_like(
  'insert_double_dot',
  '%violates check constraint%',
  'Username with consecutive periods is rejected'
);

-- 10. Test: is_username_available RPC
select is(
  public.is_username_available('alex_fit'),
  false,
  'is_username_available returns false for existing username'
);

select is(
  public.is_username_available('ALEX_FIT'),
  false,
  'is_username_available returns false for case-insensitive duplicate'
);

select is(
  public.is_username_available('new_healthy_user'),
  true,
  'is_username_available returns true for new valid username'
);

-- 11. Test: search_users respects discoverable setting
-- User A searches prefix 'bob' -> Bob is discoverable = false, so Bob should NOT be returned
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_users('bob')),
  0,
  'search_users excludes non-discoverable users'
);

-- 12. Test: search_users excludes blocked users
reset role;
insert into public.blocks (blocker_id, blocked_id)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

-- Make Bob discoverable to test blocking effect
update public.profiles set discoverable = true where id = '22222222-2222-2222-2222-222222222222'::uuid;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_users('bob')),
  0,
  'search_users excludes blocked users'
);

-- 13. Test: Rate limit check works
reset role;
select is(
  public.check_rate_limit('test_rate_bucket', 2, 60),
  true,
  'check_rate_limit allows request within limit'
);

-- 14. Test: User A cannot delete User B profile
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

delete from public.profiles where id = '22222222-2222-2222-2222-222222222222'::uuid;

reset role;
select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'::uuid),
  1,
  'User A cannot delete User B profile'
);

-- 15. Test: Username change rule (cannot change twice within 30 days)
-- User A updates username once
update public.profiles
set username = 'alex_fit_2'
where id = '11111111-1111-1111-1111-111111111111'::uuid;

prepare update_username_too_soon as
  update public.profiles
  set username = 'alex_fit_3'
  where id = '11111111-1111-1111-1111-111111111111'::uuid;

select throws_ok(
  'update_username_too_soon',
  'P0001',
  'Username can only be changed once every 30 days',
  'Changing username twice within 30 days is blocked'
);

-- 16. Test: Released username is held for 30 days
-- User B tries to claim old username 'alex_fit' just released by User A
prepare claim_released_username as
  insert into public.profiles (
    id, username, nickname, date_of_birth, sex, height_cm
  ) values (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'alex_fit',
    'Claimer',
    current_date - interval '22 years',
    'other',
    170
  );

select throws_ok(
  'claim_released_username',
  'P0001',
  'This username is temporarily held and unavailable',
  'Released username cannot be claimed by another user within 30 days'
);

select * from finish();
rollback;

