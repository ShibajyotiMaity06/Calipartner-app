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
  const freeMessages = await scalar('select public.get_chat_messages($1)', [room]);
  assert.ok(freeMessages.some((message) => message.text === 'Private paid chat'));
  await scalar('select public.mark_chat_read($1)', [room]);
  assert.equal(await scalar('select public.get_chat_unread_count($1)', [room]), 0);
  assert.ok(await scalar('select count(*)::int from public.chat_messages'));
  await scalar('select public.accept_chat_terms()');
  const freeSend = await scalar('select public.send_chat_message($1,$2,$3)', [
    room,
    'free-access-message',
    'Free member reply',
  ]);
  assert.equal(
    (
      await scalar('select public.send_chat_message($1,$2,$3)', [
        room,
        'free-access-message',
        'retry',
      ])
    ).id,
    freeSend.id,
  );
  await admin();
  assert.ok(
    await scalar(
      "select count(*)::int from public.push_notification_queue where user_id=$1 and notification_type='chat_message'",
      [ids[1]],
    ),
  );
  console.log(
    'PASS Free members read, send, acknowledge and receive chat notifications with idempotent retries',
  );
  await user(1);
  assert.deepEqual(await scalar('select public.get_chat_hidden_senders($1)', [room]), []);
  await scalar('select public.set_chat_typing($1,true)', [room]);
  const reportTarget = freeMessages.find((message) => message.text === 'Private paid chat').id;
  const report = await scalar('select public.report_chat_message($1,$2)', [reportTarget, 'spam']);
  assert.equal(
    await scalar('select public.report_chat_message($1,$2)', [reportTarget, 'spam']),
    report,
  );
  await user(0);
  assert.ok(
    (await scalar('select public.get_chat_typing($1)', [room])).some(
      (person) => person.user_id === ids[1],
    ),
  );
  await admin();
  await db.exec('set role service_role');
  assert.equal(
    await scalar('select public.can_deliver_squad_chat_push($1,$2,$3)', [
      ids[1],
      room,
      reportTarget,
    ]),
    true,
  );
  await admin();
  await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
    ids[1],
    ids[0],
  ]);
  await db.exec('set role service_role');
  assert.equal(
    await scalar('select public.can_deliver_squad_chat_push($1,$2,$3)', [
      ids[1],
      room,
      reportTarget,
    ]),
    false,
  );
  await admin();
  await db.query('delete from public.blocks where blocker_id=$1 and blocked_id=$2', [
    ids[1],
    ids[0],
  ]);
  console.log(
    'PASS Free typing, reports and dispatch-time push membership/block checks remain enforced',
  );
  for (const [tier, status, end, allowed] of [
    ['plus', 'paid', '2099-01-01', true],
    ['plus', 'trial', '2099-01-01', true],
    ['pro', 'paid', '2099-01-01', true],
    ['pro', 'grace', '2099-01-01', true],
    ['pro', 'trial', '2099-01-01', true],
    ['pro', 'paid', '2000-01-01', true],
    ['plus', 'lapsed', '2099-01-01', true],
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
  console.log('PASS Text chat is available independent of Plus/Pro, trial, expiry and lapse');
  await plan(0, 'pro', 'lapsed');
  await user(0);
  const replay = await scalar('select public.send_chat_message($1,$2,$3)', [
    room,
    'paid-access-message',
    'Private paid chat',
  ]);
  assert.ok(replay.id);
  console.log('PASS A lapsed member keeps text chat while the room remains usable');
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
