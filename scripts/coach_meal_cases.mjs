import assert from 'node:assert/strict';
export async function runCoachMealTests(db) {
  const id = (i) => 'fc030000-0000-4000-8000-' + String(i).padStart(12, '0');
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const actor = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (entries) =>
    (await db.query('select public.log_coach_meal($1::jsonb) result', [JSON.stringify(entries)]))
      .rows[0].result;
  const reject = async (entries, pattern) => {
    await db.exec('savepoint invalid_meal');
    await assert.rejects(() => rpc(entries), pattern);
    await db.exec('rollback to savepoint invalid_meal');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 3; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id(i),
        'coach_meal_' + i + '@example.com',
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Coach meal','1995-01-01','male',175,'Pacific/Honolulu')",
        [id(i), 'coach_meal_' + i],
      );
    }
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'pro','paid',now()+interval '1 year'),($2,'plus','paid',now()+interval '1 year')",
      [id(0), id(1)],
    );
    await db.query(
      "insert into public.consent_records(user_id,consent_type,version,accepted_at) values($1,'ai_processing','1.0',now())",
      [id(0)],
    );
    const day = (
      await db.query("select (now() at time zone 'Pacific/Honolulu')::date::text as local_day")
    ).rows[0].local_day;
    const entry = {
      id: id(50),
      food_name: '2 boiled eggs',
      meal_section: 'lunch',
      local_date: day,
      quantity: 2,
      unit: 'eggs',
      calories: 156,
      protein: 13,
      carbs: 1,
      fat: 11,
      fiber: 0,
      sugar: 0,
      sodium_mg: 124,
    };
    await actor(2);
    await reject([entry], /UPGRADE_REQUIRED/);
    await actor(0);
    const first = await rpc([
      entry,
      { ...entry, id: id(51), food_name: 'Rice', quantity: 1, unit: 'bowl', calories: 220 },
    ]);
    assert.equal(first.length, 2);
    const again = await rpc([entry, { ...entry, id: id(51), calories: 999 }]);
    assert.equal(
      again.find((row) => row.id === id(51)).calories,
      220,
      'Lost acknowledgement retries cannot overwrite or duplicate',
    );
    assert.equal((await db.query('select count(*)::int n from public.food_entries')).rows[0].n, 2);
    await reject(
      [
        { ...entry, id: id(52) },
        { ...entry, id: id(53), calories: -1 },
      ],
      /INVALID_COACH_MEAL/,
    );
    assert.equal(
      (await db.query('select count(*)::int n from public.food_entries')).rows[0].n,
      2,
      'Malformed multi-food meals save nothing',
    );
    await reject([{ ...entry, id: id(54), user_id: id(1) }], /INVALID_COACH_MEAL/);
    await reject([entry, entry], /INVALID_COACH_MEAL/);
    for (const status of ['trial']) {
      await admin();
      await db.query('update public.entitlements set status=$1 where user_id=$2', [status, id(0)]);
      await actor(0);
      await reject([{ ...entry, id: id(55) }], /UPGRADE_REQUIRED/);
    }
    await admin();
    await db.query(
      "update public.entitlements set status='paid',period_end=now()-interval '1 day' where user_id=$1",
      [id(0)],
    );
    await actor(0);
    await reject([{ ...entry, id: id(55) }], /UPGRADE_REQUIRED/);
    await admin();
    await db.query(
      "update public.entitlements set status='paid',period_end=now()+interval '1 year' where user_id=$1",
      [id(0)],
    );
    await db.query('delete from public.consent_records where user_id=$1', [id(0)]);
    await actor(0);
    await reject([{ ...entry, id: id(55) }], /CONSENT_REQUIRED/);
    // Both squads read one diary source; food has no room-selected copies or sharing switches.
    for (let i = 0; i < 2; i++) {
      const room = id(10 + i);
      await actor(0);
      const created = (
        await db.query('select public.create_room_v3($1,$2) result', [room, 'Coach squad ' + i])
      ).rows[0].result;
      await actor(1);
      await db.query('select public.join_by_code($1)', [created.code]);
      const projection = (
        await db.query('select public.get_squad_member_details($1,$2) result', [room, id(0)])
      ).rows[0].result;
      assert.equal(projection.meals[0].items.length, 2);
      assert.equal(projection.meals[0].calories, 376);
      assert.equal(
        (
          await db.query('select count(*)::int n from public.food_entries where user_id=$1', [
            id(0),
          ])
        ).rows[0].n,
        0,
        'Peer base-table reads stay private',
      );
    }
    await actor(2);
    await db.exec('savepoint outsider');
    await assert.rejects(
      () => db.query('select public.get_squad_member_details($1,$2)', [id(10), id(0)]),
      /NOT_ROOM_MEMBER/,
    );
    await db.exec('rollback to savepoint outsider');
    console.log(
      'Coach meal SQL/RLS: confirmed atomic save, stable retries, malformed rollback, Pro/consent/ownership gates and sharing in two squads passed',
    );
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
