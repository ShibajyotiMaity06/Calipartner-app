import assert from 'node:assert/strict';

export async function runWeeklyHabitTests(db) {
  const uid = (i) => `fa060000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const actor = async (id) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(id), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const rejects = async (sql, args, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to savepoint denied');
  };
  const log = 'log_weekly_plan_meal($1,$2,$3,$4,$5,$6)';
  const swap = 'swap_weekly_plan_meal($1,$2,$3,$4,$5,$6)';
  const repeat = 'repeat_previous_day_meal($1,$2,$3)';
  await admin();
  await db.exec('begin');
  try {
    for (let i = 1; i <= 2; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `habits${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Habit test','1995-01-01','male',175,'Pacific/Kiritimati')",
        [uid(i), `habits_${i}`],
      );
    }
    const meal = {
      name: 'Oat breakfast',
      ingredients: ['Oats 60 g'],
      portion: 'One bowl',
      calories: 450,
      protein: 30,
      carbs: 60,
      fat: 10,
    };
    const content = {
      days: Array.from({ length: 7 }, (_, day) => ({
        day,
        workout: { title: 'Rest', minutes: 0, exercises: [] },
        meals: [{ ...meal, alternatives: [{ ...meal, name: 'Tofu breakfast' }] }],
      })),
      workout_tips: [],
      diet_tips: [],
    };
    await db.query(
      'insert into public.personal_weekly_plans(user_id,id,preferences,content) values($1,$2,$3,$4)',
      [uid(1), uid(10), {}, content],
    );
    await actor(1);
    await rejects('select * from public.weekly_meal_actions', [], /permission denied/);
    assert.equal(await rpc(log, [uid(20), uid(10), 1, 0, 0, 'breakfast']), uid(20));
    assert.equal(await rpc(log, [uid(20), uid(10), 1, 0, 0, 'breakfast']), uid(20));
    const entry = (await db.query('select * from public.food_entries where id=$1', [uid(20)]))
      .rows[0];
    assert.equal(entry.food_name, meal.name);
    assert.equal(Number(entry.calories), 450);
    assert.deepEqual(entry.nutrition_details.not_provided, ['fiber', 'sugar', 'sodium_mg']);
    const local = (
      await db.query("select (now() at time zone 'Pacific/Kiritimati')::date::text as day")
    ).rows[0].day;
    assert.equal(new Date(entry.local_date).toISOString().slice(0, 10), local);
    await rejects(
      `select public.${log}`,
      [uid(20), uid(10), 1, 0, 0, 'lunch'],
      /IDEMPOTENCY_CONFLICT/,
    );
    await rejects(
      `select public.${log}`,
      [uid(21), uid(10), 1, 1, 0, 'lunch'],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await rejects(`select public.${log}`, [uid(21), uid(10), 9, 0, 0, 'lunch'], /PLAN_CHANGED/);
    await rejects(`select public.${log}`, [uid(21), uid(10), 1, 0, 99, 'lunch'], /INVALID_MEAL/);
    await actor(2);
    assert.equal(
      (await db.query('select * from public.food_entries where id=$1', [uid(20)])).rows.length,
      0,
    );
    await rejects(
      `select public.${log}`,
      [uid(20), uid(10), 1, 0, 0, 'breakfast'],
      /IDEMPOTENCY_CONFLICT/,
    );
    await rejects(`select public.${log}`, [uid(22), uid(10), 1, 0, 0, 'breakfast'], /PLAN_CHANGED/);
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','trial',now()+interval '7 days')",
      [uid(1)],
    );
    await actor(1);
    await rejects(
      `select public.${swap}`,
      [uid(30), uid(10), 1, 0, 0, 0],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await admin();
    await db.query("update public.entitlements set status='paid' where user_id=$1", [uid(1)]);
    await actor(1);
    assert.equal((await rpc(swap, [uid(30), uid(10), 1, 0, 0, 0])).revision, 2);
    assert.equal((await rpc(swap, [uid(30), uid(10), 1, 0, 0, 0])).revision, 2);
    assert.equal(
      (await rpc('get_personal_weekly_plan()', [])).days[0].meals[0].name,
      'Tofu breakfast',
    );
    await rejects(`select public.${swap}`, [uid(31), uid(10), 1, 0, 0, 0], /PLAN_CHANGED/);
    await rejects(`select public.${swap}`, [uid(31), uid(10), 2, 0, 0, 99], /INVALID_MEAL/);
    await rpc(log, [uid(21), uid(10), 2, 1, 0, 'lunch']);
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()-interval '1 minute' where user_id=$1",
      [uid(1)],
    );
    await actor(1);
    await rejects(
      `select public.${log}`,
      [uid(23), uid(10), 2, 2, 0, 'lunch'],
      /PURCHASED_PLUS_REQUIRED/,
    );
    assert.equal(await rpc(log, [uid(21), uid(10), 2, 1, 0, 'lunch']), uid(21));
    const next = (await db.query('select ($1::date+1)::text as day', [local])).rows[0].day;
    assert.equal(await rpc(repeat, [uid(40), next, 'breakfast']), 1);
    assert.equal(await rpc(repeat, [uid(40), next, 'breakfast']), 1);
    assert.equal(
      (await db.query("select * from public.food_entries where source='copy'")).rows.length,
      1,
    );
    assert.equal(await rpc(repeat, [uid(41), next, 'snacks']), 0);
    await actor(2);
    assert.equal(await rpc(repeat, [uid(42), next, 'breakfast']), 0);
    await rejects(`select public.${repeat}`, [uid(40), next, 'breakfast'], /IDEMPOTENCY_CONFLICT/);
    console.log(
      'Weekly habit SQL: acknowledged logs, privacy, tier gates, swaps, stored-zone dates and repeat idempotency passed',
    );
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
