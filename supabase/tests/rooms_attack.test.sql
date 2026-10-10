-- pgTAP test harness for Phase 5 v0.4: Rooms, Privacy Enforcement, Room Billing, Capacity & Lifecycle Attack Tests
begin;
select plan(30);

-- -----------------------------------------------------------------------------
-- Fixtures setup
-- -----------------------------------------------------------------------------
create temporary table _test_users (
  u_a uuid,
  u_b uuid,
  u_c uuid,
  u_d uuid
);

insert into _test_users values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);

do $$
declare
  u_a uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  u_b uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  u_c uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  u_d uuid := '44444444-4444-4444-4444-444444444444'::uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email)
    values
      (u_a, 'user_a@example.com'),
      (u_b, 'user_b@example.com'),
      (u_c, 'user_c@example.com'),
      (u_d, 'user_d@example.com')
    on conflict (id) do nothing;
  end if;
end;
$$;

-- Seed profiles
insert into public.profiles (id, username, nickname, date_of_birth, sex, height_cm, discoverable)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'alex_p5', 'Alex', current_date - interval '25 years', 'male', 175, true),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'bob_p5', 'Bob', current_date - interval '26 years', 'male', 180, true),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'charlie_p5', 'Charlie', current_date - interval '24 years', 'female', 165, false), -- undiscoverable
  ('44444444-4444-4444-4444-444444444444'::uuid, 'david_p5', 'David', current_date - interval '27 years', 'other', 170, true)
on conflict (id) do nothing;

-- 1-12. Assert RLS is enabled on all Phase 5 tables
select ok((select relrowsecurity from pg_class where oid = 'public.rooms'::regclass), 'RLS enabled on rooms');
select ok((select relrowsecurity from pg_class where oid = 'public.room_members'::regclass), 'RLS enabled on room_members');
select ok((select relrowsecurity from pg_class where oid = 'public.room_requests'::regclass), 'RLS enabled on room_requests');
select ok((select relrowsecurity from pg_class where oid = 'public.shared_meals'::regclass), 'RLS enabled on shared_meals');
select ok((select relrowsecurity from pg_class where oid = 'public.shared_meal_participants'::regclass), 'RLS enabled on shared_meal_participants');
select ok((select relrowsecurity from pg_class where oid = 'public.room_events'::regclass), 'RLS enabled on room_events');
select ok((select relrowsecurity from pg_class where oid = 'public.reactions'::regclass), 'RLS enabled on reactions');
select ok((select relrowsecurity from pg_class where oid = 'public.nudges'::regclass), 'RLS enabled on nudges');
select ok((select relrowsecurity from pg_class where oid = 'public.daily_summaries'::regclass), 'RLS enabled on daily_summaries');
select ok((select relrowsecurity from pg_class where oid = 'public.entitlements'::regclass), 'RLS enabled on entitlements');
select ok((select relrowsecurity from pg_class where oid = 'public.device_trials'::regclass), 'RLS enabled on device_trials');
select ok((select relrowsecurity from pg_class where oid = 'public.room_tier_configs'::regclass), 'RLS enabled on room_tier_configs');

-- 13. Direct Select Attack: User A cannot read User B daily_summaries directly
insert into public.daily_summaries (user_id, local_date, calories, protein, carbs, fat, steps, water_ml, logged_day, goal_day)
values ('22222222-2222-2222-2222-222222222222'::uuid, current_date::text, 2100, 150, 200, 60, 10000, 2500, true, true);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::integer from public.daily_summaries where user_id = '22222222-2222-2222-2222-222222222222'::uuid),
  0,
  'User A cannot directly select User B daily summaries'
);

-- 14. Room Creation: User A creates a room (starts 3-day trial on Basic tier, cap 5)
select is(
  public.has_plan('11111111-1111-1111-1111-111111111111'::uuid),
  false,
  'User A has no paid plan before trial'
);

prepare p_create_room as
  select public.create_room('Alex Test Room', 'dev-hash-alex');

