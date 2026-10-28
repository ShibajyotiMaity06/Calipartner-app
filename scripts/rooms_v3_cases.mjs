import assert from 'node:assert/strict';
export async function runRoomTests(db) {
  let passed = 0;
  const uid = (i) => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = (i) => `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const scalar = async (sql, args = []) =>
    Object.values((await db.query(sql, args)).rows[0] ?? { value: null })[0];
  const user = async (i) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const admin = () => db.exec(`reset role; select set_config('request.jwt.claims','',false);`);
  const test = async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log(`PASS ${name}`);
    } catch (error) {
      throw new Error(name, { cause: error });
    }
  };
  const fails = async (sql, pattern, args = []) =>
    assert.rejects(() => db.query(sql, args), pattern);
  const plan = async (i, tier, status = 'paid', end = '2099-01-01') => {
    await admin();
    await db.query(
      `insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,$4) on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,period_end=excluded.period_end`,
      [uid(i), tier, status, end],
    );
  };
  const create = async (i, n) => {
    await user(i);
    return scalar(`select public.create_room_v3($1,$2)`, [rid(n), `Room ${n}`]);
  };
  const join = async (i, code) => {
    await user(i);
    return scalar('select public.join_by_code($1,$2)', [code, null]);
  };
  for (let i = 1; i <= 30; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `room_v3_${i}@example.com`,
    ]);
    await db.query(
      `insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'UTC')`,
      [uid(i), `room_v3_${i}`, `Person ${i}`],
    );
  }
  let free, plus;
  await test('Free creates a pair without consuming a trial', async () => {
    free = await create(1, 1);
    assert.equal(free.room_id, rid(1));
    assert.equal(await scalar('select public.room_cap($1)', [rid(1)]), 2);
    assert.equal(
      await scalar('select trial_started_at from public.entitlements where user_id=$1', [uid(1)]),
      null,
    );
  });
  await test('Free creation is idempotent and never archives another room', async () => {
    assert.equal((await create(1, 1)).room_id, rid(1));
    await fails('select public.create_room_v3($1,$2)', /HOSTED_ROOM_LIMIT/, [rid(2), 'Second']);
    assert.equal(await scalar('select state from public.rooms where id=$1', [rid(1)]), 'dormant');
  });
  await test('Both members can join free, but a third is denied', async () => {
    await join(2, free.code);
    await join(2, free.code);
    assert.equal(await scalar('select public.room_is_usable($1)', [rid(1)]), true);
    await user(3);
    await fails('select public.join_by_code($1,$2)', /ROOM_FULL/, [free.code, null]);
  });
  await test('Free cannot send chat through either RPC or table write', async () => {
    await user(1);
    await db.query(`select public.accept_chat_terms()`);
    await fails('select public.send_chat_message($1,$2,$3)', /PLUS_REQUIRED/, [
      rid(1),
      'free-chat',
      'Hello',
    ]);
    await fails(
      `insert into public.chat_messages(client_id,room_id,sender_id,text) values('direct-free',$1,$2,'Hello')`,
      /PLUS_REQUIRED/,
      [rid(1), uid(1)],
    );
  });
  await test('Plus hosts three rooms of five; a sixth member and a fourth room are denied', async () => {
    await plan(4, 'plus');
    plus = await create(4, 4);
    await create(4, 5);
    await create(4, 6);
    await fails('select public.create_room_v3($1,$2)', /HOSTED_ROOM_LIMIT/, [rid(9), 'Fourth']);
    for (const i of [5, 6, 7, 8]) await join(i, plus.code);
    await user(9);
    await fails('select public.join_by_code($1,$2)', /ROOM_FULL/, [plus.code, null]);
  });
  await test('Pro hosts five rooms and admits a sixth free member', async () => {
    await plan(4, 'pro');
    for (const n of [7, 8]) await create(4, n);
    await fails('select public.create_room_v3($1,$2)', /HOSTED_ROOM_LIMIT/, [rid(9), 'Sixth']);
    await join(9, plus.code);
    assert.equal(await scalar('select public.room_cap($1)', [rid(4)]), 20);
  });
  await test('Plus can chat; a free member cannot read or impersonate the sender', async () => {
    await plan(1, 'plus');
    await user(1);
    await scalar('select public.send_chat_message($1,$2,$3)', [rid(1), 'plus-chat', 'Hello']);
    await user(2);
    await db.query('select public.accept_chat_terms()');
    assert.equal(
      await scalar('select count(*)::int from public.chat_messages where room_id=$1', [rid(1)]),
      0,
    );
    await fails('select public.send_chat_message($1,$2,$3)', /PLUS_REQUIRED/, [
      rid(1),
      'plus-chat',
      'stolen',
    ]);
    await user(1);
    await fails('select public.send_chat_message($1,$2,$3,$4)', /PRO_REQUIRED/, [
      rid(1),
      'plus-media',
      null,
      JSON.stringify([
        {
          storage_key: `rooms/${rid(1)}/messages/plus-media/0.jpg`,
          size: 10,
          mime_type: 'image/jpeg',
        },
      ]),
    ]);
    await plan(1, 'pro');
    await user(1);
    await scalar('select public.send_chat_message($1,$2,$3,$4)', [
      rid(1),
      'pro-media',
      null,
      JSON.stringify([
        {
          storage_key: `rooms/${rid(1)}/messages/pro-media/0.mp4`,
          size: 10,
          mime_type: 'video/mp4',
        },
      ]),
    ]);
  });
  await test('Free snapshot hides all extra metrics and never leaks base tables', async () => {
    await admin();
    await db.query(
      `update public.room_members set privacy_settings=privacy_settings || '{"share_calories_macros":true}'::jsonb where room_id=$1 and user_id=$2`,
      [rid(1), uid(1)],
    );
    await user(2);
    const snapshot = await scalar('select public.get_room_snapshot($1,null,null,1,20)', [rid(1)]);
    assert.equal(snapshot.caller_id, uid(2));
    const peer = snapshot.members.find((m) => m.user_id === uid(1));
    assert.equal(peer.metrics.steps, 'locked');
    assert.equal(peer.metrics.weight_kg, 'locked');
    assert.equal(peer.metrics.macros.fat, undefined);
    assert.equal(peer.metrics.macros.fiber, 0);
    assert.equal(
      await scalar('select count(*)::int from public.profiles where id=$1', [uid(1)]),
      0,
    );
    assert.equal(
      await scalar('select count(*)::int from public.workouts where user_id=$1', [uid(1)]),
      0,
    );
    await user(3);
    await fails('select public.get_room_snapshot($1,null,null,1,20)', /NOT_ROOM_MEMBER/, [rid(1)]);
  });

  await test('Room summaries use each member own time zone without changing shared privacy', async () => {
    await admin();
    await db.query("update public.profiles set timezone='Pacific/Kiritimati' where id=$1", [
      uid(1),
    ]);
    await db.query("update public.profiles set timezone='America/Los_Angeles' where id=$1", [
      uid(2),
    ]);
    await db.query(
      `insert into public.daily_summaries(user_id,local_date,calories) values($1,(now() at time zone 'Pacific/Kiritimati')::date::text,888) on conflict(user_id,local_date) do update set calories=888`,
      [uid(1)],
    );
    await db.query(
      `insert into public.daily_summaries(user_id,local_date,calories) values($1,(now() at time zone 'America/Los_Angeles')::date::text,777) on conflict(user_id,local_date) do update set calories=777`,
      [uid(2)],
    );
    await user(2);
    const snapshot = await scalar('select public.get_room_snapshot($1,null,null,1,20)', [rid(1)]);
    assert.equal(snapshot.members.find((m) => m.user_id === uid(1)).metrics.calories, 888);
    assert.equal(snapshot.members.find((m) => m.user_id === uid(2)).metrics.calories, 777);
    await admin();
    await db.query("update public.profiles set timezone='UTC' where id in ($1,$2)", [
      uid(1),
      uid(2),
    ]);
  });
  await test('Both participants need Plus for a pair challenge; only the invitee can accept', async () => {
    await user(1);
    await fails('select public.create_pair_challenge($1,$2,$3)', /BOTH_PLUS_REQUIRED/, [
      rid(30),
      rid(1),
      uid(2),
    ]);
    await plan(2, 'plus');
    await user(1);
    await scalar('select public.create_pair_challenge($1,$2,$3)', [rid(30), rid(1), uid(2)]);
    await fails('select public.respond_pair_challenge($1,true)', /NOT_AUTHORIZED/, [rid(30)]);
    await user(2);
    await scalar('select public.respond_pair_challenge($1,true)', [rid(30)]);
    const challenges = await scalar('select public.get_pair_challenges($1)', [rid(1)]);
    assert.equal(challenges[0].status, 'active');
    await admin();
    await db.query(
      "update public.pair_challenges set started_at=now()-interval '8 days' where id=$1",
      [rid(30)],
    );
    await user(1);
    const completed = await scalar('select public.get_pair_challenges($1)', [rid(1)]);
    assert.equal(completed[0].status, 'completed');
    assert.equal(
      await scalar('select public.create_pair_challenge($1,$2,$3)', [rid(31), rid(1), uid(2)]),
      rid(31),
    );
  });
  await test('Lapsed host freezes a larger room and any eligible member can take over', async () => {
    await plan(4, 'pro', 'lapsed', '2026-01-01');
    await user(5);
    assert.equal(await scalar('select public.room_is_usable($1)', [rid(4)]), false);
    // First observed expiry anchors the actual expiration; simulate a recent expiry for takeover.
    await plan(4, 'pro', 'lapsed', new Date(Date.now() - 3600000).toISOString());
    await admin();
    await scalar('select public.recompute_room_state($1)', [rid(4)]);
    await user(5);
    await fails('select public.sponsor_room($1)', /PLAN_REQUIRED/, [rid(4)]);
    await plan(5, 'plus');
    await user(5);
    await fails('select public.sponsor_room($1)', /ROOM_FULL/, [rid(4)]);
    await plan(5, 'pro');
    await user(5);
    await scalar('select public.sponsor_room($1)', [rid(4)]);
    assert.equal(
      await scalar('select plan_holder_id::text from public.rooms where id=$1', [rid(4)]),
      uid(5),
    );
    await user(4);
    await fails('select public.sponsor_room($1)', /ROOM_NOT_LOCKED/, [rid(4)]);
  });

  await test('Workout sharing is sender-paid, idempotent, private and readable by a free recipient', async () => {
    await admin();
    await db.query(
      `insert into public.workouts(id,user_id,type,name,local_date,notes) values($1,$2,'strength','Squat day','2026-10-24','private note')`,
      [rid(50), uid(1)],
    );
    await db.query(
      `insert into public.workout_exercises(id,user_id,workout_id,exercise_name) values($1,$2,$3,'Squat')`,
      [rid(51), uid(1), rid(50)],
    );
    await db.query(
      `insert into public.workout_sets(id,user_id,workout_id,workout_exercise_id,reps,weight_kg) values($1,$2,$3,$4,5,50)`,
      [rid(52), uid(1), rid(50), rid(51)],
    );
    await user(1);
    await scalar('select public.share_room_workout($1,$2,$3)', [rid(53), rid(1), rid(50)]);
    await scalar('select public.share_room_workout($1,$2,$3)', [rid(53), rid(1), rid(50)]);
    await plan(2, 'plus', 'lapsed', new Date(Date.now() - 3600000).toISOString());
    await user(2);
    const shares = await scalar('select public.get_room_workout_shares($1)', [rid(1)]);
    assert.equal(shares.length, 1);
    assert.equal(shares[0].exercises[0].sets[0].reps, 5);
    assert.equal(shares[0].notes, undefined);
    await fails('select public.share_room_workout($1,$2,$3)', /PLUS_REQUIRED/, [
      rid(54),
      rid(1),
      rid(50),
    ]);
    await plan(2, 'plus');
    await user(2);
    await fails('select public.share_room_workout($1,$2,$3)', /WORKOUT_NOT_FOUND/, [
      rid(54),
      rid(1),
      rid(50),
    ]);
    await admin();
    await db.query(
      `update public.room_members set privacy_settings=privacy_settings || '{"share_workouts":false}'::jsonb where room_id=$1 and user_id=$2`,
      [rid(1), uid(1)],
    );
    await user(2);
    assert.deepEqual(await scalar('select public.get_room_workout_shares($1)', [rid(1)]), []);
  });
  await test('The subscription webhook recomputes every hosted room and rejects unauthorized calls and replay', async () => {
    const args = [
      'rooms-v3-renewal',
      'RENEWAL',
      uid(4),
      'pro_annual',
      'PLAY_STORE',
      '2099-01-01',
      new Date().toISOString(),
      '{}',
    ];
    await user(4);
    await fails(
      'select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7,$8)',
      /permission denied/,
      args,
    );
    await admin();
    const first = await scalar(
      'select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7,$8)',
      args,
    );
    assert.equal(first.status, 'processed');
    const replay = await scalar(
      'select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7,$8)',
      args,
    );
    assert.equal(replay.status, 'already_processed');
    assert.equal(
      await scalar(
        `select count(*)::int from public.rooms where plan_holder_id=$1 and state='locked'`,
        [uid(4)],
      ),
      0,
    );
    assert.equal(
      await scalar('select plan_holder_id::text from public.rooms where id=$1', [rid(4)]),
      uid(5),
    );
  });
  await test('Free invitations can be accepted without a trial and outsider/blocked access is denied', async () => {
    await create(10, 60);
    await user(10);
    const invite = await scalar('select public.send_room_invitation($1,$2)', [
      rid(60),
      'room_v3_11',
    ]);
    const requestId = invite.request_id ?? invite.id;
    assert.ok(requestId);
    await user(12);
    await fails('select public.respond_to_request($1,$2)', /NOT_AUTHORIZED/, [requestId, 'accept']);
    await user(11);
    await scalar('select public.respond_to_request($1,$2)', [requestId, 'accept']);
    assert.equal(
      await scalar('select trial_started_at from public.entitlements where user_id=$1', [uid(11)]),
      null,
    );
    await admin();
    await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
      uid(12),
      uid(13),
    ]);
    const blocked = await create(12, 61);
    await user(13);
    await fails('select public.join_by_code($1,$2)', /USER_BLOCKED/, [blocked.code, null]);
    await user(14);
    await fails('select public.get_room_workout_shares($1)', /NOT_ROOM_MEMBER/, [rid(60)]);
    await fails('select public.recompute_room_state($1)', /permission denied/, [rid(60)]);
  });

  await test('Late takeover and renewal cannot bypass 30 days when maintenance was delayed', async () => {
    await plan(14, 'plus');
    const late = await create(14, 70);
    await join(15, late.code);
    await join(16, late.code);
    await plan(14, 'plus', 'lapsed', new Date(Date.now() - 31 * 86400000).toISOString());
    await plan(15, 'pro');
    await user(15);
    await fails('select public.sponsor_room($1)', /ROOM_ARCHIVED/, [rid(70)]);
    await admin();
    await scalar('select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7,$8)', [
      'late-renewal',
      'RENEWAL',
      uid(14),
      'plus_annual',
      'PLAY_STORE',
      '2099-01-01',
      new Date().toISOString(),
      '{}',
    ]);
    assert.equal(await scalar('select count(*)::int from public.rooms where id=$1', [rid(70)]), 0);
  });
  await test('Deletion at 30 days retains personal tracking records', async () => {
    await admin();
    await db.query(
      `insert into public.workouts(id,user_id,type,name,local_date) values($1,$2,'strength','Keep my workout','2026-10-24')`,
      [rid(40), uid(5)],
    );
    await db.query(
      `update public.rooms set state='locked',locked_at=now()-interval '30 days' where id=$1`,
      [rid(4)],
    );
    assert.equal(await scalar('select public.recompute_room_state($1)', [rid(4)]), 'deleted');
    assert.equal(
      await scalar('select count(*)::int from public.workouts where id=$1', [rid(40)]),
      1,
    );
  });
  await test('A free pair remains active after both subscriptions lapse', async () => {
    await plan(1, 'pro', 'lapsed', new Date(Date.now() - 3600000).toISOString());
    await plan(2, 'plus', 'lapsed', new Date(Date.now() - 3600000).toISOString());
    await admin();
    assert.equal(await scalar('select public.recompute_room_state($1)', [rid(1)]), 'active');
  });
  console.log(`Database tests: ${passed} passed, 0 failed`);
}
