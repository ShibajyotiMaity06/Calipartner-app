import assert from 'node:assert/strict';
export async function runFastingAccessTests(db) {
  const uid = (i) => 'fa031500-0000-4000-8000-' + String(i).padStart(12, '0');
  const fid = (i) => 'fb031500-0000-4000-8000-' + String(i).padStart(12, '0');
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const actor = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const reject = async (fn, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(fn, pattern);
    await db.exec('rollback to savepoint denied');
  };
  await admin();
  await db.exec('begin');
  try {
    // Model a legacy underage profile while keeping the normal signup gate intact.
    await db.exec('alter table public.profiles disable trigger tr_check_profile_dob');
    for (let i = 0; i < 7; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        'fasting_release_' + i + '@example.com',
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Fasting fixture',$3,'male',175,'Asia/Kolkata')",
        [uid(i), 'fasting_release_' + i, i === 4 ? '2012-01-01' : '1995-01-01'],
      );
      if (i !== 5)
        await db.query(
          'insert into public.health_screening(user_id,pregnant_or_breastfeeding,has_diabetes_or_medication,has_eating_disorder_history) values($1,false,false,false)',
          [uid(i)],
        );
      if (i !== 0)
        await db.query(
          "insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,now()+interval '1 day')",
          [uid(i), i === 3 ? 'pro' : 'plus', i === 2 ? 'trial' : 'paid'],
        );
    }
    await db.exec('alter table public.profiles enable trigger tr_check_profile_dob');
    const insert = (i) =>
      db.query(
        "insert into public.fasting_sessions(id,user_id,start_at,planned_minutes,status,local_date) values($1,$2,now()-interval '2 hours',1080,'active',current_date)",
        [fid(i), uid(i)],
      );
    await actor(0);
    await reject(() => insert(0), /PLUS_REQUIRED/);
    await reject(
      () =>
        db.query('insert into public.fasting_settings(user_id,enabled) values($1,true)', [uid(0)]),
      /PLUS_REQUIRED/,
    );
    for (const i of [1, 2, 3]) {
      await actor(i);
      await insert(i);
    }
    await actor(4);
    await reject(() => insert(4), /UNDER_18_BLOCKED/);
    await actor(5);
    await reject(() => insert(5), /SCREENING_REQUIRED/);
    for (const field of [
      'pregnant_or_breastfeeding',
      'has_diabetes_or_medication',
      'has_eating_disorder_history',
    ]) {
      await admin();
      await db.query(`update public.health_screening set ${field}=true where user_id=$1`, [uid(6)]);
      await actor(6);
      await reject(() => insert(6), /SCREENING_INELIGIBLE/);
      await admin();
      await db.query(`update public.health_screening set ${field}=false where user_id=$1`, [
        uid(6),
      ]);
    }
    await db.query(
      'insert into public.daily_summaries(user_id,local_date,low_intake_flag) values($1,current_date::text,true)',
      [uid(6)],
    );
    await actor(6);
    await reject(() => insert(6), /LOW_INTAKE_PAUSED/);
    await actor(1);
    await reject(
      () =>
        db.query("update public.fasting_sessions set start_at=now()+interval '1 day' where id=$1", [
          fid(1),
        ]),
      /INVALID_FASTING_TIMES/,
    );
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()-interval '1 day' where user_id=$1",
      [uid(1)],
    );
    await actor(1);
    await reject(
      () =>
        db.query('update public.fasting_sessions set planned_minutes=1200 where id=$1', [fid(1)]),
      /PLUS_REQUIRED/,
    );
    const expired = (await db.query('select * from public.fasting_sessions where id=$1', [fid(1)]))
      .rows[0];
    const endChange = {
      id: fid(1),
      entity: 'fasting_sessions',
      operation: 'upsert',
      payload: {
        ...expired,
        start_at: new Date(expired.start_at).toISOString(),
        end_at: new Date().toISOString(),
        status: 'ended_early',
        local_date: new Date(expired.local_date).toISOString().slice(0, 10),
      },
    };
    await db.query('select public.save_tracking_changes($1::jsonb)', [JSON.stringify([endChange])]);
    await db.query('select public.save_tracking_changes($1::jsonb)', [JSON.stringify([endChange])]);
    await reject(
      () =>
        db.query("update public.fasting_sessions set end_at=null,status='active' where id=$1", [
          fid(1),
        ]),
      /PLUS_REQUIRED/,
    );
    await actor(0);
    assert.equal(
      (await db.query('select * from public.fasting_sessions where user_id=$1', [uid(2)])).rows
        .length,
      0,
    );
    await actor(3);
    await reject(
      () =>
        db.query(
          "insert into public.fasting_settings(user_id,enabled,eating_window_start,eating_window_end) values($1,true,'18:00','20:00')",
          [uid(3)],
        ),
      /INVALID_FASTING_SETTINGS/,
    );
    const session = (await db.query('select * from public.fasting_sessions where id=$1', [fid(3)]))
      .rows[0];
    const change = {
      id: fid(3),
      entity: 'fasting_sessions',
      operation: 'upsert',
      payload: {
        ...session,
        start_at: new Date(session.start_at).toISOString(),
        end_at: null,
        local_date: new Date(session.local_date).toISOString().slice(0, 10),
      },
    };
    await db.query('select public.save_tracking_changes($1::jsonb)', [JSON.stringify([change])]);
    assert.equal(
      (
        await db.query('select count(*)::int as count from public.fasting_sessions where id=$1', [
          fid(3),
        ])
      ).rows[0].count,
      1,
    );
    console.log(
      'Fasting access/safety SQL tests: Free denial, Plus/Pro/Plus trial, expiry recovery, private histories, age/screening/low-intake gates, time/window validation and idempotent tracking saves passed',
    );
  } finally {
    await db.exec('rollback;reset role');
  }
}
