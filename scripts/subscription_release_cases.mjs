import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runSubscriptionAndReferralReleaseTests(db) {
  const inviter = randomUUID(),
    friend = randomUUID(),
    outsider = randomUUID();
  const jwt = (id) => JSON.stringify({ sub: id, role: 'authenticated' });
  const authenticate = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,true)", [jwt(id)]);
    await db.exec('set role authenticated');
  };
  const admin = async () => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims','',true)");
  };
  const scalar = async (query, args = []) => (await db.query(query, args)).rows[0]?.result;
  const denied = async (run, expected) => {
    await db.exec('savepoint denied');
    await assert.rejects(run, expected);
    await db.exec('rollback to denied; release denied');
  };
  await db.exec('begin');
  try {
    for (const [i, id] of [inviter, friend, outsider].entries()) {
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at,created_at) values($1,$2,now(),now()-case when $3::int=2 then interval '8 days' else interval '0' end)",
        [id, 'release' + i + '@example.invalid', i],
      );
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,height_cm,sex,country,timezone) values($1,$2,'Release',current_date-interval '36 years',190,'male',$3,'UTC')",
        [id, 'release' + i, i === 1 ? 'IN' : 'US'],
      );
    }
    await db.query(
      "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee) values(gen_random_uuid(),$1,'maintain','moderate',80,0,2500,128,334,72,1600,2500)",
      [inviter],
    );
    await authenticate(inviter);
    const link = await scalar('select public.get_coin_referral_link() as result');
    assert.equal(await scalar('select public.get_coin_referral_link() as result'), link);
    assert.equal(
      await scalar('select public.claim_coin_referral($1) as result', [link]),
      'ineligible',
    );
    assert.equal(
      (await scalar('select public.get_plus_trial_offer(null) as result')).eligible,
      false,
    );
    await denied(
      () => db.query('select public.claim_plus_trial($1,$2)', [randomUUID(), 'fixture']),
      /TRIAL_NOT_ELIGIBLE/,
    );
    await denied(() => db.query('select * from public.coin_referral_links'), /permission denied/);

    await authenticate(outsider);
    assert.equal(
      await scalar('select public.claim_coin_referral($1) as result', [link]),
      'ineligible',
    );
    await authenticate(friend);
    assert.equal(
      await scalar('select public.claim_coin_referral($1) as result', [link]),
      'setup_required',
    );
    const firstGoal = randomUUID();
    // 2,842 kcal displayed after a 200 kcal cut. 3,000 is within 500 of 2,842 and safe.
    const insert = (id, kcal, rate, reference) =>
      db.query(
        `
      insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,
        daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros,
        recompute_reason,macro_reference_adjustment_kcal)
      values($1,$2,'cut','moderate',95,$3,$4,209,245,114,1963,3042,5,190,true,'initial_onboarding',$5)`,
        [id, friend, rate, kcal, reference],
      );
    await insert(firstGoal, 3000, 0.04, 200);
    await db.query(
      'update public.goal_profiles set macro_reference_adjustment_kcal=0 where id=$1',
      [firstGoal],
    );
    assert.equal(
      await scalar(
        'select macro_reference_adjustment_kcal as result from public.goal_profiles where id=$1',
        [firstGoal],
      ),
      200,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        await scalar('select public.claim_coin_referral($1) as result', [link]),
        'claimed',
      );

    await admin();
    const paid = (event, owner, product, provider, checkout, periodEnd) =>
      scalar(
        `
      select public.apply_revenuecat_event($1,'INITIAL_PURCHASE',$2,$3,$4,now()+$5::interval,
        now(),jsonb_build_object('event',jsonb_build_object('original_transaction_id',$6::text))) as result`,
        [event, owner, product, provider, periodEnd, checkout],
      );
    const reserve = (owner, request, provider, product) =>
      scalar('select public.reserve_web_checkout($1,$2,$3,$4,$5) as result', [
        owner,
        request,
        provider,
        product,
        'plan_fixture',
      ]);
    await denied(
      () => reserve(friend, randomUUID(), 'razorpay', 'plus_monthly'),
      /INVALID_CHECKOUT/,
    );
    await denied(
      () => reserve(friend, randomUUID(), 'razorpay', 'plus_semiannual'),
      /INVALID_CHECKOUT/,
    );
    const initialRequest = randomUUID();
    const reservation = await reserve(friend, initialRequest, 'razorpay', 'pro_semiannual');
    assert.equal(reservation.trial_end, null);
    assert.equal(
      (await reserve(friend, initialRequest, 'razorpay', 'pro_semiannual')).cached,
      true,
    );
    const trialResponse = await scalar(
      `
      select public.apply_revenuecat_event('retired-native-trial','INITIAL_PURCHASE',$1,'plus_annual','APP_STORE',
        now()+interval '7 days',now(),'{"event":{"period_type":"TRIAL"}}') as result`,
      [outsider],
    );
    assert.equal(trialResponse.status, 'trial_retired');
    await paid(
      'paid-referral-one',
      friend,
      'pro_semiannual',
      'razorpay',
      'sub_release',
      '6 months',
    );
    await paid(
      'paid-referral-repeat',
      friend,
      'pro_semiannual',
      'razorpay',
      'sub_release',
      '6 months',
    );
    assert.equal(
      await scalar('select period as result from public.entitlements where user_id=$1', [friend]),
      'semiannual',
    );
    assert.equal(
      await scalar(
        "select sum(delta)::int as result from public.cc_ledger where user_id=$1 and reason like 'referral_%'",
        [inviter],
      ),
      115,
    );
    assert.equal(
      await scalar(
        "select sum(delta)::int as result from public.cc_ledger where user_id=$1 and reason like 'referral_%'",
        [friend],
      ),
      15,
    );
    await authenticate(inviter);
    assert.equal(
      await scalar(
        "select amount as result from public.get_coin_earn_options() where action='referral_purchase'",
      ),
      100,
    );
    console.log(
      'Subscription release SQL: stable macro reference, 6-month purchases, retired trials and replay-safe coin rewards passed',
    );
  } finally {
    await db.exec('reset role; rollback');
  }
}
