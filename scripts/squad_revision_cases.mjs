import assert from 'node:assert/strict';
export async function runSquadRevisionTests(db) {
  const uid = (i) => `fa020000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const id = (i) => `fb020000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const room = id(1);
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const resetRate = async () => {
    await admin();
    await db.query('delete from public.rate_limit_buckets where bucket_key=$1', [
      'chat_msg:' + uid(0),
    ]);
    await user(0);
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const reject = async (sql, args, pattern) => {
    await db.exec('savepoint rejected');
    await assert.rejects(() => db.query(sql, args), pattern);
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
    for (let i = 0; i < 22; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `squad_revision_${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,$4)",
        [uid(i), `squad_${i}`, `Squad ${i}`, i === 0 ? 'Pacific/Kiritimati' : 'America/Adak'],
      );
      if (i !== 19)
        await db.query(
          "insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from) values($1,'maintain','moderate',70,0,2500,150,80,295,1700,2500,now()-interval '2 days')",
          [uid(i)],
        );
    }
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'pro','paid',now()+interval '1 year'),($2,'plus','paid',now()+interval '1 year')",
      [uid(0), uid(2)],
    );
    await user(0);
    const created = await rpc('create_room_v3($1,$2)', [room, 'Squad revision']);
    for (let i = 1; i < 20; i++) {
      await user(i);
      await rpc('join_by_code($1)', [created.code]);
    }
    await admin();
    await db.query(
      'update public.room_members set privacy_settings=privacy_settings||\'{"share_calories_macros":false,"share_steps":false,"share_goal_completion":false,"share_meals":"never","share_workouts":false}\'::jsonb where room_id=$1',
      [room],
    );
    await db.query(
      "insert into public.food_entries(id,user_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,local_date,source) values($1,$2,'Rice and dal','lunch',1,'serving',500,30,60,10,(now() at time zone 'Pacific/Kiritimati')::date,'search'),($3,$2,'Yesterday','dinner',1,'serving',900,30,60,10,(now() at time zone 'Pacific/Kiritimati')::date-1,'search')",
      [id(2), uid(0), id(3)],
    );
    await db.query(
      "insert into public.activity_days(user_id,local_date,steps,source) values($1,(now() at time zone 'Pacific/Kiritimati')::date::text,4321,'manual')",
      [uid(0)],
    );
    await db.query(
      'insert into public.weight_logs(id,user_id,weight_kg,logged_at,local_date) values($1,$2,72,now(),current_date::text)',
      [id(4), uid(0)],
    );
    await test('Free reads all 20 members, mandatory exact macros and steps, without base-table access', async () => {
      await user(1);
      const today = await rpc('get_squad_today($1)', [room]);
      assert.equal(today.members.length, 20);
      const peer = today.members.find((m) => m.user_id === uid(0));
      assert.equal(peer.calories, 500);
      assert.equal(peer.protein, 30);
      assert.equal(peer.steps, 4321);
      assert.equal(peer.targets.calories, 2500);
      assert.equal(peer.height_cm, null);
      assert.equal(peer.weight_kg, null);
      assert.equal(today.members.find((m) => m.user_id === uid(19)).targets, null);
      for (const table of [
        'food_entries',
        'workouts',
        'goal_profiles',
        'activity_days',
        'weight_logs',
      ])
        assert.equal(
          (await db.query(`select * from public.${table} where user_id=$1`, [uid(0)])).rows.length,
          0,
        );
      await reject(
        'select public.get_squad_member_details($1,$2)',
        [room, uid(0)],
        /PLUS_REQUIRED/,
      );
      await reject(
        'select public.get_squad_member_details($1,$2)',
        [room, uid(1)],
        /PLUS_REQUIRED/,
      );
    });
    await test('Tracking choices project through squad access without leaking disabled totals or changing saved logs', async () => {
      await user(0);
      const enabled = {
        calories: true,
        protein: false,
        carbs: true,
        fat: true,
        steps: true,
        water: true,
      };
      await db.query(
        'insert into public.tracking_preferences(user_id,request_id,enabled) values($1,$2,$3)',
        [uid(0), id(88), JSON.stringify(enabled)],
      );
      await user(1);
      const peer = (await rpc('get_squad_today($1)', [room])).members.find(
        (m) => m.user_id === uid(0),
      );
      assert.equal(peer.calories, 500);
      assert.equal(peer.protein, null);
      assert.deepEqual(peer.tracking, enabled);
      assert.equal(
        (await db.query('select * from public.tracking_preferences where user_id=$1', [uid(0)]))
          .rows.length,
        0,
      );
      await user(0);
      assert.equal(
        Number(
          (
            await db.query(
              'select sum(protein) as total from public.food_entries where user_id=$1',
              [uid(0)],
            )
          ).rows[0].total,
        ),
        60,
      );
      await admin();
      await db.query('delete from public.tracking_preferences where user_id=$1', [uid(0)]);
    });
    await test('Each member uses their own timezone and latest acknowledged goals; future targets stay excluded', async () => {
      await admin();
      await db.query(
        "insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from) values($1,'maintain','moderate',70,0,2600,150,80,320,1700,2600,now()),($1,'maintain','moderate',70,0,2800,150,80,370,1700,2800,now()+interval '1 day')",
        [uid(3)],
      );
      await user(1);
      const members = (await rpc('get_squad_today($1)', [room])).members;
      assert.equal(members.find((m) => m.user_id === uid(3)).targets.calories, 2600);
      const dates = (
        await db.query(
          "select (now() at time zone 'Pacific/Kiritimati')::date::text a,(now() at time zone 'America/Adak')::date::text b",
        )
      ).rows[0];
      assert.equal(members.find((m) => m.user_id === uid(0)).local_date, dates.a);
      assert.equal(members.find((m) => m.user_id === uid(1)).local_date, dates.b);
    });
    await test('Height and weight are independent, acknowledged, idempotent visibility changes', async () => {
      await user(0);
      assert.deepEqual(await rpc('set_squad_visibility($1,$2,$3)', [room, true, false]), {
        share_height: false,
        share_weight: true,
      });
      await rpc('set_squad_visibility($1,$2,$3)', [room, true, false]);
      await user(1);
      let peer = (await rpc('get_squad_today($1)', [room])).members.find(
        (m) => m.user_id === uid(0),
      );
      assert.equal(peer.weight_kg, 72);
      assert.equal(peer.height_cm, null);
      await user(0);
      await rpc('set_squad_visibility($1,$2,$3)', [room, false, true]);
      await user(1);
      peer = (await rpc('get_squad_today($1)', [room])).members.find((m) => m.user_id === uid(0));
      assert.equal(peer.weight_kg, null);
      assert.equal(peer.height_cm, 175);
      assert.equal(peer.calories, 500);
    });
    await test('Plus sees today’s real meal nutrition and detailed workout sets, regardless of legacy switches', async () => {
      await admin();
      await db.query(
        "insert into public.workouts(id,user_id,type,name,duration_minutes,local_date) values($1,$2,'strength','Leg day',48,(now() at time zone 'Pacific/Kiritimati')::date::text)",
        [id(5), uid(0)],
      );
      await db.query(
        "insert into public.workout_exercises(id,workout_id,user_id,exercise_name) values($1,$2,$3,'Squat')",
        [id(6), id(5), uid(0)],
      );
      await db.query(
        'insert into public.workout_sets(id,workout_exercise_id,workout_id,user_id,set_number,reps,weight_kg) values($1,$2,$3,$4,1,8,80),($5,$2,$3,$4,2,8,82.5)',
        [id(7), id(6), id(5), uid(0), id(8)],
      );
      await user(2);
      const details = await rpc('get_squad_member_details($1,$2)', [room, uid(0)]);
      assert.equal(details.meals.length, 1);
      assert.equal(details.meals[0].calories, 500);
      assert.equal(details.meals[0].items[0].name, 'Rice and dal');
      assert.equal(details.workouts[0].duration_minutes, 48);
      assert.equal(details.workouts[0].exercises[0].sets[1].weight_kg, 82.5);
      await admin();
      await db.query(
        "update public.entitlements set period_end=now()-interval '1 day' where user_id=$1",
        [uid(2)],
      );
      await user(2);
      await reject(
        'select public.get_squad_member_details($1,$2)',
        [room, uid(0)],
        /PLUS_REQUIRED/,
      );
      assert.equal((await rpc('get_squad_today($1)', [room])).members.length, 20);
      await admin();
      await db.query(
        "update public.entitlements set period_end=now()+interval '1 year' where user_id=$1",
        [uid(2)],
      );
    });
    let tagged;
    await test('Chat tags create one recipient receipt; retries, repeated tags, email fragments and self-tags do not duplicate', async () => {
      await user(0);
      await rpc('accept_chat_terms()');
      tagged = await rpc('send_chat_message($1,$2,$3)', [
        room,
        'squad-mention-once',
        '@squad_2 @squad_2 @squad_1 @squad_0 @squad_21 a@squad_3 @squad_4.',
      ]);
      await rpc('send_chat_message($1,$2,$3)', [room, 'squad-mention-once', 'retry']);
      await user(2);
      const mentions = await rpc('get_squad_mentions($1)', [room]);
      assert.equal(mentions.count, 1);
      assert.equal(mentions.mentions[0].message_id, tagged.id);
      await user(3);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 0);
      await user(4);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 1);
      await user(0);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 0);
      await user(1);
      const free = await rpc('get_squad_mentions($1)', [room]);
      assert.equal(free.count, 1);
      assert.equal(free.locked, false);
      assert.equal(free.mentions[0].message_id, tagged.id);
      assert.equal(
        (await rpc('get_squad_mention_context($1,$2)', [room, tagged.id]))[0].id,
        tagged.id,
      );
    });
    await test('Opening an old mention fetches that exact message and acknowledges only that recipient after success', async () => {
      await user(0);
      for (let i = 0; i < 55; i++) {
        if (i % 18 === 0) await resetRate();
        await rpc('send_chat_message($1,$2,$3)', [room, `squad-follow-${i}`, 'Later message']);
      }
      await user(2);
      const context = await rpc('get_squad_mention_context($1,$2)', [room, tagged.id]);
      assert.equal(context.length, 1);
      assert.equal(context[0].id, tagged.id);
      await rpc('mark_squad_mention_seen($1,$2)', [room, tagged.id]);
      await rpc('mark_squad_mention_seen($1,$2)', [room, tagged.id]);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 0);
      await user(1);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 1);
      await reject('update public.squad_mentions set seen_at=now()', [], /permission denied/);
    });
    await test('All unread tags paginate without gaps at identical timestamps, and deleted messages disappear', async () => {
      await user(0);
      const sent = [];
      for (let i = 0; i < 33; i++) {
        if (i % 18 === 0) await resetRate();
        sent.push(
          await rpc('send_chat_message($1,$2,$3)', [room, `squad-page-${i}`, '@squad_2 hello']),
        );
      }
      await user(2);
      const one = await rpc('get_squad_mentions($1)', [room]);
      assert.equal(one.count, 33);
      assert.equal(one.mentions.length, 30);
      assert.equal(one.has_more, true);
      const cursor = one.mentions.at(-1);
      const two = await rpc('get_squad_mentions($1,$2,$3)', [
        room,
        cursor.created_at,
        cursor.message_id,
      ]);
      assert.equal(two.mentions.length, 3);
      assert.equal(new Set([...one.mentions, ...two.mentions].map((m) => m.message_id)).size, 33);
      await admin();
      await db.query('update public.chat_messages set deleted_at=now() where id=$1', [sent[0].id]);
      await user(2);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 32);
    });
    await test('Blocks and mutes hide mentions; outsiders, leavers and locked rooms cannot read squad projections', async () => {
      await admin();
      await db.query('insert into public.member_mutes(user_id,muted_user_id) values($1,$2)', [
        uid(2),
        uid(0),
      ]);
      await user(2);
      assert.equal((await rpc('get_squad_mentions($1)', [room])).count, 0);
      await reject(
        'select public.get_squad_mention_context($1,$2)',
        [room, tagged.id],
        /MESSAGE_NOT_FOUND/,
      );
      await admin();
      await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
        uid(2),
        uid(0),
      ]);
      await user(2);
      assert.ok(
        !(await rpc('get_squad_today($1)', [room])).members.some((m) => m.user_id === uid(0)),
      );
      await reject('select public.get_squad_member_details($1,$2)', [room, uid(0)], /USER_BLOCKED/);
      await user(21);
      for (const name of [
        'get_squad_today($1)',
        'get_squad_mentions($1)',
        'get_squad_visibility($1)',
      ])
        await reject(`select public.${name}`, [room], /NOT_ROOM_MEMBER/);
      await admin();
      await db.query(
        "update public.room_members set status='left' where room_id=$1 and user_id=$2",
        [room, uid(1)],
      );
      await user(1);
      await reject('select public.get_squad_today($1)', [room], /NOT_ROOM_MEMBER/);
      await admin();
      await db.query("update public.rooms set state='locked' where id=$1", [room]);
      await user(2);
      await reject('select public.get_squad_today($1)', [room], /ROOM_LOCKED/);
    });
    console.log(`Squad revision database tests: ${passed} passed, 0 failed`);
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
