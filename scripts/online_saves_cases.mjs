import assert from 'node:assert/strict';
export async function runOnlineSaveTests(db) {
  const uid = (value) => `f2010000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const asUser = async (id) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const change = (id, owner, amount = 250) => ({
    id,
    entity: 'water_logs',
    operation: 'upsert',
    payload: {
      id,
      user_id: owner,
      amount_ml: amount,
      local_date: '2026-11-02',
      logged_at: '2026-11-02T12:00:00Z',
    },
  });
  const save = (changes) =>
    db.query('select public.save_tracking_changes($1::jsonb)', [JSON.stringify(changes)]);
  const reject = async (changes, pattern) => {
    await db.exec('savepoint invalid_save');
    await assert.rejects(() => save(changes), pattern);
    await db.exec('rollback to savepoint invalid_save');
  };
  await admin();
  await db.exec('begin');
  try {
    for (const id of [uid(1), uid(2)]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id}@example.com`]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Online test','1995-01-01','male',175,'UTC')",
        [id, `online_${id.slice(-2)}`],
      );
    }
    await asUser(uid(1));
    await save([change(uid(10), uid(1)), change(uid(11), uid(1), 500)]);
    await save([change(uid(10), uid(1)), change(uid(11), uid(1), 500)]);
    assert.equal((await db.query('select count(*)::int as n from public.water_logs')).rows[0].n, 2);
    assert.equal(
      (await db.query('select sum(amount_ml)::int as n from public.water_logs')).rows[0].n,
      750,
    );
    await reject([change(uid(12), uid(1)), change(uid(13), uid(1), -1)], /check constraint/);
    assert.equal((await db.query('select count(*)::int as n from public.water_logs')).rows[0].n, 2);
    await reject([change(uid(12), uid(2))], /NOT_AUTHORIZED/);
    await reject([{ ...change(uid(12), uid(1)), entity: 'entitlements' }], /INVALID_SAVE/);
    await reject(
      [
        {
          ...change(uid(12), uid(1)),
          payload: { ...change(uid(12), uid(1)).payload, extra_column: 'bad' },
        },
      ],
      /INVALID_SAVE_COLUMN/,
    );
    await asUser(uid(2));
    await reject(
      [{ id: uid(10), entity: 'water_logs', operation: 'delete', payload: {} }],
      /SAVE_NOT_ALLOWED/,
    );
    await reject([{ ...change(uid(10), uid(2)) }], /row-level security/);
    assert.equal((await db.query('select count(*)::int as n from public.water_logs')).rows[0].n, 0);
    await admin();
    await db.exec('set role anon');
    await reject([change(uid(14), uid(1))], /permission denied/);
    await admin();
    console.log(
      'Online saves: 10 atomicity, idempotency, actor, RLS, whitelist and permission checks passed',
    );
  } finally {
    await admin();
    await db.exec('rollback');
  }
}