select lives_ok(
  'p_create_room',
  'User A can create room, starting 3-day trial'
);

select is(
  public.room_cap((select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)),
  5,
  'Trial room has cap of 5 members'
);

-- 15. Undiscoverable username attack: User A cannot invite Charlie by username
do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  execute format('prepare p_invite_undiscoverable as select public.send_room_invitation(%L::uuid, ''charlie_p5'')', v_room_id);
end;
$$;

select throws_ok(
  'p_invite_undiscoverable',
  'P0001',
  'USER_NOT_FOUND',
  'Undiscoverable user cannot be invited by username'
);

-- 16. Blocked user attack: User B blocked by User A cannot invite
reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  execute format('prepare p_invite_blocked as select public.send_room_invitation(%L::uuid, ''bob_p5'')', v_room_id);
end;
$$;

select throws_ok(
  'p_invite_blocked',
  'P0001',
  'USER_BLOCKED',
  'Blocked user cannot be invited'
);

-- Unblock User B and send invitation
reset role;
delete from public.blocks where blocker_id = '11111111-1111-1111-1111-111111111111'::uuid;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- 17. User B with no plan joins room for FREE without starting or consuming trial (PRD 6.18 SUB-1, SUB-3)
do $$
declare
  v_room_id uuid;
  v_inv jsonb;
  v_req_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  v_inv := public.send_room_invitation(v_room_id, 'bob_p5');
  v_req_id := (v_inv->>'request_id')::uuid;

  -- Switch to User B and accept
  set local role authenticated;
  set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

  perform public.respond_to_request(v_req_id, true);
end;
$$;

select is(
  (select trial_started_at from public.entitlements where user_id = '22222222-2222-2222-2222-222222222222'::uuid),
  null::timestamptz,
  'User B trial was NOT started upon joining (joining never starts or needs trial)'
);

-- 18. PRIVACY ENFORCEMENT: Hidden fields returned as "locked", never zero or actual values
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (
    select m->'metrics'->>'calories'
    from jsonb_array_elements(
      (public.get_room_snapshot((select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)))->'members'
    ) m
    where m->>'user_id' = '22222222-2222-2222-2222-222222222222'
  ),
  'locked',
  'User B hidden calories are returned as "locked" marker'
);

select is(
  (
    select m->'metrics'->>'weight_kg'
    from jsonb_array_elements(
      (public.get_room_snapshot((select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)))->'members'
    ) m
    where m->>'user_id' = '22222222-2222-2222-2222-222222222222'
  ),
  'locked',
  'User B hidden weight is returned as "locked" marker'
);

-- 19. PRIVACY RETROACTIVITY: User B shares calories -> next snapshot immediately shows calories
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  perform public.set_privacy(v_room_id, '{"share_calories_macros": true}'::jsonb);
end;
$$;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (
    select (m->'metrics'->>'calories')::numeric
    from jsonb_array_elements(
      (public.get_room_snapshot((select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)))->'members'
    ) m
    where m->>'user_id' = '22222222-2222-2222-2222-222222222222'
  ),
  2100::numeric,
  'User B calories become visible immediately after privacy change'
);

-- 20. Non-member attack: User D (not in room) cannot read snapshot
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  execute format('prepare p_non_member_read as select public.get_room_snapshot(%L::uuid)', v_room_id);
end;
$$;

select throws_ok(
  'p_non_member_read',
  'P0001',
  'NOT_ROOM_MEMBER',
  'Non-member cannot read room snapshot'
);

-- 21. ATTACK: User with expired trial and no plan cannot create a room
reset role;
perform public.dev_expire_trial('22222222-2222-2222-2222-222222222222'::uuid);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

prepare p_create_expired as
  select public.create_room('Bob Rogue Room');

select throws_ok(
  'p_create_expired',
  'P0001',
  'PLAN_REQUIRED',
  'User with expired trial cannot create room without a plan'
);

-- 22. ATTACK: One plan cannot cover two rooms (SUB-17)
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

