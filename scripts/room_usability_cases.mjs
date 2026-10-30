import assert from 'node:assert/strict';

export async function runRoomUsabilityTests(db) {
  const id = (n) => `fa300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (n) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(n), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const rejects = async (operation, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(operation, pattern);
    await db.exec('rollback to savepoint denied');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let n = 1; n <= 4; n++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id(n),
        `usability${n}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,timezone,date_of_birth,sex,height_cm) values($1,$2::text,$2::text,$3,'1995-01-01','male',175)",
        [id(n), `usability${n}`, n === 2 ? 'Pacific/Kiritimati' : 'America/New_York'],
      );
      if (n < 4)
        await db.query(
          "insert into public.entitlements(user_id,tier,status,period_end) values($1,'pro','paid',now()+interval '1 year')",
          [id(n)],
        );
    }
    await user(1);
    const room = await rpc('create_room_v3($1,$2)', [id(10), 'Usability']);
    await user(2);
    await rpc('join_by_code($1)', [room.code]);
    await rpc('set_privacy($1,$2)', [
      id(10),
      JSON.stringify({
        share_steps: false,
        share_water: false,
        share_meals: 'always',
        share_calories_macros: true,
      }),
    ]);
    const patched = await rpc('set_privacy($1,$2)', [
      id(10),
      JSON.stringify({ share_steps: true }),
    ]);
    assert.equal(patched.share_steps, true);
    assert.equal(patched.share_water, false);
    assert.equal(patched.share_meals, 'always');
    assert.equal(patched.share_calories_macros, true);
    await db.query(
      "insert into public.food_entries(id,user_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg,local_date,source) values($1,$2,'Partner breakfast','breakfast',100,'g',200,10,30,5,4,3,20,(now() at time zone 'Pacific/Kiritimati')::date,'search'),($3,$2,'Yesterday meal','dinner',100,'g',300,10,30,5,4,3,20,(now() at time zone 'Pacific/Kiritimati')::date-1,'search')",
      [id(20), id(2), id(21)],
    );
    await user(1);
    const meals = await rpc('get_room_meals_today($1,$2)', [id(10), id(2)]);
    assert.equal(meals.length, 1);
    assert.equal(meals[0].food_name, 'Partner breakfast');
    assert.equal(meals[0].can_copy, true);
    assert.equal(meals[0].calories, undefined);
    assert.equal(
      (await db.query('select id from public.food_entries where user_id=$1', [id(2)])).rows.length,
      0,
    );
    const args = [id(22), id(10), id(2), id(20), 'lunch'];
    const copy = await rpc('copy_room_meal($1,$2,$3,$4,$5)', args);
    assert.equal(copy.id, id(22));
    assert.equal(copy.user_id, id(1));
    assert.equal(copy.meal_section, 'lunch');
    assert.equal(Number(copy.calories), 200);
    assert.equal(Number(copy.fiber), 4);
    assert.equal(
      copy.local_date,
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()),
    );
    assert.equal((await rpc('copy_room_meal($1,$2,$3,$4,$5)', args)).id, copy.id);
    assert.equal(
      (await db.query('select id from public.food_entries where id=$1', [id(22)])).rows.length,
      1,
    );
    await rejects(
      () => rpc('copy_room_meal($1,$2,$3,$4,$5)', [...args.slice(0, 4), 'dinner']),
      /IDEMPOTENCY_CONFLICT/,
    );
    await user(2);
    await rpc('set_privacy($1,$2)', [id(10), JSON.stringify({ share_calories_macros: false })]);
    await user(1);
    assert.equal((await rpc('get_room_meals_today($1,$2)', [id(10), id(2)]))[0].can_copy, false);
    await rejects(
      () => rpc('copy_room_meal($1,$2,$3,$4,$5)', [id(23), ...args.slice(1)]),
      /PRIVACY_DENIED/,
    );
    await user(2);
    await rpc('set_privacy($1,$2)', [
      id(10),
      JSON.stringify({ share_meals: 'per_meal', share_calories_macros: true }),
    ]);
    await user(1);
    assert.deepEqual(await rpc('get_room_meals_today($1,$2)', [id(10), id(2)]), []);
    await user(2);
    await rpc('share_room_meal($1,$2,$3,$4)', [id(24), id(10), id(20), [id(1)]]);
    await user(1);
    assert.equal((await rpc('get_room_meals_today($1,$2)', [id(10), id(2)])).length, 1);
    await user(2);
    await rpc('set_privacy($1,$2)', [id(10), JSON.stringify({ share_meals: 'never' })]);
    await user(1);
    assert.deepEqual(await rpc('get_room_meals_today($1,$2)', [id(10), id(2)]), []);
    await user(3);
    await rejects(() => rpc('get_room_meals_today($1,$2)', [id(10), id(2)]), /NOT_ROOM_MEMBER/);
    await user(4);
    await rejects(() => rpc('get_room_meals_today($1,$2)', [id(10), id(2)]), /PLUS_REQUIRED/);
    await user(2);
    await rpc('set_privacy($1,$2)', [id(10), JSON.stringify({ share_meals: 'always' })]);
    await user(1);
    await rpc('block_user($1)', [id(2)]);
    await rejects(
      () => rpc('get_room_meals_today($1,$2)', [id(10), id(2)]),
      /USER_BLOCKED|NOT_ROOM_MEMBER/,
    );
    console.log('Room usability database tests: 12 passed, 0 failed');
  } finally {
    await db.exec('rollback;reset role');
  }
}
