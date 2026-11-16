import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function runAiMonthlyAllowanceTests(db) {
  const owner = 'f9110000-0000-4000-8000-000000000001',
    peer = 'f9110000-0000-4000-8000-000000000002';
  const hash = 'a'.repeat(64);
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const service = async () => {
    await admin();
    await db.exec(
      'set role service_role;select set_config(\'request.jwt.claims\',\'{"role":"service_role"}\',false)',
    );
  };
  const actor = async (id) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const begin = (user, feature, id = randomUUID(), fingerprint = hash) =>
    scalar('select public.begin_ai_request($1,$2,$3,$4)', [user, id, feature, fingerprint]);
  const finish = (
    user,
    id,
    lease,
    response = { status: 200, body: { success: true, message: 'Private fixture' } },
  ) =>
    scalar('select public.finish_ai_request($1,$2,$3,$4,25,0.00001)', [user, id, lease, response]);
  const access = (user, feature) =>
    scalar(`select public.check_ai_${feature === 'coach' ? 'coach' : 'food_photo'}_access($1)`, [
      user,
    ]);
  const rejected = async (fn, pattern) => {
    await db.exec('savepoint denied_ai');
    await assert.rejects(fn, pattern);
    await db.exec('rollback to savepoint denied_ai');
  };
  await admin();
  await db.exec('begin');
  try {
    await db.exec(
      'update public.remote_config set value=\'{"monthly_budget_usd":10000,"ai_disabled":false}\' where key=\'ai_budgets\'',
    );
    for (const [id, handle] of [
      [owner, 'monthly_owner'],
      [peer, 'monthly_peer'],
    ]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id,
        handle + '@example.invalid',
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'AI fixture','1995-01-01','male',175,'Pacific/Kiritimati')",
        [id, handle],
      );
      await db.query(
        "insert into public.entitlements(user_id,tier,period,source,status,period_end) values($1,'pro','monthly','none','paid',now()+interval '1 year')",
        [id],
      );
      await db.query(
        "insert into public.consent_records(user_id,consent_type,version,accepted_at) values($1,'ai_processing','monthly-test',now())",
        [id],
      );
    }
    await actor(owner);
    await rejected(() => begin(owner, 'coach'), /permission denied/);
    await rejected(() => db.query('select * from public.ai_requests'), /permission denied/);
    await rejected(() => access(peer, 'coach'), /FORBIDDEN/);
    await service();
    for (const [feature, cap] of [
      ['coach', 900],
      ['food_photo', 300],
    ]) {
      await db.query(
        "insert into public.ai_usage(user_id,feature,day,count) values($1,$2,(now() at time zone 'Pacific/Kiritimati')::date,$3)",
        [owner, feature, cap - 1],
      );
      const id = randomUUID(),
        other = randomUUID();
      const leases = await Promise.all([begin(owner, feature, id), begin(owner, feature, other)]);
      const first = leases.find((result) => result.lease_id),
        blocked = leases.find((result) => !result.lease_id);
      assert.ok(first?.lease_id);
      assert.equal(blocked.code, 'REQUEST_IN_PROGRESS');
      const reservedId = leases[0].lease_id ? id : other;
      assert.equal((await begin(owner, feature, reservedId)).code, 'REQUEST_IN_PROGRESS');
      assert.equal((await finish(owner, reservedId, first.lease_id)).saved, true);
      assert.equal((await access(owner, feature)).code, 'MONTHLY_LIMIT_REACHED');
      assert.equal('cap' in (await access(owner, feature)), false);
      assert.equal((await begin(owner, feature)).code, 'MONTHLY_LIMIT_REACHED');
      assert.equal(
        (await begin(owner, feature, reservedId)).replay.body.message,
        'Private fixture',
      );
      assert.equal(
        (await begin(owner, feature, reservedId, 'b'.repeat(64))).code,
        'REQUEST_CONFLICT',
      );
      await finish(owner, reservedId, first.lease_id);
      assert.equal(
        Number(
          await scalar('select sum(count) from public.ai_usage where user_id=$1 and feature=$2', [
            owner,
            feature,
          ]),
        ),
        cap,
      );
      assert.equal(
        await scalar(
          "select local_day=(now() at time zone 'Pacific/Kiritimati')::date from public.ai_requests where user_id=$1 and request_id=$2",
          [owner, reservedId],
        ),
        true,
      );
    }
    const retry = randomUUID(),
      first = await begin(peer, 'coach', retry);
    assert.equal((await finish(peer, retry, first.lease_id, null)).released, true);
    const second = await begin(peer, 'coach', retry);
    assert.notEqual(second.lease_id, first.lease_id);
    assert.equal((await finish(peer, retry, first.lease_id)).code, 'REQUEST_EXPIRED');
    assert.equal((await finish(peer, retry, second.lease_id)).saved, true);
    await db.query(
      "update public.ai_requests set expires_at=now()-interval '1 second' where user_id=$1 and request_id=$2",
      [peer, retry],
    );
    assert.equal((await begin(peer, 'coach', retry)).code, 'REQUEST_EXPIRED');
    const pending = randomUUID(),
      lease = await begin(peer, 'coach', pending);
    await db.query("update public.entitlements set tier='plus' where user_id=$1", [peer]);
    assert.equal((await finish(peer, pending, lease.lease_id)).code, 'UPGRADE_REQUIRED');
    await finish(peer, pending, lease.lease_id, null);
    await db.query("update public.entitlements set tier='pro' where user_id=$1", [peer]);
    await db.query(
      "update public.ai_usage set day=(date_trunc('month',(now() at time zone 'Pacific/Kiritimati'))-interval '1 day')::date,count=900 where user_id=$1",
      [peer],
    );
    assert.equal((await access(peer, 'coach')).allowed, true);
    console.log(
      'Monthly AI allowances: 300/900 boundaries, hidden counters, stored-zone month, concurrent reservations, replay, retries, lease fencing, entitlement recheck and RLS passed',
    );
  } finally {
    await db.exec('rollback;reset role');
  }
}
