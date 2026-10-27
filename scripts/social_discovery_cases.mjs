import assert from 'node:assert/strict';
export async function runSocialDiscoveryTests(db) {
  const uid = (i) => `ab000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = (i) => `ac000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  };
  await admin();
  for (let i = 1; i <= 37; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `browse${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'UTC')",
      [uid(i), `browse_${String(i).padStart(2, '0')}`, `Browse ${i}`],
    );
    await db.query(
      "insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee) values($1,$2,'moderate',70,0,2500,150,80,295,1700,2500)",
      [uid(i), i % 2 ? 'maintain' : 'bulk'],
    );
  }
  const browse = (goal = null, query = '', after = '', random = false, actor = uid(1)) =>
    scalar('select public.browse_social_profiles($1,$2,$3,$4,$5)', [
      goal,
      query,
      after,
      random,
      actor,
    ]);
  await test('Free discovery filters current goals, while username search spans categories', async () => {
    await user(1);
    const bulk = await browse('bulk', 'browse_');
    // Username takes precedence over goal, including maintain profiles.
    assert(bulk.some((p) => p.id === uid(3)));
    const filtered = await browse('bulk');
    assert(filtered.some((p) => p.id === uid(2)));
    assert(!filtered.some((p) => p.id === uid(3)));
    assert(!filtered.some((p) => p.id === uid(1)));
    assert.equal((await browse('cut', '@BROWSE_03'))[0].id, uid(3));
    assert.equal((await browse(null, '_03'))[0].id, uid(3));
  });
  await test('Discovery pages all results without repeats and random preview is a real safe profile', async () => {
    await user(1);
    const first = await browse(null, 'browse_');
    assert.equal(first.length, 30);
    const second = await browse(null, 'browse_', first.at(-1).username);
    assert.equal(second.length, 6);
    assert.equal(new Set([...first, ...second].map((p) => p.id)).size, 36);
    const preview = await browse(null, 'browse_', '', true);
    assert.equal(preview.length, 1);
    assert(first.concat(second).some((p) => p.id === preview[0].id));
    for (const p of [...first, ...second])
      for (const field of [
        'email',
        'date_of_birth',
        'current_weight_kg',
        'daily_calorie_target',
        'goal',
      ])
        assert.equal(p[field], undefined);
  });
  await test('Discovery excludes hidden and blocked accounts and rejects actor spoofing and anonymous access', async () => {
    await admin();
    await db.query('update public.profiles set discoverable=false where id=$1', [uid(2)]);
    await user(1);
    await db.query('select public.block_social_profile($1,$2)', [uid(1), uid(3)]);
    assert.equal((await browse(null, 'browse_02')).length, 0);
    assert.equal((await browse(null, 'browse_03')).length, 0);
    await assert.rejects(() => browse(null, '', '', false, uid(2)), /NOT_AUTHORIZED/);
    await assert.rejects(() => browse('other'), /INVALID_GOAL/);
    await admin();
    await db.exec('set role anon');
    await assert.rejects(() => browse(), /permission denied/);
  });
  const friend = async (a, b, n) => {
    await user(a);
    await db.query('select public.send_friend_request($1,$2,$3)', [uid(a), rid(n), uid(b)]);
    await user(b);
    await db.query("select public.respond_friend_request($1,$2,'accept')", [uid(b), rid(n)]);
  };
  await test('Free squad creation requires accepted friends, enforces one friend and retries without extra invites', async () => {
    await friend(4, 5, 1);
    await friend(4, 6, 2);
    await user(4);
    const create = (ids, id = rid(10)) =>
      scalar("select public.create_squad_with_friends($1,'My squad',$2)", [id, ids]);
    await assert.rejects(() => create([uid(7)]), /PROFILE_UNAVAILABLE/);
    await assert.rejects(() => create([uid(5), uid(6)]), /ROOM_FULL/);
    const room = await create([uid(5)]);
    assert.equal(room.room_id, rid(10));
    await create([uid(5)]);
    await admin();
    assert.equal(
      await scalar('select count(*)::int from public.room_requests where room_id=$1', [
        room.room_id,
      ]),
      1,
    );
    assert.equal(
      await scalar(
        "select count(*)::int from public.room_members where room_id=$1 and status='active'",
        [room.room_id],
      ),
      1,
    );
    await user(5);
    const request = await scalar('select id from public.room_requests where room_id=$1', [
      room.room_id,
    ]);
    await db.query("select public.respond_to_request($1,'accept')", [request]);
    assert.equal(await scalar('select public.room_cap($1)', [room.room_id]), 2);
  });
  await test('Plus squad batches are atomic; new members still accept invitations before sharing', async () => {
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','paid',now()+interval '1 day') on conflict(user_id) do update set tier='plus',status='paid',period_end=excluded.period_end",
      [uid(8)],
    );
    for (let i = 9; i <= 12; i++) await friend(8, i, 20 + i);
    await user(8);
    await assert.rejects(
      () =>
        scalar("select public.create_squad_with_friends($1,'Invalid batch',$2)", [
          rid(20),
          [uid(9), uid(13)],
        ]),
      /PROFILE_UNAVAILABLE/,
    );
    const room = await scalar("select public.create_squad_with_friends($1,'Plus squad',$2)", [
      rid(21),
      [9, 10, 11, 12].map(uid),
    ]);
    await admin();
    assert.equal(await scalar('select count(*)::int from public.rooms where id=$1', [rid(20)]), 0);
    assert.equal(
      await scalar('select count(*)::int from public.room_requests where room_id=$1', [
        room.room_id,
      ]),
      4,
    );
    assert.equal(
      await scalar('select count(*)::int from public.room_members where room_id=$1', [
        room.room_id,
      ]),
      1,
    );
  });
  await test('Friend sends and acceptance enqueue once; request opt-out and pause are honored', async () => {
    await admin();
    await db.query(
      "insert into public.devices(user_id,fcm_token,platform) values($1,'test-device-token-browse-30','android'),($2,'test-device-token-browse-31','android')",
      [uid(30), uid(31)],
    );
    await user(30);
    await db.query('select public.send_friend_request($1,$2,$3)', [uid(30), rid(40), uid(31)]);
    await db.query('select public.send_friend_request($1,$2,$3)', [uid(30), rid(40), uid(31)]);
    await user(31);
    await db.query("select public.respond_friend_request($1,$2,'accept')", [uid(31), rid(40)]);
    await db.query("select public.respond_friend_request($1,$2,'accept')", [uid(31), rid(40)]);
    await admin();
    const queue = (
      await db.query("select * from public.push_notification_queue where data->>'requestId'=$1", [
        rid(40),
      ])
    ).rows;
    assert.equal(queue.length, 2);
    assert(queue.every((item) => item.status === 'pending' && item.data.url === '/friends'));
    assert(queue.some((item) => item.user_id === uid(30)));
    assert(queue.some((item) => item.user_id === uid(31)));
    await db.query(
      'update public.notification_settings set room_requests_enabled=false where user_id=$1',
      [uid(31)],
    );
    await user(32);
    await db.query('select public.send_friend_request($1,$2,$3)', [uid(32), rid(41), uid(31)]);
    await admin();
    assert.equal(
      await scalar(
        "select skip_reason from public.push_notification_queue where data->>'requestId'=$1",
        [rid(41)],
      ),
      'type_disabled',
    );
    await db.query('update public.notification_settings set pause_all=true where user_id=$1', [
      uid(31),
    ]);
    await user(33);
    await db.query('select public.send_friend_request($1,$2,$3)', [uid(33), rid(42), uid(31)]);
    await admin();
    assert.equal(
      await scalar(
        "select skip_reason from public.push_notification_queue where data->>'requestId'=$1",
        [rid(42)],
      ),
      'pause_all',
    );
  });
  await admin();
  console.log(`Social discovery database tests: ${passed} passed, 0 failed`);
}
