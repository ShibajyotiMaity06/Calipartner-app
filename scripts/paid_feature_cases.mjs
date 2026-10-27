import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function runPaidFeatureTests(db) {
  const uid = (i) => `fa270000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const id = (i) => `fb270000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.exec(
      'drop function public.check_ai_coach_access(uuid); create function public.check_ai_coach_access(p_user_id uuid) returns boolean language sql stable as $$select false$$',
    );
    const repair = await readFile(
      'supabase/migrations/20261027000001_paid_feature_access_repair.sql',
      'utf8',
    );
    await db.exec(repair.split('-- New fasting activity')[0]);
    assert.equal(
      await scalar(
        "select pg_get_function_result('public.check_ai_coach_access(uuid)'::regprocedure)",
      ),
      'jsonb',
    );

    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  await admin();
  await db.exec(
    'update public.remote_config set value=\'{"monthly_budget_usd":10000,"ai_disabled":false}\'::jsonb where key=\'ai_budgets\'',
  );
  for (let i = 1; i <= 5; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `paidrepair${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Paid repair','1995-01-01','male',175,'Pacific/Kiritimati')",
      [uid(i), `paidrepair_${i}`],
    );
  }
  for (const [i, tier, status, end] of [
    [2, 'plus', 'paid', "now()+interval '1 day'"],
    [3, 'plus', 'trial', "now()+interval '1 day'"],
    [4, 'pro', 'paid', "now()+interval '1 day'"],
    [5, 'pro', 'paid', "now()-interval '1 day'"],
  ])
    await db.query(
      `insert into public.entitlements(user_id,tier,period,source,status,period_end) values($1,$2,'annual','apple',$3,${end})`,
      [uid(i), tier, status],
    );
  for (const [i, allowed] of [
    [1, false],
    [2, false],
    [3, false],
    [4, true],
    [5, false],
  ]) {
    await user(i);
    assert.equal(
      (await scalar('select public.check_ai_coach_access($1)', [uid(i)])).allowed,
      allowed,
    );
  }
  await user(1);
  await assert.rejects(
    () => scalar('select public.check_ai_coach_access($1)', [uid(4)]),
    /FORBIDDEN/,
  );
  await admin();
  await db.exec('set role anon');
  await assert.rejects(
    () => scalar('select public.check_ai_coach_access($1)', [uid(4)]),
    /permission denied/,
  );
  console.log(
    'PASS Coach requires active Pro, rejects Free/Plus/Plus trial/expired Pro, actor spoofing and anonymous access',
  );
  await admin();
  await db.exec(
    'set role service_role;select set_config(\'request.jwt.claims\',\'{"role":"service_role"}\',false)',
  );
  for (let i = 0; i < 10; i++)
    await db.query("select public.record_ai_usage($1,'coach',10,0.001)", [uid(4)]);
  await assert.rejects(
    () => db.query("select public.record_ai_usage($1,'coach',10,0.001)", [uid(4)]),
    /DAILY_LIMIT_REACHED/,
  );
  assert.equal((await scalar('select public.check_ai_coach_access($1)', [uid(4)])).remaining, 0);
  await user(4);
  await assert.rejects(
    () => db.query("select public.record_ai_usage($1,'coach')", [uid(4)]),
    /permission denied/,
  );
  console.log(
    'PASS Coach daily usage is capped atomically at ten; clients cannot reset or write its counter',
  );
  await user(1);
  const insertFast = (i) =>
    db.query(
      "insert into public.fasting_sessions(id,user_id,start_at,planned_minutes,status,local_date) values($1,$2,now(),960,'active',current_date)",
      [id(i), uid(i)],
    );
  await assert.rejects(() => insertFast(1), /PLUS_REQUIRED/);
  await db.query(
    'insert into public.fasting_settings(user_id,enabled) values($1,false) on conflict(user_id) do update set enabled=false',
    [uid(1)],
  );
  await assert.rejects(
    () => db.query('update public.fasting_settings set enabled=true where user_id=$1', [uid(1)]),
    /PLUS_REQUIRED/,
  );
  for (const i of [2, 3, 4]) {
    await user(i);
    await insertFast(i);
  }
  console.log('PASS Fasting enforces Plus/Pro in the database, including valid Plus trials');
  await admin();
  await db.query(
    "update public.entitlements set period_end=now()-interval '1 day' where user_id=$1",
    [uid(2)],
  );
  await user(2);
  await db.query(
    "update public.fasting_sessions set status='ended_early',end_at=now() where user_id=$1",
    [uid(2)],
  );
  await assert.rejects(
    () =>
      db.query("update public.fasting_sessions set status='active',end_at=null where user_id=$1", [
        uid(2),
      ]),
    /PLUS_REQUIRED/,
  );
  console.log('PASS A lapsed subscriber can safely end an existing fast but cannot restart it');
  await admin();
  for (let i = 1; i <= 11; i++)
    await db.query(
      "insert into public.recipes(id,title,cuisine,meal_type,difficulty,servings,status,nutrition_per_serving,created_at) values($1,$2,'Indian','lunch','easy',1,'published','{\"calories\":200,\"protein\":10,\"carbs\":20,\"fat\":8,\"fiber\":3}', '1990-01-01')",
      [id(100 + i), `Starter audit ${i}`],
    );
  await user(1);
  assert.equal(await scalar('select count(*)::int from public.recipes'), 10);
  assert.equal(await scalar('select count(*)::int from public.recipes where id=$1', [id(111)]), 0);
  await user(3);
  assert.ok((await scalar('select count(*)::int from public.recipes')) >= 11);
  console.log(
    'PASS Recipe catalog RLS limits Free to ten fixed starter entries while Plus sees the full library',
  );
  console.log('Paid feature database tests: 5 passed, 0 failed');
  await admin();
}
