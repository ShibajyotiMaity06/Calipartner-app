import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runScanRepairTests(db) {
  const uid = (i) => `fd000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const id = (i) => `fe000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const access = async () =>
    (await db.query('select public.can_view_advanced_nutrition() as allowed')).rows[0].allowed;
  await admin();
  for (let i = 1; i <= 5; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `repair${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Repair','1995-01-01','male',175,'UTC')",
      [uid(i), `repair_${i}`],
    );
  }
  for (const [i, tier, end] of [
    [2, 'plus', "now()+interval '1 day'"],
    [3, 'pro', "now()+interval '1 day'"],
    [4, 'pro', "now()-interval '1 day'"],
  ])
    await db.query(
      `insert into public.entitlements(user_id,tier,period,source,status,period_end) values($1,$2,'annual','apple','paid',${end})`,
      [uid(i), tier],
    );
  for (const [i, expected] of [
    [1, false],
    [2, true],
    [3, true],
    [4, false],
  ]) {
    await user(i);
    assert.equal(await access(), expected);
  }
  await user(1);
  await assert.rejects(
    () => db.query('select public.can_view_advanced_nutrition($1)', [uid(2)]),
    /NOT_AUTHORIZED/,
  );
  await admin();
  await db.exec('set role anon');
  await assert.rejects(access, /permission denied/);
  console.log(
    'PASS Advanced nutrition requires a current Plus or Pro entitlement and rejects actor spoofing',
  );
  await admin();
  for (const [details, expected, portion] of [
    [null, true, false],
    [{ saturated_fat: 2, cholesterol_mg: null }, true, false],
    [{ saturated_fat: 101 }, false, false],
    [{ saturated_fat: 101 }, true, true],
    [{ saturated_fat: -1 }, false, true],
    [{ cholesterol_mg: 'bad' }, false, false],
    [{ unexpected: 5 }, false, false],
  ]) {
    const result = await db.query('select public.valid_nutrition_details($1::jsonb,$2) as valid', [
      details == null ? null : JSON.stringify(details),
      portion,
    ]);
    assert.equal(result.rows[0].valid, expected);
  }
  console.log('PASS Nutrition JSON validates units and bounds while preserving unknown values');
  await user(1);
  await db.query('select public.send_friend_request($1,$2,$3)', [uid(1), id(1), uid(5)]);
  await user(5);
  await db.query("select public.respond_friend_request($1,$2,'accept')", [uid(5), id(1)]);
  await admin();
  const old = await readFile('supabase/migrations/20261008000009_phase9_notifications.sql', 'utf8');
  const legacy = old.match(
    /create or replace function public\.trg_room_requests_push\(\)[\s\S]*?\$\$;/i,
  )?.[0];
  assert.ok(legacy, 'Legacy reproduction must use the actual broken trigger');
  await db.exec(legacy);
  await user(1);
  const create = () =>
    db.query("select public.create_squad_with_friends($1,'Repaired squad',$2)", [id(2), [uid(5)]]);
  await assert.rejects(create, /host_id/);
  await admin();
  await db.exec(
    await readFile('supabase/migrations/20261027000000_scan_nutrition_room_repairs.sql', 'utf8'),
  );
  await user(1);
  await create();
  await create();
  await admin();
  assert.equal(
    (
      await db.query('select count(*)::int as n from public.room_requests where room_id=$1', [
        id(2),
      ])
    ).rows[0].n,
    1,
  );
  console.log(
    'PASS Targeted migration repairs the deployed host_id trigger; Free friend invitations remain idempotent',
  );
  console.log('Scan repair database tests: 3 passed, 0 failed');
}
