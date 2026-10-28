import assert from 'node:assert/strict';

export async function runChatAccessTests(db) {
  const ids = [1, 2, 3].map((i) => `d1700000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const room = 'd1800000-0000-4000-8000-000000000001';
  const admin = () => db.exec("reset role; select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: ids[i], role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const plan = async (i, tier, status = 'paid', period = '2099-01-01') => {
    await admin();
    await db.query(
      'insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,$4) on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,period_end=excluded.period_end',
      [ids[i], tier, status, period],
    );
  };
  await admin();
  for (let i = 0; i < 3; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      ids[i],
      `paid_chat_${i}@example.com`,
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Chat access','1995-01-01','male',175,'UTC')",
      [ids[i], `paid_chat_${i}`],
    );
  }
  await plan(0, 'pro');
  await user(0);
  const created = await scalar('select public.create_room_v3($1,$2)', [room, 'Chat room']);
  await user(1);
  await scalar('select public.join_by_code($1)', [created.code]);
  await user(0);
  await scalar('select public.accept_chat_terms()');
  await scalar('select public.send_chat_message($1,$2,$3,$4)', [
    room,
    'paid-access-message',
    'Private paid chat',
    JSON.stringify([
      {
        storage_key: `rooms/${room}/messages/paid-access-message/0.jpg`,
        size: 10,
        mime_type: 'image/jpeg',
      },
    ]),
  ]);
  await user(1);
  await assert.rejects(
    () => scalar('select public.get_chat_messages($1)', [room]),
    /PLUS_REQUIRED/,
  );
  await assert.rejects(() => scalar('select public.mark_chat_read($1)', [room]), /PLUS_REQUIRED/);
  assert.equal(await scalar('select public.get_chat_unread_count($1)', [room]), 0);
  for (const table of ['chat_messages', 'chat_attachments', 'chat_read_state'])
    assert.equal(await scalar(`select count(*)::int from public.${table}`), 0);
  await admin();
  assert.equal(
    await scalar(
      "select count(*)::int from public.push_notification_queue where user_id=$1 and notification_type='chat_message'",
      [ids[1]],
    ),
    0,
  );
  console.log(
    'PASS Free members cannot read chat RPCs, tables, media metadata, read-state or previews',
  );
  for (const [tier, status, end, allowed] of [
    ['plus', 'paid', '2099-01-01', true],
    ['plus', 'trial', '2099-01-01', true],
    ['pro', 'paid', '2099-01-01', true],
    ['pro', 'grace', '2099-01-01', true],
    ['pro', 'trial', '2099-01-01', false],
    ['pro', 'paid', '2000-01-01', false],
    ['plus', 'lapsed', '2099-01-01', false],
  ]) {
    await plan(1, tier, status, end);
    await user(1);
    if (allowed) {
      const messages = await scalar('select public.get_chat_messages($1)', [room]);
      assert.ok(messages.some((m) => m.text === 'Private paid chat'));
      assert.ok(await scalar('select count(*)::int from public.chat_attachments'));
      await scalar('select public.mark_chat_read($1)', [room]);
    } else {
      await assert.rejects(
        () => scalar('select public.get_chat_messages($1)', [room]),
        /PLUS_REQUIRED/,
      );
      assert.equal(await scalar('select count(*)::int from public.chat_messages'), 0);
      assert.equal(await scalar('select public.get_chat_unread_count($1)', [room]), 0);
    }
  }
  console.log(
    'PASS Plus/Pro and eligible Plus trials read chat; expired, lapsed and Pro trials do not',
  );
  await plan(0, 'pro', 'lapsed');
  await user(0);
  await assert.rejects(
    () =>
      scalar('select public.send_chat_message($1,$2,$3)', [
        room,
        'paid-access-message',
        'Private paid chat',
      ]),
    /PLUS_REQUIRED/,
  );
  console.log('PASS A lapsed sender cannot recover chat by replaying a previously successful send');
  await plan(2, 'pro');
  await user(2);
  await assert.rejects(
    () => scalar('select public.get_chat_messages($1)', [room]),
    /NOT_ROOM_MEMBER/,
  );
  await admin();
  await db.exec('set role anon');
  await assert.rejects(
    () => scalar('select public.get_chat_messages($1)', [room]),
    /permission denied|UNAUTHENTICATED/,
  );
  await admin();
  console.log('PASS Paid outsiders and anonymous users still cannot read room chat');
  console.log('Chat access database tests: 4 passed, 0 failed');
}
