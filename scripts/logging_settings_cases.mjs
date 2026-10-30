import assert from 'node:assert/strict';

export async function runLoggingSettingsTests(db) {
  const id = (n) => `a9000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const asUser = async (n) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(n), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  await admin();
  for (let n = 1; n <= 5; n++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      id(n),
      `logging_${n}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm) values($1,$2,$3,'1995-01-01','male',175)",
      [id(n), `logging_${n}`, `Logging ${n}`],
    );
  }
  const custom = (n, goalId) =>
    db.query(
      `insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros)
    values($1,$2,'cut','moderate',80,0.42,2040,150,225,60,1700,2500,3,175,true)`,
      [id(goalId), id(n)],
    );
  await asUser(1);
  await assert.rejects(() => custom(1, 101), /PLUS_REQUIRED/);
  await assert.rejects(() => custom(2, 112), /NOT_AUTHORIZED/);
  await assert.rejects(
    () =>
      db.query(
        `insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros)
    values($1,$2,'cut','moderate',80,0.42,2040,150,225,60,1700,2500,3,175,false)`,
        [id(111), id(1)],
      ),
    /PLUS_REQUIRED/,
  );
  await admin();
  for (const [n, tier, status] of [
    [2, 'plus', 'paid'],
    [3, 'pro', 'paid'],
    [4, 'plus', 'lapsed'],
    [5, 'plus', 'trial'],
  ]) {
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,now()+interval '1 day')",
      [id(n), tier, status],
    );
  }
  await asUser(4);
  await assert.rejects(() => custom(4, 104), /PLUS_REQUIRED/);
  for (const n of [2, 3, 5]) {
    await asUser(n);
    await custom(n, 100 + n);
  }
  await asUser(2);
  await assert.rejects(
    () =>
      db.query('update public.goal_profiles set daily_calorie_target=1000 where id=$1', [id(102)]),
    /UNSAFE_MACROS/,
  );
  await assert.rejects(
    () =>
      db.query('update public.goal_profiles set daily_calorie_target=2041 where id=$1', [id(102)]),
    /UNSAFE_MACROS/,
  );
  await asUser(1);
  assert.equal(
    await scalar('select count(*)::int from public.goal_profiles where user_id=$1', [id(2)]),
    0,
  );
  console.log(
    'PASS Custom macros: Free/expired denied; Plus/Pro allowed; safety and owner-only reads enforced',
  );
  await admin();
  await db.query("update public.entitlements set status='lapsed' where user_id=$1", [id(2)]);
  await asUser(2);
  await db.query('update public.goal_profiles set step_goal=9999 where id=$1', [id(102)]);
  assert.equal(
    await scalar('select daily_calorie_target from public.goal_profiles where id=$1', [id(102)]),
    2040,
  );
  await assert.rejects(
    () =>
      db.query(
        'update public.goal_profiles set carb_grams=226,daily_calorie_target=2044 where id=$1',
        [id(102)],
      ),
    /PLUS_REQUIRED/,
  );
  console.log('PASS Expired plans retain saved custom macros while changing daily step goals');
  await asUser(3);
  const room = await scalar("select public.create_room_v3($1,'Logging identities')", [id(201)]);
  const request = await scalar('select public.send_room_invitation($1,$2)', [
    room.room_id,
    'logging_1',
  ]);
  const requestId = request.request_id;
  assert.ok(requestId);
  await asUser(1);
  const identities = (
    await db.query('select * from public.get_request_identities($1::uuid[])', [[requestId]])
  ).rows;
  assert.ok(identities.some((p) => p.id === id(3) && p.nickname === 'Logging 3'));
  assert.equal(await scalar('select count(*)::int from public.profiles where id=$1', [id(3)]), 0);
  await asUser(2);
  assert.equal(
    await scalar('select count(*)::int from public.get_request_identities($1::uuid[])', [
      [requestId],
    ]),
    0,
  );
  console.log(
    'PASS Invitation identities: names visible to participants; peers and private profile tables stay hidden',
  );
  await admin();
  await db.query('delete from public.rooms where id=$1', [room.room_id]);
  await db.query('delete from auth.users where id=any($1::uuid[])', [[1, 2, 3, 4, 5].map(id)]);
  console.log('Logging/settings database tests: 3 passed, 0 failed');
}
