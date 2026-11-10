import assert from 'node:assert/strict';
export async function runWeightHistoryTests(db) {
  await db.exec('begin');
  try {
    const owner = 'f9010000-0000-4000-8000-000000000001';
    const id = 'f9010000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      owner,
      'weight-regression@example.com',
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,'weight_regression','Weight test','1995-01-01','male',175,'Pacific/Kiritimati')",
      [owner],
    );
    await db.query(
      "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee) values($1,$2,'cut','sedentary',80,0.25,2000,100,250,67,1700,2200)",
      [id, owner],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: owner, role: 'authenticated' }),
    ]);
    await db.exec('set local role authenticated');
    const today = (
      await db.query("select to_char(now() at time zone 'Pacific/Kiritimati','YYYY-MM-DD') as day")
    ).rows[0].day;
    const save = (date) =>
      db.query('select public.save_tracking_changes($1::jsonb)', [
        JSON.stringify([
          {
            id,
            entity: 'weight_logs',
            operation: 'upsert',
            payload: {
              id,
              user_id: owner,
              weight_kg: 79,
              local_date: date,
              logged_at: new Date().toISOString(),
            },
          },
        ]),
      ]);
    await save(today);
    await save(today);
    assert.equal(
      (await db.query('select count(*)::int n from public.weight_logs where user_id=$1', [owner]))
        .rows[0].n,
      1,
    );
    const progress = (await db.query("select public.get_individual_progress('30d') as data"))
      .rows[0].data;
    assert.equal(Number(progress.weight.start_weight_kg), 80);
    assert.equal(Number(progress.weight.total_change_kg), -1);
    for (const date of ['2999-01-01', '2026-02-30', 'not-a-date']) {
      await db.exec('savepoint invalid_weight');
      await assert.rejects(() => save(date), /INVALID_WEIGHT_DATE|date\/time|date out of range/);
      await db.exec('rollback to savepoint invalid_weight');
    }
    console.log(
      'Weight baseline, stored-zone date validation and acknowledged retry tests: passed',
    );
  } finally {
    await db.exec('rollback; reset role');
  }
}
