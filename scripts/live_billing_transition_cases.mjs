import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export async function runLiveBillingTransitionTests(db) {
  await db.exec('reset role');
  const ids = ['fe000000-0000-4000-8000-000000000001', 'fe000000-0000-4000-8000-000000000002'];
  for (const [i, uid] of ids.entries()) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid,
      `cutover${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Billing','1995-01-01','male',175,'UTC')",
      [uid, `cutover${i}`],
    );
  }
  await db.exec('set role service_role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: 'service_role' }),
  ]);
  const grant = async (uid, name, product) => {
    const checkout = (
      await db.query(
        "insert into public.dodo_checkouts(id,user_id,product_key,product_id) values($3,$1,'pro_annual',$2) returning id",
        [uid, product, randomUUID()],
      )
    ).rows[0].id;
    await db.query(
      "select public.apply_dodo_event($1,'INITIAL_PURCHASE','pro_annual',now()+interval '1 year',now(),$2,$3,$4,$5,$6)",
      [
        name,
        `sub_${name}`,
        `cus_${name}`,
        product,
        checkout,
        JSON.stringify({ event: { original_transaction_id: `sub_${name}` } }),
      ],
    );
  };
  await grant(ids[0], 'test_only', 'pdt_0NqcXelIZAyFcdi7QqLFp');
  await grant(ids[1], 'test_history', 'pdt_0NqcXelIZAyFcdi7QqLFp');
  await grant(ids[1], 'live_purchase', 'pdt_live_regression');
  await db.exec('reset role');
  const migration = await readFile(
    'supabase/migrations/20261027000003_retire_dodo_test_access.sql',
    'utf8',
  );
  await db.exec(migration);
  assert.equal(
    (await db.query('select status from public.entitlements where user_id=$1', [ids[0]])).rows[0]
      .status,
    'lapsed',
  );
  await db.exec('set role service_role');
  assert.equal(
    (await db.query('select public.check_ai_food_photo_access($1) as access', [ids[0]])).rows[0]
      .access.allowed,
    false,
  );
  console.log('PASS Live cutover retires test purchases and removes unpaid AI access');
  const live = (
    await db.query(
      'select status,original_transaction_id from public.entitlements where user_id=$1',
      [ids[1]],
    )
  ).rows[0];
  assert.deepEqual(live, { status: 'paid', original_transaction_id: 'sub_live_purchase' });
  console.log('PASS Historical test checkouts cannot revoke a newer live purchase');
  await db.exec('reset role');
  await db.exec(migration);
  assert.equal(
    (await db.query('select status from public.entitlements where user_id=$1', [ids[1]])).rows[0]
      .status,
    'paid',
  );
  console.log('PASS Live cutover repair is safe to retry');
  console.log('Live billing transition database tests: 3 passed, 0 failed');
}
