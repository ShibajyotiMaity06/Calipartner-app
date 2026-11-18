import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runCardioSessionTests(db) {
  const owner = randomUUID();
  const outsider = randomUUID();
  const now = '2026-11-18T10:00:00.000Z';
  const day = '2026-11-18';
  const auth = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id }),
    ]);
    await db.exec('set role authenticated');
  };
  const record = (mode, id = randomUUID()) => {
    const name = {
      steps: 'Walking Session',
      cycling: 'Cycling (Outdoor GPS)',
      running: 'Running (Outdoor GPS)',
    }[mode];
    const type = mode === 'cycling' ? 'cardio' : 'walk_run';
    const session = {
      workout_id: id,
      user_id: owner,
      mode,
      local_date: day,
      started_at: now,
      duration_seconds: 601,
      distance_m: 1215,
      target: mode === 'steps' ? 1000 : 1000,
      step_count: mode === 'steps' ? 1400 : null,
      estimated_calories: 95,
    };
    const change = (entity, payload) => ({ entity, id: payload.id, operation: 'upsert', payload });
    const exercise = randomUUID();
    return {
      session,
      changes: [
        change('workouts', {
          id,
          name,
          type,
          user_id: owner,
          duration_minutes: 10,
          local_date: day,
          start_time: now,
        }),
        change('workout_exercises', {
          id: exercise,
          workout_id: id,
          user_id: owner,
          exercise_name: name,
          order_in_workout: 1,
        }),
        change('workout_sets', {
          id: randomUUID(),
          workout_id: id,
          workout_exercise_id: exercise,
          user_id: owner,
          distance_meters: 1215,
          duration_seconds: 601,
        }),
      ],
    };
  };
  const save = (entry, daily = null) =>
    db.query('select public.save_cardio_session($1::jsonb, $2::jsonb, $3::jsonb)', [
      JSON.stringify(entry.changes),
      JSON.stringify(entry.session),
      daily && JSON.stringify(daily),
    ]);
  const denied = async (call, pattern) => {
    await db.exec('savepoint blocked');
    try {
      await assert.rejects(call, pattern);
    } finally {
      await db.exec('rollback to blocked; release blocked');
    }
  };
  const history = async () =>
    (
      await db.query(
        'select workout_id, mode, distance_m, step_count, duration_seconds, target from public.cardio_history order by mode',
      )
    ).rows;

  await db.exec('reset role; begin');
  try {
    await db.query(
      "insert into auth.users(id,email) values($1,'cardio-owner@example.invalid'), ($2,'cardio-outsider@example.invalid')",
      [owner, outsider],
    );
    await auth(owner);
    const run = record('running');
    await save(run);
    await save(run);
    assert.deepEqual(await history(), [
      {
        workout_id: run.session.workout_id,
        mode: 'running',
        distance_m: '1215',
        step_count: null,
        duration_seconds: 601,
        target: 1000,
      },
    ]);
    const manual = record('cycling');
    manual.changes[0].payload.name = 'Cycling';
    await db.query('select public.save_tracking_changes($1::jsonb)', [
      JSON.stringify(manual.changes),
    ]);
    const manualRow = (await history()).find((row) => row.mode === 'cycling');
    assert.equal(manualRow.target, null);
    assert.equal(Number(manualRow.distance_m), 1215);

    const walk = record('steps');
    await denied(() => save(walk), /INVALID_STEP_READING/);
    assert.equal(
      (await db.query('select id from public.workouts where id = $1', [walk.session.workout_id]))
        .rows.length,
      0,
    );
    const daily = { steps: 1800, distance_m: 1500, source: 'pedometer' };
    await save(walk, daily);
    await db.query(
      "update public.activity_days set steps = 2200, source = 'health_platform' where user_id = $1",
      [owner],
    );
    await save(walk, daily);
    const secondWalk = record('steps');
    await save(secondWalk, daily);
    const { rows } = await db.query(
      'select steps, source from public.activity_days where user_id = $1',
      [owner],
    );
    assert.deepEqual(rows, [{ steps: 2200, source: 'health_platform' }]);
    assert.equal((await history()).length, 4);

    await auth(outsider);
    assert.equal((await history()).length, 0);
    await denied(() => save(run), /NOT_AUTHORIZED/);
    await denied(
      () =>
        db.query(
          'insert into public.cardio_sessions select * from jsonb_populate_record(null::public.cardio_sessions, $1::jsonb)',
          [JSON.stringify({ ...run.session, user_id: outsider })],
        ),
      /row-level security/,
    );
    await auth(owner);
    await db.query('update public.workouts set deleted_at = now() where id = $1', [
      run.session.workout_id,
    ]);
    assert.equal(
      (await history()).some((row) => row.workout_id === run.session.workout_id),
      false,
    );
    console.log(
      'Cardio database tests: atomic saves, retries, prior history, deduplicated daily steps and owner-only access passed',
    );
  } finally {
    await db.exec('reset role; rollback');
  }
}
