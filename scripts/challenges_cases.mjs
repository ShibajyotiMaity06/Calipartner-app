import assert from 'node:assert/strict';
export async function runChallengeTests(db) {
  const uid = (i) => `cd280000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const cid = (i) => `ce280000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const denied = async (sql, args, pattern) => {
    await db.exec('savepoint rejected');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to rejected');
  };
  await admin();
  await db.exec('begin');
  let count = 0;
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `challenge_${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2::text,$2::text,'1995-01-01','male',175,'UTC')",
        [uid(i), `challenge_${i}`],
      );
    }
    await user(1);
    const invite = await scalar(
      "select public.prepare_onboarding_pair_invite($1,'Training together')",
      [cid(1)],
    );
    assert.equal(await scalar('select public.can_create_room($1)', [uid(1)]), true);
    assert.equal(
      invite.token,
      (
        await scalar("select public.prepare_onboarding_pair_invite($1,'Training together')", [
          cid(1),
        ])
      ).token,
    );
    await denied('select public.accept_onboarding_pair_invite($1)', [invite.token], /SELF_INVITE/);
    await user(2);
    const accepted = await scalar('select public.accept_onboarding_pair_invite($1)', [
      invite.token,
    ]);
    assert.equal(accepted.room_id, cid(1));
    assert.equal(
      (await scalar('select public.accept_onboarding_pair_invite($1)', [invite.token])).room_id,
      cid(1),
    );
    await user(1);
    assert.equal(await scalar('select public.can_create_room($1)', [uid(1)]), false);
    count++;
    console.log(
      'PASS Pair invite sharing reserves no slot; explicit acceptance creates one room and retries safely',
    );
    await admin();
    await db.query(
      "insert into public.workouts(id,user_id,type,name,local_date,duration_minutes) values($1,$2,'strength','Challenge workout',current_date::text,30)",
      [cid(900), uid(1)],
    );
    await user(1);
    const catalog = await scalar('select public.challenge_catalog()');
    assert.ok(catalog.templates.length >= 11);
    assert.equal(catalog.plan, 'free');
    assert.deepEqual((await scalar('select public.challenge_home()')).items, []);
    assert.equal((await db.query('select * from public.challenge_templates')).rows.length, 0);
    await denied('select public.challenge_engine_input($1)', [uid(1)], /permission denied/);
    await denied(
      "insert into public.challenge_config values('spoof','1')",
      [],
      /row-level security/,
    );
    count++;
    console.log(
      'PASS Challenge catalogue is authenticated; base tables and trusted scoring APIs deny app writes',
    );
    const starter =
      catalog.templates.find((t) => t.slug === 'daily-steps-sprint') ??
      catalog.templates.find((t) => t.tasks.length === 1 && t.tasks[0] === 'steps');
    assert.ok(starter);
    const create = async (id, scope = 'pair', duration = 7, template = starter, options = {}) => {
      await admin();
      return scalar(
        'select public.challenge_create_server($1,$2,$3,$4,$5,$6,$7,null,null,null,null,$8)',
        [
          uid(1),
          cid(id),
          template.id,
          scope,
          duration,
          scope === 'pair' ? [uid(2)] : [],
          Object.fromEntries(
            template.tasks.map((m) => [m, catalog.config.rules.metrics[m].fallback.default]),
          ),
          options,
        ],
      );
    };
    await create(10);
    await create(10);
    await user(1);
    assert.equal((await scalar('select public.challenge_home()')).items.length, 1);
    await admin();
    await denied(
      'select public.challenge_create_server($1,$2,$3,$4,$5,$6,$7)',
      [uid(1), cid(11), starter.id, 'pair', 7, [uid(2)], { steps: 5000 }],
      /CHALLENGE_LIMIT/,
    );
    await user(2);
    let snapshot = await scalar('select public.challenge_snapshot($1)', [cid(10)]);
    assert.equal(snapshot.self.status, 'invited');
    assert.equal(snapshot.participants.find((p) => !p.self).percent, 'locked');
    assert.equal(snapshot.participants.find((p) => !p.self).summary, null);
    assert.equal(snapshot.participants.find((p) => !p.self).days, null);
    await user(3);
    await denied('select public.challenge_snapshot($1)', [cid(10)], /NOT_CHALLENGE_PARTICIPANT/);
    await admin();
    await scalar('select public.challenge_respond_server($1,$2,true,$3)', [
      uid(2),
      cid(10),
      { steps: 3000 },
    ]);
    await scalar('select public.challenge_respond_server($1,$2,true,$3)', [
      uid(2),
      cid(10),
      { steps: 3000 },
    ]);
    await user(2);
    snapshot = await scalar('select public.challenge_snapshot($1)', [cid(10)]);
    assert.equal(snapshot.challenge.status, 'scheduled');
    assert.equal(snapshot.self.targets.steps, 3000);
    assert.equal(
      snapshot.self.start_date,
      new Date(Date.parse(snapshot.today_date + 'T00:00:00Z') + 86400000)
        .toISOString()
        .slice(0, 10),
    );
    count++;
    console.log(
      'PASS Free pair quota, idempotent creation, consent, personal targets and outsider denial',
    );
    await scalar("select public.challenge_action($1,$2,'comparison',null,null,$3)", [
      cid(20),
      cid(10),
      { enabled: true },
    ]);
    await user(1);
    snapshot = await scalar('select public.challenge_snapshot($1)', [cid(10)]);
    assert.equal(snapshot.participants.find((p) => !p.self).percent, 'locked');
    assert.equal(snapshot.team_percent, 'locked');
    await scalar("select public.challenge_action($1,$2,'nudge',$3)", [cid(21), cid(10), uid(2)]);
    await scalar("select public.challenge_action($1,$2,'nudge',$3)", [cid(21), cid(10), uid(2)]);
    await denied(
      "select public.challenge_action($1,$2,'nudge',$3)",
      [cid(22), cid(10), uid(2)],
      /NUDGE_LIMIT/,
    );
    await scalar('select public.challenge_notification_preference($1,true)', [cid(10)]);
    await scalar('select public.challenge_remind($1,true)', [
      catalog.templates.find((t) => t.season_id).id,
    ]);
    assert.deepEqual(
      await scalar('select public.challenge_board($1)', [catalog.seasons[0].id]),
      [],
    );
    count++;
    console.log(
      'PASS Comparison opt-out, action retry, daily reminder cap, optional notifications and anonymous board threshold',
    );
    await admin();
    const input = await scalar('select public.challenge_engine_input($1)', [uid(1)]);
    assert.equal(input.history.length, catalog.config.history_days);
    assert.equal(input.challenges.length, 1);
    assert.equal(input.challenges[0].source_days.length, 7);
    const days = input.challenges[0].source_days.map((day, index) => ({
      local_date: day.local_date,
      day_index: index + 1,
      value: 5000,
      target: 5000,
      percent: 100,
      status: 'pass',
      tasks: [{ metric: 'steps', value: 5000, target: 5000, percent: 100, source: 'sensor' }],
      verified: true,
      finalized: true,
    }));
    await scalar('select public.challenge_commit_results($1,$2,$3,$4)', [
      uid(1),
      cid(10),
      days,
      {
        percent: 100,
        today_percent: 100,
        passed: 7,
        eligible: 7,
        longest_streak: 7,
        shields: 1,
        outcome: 'completed',
        day: 7,
        verified_days: 7,
        public_percent: 100,
        today_tasks: [],
        chapters: [],
      },
    ]);
    await scalar('select public.challenge_commit_results($1,$2,$3,$4)', [
      uid(1),
      cid(10),
      days,
      { outcome: 'completed', shields: 1 },
    ]);
    assert.equal(
      await scalar('select completed_count from public.challenge_counters where template_id=$1', [
        starter.id,
      ]),
      1,
    );
    assert.ok(await scalar('select count(*) from public.user_badges where user_id=$1', [uid(1)]));
    count++;
    console.log(
      'PASS Real source aggregates, frozen result writes and completion rewards cannot duplicate',
    );
    await user(2);
    await scalar("select public.challenge_action($1,$2,'leave')", [cid(23), cid(10)]);
    await user(1);
    assert.equal(
      (await scalar('select public.challenge_snapshot($1)', [cid(10)])).challenge.scope,
      'solo',
    );
    await admin();
    await scalar('select public.challenge_maintenance()');
    assert.ok(await scalar('select public.challenge_analytics_summary()'));
    for (const table of [
      'challenges',
      'challenge_templates',
      'challenge_config',
      'occasion_plans',
      'occasion_milestones',
      'challenge_day_results',
      'challenge_job_config',
    ])
      assert.equal(
        await scalar('select relrowsecurity from pg_class where relname=$1', [table]),
        true,
      );
    count++;
    console.log(
      'PASS Leave becomes solo, all new tables use RLS and maintenance/aggregate analytics execute',
    );
    await admin();
    for (const i of [1, 2])
      await db.query(
        "insert into public.entitlements(user_id,tier,period,source,status,period_end) values($1,'plus','annual','apple','paid',now()+interval '1 day') on conflict(user_id) do update set tier='plus',status='paid',period_end=now()+interval '1 day'",
        [uid(i)],
      );
    await db.exec(
      "update public.challenge_seasons set starts_at=now()-interval '1 day',ends_at=now()+interval '365 days'",
    );
    // Controlled season clocks exist only inside this rolled-back test transaction.
    await db.exec(
      "update public.challenge_config set value='1000' where key='creation_hourly_limit'",
    );
    let n = 100;
    for (const template of catalog.templates) {
      const id = cid(n++),
        duration = template.duration_options[0];
      const targets = Object.fromEntries(
        template.tasks.map((m) => [m, catalog.config.rules.metrics[m].fallback.default]),
      );
      const scope = template.season_id ? 'season' : 'pair';
      await scalar('select public.challenge_create_server($1,$2,$3,$4,$5,$6,$7)', [
        uid(1),
        id,
        template.id,
        scope,
        duration,
        scope === 'season' ? [] : [uid(2)],
        targets,
      ]);
      if (scope === 'pair')
        await scalar('select public.challenge_respond_server($1,$2,true,$3)', [
          uid(2),
          id,
          targets,
        ]);
      await user(1);
      const item = await scalar('select public.challenge_snapshot($1)', [id]);
      assert.equal(item.challenge.rules_snapshot.format, template.format);
      assert.equal(item.self.status, 'joined');
      assert.equal(item.challenge.duration_days, duration);
      await scalar("select public.challenge_action($1,$2,'leave')", [cid(n++), id]);
      await admin();
      if (scope === 'pair') {
        await user(2);
        await scalar("select public.challenge_action($1,$2,'leave')", [cid(n++), id]);
        await admin();
      }
    }
    count++;
    console.log(
      `PASS All ${catalog.templates.length} real templates and all six formats create, accept and leave under controlled season clocks`,
    );
    const habits = catalog.templates.find((t) => t.slug === 'habit-checklist');
    const tomorrow = await scalar('select (now()::date+1)::text');
    const event = await scalar('select (now()::date+30)::text');
    const target = { steps: 5000, water_ml: 2000, food_log_days: 1 };
    await scalar('select public.challenge_occasion_server($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
      uid(1),
      cid(500),
      habits.id,
      uid(2),
      'wedding',
      event,
      33,
      target,
      { body_goal: true, current_weight: 70, target_weight: 69 },
      [{ week: 1, date: tomorrow, habit_factor: 1, weight: 69.75 }],
    ]);
    await user(2);
    let eventView = await scalar('select public.challenge_snapshot($1)', [cid(500)]);
    assert.equal(eventView.occasion.private_plan, null);
    assert.equal(eventView.occasion.milestones[0].weight, null);
    await admin();
    await db.query(
      'insert into public.health_screening(user_id,pregnant_or_breastfeeding,has_diabetes_or_medication,has_eating_disorder_history) values($1,true,false,false) on conflict(user_id) do update set pregnant_or_breastfeeding=true',
      [uid(1)],
    );
    await denied(
      'select public.challenge_occasion_server($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [uid(1), cid(501), habits.id, uid(2), 'wedding', event, 33, target, { body_goal: false }, []],
      /HEALTH_SCREENING_RESTRICTED/,
    );
    count++;
    console.log('PASS Occasion plans keep weights private and health screening blocks creation');
    await create(600);
    await admin();
    await scalar('select public.challenge_respond_server($1,$2,true,$3)', [
      uid(2),
      cid(600),
      { steps: 5000 },
    ]);
    await user(2);
    for (let i = 0; i < catalog.config.cheer_daily_limit; i++)
      await scalar("select public.challenge_action($1,$2,'cheer',$3)", [
        cid(800 + i),
        cid(600),
        uid(1),
      ]);
    await denied(
      "select public.challenge_action($1,$2,'cheer',$3)",
      [cid(899), cid(600), uid(1)],
      /CHEER_LIMIT/,
    );
    await admin();
    count++;
    console.log('PASS Encouragement uses the configured daily limit with retry-safe events');
    const roomCode = await scalar('select code from public.rooms where id=$1', [cid(1)]);
    await user(3);
    await scalar('select public.join_by_code($1)', [roomCode]);
    await admin();
    const coop = catalog.templates.find((t) => t.format === 'coop');
    await scalar('select public.challenge_create_server($1,$2,$3,$4,$5,$6,$7,$8)', [
      uid(1),
      cid(650),
      coop.id,
      'room',
      7,
      [uid(2), uid(3)],
      { steps: 5000 },
      cid(1),
    ]);
    for (const actor of [uid(2), uid(3)])
      await scalar('select public.challenge_respond_server($1,$2,true,$3)', [
        actor,
        cid(650),
        { steps: 5000 },
      ]);
    await user(3);
    const freeRoom = await scalar('select public.challenge_snapshot($1)', [cid(650)]);
    assert.equal(freeRoom.details_locked, true);
    assert.ok(freeRoom.participants.filter((p) => !p.self).every((p) => p.percent === 'locked'));
    await user(1);
    assert.equal(
      (await scalar('select public.challenge_snapshot($1)', [cid(650)])).details_locked,
      false,
    );
    await admin();
    count++;
    console.log(
      'PASS A paid host runs a real three-member co-op; Free members accept but peer details remain server-locked',
    );
    await db.query("update public.profiles set timezone='America/New_York' where id=$1", [uid(3)]);
    for (const [id, protein, at] of [
      [910, 200, '2026-01-01T00:00:00Z'],
      [911, 100, '2026-10-27T03:00:00Z'],
    ])
      await db.query(
        "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from,confirmed_at) values($1,$2,'maintain','moderate',70,0,2500,$3,80,280,1700,2500,$4,$4)",
        [cid(id), uid(3), protein, at],
      );
    for (const [index, meal] of ['breakfast', 'lunch', 'dinner'].entries())
      await db.query(
        "insert into public.food_entries(id,user_id,meal_section,quantity,unit,calories,protein,carbs,fat,food_name,source,local_date) values($1,$2,$3,1,'serving',500,30,50,15,'Boundary test meal','search','2026-10-26')",
        [cid(920 + index), uid(3), meal],
      );
    const localSource = await scalar(
      "select public.challenge_source_days($1,'2026-10-26','2026-10-26')",
      [uid(3)],
    );
    assert.equal(localSource[0].values.protein_in_range, 1);
    count++;
    console.log(
      'PASS Protein challenge goals use local midnight when a New York evening update falls after UTC midnight',
    );
    await db.query(
      'insert into public.water_logs(id,user_id,local_date,amount_ml) values($1,$2,current_date::text,500)',
      [cid(700), uid(3)],
    );
    await db.query('delete from auth.users where id=$1', [uid(3)]);
    assert.equal(
      await scalar('select count(*) from public.daily_summaries where user_id=$1', [uid(3)]),
      0,
    );
    assert.equal(
      await scalar('select count(*) from public.challenge_dirty_queue where user_id=$1', [uid(3)]),
      0,
    );
    const dashboard = await scalar('select public.challenge_analytics_dashboard()');
    assert.ok(dashboard.events);
    assert.ok(dashboard.templates.length);
    count++;
    console.log(
      'PASS Account deletion with real logs does not recreate summaries or challenge work; aggregate dashboard executes',
    );
    const beforeCounters = await scalar(
      'select joined_count from public.challenge_counters where template_id=$1',
      [starter.id],
    );
    await db.query('delete from public.challenges where id=$1', [cid(10)]);
    assert.equal(
      await scalar('select joined_count from public.challenge_counters where template_id=$1', [
        starter.id,
      ]),
      beforeCounters - 2,
    );
    assert.equal(
      await scalar('select completed_count from public.challenge_counters where template_id=$1', [
        starter.id,
      ]),
      0,
    );
    count++;
    console.log(
      'PASS Deleting a fixture removes exactly its real joined/completed counts without double subtraction',
    );
  } catch (error) {
    await db.exec('rollback;reset role');
    throw error;
  } finally {
    await db.exec('rollback;reset role');
  }
  console.log(`Challenge database tests: ${count} passed, 0 failed`);
}
