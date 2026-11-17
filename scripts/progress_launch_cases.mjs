import assert from 'node:assert/strict';
export async function runProgressLaunchTests(db) {
  await db.exec('begin');
  const id = (n) => `fa160000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  try {
    for (let n = 1; n <= 3; n++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id(n),
        `progress${n}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Progress test','1995-01-01','male',175,'Pacific/Kiritimati')",
        [id(n), `launch_progress_${n}`],
      );
    }
    const today = await scalar(
      "select to_char(now() at time zone 'Pacific/Kiritimati','YYYY-MM-DD')",
    );
    await db.query(
      "insert into public.social_profiles(user_id,bio,mutation_id,edited_at) values($1,'Visible bio',$2,now())",
      [id(1), id(10)],
    );
    await db.query(
      "insert into public.social_profiles(user_id,bio,is_public,mutation_id,edited_at) values($1,'Private bio',false,$2,now())",
      [id(2), id(11)],
    );
    for (const [n, owner, date] of [
      [20, 1, today],
      [21, 1, today],
      [22, 2, today],
      [23, 1, '2020-01-01'],
    ]) {
      await db.query(
        "insert into public.workouts(id,user_id,type,duration_minutes,local_date) values($1,$2,'strength',30,$3)",
        [id(n), id(owner), date],
      );
      await db.query(
        "insert into public.workout_exercises(id,user_id,workout_id,exercise_name) values($1,$2,$3,'Press')",
        [id(n + 10), id(owner), id(n)],
      );
    }
    for (let n = 0; n < 5; n++)
      await db.query(
        'insert into public.workout_sets(id,user_id,workout_id,workout_exercise_id,set_number,reps,weight_kg,completed,is_warmup,deleted_at) values($1,$2,$3,$4,$5,5,60,$6,$7,$8)',
        [
          id(40 + n),
          id(1),
          id(20),
          id(30),
          n + 1,
          n !== 2,
          n === 3,
          n === 4 ? new Date().toISOString() : null,
        ],
      );
    await db.query(
      'insert into public.workout_sets(id,user_id,workout_id,workout_exercise_id,set_number,reps,weight_kg) values($1,$2,$3,$4,1,10,999)',
      [id(49), id(2), id(22), id(32)],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(1), role: 'authenticated' }),
    ]);
    await db.exec('set local role authenticated');
    const data = await scalar("select public.get_individual_progress('7d')");
    assert.equal(data.end_date, today);
    assert.equal(data.workouts.total_workouts, 2);
    assert.equal(data.workouts.total_duration_minutes, 60);
    assert.equal(data.workouts.total_strength_sets, 2);
    assert.equal(data.workouts.strength_sets.length, 2);
    assert(data.workouts.strength_sets.every((s) => s.weight_kg === 60));
    assert.deepEqual(data.workouts.daily_sessions, [{ date: today, sessions: 2 }]);
    assert.equal(
      (await scalar("select public.get_individual_progress('all')")).start_date,
      '2020-01-01',
    );
    const privateProfile = await scalar('select public.get_social_profile($1)', [id(2)]);
    assert.equal(privateProfile.bio, '');
    assert.equal(privateProfile.is_public, false);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(3), role: 'authenticated' }),
    ]);
    await db.exec('set local role authenticated');
    const publicProfile = await scalar('select public.get_social_profile($1)', [id(1)]);
    assert.equal(publicProfile.bio, 'Visible bio');
    assert.equal(publicProfile.is_public, true);
    assert.equal((await scalar('select public.get_social_profile($1)', [id(3)])).is_public, true);
    assert.equal((await db.query('select * from public.social_profiles')).rows.length, 0);
    assert.equal(
      await scalar(
        "select has_function_privilege('authenticated','public.get_individual_progress_before_launch_refresh(text)','execute')",
      ),
      false,
    );
    assert.equal(
      await scalar(
        "select has_function_privilege('anon','public.get_individual_progress(text)','execute')",
      ),
      false,
    );
    assert.equal(
      (await scalar("select public.get_individual_progress('7d')")).workouts.total_workouts,
      0,
    );
    console.log(
      'Progress launch: session/set counts, stored-zone ranges, owner isolation, public defaults and explicit privacy opt-outs passed',
    );
  } finally {
    await db.exec('rollback; reset role');
  }
}
