import assert from 'node:assert/strict';
export async function runFoodCaptureTests(db) {
  const uid = 'fc000000-0000-4000-8000-000000000001';
  await db.exec('reset role');
  await db.query("insert into auth.users(id,email) values($1,'photo_repair@example.com')", [uid]);
  await db.query(
    "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,'photo_repair','Photo','1995-01-01','male',175,'Pacific/Kiritimati')",
    [uid],
  );
  const asOwner = async () => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);
  };
  const asService = async () => {
    await db.exec('reset role; set role service_role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ role: 'service_role' }),
    ]);
  };
  const access = async () =>
    (await db.query('select public.check_ai_food_photo_access($1) as result', [uid])).rows[0]
      .result;
  const record = () => db.query("select public.record_ai_usage($1,'food_photo',10,0.0001)", [uid]);
  await asOwner();
  assert.equal((await access()).code, 'UPGRADE_REQUIRED');
  await db.query("select public.accept_ai_processing_consent('1.0')");
  assert.equal((await access()).cap, 0);
  assert.equal((await access()).allowed, false);
  console.log('PASS Free accounts have no AI allowance even after consent');
  await assert.rejects(
    () =>
      db.query("select public.check_ai_food_photo_access('fc000000-0000-4000-8000-000000000099')"),
    /FORBIDDEN/,
  );
  await assert.rejects(record, /permission denied/);
  console.log('PASS App clients cannot inspect another account or write AI usage');
  await asService();
  await db.exec(
    `update public.remote_config set value='{"paid_pro":5,"free_taste":999,"trial":999,"free_after_trial":999}' where key='ai_food_photo_caps'`,
  );
  assert.equal((await access()).cap, 0);
  await assert.rejects(record, /AI_PHOTO_ACCESS_DENIED/);
  console.log('PASS Legacy starter and trial configuration cannot grant or record Free scans');
  await db.query(
    "insert into public.entitlements(user_id,tier,period,source,status,period_end) values($1,'plus','annual','apple','paid',now()+interval '1 year')",
    [uid],
  );
  assert.equal((await access()).code, 'UPGRADE_REQUIRED');
  await db.query("update public.entitlements set status='trial' where user_id=$1", [uid]);
  assert.equal((await access()).allowed, false);
  console.log('PASS Plus paid and Plus trial do not receive Pro photo scans');
  await db.query("update public.entitlements set tier='pro',status='paid' where user_id=$1", [uid]);
  await db.query("update public.entitlements set status='trial' where user_id=$1", [uid]);
  assert.equal((await access()).code, 'UPGRADE_REQUIRED');
  await assert.rejects(record, /AI_PHOTO_ACCESS_DENIED/);
  await db.query("update public.entitlements set status='paid' where user_id=$1", [uid]);
  assert.equal((await access()).cap, 5);
  for (let i = 0; i < 5; i++) await record();
  await assert.rejects(record, /AI_PHOTO_ACCESS_DENIED/);
  const total = (
    await db.query(
      "select count,day::text as day,(now() at time zone 'Pacific/Kiritimati')::date::text as expected_day from public.ai_usage where user_id=$1",
      [uid],
    )
  ).rows[0];
  assert.equal(total.count, 5);
  assert.equal(total.day, total.expected_day);
  console.log('PASS Pro daily scans use the stored time zone and enforce five scans');
  await db.exec(
    "insert into public.remote_config(key,value) values('ai_budgets','{\"ai_disabled\":true}') on conflict(key) do update set value=excluded.value",
  );
  assert.equal((await access()).code, 'FEATURE_DISABLED');
  console.log('PASS The server AI kill switch still takes priority');
  console.log('Food capture database tests: 6 passed, 0 failed');
  await db.exec('reset role');
}
