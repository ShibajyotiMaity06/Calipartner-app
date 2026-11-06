import assert from 'node:assert/strict';
export async function runBlueprintReviewTests(db) {
  const uid = (i) => `aa050000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = (i) => `ab050000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values(
      (await db.query(`select ${name.startsWith('count(') ? '' : 'public.'}${name}`, args)).rows[0],
    )[0];
  const reject = async (name, args, pattern) => {
    await db.exec('savepoint rejected');
    await assert.rejects(() => rpc(name, args), pattern);
    await db.exec('rollback to savepoint rejected');
  };
  let passed = 0;
  const test = async (name, run) => {
    await run();
    passed++;
    console.log(`PASS ${name}`);
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 3; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `blueprint_${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Blueprint member','1995-01-01','male',180,'Pacific/Kiritimati')",
        [uid(i), `blueprint_${i}`],
      );
    }
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'pro','paid',now()+interval '1 year')",
      [uid(0)],
    );
    await db.query('insert into public.health_screening(user_id) values($1)', [uid(0)]);
    await db.query(
      "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,gym_days,input_height_cm,effective_from,confirmed_at) values($1,$2,'cut','moderate',80,0.5,1950,176,96,96,1800,2500,3,180,now()-interval '40 days',now()-interval '40 days')",
      [rid(1), uid(0)],
    );
    await db.query(
      "insert into public.food_entries(id,user_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,local_date,source) select gen_random_uuid(),$1,'Lentils','lunch',1,'bowl',1000,50,125,30,((now() at time zone 'Pacific/Kiritimati')::date-d),'search' from generate_series(1,14) d cross join generate_series(1,2) n",
      [uid(0)],
    );
    await db.query(
      "insert into public.weight_logs(user_id,weight_kg,local_date) select $1,case when d>7 then 80.5 else 80 end,((now() at time zone 'Pacific/Kiritimati')::date-d)::text from unnest(array[14,11,6,1]) d",
      [uid(0)],
    );
    const context = await rpc('adaptive_review_context($1)', [uid(0)]);
    const proposal = {
      source_goal_id: rid(1),
      tdee: 2500,
      daily_calorie_target: 1950,
      protein_grams: 176,
      carb_grams: 96,
      fat_grams: 96,
      current_weight_kg: 80,
      weekly_rate_kg: 0.5,
      logged_days: 14,
      weigh_in_days: 4,
      weight_change: -0.5,
      observed_tdee: 2500,
    };
    await test('Adaptive evidence uses 14 completed stored-zone days; app clients cannot read or write proposals', async () => {
      assert.equal(context.days.length, 14);
      assert.equal(context.days.filter((d) => d.weight !== null).length, 4);
      assert.ok(context.days.every((d) => d.foods === 2));
      await user(0);
      await reject('adaptive_review_context($1)', [uid(0)], /permission denied/);
      await reject('count(*) from public.adaptive_review_proposals', [], /permission denied/);
      await user(1);
      await reject('accept_adaptive_review($1)', [rid(4)], /PURCHASED_PRO_REQUIRED/);
    });
    await admin();
    await rpc('store_adaptive_review($1,$2,$3,$4)', [
      uid(0),
      rid(4),
      JSON.stringify(context),
      JSON.stringify(proposal),
    ]);
    await test('Changed logs invalidate a proposal without changing goals', async () => {
      await db.query(
        "insert into public.food_entries(id,user_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,local_date,source) values($1,$2,'Extra food','extra',1,'serving',100,5,10,4,((now() at time zone 'Pacific/Kiritimati')::date-1),'search')",
        [rid(5), uid(0)],
      );
      await user(0);
      await reject('accept_adaptive_review($1)', [rid(4)], /REVIEW_STALE/);
      await admin();
      await db.query('delete from public.food_entries where id=$1', [rid(5)]);
    });
    await test('Explicit acceptance inserts one historical goal and retries return the same acknowledged result', async () => {
      await user(0);
      const saved = await rpc('accept_adaptive_review($1)', [rid(4)]);
      assert.equal(saved.id, rid(4));
      assert.equal(saved.recompute_reason, 'recalibration');
      assert.equal((await rpc('accept_adaptive_review($1)', [rid(4)])).id, saved.id);
      assert.equal(
        await rpc('count(*)::int from public.goal_profiles where user_id=$1', [uid(0)]),
        2,
      );
      await admin();
      await db.query("update public.entitlements set status='lapsed' where user_id=$1", [uid(0)]);
      await user(0);
      await reject('accept_adaptive_review($1)', [rid(4)], /PURCHASED_PRO_REQUIRED/);
      await admin();
      await db.query("update public.entitlements set status='paid' where user_id=$1", [uid(0)]);
    });
    await user(0);
    const room = await rpc('create_room_v3($1,$2)', [rid(10), 'Blueprint squad']);
    await user(1);
    await rpc('join_by_code($1)', [room.code]);
    await rpc('accept_chat_terms()');
    const original = await rpc('send_chat_message($1,$2,$3)', [
      rid(10),
      'blueprint-original',
      'A useful message',
    ]);
    await user(0);
    await rpc('accept_chat_terms()');
    await test('Free-chat replies are reference-based and retry once; conflicting reply targets are rejected', async () => {
      const reply = await rpc('send_chat_reply($1,$2,$3,$4)', [
        rid(10),
        'blueprint-reply',
        original.id,
        'My reply',
      ]);
      assert.equal(reply.reply.text, 'A useful message');
      assert.equal(
        (
          await rpc('send_chat_reply($1,$2,$3,$4)', [
            rid(10),
            'blueprint-reply',
            original.id,
            'My reply',
          ])
        ).id,
        reply.id,
      );
      await reject(
        'send_chat_reply($1,$2,$3,$4)',
        [rid(10), 'blueprint-reply', original.id, 'Different payload'],
        /IDEMPOTENCY_CONFLICT/,
      );
      const list = await rpc('get_chat_messages_v2($1)', [rid(10)]);
      assert.equal(list.find((m) => m.id === reply.id).reply.text, 'A useful message');
    });
    await test('Replies cannot reference other rooms; deleting an original removes its quoted content', async () => {
      await rpc('create_room_v3($1,$2)', [rid(11), 'Other squad']);
      await reject(
        'send_chat_reply($1,$2,$3,$4)',
        [rid(11), 'bad-room-reply', original.id, 'No leak'],
        /REPLY_UNAVAILABLE/,
      );
      await user(1);
      await rpc('delete_own_chat_message($1)', [original.id]);
      await user(0);
      const list = await rpc('get_chat_messages_v2($1)', [rid(10)]);
      assert.equal(list.find((m) => m.client_id === 'blueprint-reply').reply, null);
      await reject(
        'send_chat_reply($1,$2,$3,$4)',
        [rid(10), 'deleted-reply', original.id, 'No quote'],
        /REPLY_UNAVAILABLE/,
      );
    });
    await test('Water shares actual stored-zone totals only through the checked squad projection', async () => {
      await admin();
      await db.query(
        "insert into public.water_logs(user_id,amount_ml,local_date) values($1,500,(now() at time zone 'Pacific/Kiritimati')::date::text),($1,700,((now() at time zone 'Pacific/Kiritimati')::date-1)::text)",
        [uid(0)],
      );
      await user(1);
      const today = await rpc('get_squad_today($1)', [rid(10)]);
      assert.equal(today.members.find((m) => m.user_id === uid(0)).water, 500);
      assert.equal(today.members.find((m) => m.user_id === uid(0)).targets.water, 2500);
      assert.equal(await rpc('count(*)::int from public.water_logs where user_id=$1', [uid(0)]), 0);
      await user(2);
      await reject('get_squad_today($1)', [rid(10)], /NOT_ROOM_MEMBER/);
    });
    console.log(`Blueprint, review and reply database tests: ${passed} passed, 0 failed`);
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
