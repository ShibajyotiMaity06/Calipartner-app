import assert from 'node:assert/strict';
export async function runCardlessTrialTests(db) {
  const uid = (i) => `ca770000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const offer = (device = 'cardless-device') =>
    scalar('select public.get_plus_trial_offer($1)', [device]);
  const claim = (id = 20, device = 'cardless-device') =>
    scalar('select public.claim_plus_trial($1,$2)', [uid(id), device]);
  const rejects = async (fn, pattern) => {
    await db.exec('savepoint denied_trial');
    await assert.rejects(fn, pattern);
    await db.exec('rollback to savepoint denied_trial');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 1; i <= 5; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `trial${i}@example.invalid`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone,country) values($1,$2,'Trial','1995-01-01','male',175,'UTC',null)",
        [uid(i), `cardless${i}`],
      );
    }
    await user(1);
    assert.equal((await offer()).eligible, true);
    const first = await claim();
    assert.equal(first.active, true);
    assert.equal(first.eligible, false);
    assert.equal(Date.parse(first.ends_at) - Date.parse(first.started_at), 7 * 86400000);
    assert.deepEqual(await claim(), first);
    assert.deepEqual(await claim(21), first);
    const pair = await scalar('select public.create_room_v3($1,$2)', [uid(40), 'Trial pair']);
    await user(5);
    await scalar('select public.join_by_code($1)', [pair.code]);
    await user(1);
    await admin();
    assert.equal(await scalar('select public.active_room_tier($1)', [uid(1)]), 'plus');
    assert.equal(
      await scalar('select count(*)::int from public.web_billing_checkouts where user_id=$1', [
        uid(1),
      ]),
      0,
    );
    assert.equal(
      await scalar('select source from public.entitlements where user_id=$1', [uid(1)]),
      'none',
    );
    await db.exec('select set_config(\'request.jwt.claims\',\'{"role":"service_role"}\',false)');
    assert.equal(
      (await scalar('select public.check_ai_coach_access($1)', [uid(1)])).allowed,
      false,
    );
    console.log(
      'PASS Cardless trial grants acknowledged seven-day Plus without country, checkout or Pro AI; retries never extend it',
    );
    await user(1);
    await rejects(
      () => db.query('select public.start_trial_if_eligible($1)', [uid(1)]),
      /permission denied/,
    );
    await rejects(
      () => db.query("update public.plus_trial_claims set ends_at=now()+interval '30 days'"),
      /permission denied/,
    );
    await user(2);
    assert.equal(await scalar('select count(*)::int from public.plus_trial_claims'), 0);
    assert.equal((await offer()).eligible, false);
    await rejects(() => claim(22), /TRIAL_NOT_ELIGIBLE/);
    await rejects(() => claim(20, 'new-device'), /NOT_AUTHORIZED/);
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,source,status,period_end) values($1,'pro','dodo','paid',now()+interval '1 year')",
      [uid(2)],
    );
    await user(2);
    await rejects(() => claim(22, 'another-device'), /TRIAL_NOT_ELIGIBLE/);
    assert.equal(
      await scalar('select tier from public.entitlements where user_id=$1', [uid(2)]),
      'pro',
    );
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,source,status,trial_started_at,period_end) values($1,'plus','none','lapsed',now()-interval '9 days',now()-interval '2 days')",
      [uid(3)],
    );
    await user(3);
    await rejects(() => claim(23, 'other-device'), /TRIAL_NOT_ELIGIBLE/);
    console.log(
      'PASS RLS, immutable claims, device/account limits and existing paid subscriptions prevent trial abuse',
    );
    await admin();
    await db.query(
      "update public.plus_trial_claims set started_at=now()-interval '8 days',ends_at=now()-interval '1 day' where user_id=$1",
      [uid(1)],
    );
    await db.query(
      "update public.entitlements set trial_started_at=now()-interval '8 days',period_end=now()-interval '1 day' where user_id=$1",
      [uid(1)],
    );
    await user(1);
    const expired = await offer();
    assert.equal(expired.active, false);
    assert.equal(expired.expired, true);
    assert.equal(expired.eligible, false);
    await admin();
    assert.equal(await scalar('select public.active_room_tier($1)', [uid(1)]), 'free');
    assert.equal(await scalar('select public.room_is_usable($1)', [pair.room_id]), true);
    await user(1);
    await rejects(
      () =>
        db.query('insert into public.fasting_settings(user_id,enabled) values($1,true)', [uid(1)]),
      /PLUS_REQUIRED/,
    );
    assert.equal((await claim(24)).active, false);
    console.log(
      'PASS Server expiry immediately returns Free access; changing request UUID cannot renew the trial',
    );
    await admin();
    await db.exec('set role service_role');
    await db.query(
      "select public.apply_revenuecat_event('cardless-retrial','INITIAL_PURCHASE',$1,'plus_monthly','APP_STORE',now()+interval '7 days',now(),jsonb_build_object('event',jsonb_build_object('period_type','TRIAL','purchased_at_ms',extract(epoch from now())*1000)))",
      [uid(1)],
    );
    assert.equal(
      await scalar('select status from public.entitlements where user_id=$1', [uid(1)]),
      'lapsed',
    );
    await user(4);
    const current = await claim(25, 'device-four');
    assert.equal(current.active, true);
    await admin();
    await db.query("update public.profiles set country='IN' where id=$1", [uid(4)]);
    await db.exec('set role service_role');
    const purchase = await scalar(
      "select public.reserve_web_checkout($1,$2,'razorpay','plus_monthly','plan_fixture')",
      [uid(4), uid(30)],
    );
    assert.equal(purchase.trial_end, null);
    await admin();
    await db.query("update public.profiles set country='US' where id=$1", [uid(5)]);
    await db.exec('set role service_role');
    await scalar("select public.reserve_web_checkout($1,$2,'dodo','plus_annual','pdt_fixture')", [
      uid(5),
      uid(31),
    ]);
    await user(5);
    await rejects(() => claim(26, 'device-five'), /TRIAL_NOT_ELIGIBLE/);
    console.log(
      'PASS Paid checkout during a cardless trial adds no mandate trial; store intro cannot restart consumed access',
    );
  } finally {
    await db.exec('rollback');
    await admin();
  }
  console.log('Cardless trial database tests: 4 passed, 0 failed');
}
