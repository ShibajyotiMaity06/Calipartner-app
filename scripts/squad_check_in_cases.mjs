import assert from 'node:assert/strict';

export async function runSquadCheckInTests(db) {
  const uid = (i) => `f1010000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const room = 'f1020000-0000-4000-8000-000000000001';
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const day = async () =>
    (await db.query('select public.get_squad_day($1) as day', [room])).rows[0].day;
  const save = async (i, share = true) => {
    await user(i);
    await db.query(
      `insert into public.squad_check_ins(id,user_id,room_id,local_date,activities,note,share_with_squad,occurred_at) select $1,$2,$3,(now() at time zone timezone)::date,array['rest'],'A quiet day',$4,now() from public.profiles where id=$2 on conflict(user_id,room_id,local_date) do update set note=excluded.note`,
      [uid(100 + i), uid(i), room, share],
    );
  };
  const reject = async (sql, params, pattern) => {
    await db.exec('savepoint rejected');
    await assert.rejects(() => db.query(sql, params), pattern);
    await db.exec('rollback to savepoint rejected');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 22; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `checkin${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'Pacific/Kiritimati')",
        [uid(i), `checkin_${i}`, `Check-in ${i}`],
      );
    }
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'pro','paid',now()+interval '1 year'),($2,'plus','paid',now()+interval '1 year')",
      [uid(0), uid(1)],
    );
    await user(0);
    const created = (
      await db.query("select public.create_room_v3($1,'Check-in squad') as room", [room])
    ).rows[0].room;
    await user(1);
    await db.query('select public.join_by_code($1)', [created.code]);
    await save(0);
    await save(0);
    assert.equal((await day()).members.length, 2);
    assert.equal((await day()).members.filter((m) => m.checked_in).length, 1);
    assert.equal(
      (await db.query('select count(*)::int as count from public.squad_check_ins')).rows[0].count,
      1,
    );
    for (let i = 2; i < 20; i++) {
      await user(i);
      await db.query('select public.join_by_code($1)', [created.code]);
    }
    for (let i = 1; i < 14; i++) await save(i, i !== 2);
    await user(1);
    let result = await day();
    assert.equal(result.members.length, 20);
    assert.equal(result.members.filter((m) => m.checked_in === true).length, 13);
    assert.equal(result.members.find((m) => m.user_id === uid(2)).checked_in, null);
    assert.equal(result.members.find((m) => m.user_id === uid(2)).note, null);
    assert.equal(result.members.find((m) => m.user_id === uid(0)).note, 'A quiet day');
    assert.equal(
      (await db.query('select count(*)::int as count from public.squad_check_ins')).rows[0].count,
      1,
    );
    await user(3);
    result = await day();
    assert.equal(result.members.find((m) => m.user_id === uid(0)).note, null);
    assert.deepEqual(result.members.find((m) => m.user_id === uid(0)).activities, []);
    await reject(
      'insert into public.squad_check_ins(id,user_id,room_id,local_date,occurred_at) values($1,$2,$3,current_date,now())',
      [uid(200), uid(0), room],
      /row-level security/,
    );
    await reject(
      "insert into public.squad_check_ins(id,user_id,room_id,local_date,occurred_at) values($1,$2,$3,'1999-01-01',now())",
      [uid(201), uid(3), room],
      /row-level security/,
    );
    await user(21);
    await reject('select public.get_squad_day($1)', [room], /NOT_ROOM_MEMBER/);
    await admin();
    await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
      uid(1),
      uid(0),
    ]);
    await user(1);
    assert.ok(!(await day()).members.some((m) => m.user_id === uid(0)));
    await admin();
    await db.query("update public.room_members set status='left' where room_id=$1 and user_id=$2", [
      room,
      uid(1),
    ]);
    await user(1);
    await reject('select public.get_squad_day($1)', [room], /NOT_ROOM_MEMBER/);
    await user(0);
    const recipe = (
      await db.query(
        'select id from public.recipes where source_recipe is not null and not public.is_starter_recipe(id) limit 1',
      )
    ).rows[0].id;
    await db.query('select public.set_recipe_favorite($1,true)', [recipe]);
    await db.query('select public.set_recipe_favorite($1,true)', [recipe]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int as count from public.recipe_favorites where recipe_id=$1',
          [recipe],
        )
      ).rows[0].count,
      1,
    );
    await db.query('select public.set_recipe_favorite($1,false)', [recipe]);
    await db.query('select public.set_recipe_favorite($1,false)', [recipe]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int as count from public.recipe_favorites where recipe_id=$1',
          [recipe],
        )
      ).rows[0].count,
      0,
    );
    await user(3);
    await reject('select public.set_recipe_favorite($1,true)', [recipe], /RECIPE_UNAVAILABLE/);
    console.log(
      'Squad check-in and supplied-recipe database scenarios: passed (2/20 members, privacy, RLS, retries and favorites)',
    );
  } finally {
    await db.exec('rollback;reset role');
  }
}
