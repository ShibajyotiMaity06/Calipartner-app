import assert from 'node:assert/strict';

export async function runRoomMatrixTests(db) {
  const uid = (i) => `dc280000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = (i) => `dd280000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const plan = async (i, tier, status = 'paid', expired = false) => {
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,now()+case when $4 then interval '-1 day' else interval '1 year' end) on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,period_end=excluded.period_end",
      [uid(i), tier, status, expired],
    );
  };
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 24; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `matrix${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'Pacific/Kiritimati')",
        [uid(i), `matrix_${i}`, `Matrix ${String(i).padStart(2, '0')}`],
      );
      await db.query(
        "insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee) values($1,'maintain','moderate',70,0,2500,150,80,295,1700,2500)",
        [uid(i)],
      );
      await db.query(
        "insert into public.activity_days(user_id,local_date,steps,source) values($1,(now() at time zone 'Pacific/Kiritimati')::date::text,$2,'manual')",
        [uid(i), 1000 + i * 100],
      );
    }
    await plan(0, 'pro');
    await plan(1, 'plus');
    await plan(2, 'plus', 'trial');
    await plan(3, 'pro', 'paid', true);
    await user(0);
    const room = await rpc('create_room_v3($1,$2)', [rid(1), 'Matrix room']);
    await test('A same-day target takes effect in the snapshot immediately', async () => {
      await admin();
      await db.query("update public.profiles set timezone='UTC' where id=$1", [uid(0)]);
      await db.query(
        "insert into public.activity_days(user_id,local_date,steps,source) values($1,(now() at time zone 'UTC')::date::text,1000,'manual') on conflict(user_id,local_date) do update set steps=1000",
        [uid(0)],
      );
      await db.query(
        "update public.daily_summaries set calories=1000 where user_id=$1 and local_date=(now() at time zone 'UTC')::date::text",
        [uid(0)],
      );
      await user(0);
      assert.equal(
        (await rpc('get_room_snapshot($1)', [rid(1)])).members[0].metrics.goal_completion,
        40,
      );
      await admin();
      await db.query("update public.profiles set timezone='Pacific/Kiritimati' where id=$1", [
        uid(0),
      ]);
      await user(0);
    });
    await test('Room matrix: 1/2/3/4/5/19/20 joined users, bounded projections and progress', async () => {
      assert.equal((await rpc('get_room_snapshot($1)', [rid(1)])).members.length, 1);
      for (let i = 1; i < 20; i++) {
        await user(i);
        await rpc('join_by_code($1)', [room.code]);
        if (![2, 3, 4, 5, 19, 20].includes(i + 1)) continue;
        await user(0);
        const snapshot = await rpc('get_room_snapshot($1,$2)', [rid(1), uid(i)]);
        assert.equal(snapshot.members.length, i + 1);
        const progress = await rpc('get_room_progress($1,$2)', [rid(1), '7d']);
        assert.equal(progress.total_members, i + 1);
        assert.equal(
          progress.end_date,
          (await db.query("select (now() at time zone 'Pacific/Kiritimati')::date::text as day"))
            .rows[0].day,
        );
        assert.equal(progress.summary_table.length, i + 1);
        assert.equal(progress.members_series.steps.length, i + 1 > 10 ? 4 : i + 1);
      }
    });
    await test('Progress handles every range, eight selected people including self, trials and expired plans', async () => {
      await user(0);
      for (const range of ['7d', '30d', '90d', '6m', '1y', 'all', 'since_start']) {
        const data = await rpc('get_room_progress($1,$2,$3)', [
          rid(1),
          range,
          Array.from({ length: 19 }, (_, i) => uid(i + 1)),
        ]);
        assert(data.selected_member_ids.includes(uid(0)));
        assert(data.selected_member_ids.length <= 8);
      }
      for (const i of [1, 2]) {
        await user(i);
        await rpc('get_room_progress($1)', [rid(1)]);
      }
      for (const i of [3, 4]) {
        await user(i);
        await db.exec('savepoint denied');
        await assert.rejects(() => rpc('get_room_progress($1)', [rid(1)]), /PLUS_REQUIRED/);
        await db.exec('rollback to savepoint denied');
      }
    });
    await test('Progress excludes hidden steps from averages, respects private series and never carries peer weights', async () => {
      await user(1);
      await rpc('set_privacy($1,$2)', [
        rid(1),
        JSON.stringify({
          share_steps: false,
          share_weight_progress: true,
          share_weight_number: false,
        }),
      ]);
      await admin();
      await db.query(
        "insert into public.weight_logs(user_id,weight_kg,local_date) values($1,80,(now() at time zone 'Pacific/Kiritimati')::date::text)",
        [uid(1)],
      );
      await user(0);
      const data = await rpc('get_room_progress($1,$2,$3)', [
        rid(1),
        '7d',
        [uid(0), uid(1), uid(2)],
      ]);
      assert.equal(
        data.members_series.steps.find((m) => m.user_id === uid(1)).is_metric_locked,
        true,
      );
      assert.deepEqual(data.members_series.steps.find((m) => m.user_id === uid(1)).data, []);
      assert.equal(data.summary_table.find((m) => m.user_id === uid(1)).weight_change_kg, 'locked');
      assert.equal(
        data.summary_table.find((m) => m.user_id === uid(2)).weight_change_pct,
        'locked',
      );
      const expected = Math.round(
        Array.from({ length: 20 }, (_, i) => 1000 + i * 100)
          .filter((_, i) => i !== 1)
          .reduce((a, b) => a + b, 0) / 19,
      );
      assert.equal(data.room_average_series.steps.at(-1).value, expected);
      await user(2);
      await rpc('set_privacy($1,$2)', [rid(1), JSON.stringify({ share_weight_progress: true })]);
      await user(0);
      assert.equal(
        (await rpc('get_room_progress($1)', [rid(1)])).summary_table.find(
          (m) => m.user_id === uid(2),
        ).weight_change_pct,
        null,
      );
    });
    await test('Nudges retry without spending allowance; real-event reactions and meal invitations preserve consent', async () => {
      await user(0);
      const nudge = [rid(30), rid(1), uid(1), 'A gentle check-in'];
      await rpc('send_room_nudge_v2($1,$2,$3,$4)', nudge);
      await rpc('send_room_nudge_v2($1,$2,$3,$4)', nudge);
      await rpc('send_room_nudge_v2($1,$2,$3,$4)', [rid(31), rid(1), uid(1), 'Another check-in']);
      await db.exec('savepoint limited');
      await assert.rejects(
        () => rpc('send_room_nudge_v2($1,$2,$3,$4)', [rid(32), rid(1), uid(1), 'Third']),
        /NUDGE_LIMIT_REACHED/,
      );
      await db.exec('rollback to savepoint limited');
      await user(1);
      await db.query(
        "insert into public.workouts(id,user_id,type,name,duration_minutes,local_date) values($1,$2,'strength','Matrix workout',30,(now() at time zone 'Pacific/Kiritimati')::date::text)",
        [rid(35), uid(1)],
      );
      await user(0);
      await rpc('react_to_room_member($1,$2,$3)', [rid(1), uid(1), 'clap']);
      await rpc('react_to_room_member($1,$2,$3)', [rid(1), uid(1), 'clap']);
      await rpc('set_privacy($1,$2)', [
        rid(1),
        JSON.stringify({ share_meals: 'per_meal', share_calories_macros: true }),
      ]);
      await db.query(
        "insert into public.food_entries(id,user_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg,local_date,source) values($1,$2,'Audit rice','lunch',100,'g',200,10,30,5,4,3,20,(now() at time zone 'Pacific/Kiritimati')::date,'search')",
        [rid(33), uid(0)],
      );
      await rpc('share_room_meal($1,$2,$3,$4)', [rid(34), rid(1), rid(33), [uid(1), uid(4)]]);
      await rpc('share_room_meal($1,$2,$3,$4)', [rid(34), rid(1), rid(33), [uid(1), uid(4)]]);
      await user(4);
      assert.equal((await rpc('get_pending_room_meals($1)', [rid(1)])).length, 1);
      const accepted = await rpc('respond_shared_meal($1,$2,$3,$4)', [
        rid(34),
        true,
        150,
        'dinner',
      ]);
      const retry = await rpc('respond_shared_meal($1,$2,$3,$4)', [rid(34), true, 150, 'dinner']);
      assert.equal(accepted.diary_entry_id, retry.diary_entry_id);
      const entry = (
        await db.query(
          'select calories,fiber,sugar,sodium_mg from public.food_entries where id=$1',
          [accepted.diary_entry_id],
        )
      ).rows[0];
      assert.deepEqual(entry, {
        calories: '300.00',
        fiber: '6.00',
        sugar: '4.50',
        sodium_mg: '30.00',
      });
      await user(0);
      await rpc('set_privacy($1,$2)', [rid(1), JSON.stringify({ share_meals: 'never' })]);
      await user(1);
      assert.equal((await rpc('get_pending_room_meals($1)', [rid(1)])).length, 0);
      await db.exec('savepoint private');
      await assert.rejects(
        () => rpc('respond_shared_meal($1,$2)', [rid(34), true]),
        /PRIVACY_DENIED/,
      );
      await db.exec('rollback to savepoint private');
      await user(0);
      await rpc('set_privacy($1,$2)', [rid(1), JSON.stringify({ share_meals: 'always' })]);
    });
    await test('Plus hosts three and Pro hosts five independent rooms; excess room creation is atomic', async () => {
      await user(0);
      for (let i = 2; i <= 5; i++) await rpc('create_room_v3($1,$2)', [rid(i), `Pro room ${i}`]);
      await db.exec('savepoint quota');
      await assert.rejects(
        () => rpc('create_room_v3($1,$2)', [rid(6), 'Excess']),
        /HOSTED_ROOM_LIMIT/,
      );
      await db.exec('rollback to savepoint quota');
      await user(1);
      for (let i = 10; i < 13; i++) await rpc('create_room_v3($1,$2)', [rid(i), `Plus room ${i}`]);
      await db.exec('savepoint quota');
      await assert.rejects(
        () => rpc('create_room_v3($1,$2)', [rid(13), 'Excess']),
        /HOSTED_ROOM_LIMIT/,
      );
      await db.exec('rollback to savepoint quota');
      await admin();
      assert.equal(
        (
          await db.query('select count(*)::int as count from public.rooms where id in ($1,$2)', [
            rid(6),
            rid(13),
          ])
        ).rows[0].count,
        0,
      );
    });
    await test('Former and blocked members are excluded from progress, search and charts', async () => {
      await user(19);
      await rpc('leave_room($1)', [rid(1)]);
      await user(0);
      let data = await rpc('get_room_progress($1)', [rid(1)]);
      assert(!data.summary_table.some((m) => m.user_id === uid(19)));
      assert.equal(
        (
          await db.query('select * from public.search_room_members_for_progress($1,$2)', [
            rid(1),
            'matrix_19',
          ])
        ).rows.length,
        0,
      );
      await rpc('block_user($1)', [uid(18)]);
      data = await rpc('get_room_progress($1)', [rid(1)]);
      assert(!data.summary_table.some((m) => m.user_id === uid(18)));
      assert.equal(
        (
          await db.query('select * from public.search_room_members_for_progress($1,$2)', [
            rid(1),
            'matrix_18',
          ])
        ).rows.length,
        0,
      );
    });
    console.log(`Room matrix database tests: ${passed} passed, 0 failed`);
  } finally {
    await db.exec('rollback;reset role');
  }
}
