import assert from 'node:assert/strict';
export async function runPairInvitePreviewTests(db) {
  const ids = Array.from(
    { length: 4 },
    (_, i) => `ef290000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  );
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: ids[i], role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const reject = async (name, args, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(() => rpc(name, args), pattern);
    await db.exec('rollback to savepoint denied');
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 4; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        ids[i],
        `preview${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'UTC')",
        [ids[i], `preview_${i}`, `Preview ${i}`],
      );
    }
    await user(0);
    const invite = await rpc('prepare_onboarding_pair_invite($1,$2)', [
      'ef290000-0000-4000-8000-000000000100',
      'Pair preview',
    ]);
    assert.deepEqual(await rpc('preview_onboarding_pair_invite($1)', [invite.token]), {
      state: 'sender',
      can_share: true,
      reason: null,
    });
    assert.equal((await rpc('get_my_rooms()')).length, 0);
    await reject('accept_onboarding_pair_invite($1)', [invite.token], /SELF_INVITE/);
    await user(1);
    assert.equal(
      (await rpc('preview_onboarding_pair_invite($1)', [invite.token])).state,
      'joinable',
    );
    const joined = await rpc('accept_onboarding_pair_invite($1)', [invite.token]);
    assert.equal(
      (await rpc('accept_onboarding_pair_invite($1)', [invite.token])).room_id,
      joined.room_id,
    );
    assert.deepEqual(await rpc('preview_onboarding_pair_invite($1)', [invite.token]), {
      state: 'member',
      room_id: joined.room_id,
      is_sender: false,
    });
    await user(0);
    assert.deepEqual(await rpc('preview_onboarding_pair_invite($1)', [invite.token]), {
      state: 'member',
      room_id: joined.room_id,
      is_sender: true,
    });
    await user(2);
    assert.equal(
      (await rpc('preview_onboarding_pair_invite($1)', [invite.token])).state,
      'unavailable',
    );
    const expired = await rpc('prepare_onboarding_pair_invite($1,$2)', [
      'ef290000-0000-4000-8000-000000000200',
      'Expired preview',
    ]);
    await admin();
    await db.query(
      "update public.onboarding_pair_invites set expires_at=now()-interval '1 minute' where token=$1",
      [expired.token],
    );
    await user(2);
    assert.equal(
      (await rpc('preview_onboarding_pair_invite($1)', [expired.token])).reason,
      'expired',
    );
    await user(3);
    assert.equal(
      (await rpc('preview_onboarding_pair_invite($1)', [expired.token])).state,
      'unavailable',
    );
    console.log(
      'Pair invitation preview database tests: 1 passed, 0 failed (sender, recipient, retry, accepted member and expiry)',
    );
  } finally {
    await admin();
    await db.exec('rollback');
  }
}
