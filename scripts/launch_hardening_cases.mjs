import assert from 'node:assert/strict';
export async function runLaunchHardeningTests(db) {
  await db.exec("reset role; begin; select set_config('request.jwt.claims','',false)");
  const owner = 'fa160000-0000-4000-8000-000000000001',
    other = 'fa160000-0000-4000-8000-000000000002',
    meal = 'fa160000-0000-4000-8000-000000000003';
  const actor = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  try {
    await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [
      owner,
      'launch1@example.invalid',
      other,
      'launch2@example.invalid',
    ]);
    await db.exec("update public.avatar_config set value='true'::jsonb where key='avatar_enabled'");
    await actor(owner);
    const reward = (await db.query('select public.get_avatar_reward_state() as result')).rows[0]
      .result;
    assert(!('products' in reward));
    assert(!('ledger' in reward));
    assert.equal(reward.balances.earned, 0);
    for (let i = 0; i < 2; i++)
      await db.query(
        "insert into public.saved_meals(id,user_id,name,items) values($1,$2,'Breakfast shake','[]') on conflict(id) do update set name=excluded.name",
        [meal, owner],
      );
    assert.equal(
      (await db.query('select * from public.saved_meals where id=$1', [meal])).rows.length,
      1,
    );
    await actor(other);
    assert.equal(
      (await db.query('select * from public.saved_meals where id=$1', [meal])).rows.length,
      0,
    );
    assert.equal(
      (await db.query('delete from public.saved_meals where id=$1 returning id', [meal])).rows
        .length,
      0,
    );
    await db.exec('savepoint denied');
    let denied = false;
    try {
      await db.query(
        "insert into public.saved_meals(id,user_id,name) values(gen_random_uuid(),$1,'Attack')",
        [owner],
      );
    } catch {
      denied = true;
      await db.exec('rollback to denied');
    }
    await db.exec('release denied');
    assert(denied);
    await db.exec('reset role');
    await db.exec('delete from public.push_notification_queue');
    assert.equal(
      (await db.query('select public.process_push_notifications_cron() as result')).rows[0].result,
      null,
    );
    console.log(
      'PASS Launch hardening: saved-meal retries, owner-only reads/writes/deletes and idle push guard',
    );
  } finally {
    await db.exec('reset role; rollback');
  }
}
