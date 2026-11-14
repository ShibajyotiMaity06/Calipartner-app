import assert from 'node:assert/strict';
export async function runAvatarTests(db) {
  let passed = 0;
  const ids = [1, 2, 3].map((n) => `a8130000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  const request = (n) => `a8140000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const actor = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: ids[i], role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const test = async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log(`PASS Avatar ${name}`);
    } catch (e) {
      throw new Error(`Avatar ${name}`, { cause: e });
    }
  };
  const state = () => scalar('select public.get_avatar_state() as value');
  const create = () => scalar("select public.avatar_create('m','skin_3') as value");
  const buy = (n, id, price, collection = null) =>
    scalar('select public.avatar_purchase($1,$2,$3,$4) as value', [
      request(n),
      id,
      collection,
      price,
    ]);
  const save = (n, slots, tints = {}, gender = 'm') =>
    scalar('select public.avatar_save($1,$2,$3,$4,$5) as value', [
      request(n),
      gender,
      'skin_3',
      JSON.stringify(slots),
      JSON.stringify(tints),
    ]);
  await admin();
  for (const [i, id] of ids.entries()) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      id,
      `avatar_${i}@example.invalid`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Avatar test','1995-01-01','male',175,'America/New_York')",
      [id, `avatar_fixture_${i}`],
    );
  }
  try {
    await test('authenticated creation is idempotent, Starter Kit and 20 CC granted once', async () => {
      await actor(0);
      const first = await create();
      assert.equal(first.profile.form, 1);
      assert.equal(first.balances.earned, 20);
      assert.ok(first.products.find((p) => p.id === 'hair_crop').owned);
      assert.equal((await create()).balances.earned, 20);
      assert.equal(first.products.length, 93);
    });
    await test('fake rewards, unowned loadouts, invalid slots and foreign reads are rejected', async () => {
      await assert.rejects(
        () => scalar('select public.claim_daily_drop() as value'),
        /LOG_REQUIRED/,
      );
      await assert.rejects(
        () => db.query("select public.avatar_reward($1,'daily_drop','fake')", [ids[0]]),
        /permission denied/,
      );
      await assert.rejects(() => save(1, { top: 'top_tee' }), /INVALID_LOADOUT/);
      await assert.rejects(() => save(2, { hair: 'top_tank' }), /INVALID_LOADOUT/);
      await assert.rejects(
        () =>
          db.query(
            "insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values($1,'earned',99999,'fake','fake')",
            [ids[0]],
          ),
        /permission denied/,
      );
      await actor(1);
      await create();
      assert.equal(
        await scalar('select count(*)::int as value from public.avatar_profiles where user_id=$1', [
          ids[0],
        ]),
        0,
      );
      assert.deepEqual(
        await scalar('select public.get_avatar_public($1) as value', [[ids[0]]]),
        [],
      );
    });
    await test('real stored-zone logs grant first log and Daily Drop once', async () => {
      await actor(0);
      await db.query(
        "insert into public.water_logs(id,user_id,amount_ml,local_date) values($1,$2,250,(now() at time zone 'America/New_York')::date::text)",
        [request(3), ids[0]],
      );
      await db.query('select public.avatar_reconcile_rewards()');
      await db.query('select public.avatar_reconcile_rewards()');
      assert.equal((await state()).balances.earned, 30);
      assert.equal((await scalar('select public.claim_daily_drop() as value')).balances.earned, 35);
      assert.equal((await scalar('select public.claim_daily_drop() as value')).balances.earned, 35);
      await db.query("update public.profiles set timezone='Pacific/Honolulu' where id=$1", [
        ids[0],
      ]);
      await assert.rejects(
        () => db.query("update public.profiles set timezone='UTC' where id=$1", [ids[0]]),
        /TIMEZONE_CHANGE_LIMIT/,
      );
    });
    await test('only verified store path credits packs, duplicate events cannot double credit', async () => {
      await assert.rejects(
        () =>
          db.query("select public.avatar_apply_store_event($1,'APPLE:1','cc_100',false)", [ids[0]]),
        /permission denied/,
      );
      await admin();
      await db.query("select public.avatar_apply_store_event($1,'APPLE:1','cc_100',false)", [
        ids[0],
      ]);
      await db.query("select public.avatar_apply_store_event($1,'APPLE:1','cc_100',false)", [
        ids[0],
      ]);
      await actor(0);
      assert.equal((await state()).balances.purchased, 100);
    });
    await test('purchase spends earned first, retries and a second buy never duplicate charges', async () => {
      const first = await buy(4, 'hair_fade', 45);
      assert.deepEqual(first.balances, { earned: 0, purchased: 90 });
      assert.deepEqual((await buy(4, 'hair_fade', 45)).balances, first.balances);
      assert.deepEqual((await buy(5, 'hair_fade', 45)).balances, first.balances);
      await assert.rejects(() => buy(4, 'top_tee', 60), /IDEMPOTENCY_CONFLICT/);
      await assert.rejects(() => buy(6, 'top_tee', 59), /PRICE_CHANGED/);
      await assert.rejects(() => buy(7, 'top_plus_baggytee', 140), /TIER_REQUIRED/);
      await assert.rejects(() => buy(8, 'aura_flame', 0), /NO_PURCHASABLE_ITEMS/);
      await assert.rejects(() => buy(9, 'hair_bun', 45), /NO_PURCHASABLE_ITEMS/);
      const saved = await save(
        10,
        { hair: 'hair_fade', top: 'top_tank' },
        { hair: 'hair_1', top: 'garment_5' },
      );
      assert.equal(saved.profile.slots.hair, 'hair_fade');
      await assert.rejects(
        () => save(11, { top: 'top_tank' }, { top: 'garment_fashion_1' }),
        /INVALID_TINT/,
      );
    });
    await test('trial unlocks access, complete-set quote is authoritative and expiry keeps cosmetics', async () => {
      await admin();
      await db.query(
        "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','trial',now()+interval '7 days') on conflict(user_id) do update set tier='plus',status='trial',period_end=excluded.period_end",
        [ids[0]],
      );
      await db.query("select public.avatar_apply_store_event($1,'APPLE:2','cc_2500',false)", [
        ids[0],
      ]);
      await actor(0);
      const quote = (await state()).collections.find(
        (c) => c.id === 'plus_studio',
      ).price_to_complete;
      assert.ok(quote > 0);
      const bought = await buy(12, null, quote, 'plus_studio');
      assert.ok(bought.products.find((p) => p.id === 'top_plus_baggytee').owned);
      await save(13, { top: 'top_plus_baggytee' }, { top: 'garment_fashion_1' });
      await admin();
      await db.query(
        "update public.entitlements set status='lapsed',period_end=now()-interval '1 day' where user_id=$1",
        [ids[0]],
      );
      await actor(0);
      const expired = await save(14, { top: 'top_plus_baggytee' }, { top: 'garment_fashion_1' });
      assert.equal(expired.profile.slots.top, 'top_plus_baggytee');
      assert.ok(expired.products.find((p) => p.id === 'top_plus_baggytee').owned);
      await assert.rejects(() => buy(15, 'headwear_beanie', 90), /TIER_REQUIRED/);
    });
    await test('refund debt blocks spending without taking earned CC or owned items; late grants cannot resurrect refunds', async () => {
      await admin();
      await db.query("select public.avatar_apply_store_event($1,'APPLE:2','cc_2500',true)", [
        ids[0],
      ]);
      await db.query("select public.avatar_apply_store_event($1,'APPLE:2','cc_2500',true)", [
        ids[0],
      ]);
      await actor(0);
      const refunded = await state();
      assert.equal(refunded.balances.earned, 0);
      assert.ok(refunded.balances.purchased < 0);
      assert.ok(refunded.products.find((p) => p.id === 'top_plus_baggytee').owned);
      await assert.rejects(() => buy(16, 'top_tee', 60), /PURCHASED_BALANCE_NEGATIVE/);
      await admin();
      await db.query("select public.avatar_apply_store_event($1,'APPLE:3','cc_100',true)", [
        ids[0],
      ]);
      await db.query("select public.avatar_apply_store_event($1,'APPLE:3','cc_100',false)", [
        ids[0],
      ]);
      await actor(0);
      assert.deepEqual((await state()).balances, refunded.balances);
    });
    await test('XP banks above level six and model changes retain inventory and valid loadout hashes', async () => {
      await admin();
      await db.query(
        "insert into public.xp_ledger(user_id,delta,reason,idempotency_key) values($1,10000,'test','avatar-test-xp')",
        [ids[0]],
      );
      await actor(0);
      assert.equal((await state()).profile.form, 3);
      assert.equal((await state()).profile.level, 6);
      assert.equal((await state()).profile.xp, 10000);
      const saved = await save(17, { hair: 'hair_ponytail', top: 'top_tank' }, {}, 'f');
      assert.ok(saved.products.find((p) => p.id === 'hair_fade').owned);
      assert.equal(saved.profile.gender, 'f');
      assert.equal(
        (await save(17, { hair: 'hair_ponytail', top: 'top_tank' }, {}, 'f')).profile.hash,
        saved.profile.hash,
      );
      await assert.rejects(() => save(18, { hair: 'hair_fade' }, {}, 'f'), /INVALID_LOADOUT/);
    });
    await test('accepted friends can project avatars, blocking revokes projections and disabled flag closes RPCs', async () => {
      await admin();
      await db.query(
        "insert into public.friend_requests(id,sender_id,recipient_id,status) values($1,$2,$3,'accepted')",
        [request(19), ids[0], ids[1]],
      );
      await actor(1);
      const avatars = await scalar('select public.get_avatar_public($1) as value', [[ids[0]]]);
      assert.equal(avatars.length, 1);
      assert.equal('xp' in avatars[0], false);
      assert.equal('created_at' in avatars[0], false);
      assert.ok(avatars[0].slots);
      await admin();
      await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
        ids[1],
        ids[0],
      ]);
      await actor(1);
      assert.deepEqual(
        await scalar('select public.get_avatar_public($1) as value', [[ids[0]]]),
        [],
      );
      await admin();
      await db.exec("update public.avatar_config set value='false' where key='avatar_enabled'");
      await actor(0);
      assert.deepEqual(await state(), { enabled: false });
      await assert.rejects(() => create(), /AVATAR_DISABLED/);
    });
    await test('only trusted completed challenge results grant a unique CC/XP reward', async () => {
      await admin();
      await db.exec("update public.avatar_config set value='true' where key='avatar_enabled'");
      await actor(2);
      await create();
      const before = await state();
      await admin();
      const template = await scalar(
        'select id as value from public.challenge_templates where active limit 1',
      );
      await db.query(
        "insert into public.challenges(id,template_id,template_version,rules_snapshot,creator_id,scope,duration_days,status,invite_expires_at) values($1,$2,1,'{}',$3,'solo',7,'active',now()+interval '1 day')",
        [request(20), template, ids[2]],
      );
      await db.query(
        "insert into public.challenge_participants(challenge_id,user_id,status,benefits,tz,start_date) values($1,$2,'joined','{}','America/New_York',current_date)",
        [request(20), ids[2]],
      );
      await db.query(
        'update public.challenge_participants set status=\'completed\',summary=\'{"outcome":"completed"}\' where challenge_id=$1 and user_id=$2',
        [request(20), ids[2]],
      );
      await db.query(
        "update public.challenge_participants set status='completed' where challenge_id=$1 and user_id=$2",
        [request(20), ids[2]],
      );
      await actor(2);
      const after = await state();
      assert.equal(after.balances.earned - before.balances.earned, 20);
      assert.equal(after.profile.xp - before.profile.xp, 100);
    });
  } finally {
    await admin();
    await db.exec("update public.avatar_config set value='true' where key='avatar_enabled'");
    await db.query('delete from auth.users where id=any($1::uuid[])', [ids]);
  }
  console.log(`Avatar database tests: ${passed} passed, 0 failed`);
}
