import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runSnapshotRepairTests(db) {
  await db.exec("reset role; select set_config('request.jwt.claims','',false); begin;");
  try {
    const uid = 'd1900000-0000-4000-8000-000000000001';
    const room = 'd1900000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid,
      'snapshot_repair@example.com',
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,'snapshot_repair','Snapshot repair','1995-01-01','male',175,'UTC')",
      [uid],
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
    await db.query("select public.create_room_v3($1,'Snapshot repair')", [room]);
    await db.exec('reset role');
    // Restore the actual stale implementation, then reproduce the hosted schema without its alias.
    const source = await readFile(
      'supabase/migrations/20261024060000_rooms_v3_free_pairs_individual_features.sql',
      'utf8',
    );
    const stale = source.match(
      /create or replace function public\.get_room_snapshot\([\s\S]*?\$\$;/i,
    )?.[0];
    assert.ok(stale);
    await db.exec(stale);
    await db.exec('alter table public.goal_profiles drop column target_calories cascade');
    await db.exec('set role authenticated');
    await db.exec('savepoint before_snapshot');
    await assert.rejects(
      () => db.query('select public.get_room_snapshot($1)', [room]),
      /target_calories/,
    );
    await db.exec('rollback to savepoint before_snapshot; reset role');
    const repair = await readFile(
      'supabase/migrations/20261027000006_room_snapshot_current_target.sql',
      'utf8',
    );
    await db.exec(repair);
    await db.exec(repair);
    await db.exec('set role authenticated');
    const result = (await db.query('select public.get_room_snapshot($1) as snapshot', [room]))
      .rows[0].snapshot;
    assert.equal(result.room.id, room);
    assert.equal(result.members.length, 1);
    assert.equal(result.room.state, 'dormant');
  } finally {
    await db.exec('rollback; reset role');
  }
  console.log(
    'PASS Actual legacy snapshot failure without target_calories is repaired using the canonical column',
  );
  console.log('Snapshot repair database tests: 1 passed, 0 failed');
}