prepare p_create_second_room as
  select public.create_room('Alex Second Room');

select throws_ok(
  'p_create_second_room',
  'P0001',
  'PLAN_ALREADY_ATTACHED',
  'One plan cannot cover two hosted rooms'
);

-- 23. ATTACK: Accept-invite to a full room returns ROOM_FULL
reset role;
-- Alex's room has cap 5. Add David and Charlie to reach 4, plus another to reach 5.
do $$
declare
  v_room_id uuid;
  v_dummy uuid := gen_random_uuid();
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;

  insert into public.room_members (room_id, user_id, role, status)
  values
    (v_room_id, '44444444-4444-4444-4444-444444444444'::uuid, 'member', 'active'),
    (v_room_id, '33333333-3333-3333-3333-333333333333'::uuid, 'member', 'active'),
    (v_room_id, v_dummy, 'member', 'active')
  on conflict do nothing;
end;
$$;

-- Create an invite for a 6th user
do $$
declare
  v_room_id uuid;
  v_extra_user uuid := gen_random_uuid();
  v_req_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;

  insert into public.room_requests (room_id, sender_id, recipient_id, type, status, expires_at)
  values (v_room_id, '11111111-1111-1111-1111-111111111111'::uuid, v_extra_user, 'invitation', 'pending', now() + interval '1 day')
  returning id into v_req_id;

  set local role authenticated;
  execute format('set local "request.jwt.claims" to ''{"sub": "%s", "role": "authenticated"}''', v_extra_user);
  execute format('prepare p_accept_full as select public.respond_to_request(''%s''::uuid, true)', v_req_id);
end;
$$;

select throws_ok(
  'p_accept_full',
  'P0001',
  'ROOM_FULL',
  'Accepting invitation to a full room returns ROOM_FULL'
);

-- 24. ATTACK: Locked rooms are unreadable by every route (PRD 7.6)
reset role;
perform public.dev_expire_trial('11111111-1111-1111-1111-111111111111'::uuid);

select is(
  (select state from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1),
  'locked',
  'Room transitions to locked when plan expires'
);

-- Route 1: get_room_snapshot returns ROOM_LOCKED
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  execute format('prepare p_read_locked as select public.get_room_snapshot(%L::uuid)', v_room_id);
end;
$$;

select throws_ok(
  'p_read_locked',
  'P0001',
  'ROOM_LOCKED',
  'get_room_snapshot on locked room throws ROOM_LOCKED'
);

-- Route 2: RLS blocks direct reading of room_events on locked room
select is(
  (select count(*)::integer from public.room_events where room_id = (select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)),
  0,
  'Direct select on room_events returns 0 rows when room is locked'
);

-- Route 3: RLS blocks direct reading of shared_meals on locked room
select is(
  (select count(*)::integer from public.shared_meals where room_id = (select id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1)),
  0,
  'Direct select on shared_meals returns 0 rows when room is locked'
);

-- 28. Trial cannot be restarted on expired account
reset role;
select is(
  public.start_trial_if_eligible('22222222-2222-2222-2222-222222222222'::uuid, 'new-device-hash'),
  false,
  'Expired trial account cannot restart trial'
);

-- 29. Trial cannot be restarted on same device hash
select is(
  public.start_trial_if_eligible('44444444-4444-4444-4444-444444444444'::uuid, 'dev-hash-alex'),
  false,
  'New account cannot claim trial on previously used device hash'
);

-- 30. Sponsoring restores the room instantly
reset role;
perform public.dev_grant_plan('22222222-2222-2222-2222-222222222222'::uuid, 'plus', 'monthly', 'paid');
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

do $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1;
  perform public.sponsor_room(v_room_id);
end;
$$;

select is(
  (select state from public.rooms where created_by = '11111111-1111-1111-1111-111111111111'::uuid limit 1),
  'active',
  'Sponsoring restores the room to active state instantly'
);

select * from finish();
rollback;
