import assert from 'node:assert/strict';
export async function runWorkoutRoutineTests(db) {
  const uid = (n) => `fa080000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (n) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(n), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const reject = async (sql, args, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to savepoint denied');
  };
  const preferences = {
    workout_days: [0, 2, 4],
    location: 'home',
    equipment: ['dumbbell'],
    experience: 'beginner',
    session_minutes: 30,
    limitations: '',
    workout_notes: 'Focus more on arms. No legs.',
    country: 'India',
    cuisine: 'Indian',
    diet: 'mixed',
    allergies: [],
    exclusions: [],
    meals_per_day: 4,
    cooking_minutes: 30,
    budget: 'economical',
  };
  const content = {
    days: Array.from({ length: 7 }, (_, day) => ({
      day,
      title: [0, 2, 4].includes(day) ? 'Arms' : 'Rest',
      minutes: [0, 2, 4].includes(day) ? 30 : 0,
      exercises: [0, 2, 4].includes(day)
        ? [
            {
              id: `day-${day}-exercise-0`,
              name: 'Seated dumbbell curls',
              equipment: 'dumbbell',
              targetSets: [
                { reps: 10, weightKg: 0 },
                { reps: 8, weightKg: 0 },
              ],
            },
          ]
        : [],
    })),
  };
  const reserve = (n, id, initial = false) =>
    rpc('reserve_workout_plan($1,$2,$3,$4)', [uid(n), uid(id), preferences, initial]);
  const finish = (n, id, lease, value = content) =>
    rpc('finish_workout_plan($1,$2,$3,$4)', [uid(n), uid(id), lease, value]);
  await admin();
  await db.exec('begin');
  try {
    for (const n of [1, 2, 3, 4]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(n),
        `workout_routine_${n}@example.invalid`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Workout fixture','1995-01-01','male',175,'America/New_York')",
        [uid(n), `workout_routine_${n}`],
      );
      await user(n);
      await rpc('accept_ai_processing_consent($1)', ['1.1-weekly-plan']);
      await admin();
      await db.query(
        'insert into public.personal_weekly_plans(user_id,id,preferences,content) values($1,$2,$3,$4)',
        [
          uid(n),
          uid(10 + n),
          preferences,
          {
            days: Array.from({ length: 7 }, (_, day) => ({
              day,
              workout: { title: 'Old', minutes: 0, exercises: [] },
              meals: [],
            })),
            workout_tips: [],
            diet_tips: [],
          },
        ],
      );
      const r = await reserve(n, 20 + n, true);
      await finish(n, 20 + n, r.lease);
      assert.equal((await reserve(n, 20 + n, true)).cached, true);
    }
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','paid',now()+interval '2 years'),($2,'pro','paid',now()+interval '2 years'),($3,'plus','trial',now()+interval '7 days')",
      [uid(2), uid(3), uid(4)],
    );
    await user(1);
    const free = await rpc('get_workout_plan()');
    assert.deepEqual(free.days, []);
    assert.equal(free.preferences, null);
    assert.equal(free.can_rebuild, false);
    await reject('select * from public.workout_plans', [], /permission denied/);
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(1), uid(90), preferences],
      /permission denied/,
    );
    await admin();
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(1), uid(90), preferences],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(4), uid(90), preferences],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,true)',
      [uid(2), uid(90), preferences],
      /INITIAL_PLAN_EXISTS/,
    );
    console.log(
      'PASS Workout routine: one initial routine, private Free/trial projection, RLS and service-only generation',
    );
    const failed = await reserve(2, 30);
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(2), uid(31), preferences],
      /PLAN_BUSY/,
    );
    await finish(2, 30, failed.lease, null);
    await user(2);
    assert.equal((await rpc('get_workout_plan()')).can_rebuild, true);
    await admin();
    const retried = await reserve(2, 30);
    assert.notEqual(retried.lease, failed.lease);
    await reject(
      'select public.finish_workout_plan($1,$2,$3,$4)',
      [uid(2), uid(30), failed.lease, content],
      /PLAN_STALE/,
    );
    await finish(2, 30, retried.lease);
    assert.equal((await reserve(2, 30)).cached, true);
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(2), uid(31), preferences],
      /WORKOUT_LIFETIME_LIMIT/,
    );
    await user(2);
    let view = await rpc('get_workout_plan()');
    assert.equal(view.rebuilds_used, 1);
    assert.equal(view.can_rebuild, false);
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()+interval '5 years' where user_id=$1",
      [uid(2)],
    );
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(2), uid(31), preferences],
      /WORKOUT_LIFETIME_LIMIT/,
    );
    console.log(
      'PASS Workout routine: Plus lifetime rebuild, concurrent reservation, failed generation, stable retries and renewed-subscription denial',
    );
    await user(3);
    assert.equal((await rpc('get_workout_plan()')).can_rebuild, true);
    await admin();
    const firstPro = await reserve(3, 40);
    await finish(3, 40, firstPro.lease);
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(3), uid(41), preferences],
      /WORKOUT_COOLDOWN/,
    );
    const next = (
      await db.query(
        "select completed_at+interval '6 months' as next from public.workout_plan_builds where id=$1",
        [uid(40)],
      )
    ).rows[0].next;
    await user(3);
    view = await rpc('get_workout_plan()');
    assert.equal(new Date(view.next_rebuild_at).getTime(), new Date(next).getTime());
    await admin();
    await db.query(
      "update public.workout_plan_builds set completed_at=now()-interval '6 months'+interval '1 second' where id=$1",
      [uid(40)],
    );
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(3), uid(41), preferences],
      /WORKOUT_COOLDOWN/,
    );
    await db.query(
      "update public.workout_plan_builds set completed_at=now()-interval '6 months' where id=$1",
      [uid(40)],
    );
    const secondPro = await reserve(3, 41);
    await finish(3, 41, secondPro.lease, null);
    await user(3);
    assert.equal((await rpc('get_workout_plan()')).can_rebuild, true);
    await admin();
    const retryPro = await reserve(3, 41);
    await db.query(
      "update public.entitlements set period_end=now()-interval '1 second' where user_id=$1",
      [uid(3)],
    );
    await reject(
      'select public.finish_workout_plan($1,$2,$3,$4)',
      [uid(3), uid(41), retryPro.lease, content],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await finish(3, 41, retryPro.lease, null);
    await db.query(
      "update public.entitlements set period_end=now()+interval '2 years' where user_id=$1",
      [uid(3)],
    );
    const finalPro = await reserve(3, 42);
    await finish(3, 42, finalPro.lease);
    await reject(
      'select public.reserve_workout_plan($1,$2,$3,false)',
      [uid(3), uid(43), preferences],
      /WORKOUT_COOLDOWN/,
    );
    console.log(
      'PASS Workout routine: immediate first Pro rebuild, exact six-calendar-month boundary, failed-build allowance and entitlement recheck',
    );
    await user(2);
    view = await rpc('get_workout_plan()');
    const edited = structuredClone({ days: view.days });
    edited.days[0].exercises[0].targetSets = [
      { reps: 12, weightKg: 7.5 },
      { reps: 9, weightKg: 10 },
    ];
    const result = await rpc('edit_workout_plan($1,$2,$3,$4)', [
      uid(60),
      view.id,
      view.revision,
      edited,
    ]);
    assert.deepEqual(
      result.days[0].exercises[0].targetSets,
      edited.days[0].exercises[0].targetSets,
    );
    assert.equal(
      (await rpc('edit_workout_plan($1,$2,$3,$4)', [uid(60), view.id, view.revision, edited]))
        .revision,
      result.revision,
    );
    assert.equal(result.rebuilds_used, 1);
    await reject(
      'select public.edit_workout_plan($1,$2,$3,$4)',
      [uid(61), view.id, view.revision, edited],
      /PLAN_STALE/,
    );
    const removed = structuredClone(edited);
    removed.days[0].exercises = [];
    removed.days[0].minutes = 0;
    const rest = await rpc('edit_workout_plan($1,$2,$3,$4)', [
      uid(61),
      result.id,
      result.revision,
      removed,
    ]);
    assert.deepEqual(rest.days[0].exercises, []);
    await user(1);
    await reject(
      'select public.edit_workout_plan($1,$2,$3,$4)',
      [uid(62), result.id, rest.revision, removed],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await admin();
    await db.query(
      'update public.personal_weekly_plans set content=jsonb_set(content,\'{days,0,workout}\', \'{"title":"Quota bypass attempt","minutes":30,"exercises":[]}\'::jsonb) where user_id=$1',
      [uid(2)],
    );
    const legacy = (
      await db.query('select content from public.personal_weekly_plans where user_id=$1', [uid(2)])
    ).rows[0].content;
    assert.notEqual(legacy.days[0].workout.title, 'Quota bypass attempt');
    await user(3);
    await reject(
      'select public.edit_workout_plan($1,$2,$3,$4)',
      [uid(70), rest.id, rest.revision, removed],
      /PLAN_STALE/,
    );
    await admin();
    const malformed = structuredClone(content);
    delete malformed.days[0].day;
    assert.equal(await rpc('valid_workout_routine($1)', [malformed]), false);
    malformed.days[0].day = 0;
    malformed.days[0].exercises[0].targetSets[0].reps = 101;
    assert.equal(await rpc('valid_workout_routine($1)', [malformed]), false);
    console.log(
      'PASS Workout routine: private acknowledged per-set edits/removal, stale and cross-owner rejection, malformed payloads and legacy-generation bypass prevention',
    );
    await db.query(
      "insert into public.workouts(id,user_id,type,duration_minutes,local_date) values($1,$2,'strength',0,'2026-11-08')",
      [uid(80), uid(1)],
    );
    await db.query(
      "insert into public.workout_exercises(id,user_id,workout_id,exercise_name) values($1,$2,$3,'Curl')",
      [uid(81), uid(1), uid(80)],
    );
    const counts = async () =>
      (await rpc('challenge_source_days($1,$2::date,$2::date)', [uid(1), '2026-11-08']))[0].values;
    assert.equal((await counts()).workouts_count, 0);
    await db.query(
      'insert into public.workout_sets(id,user_id,workout_id,workout_exercise_id,set_number,reps,weight_kg,completed,is_warmup) values($1,$2,$3,$4,1,10,5,true,false)',
      [uid(82), uid(1), uid(80), uid(81)],
    );
    assert.equal((await counts()).workouts_count, 1);
    assert.equal((await counts()).workout_minutes, 0);
    await db.query('delete from public.challenge_dirty_queue where user_id=$1', [uid(1)]);
    await db.query('update public.workout_sets set reps=12 where id=$1', [uid(82)]);
    assert.equal((await counts()).workouts_count, 1);
    assert.equal(
      (await db.query('select * from public.challenge_dirty_queue where user_id=$1', [uid(1)])).rows
        .length,
      1,
    );
    await db.query('update public.workout_sets set is_warmup=true where id=$1', [uid(82)]);
    assert.equal((await counts()).workouts_count, 0);
    await db.query('update public.workout_sets set is_warmup=false,deleted_at=now() where id=$1', [
      uid(82),
    ]);
    assert.equal((await counts()).workouts_count, 0);
    console.log(
      'PASS Workout routine: completed strength sets count once, warmup/deleted sets do not count, minutes stay zero and edits invalidate challenge aggregates',
    );
    console.log('Workout routine SQL/RLS: 5 groups passed, 0 failed');
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
