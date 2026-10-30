import assert from 'node:assert/strict';
const owner = 'fa310000-0000-4000-8000-000000000001';
const challenge = 'fa310000-0000-4000-8000-000000000002';
const session = 'fa310000-0000-4000-8000-000000000003';
const push = 'fa310000-0000-4000-8000-000000000004';
const scalar = async (db, sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

/** Seed before applying the retirement migration, so preservation and pending-work tests are real. */
export async function seedActivityRetirementHistory(db) {
  await db.query("insert into auth.users(id,email) values($1,'retirement_fixture@example.com')", [
    owner,
  ]);
  await db.query(
    "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm) values($1,'retirement_fixture','Historical owner','1995-01-01','male',175)",
    [owner],
  );
  await db.query(
    "insert into public.focus_sessions(id,user_id,mode,started_at,ended_at,status) values($1,$2,'stopwatch',now()-interval '1 hour',now(),'ended')",
    [session, owner],
  );
  await db.query(
    `insert into public.challenges(id,template_id,template_version,rules_snapshot,creator_id,scope,start_date,end_date,duration_days,status,invite_expires_at)
    select $1,id,version,jsonb_build_object('tasks',tasks),$2,'solo',current_date,current_date+6,7,'active',now()+interval '1 day' from public.challenge_templates where slug='focus-streak'`,
    [challenge, owner],
  );
  await db.query(
    "insert into public.challenge_participants(challenge_id,user_id,status,targets,benefits,tz,start_date) values($1,$2,'joined','{\"focus_minutes\":60}','{}','UTC',current_date)",
    [challenge, owner],
  );
  await db.query(
    "insert into public.push_notification_queue(id,user_id,notification_type,title,body) values($1,$2,'focus_session','Focus session','Old pending reminder')",
    [push, owner],
  );
}

export async function runActivityRetirementTests(db) {
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  await admin();
  assert.equal(
    await scalar(db, 'select count(*)::int from public.focus_sessions where id=$1', [session]),
    1,
  );
  assert.equal(
    await scalar(db, 'select status from public.challenges where id=$1', [challenge]),
    'cancelled',
  );
  assert.equal(
    await scalar(db, 'select status from public.push_notification_queue where id=$1', [push]),
    'skipped',
  );
  assert.equal(
    await scalar(
      db,
      "select count(*)::int from pg_proc where pronamespace='public'::regnamespace and proname like '%focus%' and (has_function_privilege('authenticated',oid,'execute') or has_function_privilege('anon',oid,'execute') or has_function_privilege('service_role',oid,'execute'))",
    ),
    0,
  );
  for (const table of [
    'focus_sessions',
    'focus_settings',
    'room_focus_sessions',
    'room_focus_participants',
  ]) {
    assert.equal(
      await scalar(
        db,
        "select has_table_privilege('authenticated',$1,'select,insert,update,delete')",
        [`public.${table}`],
      ),
      false,
    );
    assert.equal(
      await scalar(
        db,
        "select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and tablename=$1",
        [table],
      ),
      0,
    );
  }
  console.log(
    'PASS Retirement: historical records preserved; session APIs, table access, Realtime and pending timer push disabled',
  );

  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: owner, role: 'authenticated' }),
  ]);
  await db.exec('set role authenticated');
  await assert.rejects(
    () => db.query("select public.start_personal_focus($1,'stopwatch')", [session]),
    /permission denied/,
  );
  await assert.rejects(() => db.query('select * from public.focus_sessions'), /permission denied/);
  const home = await scalar(db, 'select public.challenge_home()');
  assert.deepEqual(home.items, []);
  assert.equal(
    home.catalog.templates.some((t) => t.tasks.includes('focus_minutes')),
    false,
  );
  assert.equal(home.catalog.config.rules.metrics.focus_minutes, undefined);
  assert.equal(home.catalog.texts['template.focus-streak.title'], undefined);
  assert.equal(await scalar(db, 'select public.challenge_has_access($1)', [challenge]), false);
  await assert.rejects(
    () => db.query('select public.challenge_snapshot($1)', [challenge]),
    /NOT_CHALLENGE_PARTICIPANT/,
  );
  console.log(
    'PASS Retirement: old clients cannot start timers or open retired challenges; catalogue and all metrics exclude Focus',
  );

  const defaults = await scalar(db, 'select public.default_privacy_settings()');
  const sanitized = await scalar(
    db,
    'select public.sanitize_privacy_settings(\'{"share_steps":false,"share_focus_status":true}\')',
  );
  for (const key of ['share_focus_status', 'share_focus_label', 'focus_status', 'focus_label']) {
    assert.equal(defaults[key], undefined);
    assert.equal(sanitized[key], undefined);
  }
  assert.equal(sanitized.share_steps, false);
  console.log(
    'PASS Retirement: privacy removes retired aliases and preserves current sharing choices',
  );

  await admin();
  const input = await scalar(db, 'select public.challenge_engine_input($1)', [owner]);
  assert.deepEqual(input.challenges, []);
  assert.ok(
    !String(
      await scalar(
        db,
        "select pg_get_functiondef('public.challenge_source_days(uuid,date,date,jsonb)'::regprocedure)",
      ),
    ).includes('public.focus_sessions'),
  );
  assert.equal(
    await scalar(db, "select public.challenge_notify($1,$2,'morning','retired-morning')", [
      owner,
      challenge,
    ]),
    false,
  );
  await db.exec('select public.challenge_maintenance()');
  assert.equal(
    await scalar(
      db,
      "select count(*)::int from public.push_notification_queue where user_id=$1 and status in ('pending','processing')",
      [owner],
    ),
    0,
  );
  console.log(
    'PASS Retirement: scoring and notification workers no longer process retired challenges',
  );

  const secondPush = 'fa310000-0000-4000-8000-000000000005';
  await db.query(
    "insert into public.push_notification_queue(id,user_id,notification_type,title,body) values($1,$2,'focus_session','Old client','Ignored')",
    [secondPush, owner],
  );
  assert.equal(
    await scalar(db, 'select status from public.push_notification_queue where id=$1', [secondPush]),
    'skipped',
  );
  await db.query('delete from public.challenges where id=$1', [challenge]);
  await db.query('delete from auth.users where id=$1', [owner]);
  console.log('PASS Retirement: new legacy timer notifications are skipped automatically');
  console.log('Activity retirement database tests: 5 passed, 0 failed');
}
