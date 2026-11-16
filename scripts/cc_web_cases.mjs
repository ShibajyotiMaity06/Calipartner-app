import assert from 'node:assert/strict';
export async function runCCWebTests(db) {
  const owner = 'cc150000-0000-4000-8000-000000000001';
  const other = 'cc150000-0000-4000-8000-000000000002';
  const id = (n) => `cc150001-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const admin = () => db.exec('reset role');
  const actor = async (uid) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  await admin();
  await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
  const pack = (await db.query('select * from public.cc_packs where active order by cc limit 1'))
    .rows[0];
  const reserve = (n, user = owner) =>
    db.query(
      "select public.reserve_cc_web_checkout($1,$2,$3,'dodo','pdt_test','USD',99) as value",
      [id(n), user, pack.id],
    );
  const apply = (n, refund = false) =>
    db.query("select public.apply_cc_web_event($1,'dodo',$2,$3,$4)", [
      id(n),
      'session_' + n,
      'pay_' + n,
      refund,
    ]);
  const balance = async () =>
    Number(
      (
        await db.query(
          'select coalesce(sum(delta),0) as balance from public.cc_ledger where user_id=$1',
          [owner],
        )
      ).rows[0].balance,
    );
  try {
    const first = (await reserve(1)).rows[0].value;
    assert.equal(first.fresh, true);
    assert.equal((await reserve(1)).rows[0].value.fresh, false);
    await assert.rejects(reserve(1, other), /CHECKOUT_CONFLICT/);
    await db.query(
      "update public.cc_web_checkouts set provider_ref='session_1',state='ready' where id=$1",
      [id(1)],
    );
    await apply(1);
    await apply(1);
    assert.equal(await balance(), pack.cc);
    await actor(other);
    assert.equal((await db.query('select * from public.cc_web_checkouts')).rows.length, 0);
    await assert.rejects(reserve(2), /permission denied/);
    await assert.rejects(apply(1), /permission denied/);
    await assert.rejects(
      db.query("update public.cc_web_checkouts set state='paid'"),
      /permission denied/,
    );
    await actor(owner);
    assert.equal((await db.query('select * from public.cc_web_checkouts')).rows.length, 1);
    await admin();
    await apply(1, true);
    await apply(1, true);
    await apply(1);
    assert.equal(await balance(), 0);
    await reserve(2);
    await db.query(
      "update public.cc_web_checkouts set provider_ref='session_2',state='ready' where id=$1",
      [id(2)],
    );
    await apply(2, true);
    await apply(2);
    assert.equal(await balance(), 0);
    await assert.rejects(
      db.query("select public.apply_cc_web_event($1,'razorpay','session_2','pay_2',false)", [
        id(2),
      ]),
      /INVALID_CC_RECEIPT/,
    );
    console.log(
      'CC web database: retries, ownership, RLS, forged writes, duplicate payments, duplicate refunds and refund-before-success passed',
    );
  } finally {
    await admin();
    await db.query('delete from auth.users where id in ($1,$2)', [owner, other]);
  }
}
