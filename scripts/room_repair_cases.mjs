import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runRoomRepairTests(db) {
  const uid = (i) => `af000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const id = (i) => `ae000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const migration = await readFile(
    'supabase/migrations/20261027000004_room_lifecycle_workout_repairs.sql',
    'utf8',
  );
  await admin();
  for (let i = 1; i <= 5; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `room_repair_${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Room repair','1995-01-01','male',175,'UTC')",
      [uid(i), `room_repair_${i}`],
    );
  }
  await user(1);
  await scalar('select public.create_room_v3($1,$2)', [id(1), 'Abandoned']);
  await admin();
  await db.query("update public.room_members set status='left' where room_id=$1", [id(1)]);
  await user(1);
  await assert.rejects(
    () => scalar('select public.create_room_v3($1,$2)', [id(2), 'Replacement']),
    /HOSTED_ROOM_LIMIT/,
  );
  // Reproduce the actual hosted deployment: both extras tables/APIs were absent.
  await admin();
  await db.exec(
    'drop table public.room_workout_shares cascade; drop table public.pair_challenges cascade; drop function public.get_room_workout_shares(uuid); drop function public.get_pair_challenges(uuid);',
  );
  await db.exec(migration);
  assert.equal(await scalar('select state from public.rooms where id=$1', [id(1)]), 'archived');
  await user(1);
  const replacement = await scalar('select public.create_room_v3($1,$2)', [id(2), 'Replacement']);
  assert.equal(replacement.room_id, id(2));
  assert.deepEqual(await scalar('select public.get_room_workout_shares($1)', [id(2)]), []);
  assert.deepEqual(await scalar('select public.get_pair_challenges($1)', [id(2)]), []);
  console.log('PASS Missing hosted workout APIs are restored and abandoned Free slots recovered');
  await scalar('select public.send_room_invitation($1,$2)', [id(2), 'room_repair_2']);
  await admin();
  const invitation = await scalar(
    'select id from public.room_requests where room_id=$1 and recipient_id=$2',
    [id(2), uid(2)],
  );
  await user(3);
  await assert.rejects(
    () => scalar('select public.respond_to_request($1,true,null)', [invitation]),
    /NOT_AUTHORIZED/,
  );
  await user(2);
  assert.equal(
    (await scalar('select public.respond_to_request($1,true,null)', [invitation])).status,
    'accepted',
  );
  assert.equal(
    (await scalar('select public.respond_to_request($1,true,null)', [invitation])).status,
    'accepted',
  );
  console.log(
    'PASS Free invite acceptance uses current consent/capacity checks and retries safely',
  );
  await user(1);
  await scalar('select public.leave_room($1)', [id(2)]);
  await admin();
  assert.equal(
    await scalar('select plan_holder_id from public.rooms where id=$1', [id(2)]),
    uid(2),
  );
  await user(1);
  await scalar('select public.create_room_v3($1,$2)', [id(3), 'New Free slot']);
  await scalar('select public.leave_room($1)', [id(2)]);
  console.log('PASS Host exit transfers ownership, frees original quota and is idempotent');
  await user(2);
  await scalar('select public.leave_room($1)', [id(2)]);
  await scalar('select public.leave_room($1)', [id(2)]);
  await scalar('select public.create_room_v3($1,$2)', [id(4), 'Reused Free slot']);
  await scalar('select public.send_room_invitation($1,$2)', [id(4), 'room_repair_4']);
  await scalar('select public.leave_room($1)', [id(4)]);
  await admin();
  assert.equal(
    await scalar(
      "select count(*)::int from public.room_requests where room_id=$1 and status='pending'",
      [id(4)],
    ),
    0,
  );
  await user(4);
  const cancelled = await scalar('select id from public.room_requests where room_id=$1', [id(4)]);
  await assert.rejects(
    () => scalar("select public.respond_to_request($1,'accept')", [cancelled]),
    /REQUEST_NOT_FOUND/,
  );
  console.log('PASS Last-member exit archives room, cancels invitations and restores Free slot');
  await user(5);
  await assert.rejects(
    () => scalar('select public.get_room_workout_shares($1)', [id(3)]),
    /NOT_ROOM_MEMBER/,
  );
  await assert.rejects(() => scalar('select public.leave_room($1)', [id(3)]), /NOT_ROOM_MEMBER/);
  await admin();
  await db.exec('set role anon');
  await assert.rejects(
    () => scalar('select public.get_room_workout_shares($1)', [id(3)]),
    /permission denied/,
  );
  await admin();
  await db.exec(migration);
  await db.exec(migration);
  await user(1);
  assert.equal(
    await scalar("select count(*)::int from public.rooms where id=$1 and state<>'archived'", [
      id(3),
    ]),
    1,
  );
  console.log(
    'PASS Repair migration retries preserve occupied rooms and enforce outsider/anonymous denial',
  );
  await admin();
  console.log('Room repair database tests: 5 passed, 0 failed');
}
