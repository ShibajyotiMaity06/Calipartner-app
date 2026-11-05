import assert from 'node:assert/strict';

export async function runSquadRenameTests(db) {
  const id = (n) => `fa510000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (n) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(n), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (call, args = []) =>
    Object.values((await db.query(`select public.${call}`, args)).rows[0])[0];
  const denied = async (operation, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(operation, pattern);
    await db.exec('rollback to savepoint denied');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let n = 1; n <= 3; n++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id(n),
        `rename${n}@example.invalid`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,timezone,date_of_birth,sex,height_cm) values($1,$2::text,$2::text,'UTC','1995-01-01','male',175)",
        [id(n), `rename${n}`],
      );
    }
    await user(1);
    const room = await rpc('create_room_v3($1,$2)', [id(10), 'Original squad']);
    await user(2);
    await rpc('join_by_code($1)', [room.code]);
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Member rename']),
      /NOT_AUTHORIZED/,
    );
    await user(3);
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Stranger rename']),
      /NOT_AUTHORIZED/,
    );
    await user(1);
    for (const name of ['', '   ', 'a'.repeat(101), null])
      await denied(
        () => rpc('rename_room($1,$2,$3)', [id(20), room.room_id, name]),
        /INVALID_ROOM_NAME/,
      );
    const renamed = await rpc('rename_room($1,$2,$3)', [id(20), room.room_id, '  Morning squad  ']);
    assert.equal(renamed.name, 'Morning squad');
    assert.equal((await rpc('get_my_rooms()'))[0].name, 'Morning squad');
    assert.equal(
      (await rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Morning squad'])).name,
      'Morning squad',
    );
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Different payload']),
      /NOT_AUTHORIZED/,
    );
    await rpc('rename_room($1,$2,$3)', [id(21), room.room_id, 'Evening squad']);
    assert.equal(
      (await rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Morning squad'])).name,
      'Evening squad',
    );
    await user(2);
    assert.equal((await rpc('get_my_rooms()'))[0].name, 'Evening squad');
    await denied(() => db.query('select * from public.room_name_changes'), /permission denied/);
    await user(1);
    await rpc('transfer_host($1,$2)', [room.room_id, id(2)]);
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(20), room.room_id, 'Morning squad']),
      /NOT_AUTHORIZED/,
    );
    await user(2);
    await rpc('rename_room($1,$2,$3)', [id(22), room.room_id, 'New host squad']);
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(21), room.room_id, 'Evening squad']),
      /NOT_AUTHORIZED/,
    );
    await admin();
    assert.equal(
      (
        await db.query(
          'select count(*)::int as count from public.room_name_changes where room_id=$1',
          [room.room_id],
        )
      ).rows[0].count,
      3,
    );
    assert.equal(
      (
        await db.query(
          "select relrowsecurity from pg_class where oid='public.room_name_changes'::regclass",
        )
      ).rows[0].relrowsecurity,
      true,
    );
    await db.exec('set role anon');
    await denied(
      () => rpc('rename_room($1,$2,$3)', [id(23), room.room_id, 'Anonymous']),
      /permission denied/,
    );
    await admin();
    console.log(
      'Squad rename database tests: host permissions, validation, acknowledged shared names, safe replays, host transfer and RLS passed',
    );
  } finally {
    await admin();
    await db.exec('rollback');
  }
}
