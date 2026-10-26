import assert from 'node:assert/strict';
export async function runBillingGoalTests(db) {
  const uid = 'fa000000-0000-4000-8000-000000000001';
  await db.exec('reset role');
  await db.query("insert into auth.users(id,email) values($1,'custom_plan@example.com')", [uid]);
  await db.query(
    "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,'custom_plan','Ari','1995-01-01','male',175,'UTC')",
    [uid],
  );
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  const insert = (rate, target) =>
    db.query(
      `insert into public.goal_profiles(user_id,goal,activity_level,gym_days,input_height_cm,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from,confirmed_at) values($1,'bulk','moderate',3,175,70,$2,$3,154,84,500,1700,2500,now(),now())`,
      [uid, rate, target],
    );
  await insert(2, 4700);
  console.log('PASS Custom bulk pace above the recommendation persists under owner RLS');
  await assert.rejects(() => insert(-1, 1400));
  await assert.rejects(() => insert('Infinity', 4700));
  await assert.rejects(() => insert(1, 0));
  await assert.rejects(() => insert(2, 1500));
  console.log(
    'PASS Invalid numbers, impossible macros and inconsistent calorie adjustments are rejected',
  );
  const checkout = 'fa000000-0000-4000-8000-000000000002';
  const event =
    "select public.apply_dodo_event('web-billing-regression','INITIAL_PURCHASE','pro_annual',now()+interval '1 year',now(),'sub_example','cus_example','pdt_example',$1,'{\"event\":{\"original_transaction_id\":\"sub_example\"}}')";
  await assert.rejects(() => db.query(event, [checkout]), /permission denied/);
  await assert.rejects(
    () =>
      db.query(
        "insert into public.dodo_checkouts(id,user_id,product_key,product_id) values($1,$2,'pro_annual','pdt_example')",
        [checkout, uid],
      ),
    /row-level security/,
  );
  console.log('PASS App clients cannot create server checkout records or grant Dodo access');
  await db.exec('reset role; set role service_role');
  await assert.rejects(() => db.query(event, [checkout]), /INVALID_DODO_CHECKOUT/);
  await db.query(
    "insert into public.dodo_checkouts(id,user_id,product_key,product_id) values($1,$2,'pro_annual','pdt_example')",
    [checkout, uid],
  );
  await db.query(event, [checkout]);
  const result = await db.query(
    'select source,tier,status from public.entitlements where user_id=$1',
    [uid],
  );
  assert.deepEqual(result.rows[0], { source: 'dodo', tier: 'pro', status: 'paid' });
  await db.query(event, [checkout]);
  const events = await db.query(
    "select count(*)::integer as count from public.processed_webhook_events where event_id='dodo:web-billing-regression'",
  );
  assert.equal(events.rows[0].count, 1);
  console.log(
    'PASS Verified Dodo subscriptions require an account-bound checkout and ignore replay',
  );
  await db.exec('reset role');
  await db.exec('set role authenticated');
  await assert.rejects(
    () => db.query("select public.grant_vip_pro_for_email('shibajyoti.maity06@gmail.com')"),
    /permission denied/,
  );
  await db.exec('reset role');
  const triggers = await db.query(
    "select count(*)::integer as count from pg_trigger where tgname='on_auth_user_created_vip_pro'",
  );
  assert.equal(triggers.rows[0].count, 0);
  console.log(
    'PASS Email-based automatic plan grants are disabled and cannot be called by app users',
  );
  console.log('Billing and goal database tests: 5 passed, 0 failed');
}
