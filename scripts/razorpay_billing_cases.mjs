import assert from 'node:assert/strict';
export async function runRazorpayBillingTests(db) {
  const uid = (i) => `fa110000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const rejects = async (sql, args, pattern) => {
    await db.exec('savepoint rejected_billing');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to savepoint rejected_billing');
  };
  const reserve = (i, n, provider = 'razorpay', product = 'plus_monthly') =>
    scalar('select public.reserve_web_checkout($1,$2,$3,$4,$5)', [
      uid(i),
      uid(n),
      provider,
      product,
      'plan_Fixture',
    ]);
  const apply = (n, event, kind, end, status = 'active', subscription = 'sub_Fixture') =>
    scalar('select public.apply_razorpay_event($1,$2,$3,$4,$5,$6,$7,now(),$8)', [
      event,
      'subscription.fixture',
      uid(n),
      subscription,
      'plan_Fixture',
      kind,
      end,
      status,
    ]);
  await admin();
  await db.exec('begin');
  try {
    for (let i = 1; i <= 4; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `razorpay${i}@example.invalid`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone,country) values($1,$2,'Billing check','1995-01-01','male',175,'UTC',$3)",
        [uid(i), `rzpbilling${i}`, i === 2 ? 'US' : i === 3 ? null : 'IN'],
      );
    }
    await user(1);
    await rejects(
      'select public.reserve_web_checkout($1,$2,$3,$4,$5)',
      [uid(1), uid(10), 'razorpay', 'plus_monthly', 'plan_Fixture'],
      /permission denied/,
    );
    await rejects(
      "insert into public.web_billing_checkouts(id,user_id,provider,product_key,product_id) values($1,$2,'razorpay','plus_monthly','plan_Fixture')",
      [uid(10), uid(1)],
      /row-level security/,
    );
    await admin();
    await db.exec('set role service_role');
    await rejects(
      'select public.reserve_web_checkout($1,$2,$3,$4,$5)',
      [uid(1), uid(10), 'dodo', 'plus_monthly', 'pdt_Fixture'],
      /WRONG_BILLING_PROVIDER/,
    );
    await rejects(
      'select public.reserve_web_checkout($1,$2,$3,$4,$5)',
      [uid(2), uid(10), 'razorpay', 'plus_monthly', 'plan_Fixture'],
      /WRONG_BILLING_PROVIDER/,
    );
    await rejects(
      'select public.reserve_web_checkout($1,$2,$3,$4,$5)',
      [uid(3), uid(10), 'razorpay', 'plus_monthly', 'plan_Fixture'],
      /BILLING_COUNTRY_REQUIRED/,
    );
    const reserved = await reserve(1, 10);
    assert.equal(reserved.trial_end, null);
    // Simulate a mandate already reserved before cardless trials were introduced.
    reserved.trial_end = (
      await db.query(
        "update public.web_billing_checkouts set trial_end=date_trunc('second',now())+interval '7 days' where id=$1 returning trial_end",
        [reserved.id],
      )
    ).rows[0].trial_end;
    assert.equal((await reserve(1, 10)).cached, true);
    await rejects(
      'select public.reserve_web_checkout($1,$2,$3,$4,$5)',
      [uid(1), uid(11), 'razorpay', 'plus_monthly', 'plan_Fixture'],
      /CHECKOUT_PENDING/,
    );
    await user(2);
    assert.equal(await scalar('select count(*)::int from public.web_billing_checkouts'), 0);
    await user(1);
    assert.equal(await scalar('select count(*)::int from public.web_billing_checkouts'), 1);
    await rejects(
      'select public.apply_razorpay_event($1,$2,$3,$4,$5,$6,$7,now(),$8)',
      [
        'forged',
        'subscription.charged',
        uid(10),
        'sub_Fixture',
        'plan_Fixture',
        'paid',
        '2099-01-01',
        'active',
      ],
      /permission denied/,
    );
    console.log(
      'PASS Razorpay checkout country, service-only writes, RLS ownership, shared reservation and retry binding',
    );
    await admin();
    await db.exec('set role service_role');
    await apply(10, 'trial', 'trial', reserved.trial_end, 'authenticated');
    let ent = await scalar('select to_jsonb(e) from public.entitlements e where user_id=$1', [
      uid(1),
    ]);
    assert.equal(ent.source, 'razorpay');
    assert.equal(ent.status, 'trial');
    assert.equal(ent.tier, 'plus');
    assert.equal(Date.parse(ent.period_end), Date.parse(reserved.trial_end));
    assert.equal(
      (await apply(10, 'trial', 'trial', reserved.trial_end, 'authenticated')).status,
      'already_processed',
    );
    const until = await scalar("select (now()+interval '1 month')::text");
    await apply(10, 'paid', 'paid', until);
    ent = await scalar('select to_jsonb(e) from public.entitlements e where user_id=$1', [uid(1)]);
    assert.equal(ent.status, 'paid');
    assert.equal(ent.source, 'razorpay');
    assert.equal(await scalar('select public.active_room_tier($1)', [uid(1)]), 'plus');
    await apply(10, 'stale-trial', 'trial', reserved.trial_end, 'authenticated');
    assert.equal(
      await scalar('select status from public.entitlements where user_id=$1', [uid(1)]),
      'paid',
    );
    await apply(10, 'cancel', 'retain', null, 'cancelled');
    ent = await scalar('select to_jsonb(e) from public.entitlements e where user_id=$1', [uid(1)]);
    assert.equal(ent.status, 'paid');
    assert.equal(ent.cancel_at_period_end, true);
    assert.equal(Date.parse(ent.period_end), Date.parse(until));
    console.log(
      'PASS Signed Razorpay trials stay trials, paid events unlock, duplicate/stale events are safe and cancellation retains current access',
    );
    await apply(10, 'old-refund', 'revoke', reserved.trial_end, 'cancelled');
    assert.equal(
      await scalar('select status from public.entitlements where user_id=$1', [uid(1)]),
      'paid',
    );
    await apply(10, 'full-refund', 'revoke', until, 'cancelled');
    assert.equal(
      await scalar('select status from public.entitlements where user_id=$1', [uid(1)]),
      'lapsed',
    );
    await apply(10, 'late-capture', 'paid', until, 'cancelled');
    assert.equal(
      await scalar('select status from public.entitlements where user_id=$1', [uid(1)]),
      'lapsed',
    );
    const pro = await reserve(4, 14, 'razorpay', 'pro_monthly');
    assert.equal(pro.trial_end, null);
    await rejects(
      'select public.apply_razorpay_event($1,$2,$3,$4,$5,$6,$7,now(),$8)',
      [
        'protrial',
        'subscription.authenticated',
        uid(14),
        'sub_Pro',
        'plan_Fixture',
        'trial',
        until,
        'authenticated',
      ],
      /INVALID_RAZORPAY_TRIAL/,
    );
    await db.query(
      "insert into public.entitlements(user_id,source,tier,status,period_end) values($1,'google','pro','paid',now()+interval '1 month')",
      [uid(4)],
    );
    await rejects(
      'select public.apply_razorpay_event($1,$2,$3,$4,$5,$6,$7,now(),$8)',
      [
        'conflict',
        'subscription.charged',
        uid(14),
        'sub_Pro',
        'plan_Fixture',
        'paid',
        until,
        'active',
      ],
      /CONFLICTING_ACTIVE_SUBSCRIPTION/,
    );
    console.log(
      'PASS Current-period refunds revoke, older refunds cannot revoke renewals, Pro gets no trial and active native subscriptions cannot be overwritten',
    );
    console.log('Razorpay billing database tests: 3 passed, 0 failed');
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
