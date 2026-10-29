import assert from 'node:assert/strict';
export async function runChatConcurrencyTests(db) {
  const uid = (i) => `ec280000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = 'ed280000-0000-4000-8000-000000000001';
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rpc = async (name, args = []) =>
    Object.values((await db.query(`select public.${name}`, args)).rows[0])[0];
  const reject = async (name, args, pattern) => {
    await db.exec('savepoint reject');
    await assert.rejects(() => rpc(name, args), pattern);
    await db.exec('rollback to savepoint reject');
  };
  const plan = async (i, tier, status = 'paid', expired = false) => {
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,now()+case when $4 then interval '-1 day' else interval '1 year' end) on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,period_end=excluded.period_end",
      [uid(i), tier, status, expired],
    );
  };
  const service = async () => {
    await admin();
    await db.exec(
      'set role service_role;select set_config(\'request.jwt.claims\',\'{"role":"service_role"}\',false)',
    );
  };
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 0; i < 21; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `concurrent${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,$3,'1995-01-01','male',175,'UTC')",
        [uid(i), `concurrent_${i}`, `Concurrent ${i}`],
      );
    }
    for (const i of [0, 1, 7, 8]) await plan(i, 'pro');
    await plan(2, 'plus');
    await plan(3, 'plus', 'trial');
    await plan(5, 'pro', 'paid', true);
    await plan(6, 'pro', 'grace');
    await user(0);
    const room = await rpc('create_room_v3($1,$2)', [rid, 'Chat concurrency']);
    for (let i = 1; i < 20; i++) {
      await user(i);
      await rpc('join_by_code($1)', [room.code]);
    }
    await test('126 equal-timestamp messages paginate without gaps or duplicates; retry and unread cursors stay exact', async () => {
      for (const i of [0, 1, 2, 3, 6, 7, 8]) {
        await user(i);
        await rpc('accept_chat_terms()');
        for (let m = 0; m < 18; m++)
          await rpc('send_chat_message($1,$2,$3)', [
            rid,
            `chat-concurrent-${i}-${m}`,
            `Concurrent ${i} message ${m}`,
          ]);
      }
      await user(0);
      let before = null,
        ids = [];
      for (let page = 0; page < 6; page++) {
        const items = await rpc('get_chat_messages_v2($1,$2,$3,$4,$5,$6)', [
          rid,
          25,
          before?.created_at ?? null,
          null,
          before?.id ?? null,
          null,
        ]);
        if (!items.length) break;
        ids.push(...items.filter((m) => m.text?.startsWith('Concurrent ')).map((m) => m.id));
        before = items[0];
      }
      assert.equal(ids.length, 126);
      assert.equal(new Set(ids).size, 126);
      await admin();
      const all = (
        await db.query(
          "select id,created_at from public.chat_messages where room_id=$1 and text like 'Concurrent %' order by created_at,id",
          [rid],
        )
      ).rows;
      await user(0);
      let after = all[0],
        seen = [];
      for (let page = 0; page < 6; page++) {
        const items = await rpc('get_chat_messages_v2($1,$2,$3,$4,$5,$6)', [
          rid,
          25,
          null,
          after.created_at,
          null,
          after.id,
        ]);
        if (!items.length) break;
        seen.push(...items.map((m) => m.id));
        after = items.at(-1);
      }
      assert.deepEqual(
        seen,
        all.slice(1).map((m) => m.id),
      );
      const replay = await rpc('send_chat_message($1,$2,$3)', [
        rid,
        'chat-concurrent-0-0',
        'Concurrent 0 message 0',
      ]);
      assert(replay.id);
      const beforeUnread = await rpc('get_chat_unread_count($1)', [rid]);
      assert(beforeUnread >= 108);
      await rpc('mark_chat_read($1,$2)', [rid, all.at(-1).id]);
      assert.equal(await rpc('get_chat_unread_count($1)', [rid]), 0);
      await rpc('mark_chat_read($1,$2)', [rid, all[0].id]);
      assert.equal(await rpc('get_chat_unread_count($1)', [rid]), 0);
    });
    await test('Typing shows multiple paid members, excludes self/Free/expired, stops and expires safely', async () => {
      for (const i of [0, 1, 2, 3, 6]) {
        await user(i);
        await rpc('set_chat_typing($1,true)', [rid]);
      }
      await user(0);
      assert.equal((await rpc('get_chat_typing($1)', [rid])).length, 4);
      for (const i of [4, 5]) {
        await user(i);
        await reject('set_chat_typing($1,true)', [rid], /PLUS_REQUIRED/);
        await reject('get_chat_typing($1)', [rid], /PLUS_REQUIRED/);
      }
      await user(1);
      await rpc('set_chat_typing($1,false)', [rid]);
      await user(0);
      assert.equal((await rpc('get_chat_typing($1)', [rid])).length, 3);
      await admin();
      await db.exec("update public.chat_typing set expires_at=now()-interval '1 second'");
      await user(0);
      assert.deepEqual(await rpc('get_chat_typing($1)', [rid]), []);
      await reject(
        'set_chat_typing($1,true)',
        ['ed280000-0000-4000-8000-000000000099'],
        /NOT_ROOM_MEMBER/,
      );
    });
    await test('Media ownership, staging, Pro writes and permission-checked reads cannot be bypassed', async () => {
      const client = 'chat-concurrent-media',
        key = `rooms/${rid}/messages/${client}/0.jpg`;
      await service();
      const temp = await rpc('claim_chat_media_upload($1,$2,$3,$4,$5)', [
        rid,
        uid(0),
        key,
        'image/jpeg',
        4,
      ]);
      assert(temp.startsWith(`pending/${uid(0)}/`));
      await user(0);
      const sentMedia = await rpc('send_chat_message($1,$2,$3,$4)', [
        rid,
        client,
        'Image',
        JSON.stringify([{ storage_key: key, size: 4, mime_type: 'image/jpeg' }]),
      ]);
      await service();
      assert.equal(await rpc('can_read_chat_media($1,$2,$3)', [rid, key, uid(2)]), false);
      await admin();
      await db.query(
        "update public.chat_attachments set moderation_status='ok' where storage_key=$1",
        [key],
      );
      await service();
      for (const [i, allowed] of [
        [0, true],
        [2, true],
        [3, true],
        [4, false],
        [5, false],
        [20, false],
      ])
        assert.equal(await rpc('can_read_chat_media($1,$2,$3)', [rid, key, uid(i)]), allowed);
      await reject(
        'claim_chat_media_upload($1,$2,$3,$4,$5)',
        [rid, uid(1), key, 'image/jpeg', 4],
        /MEDIA_ALREADY_PUBLISHED/,
      );
      await user(2);
      await reject(
        'send_chat_message($1,$2,$3,$4)',
        [
          rid,
          'plus-media',
          'Photo',
          JSON.stringify([
            {
              storage_key: `rooms/${rid}/messages/plus-media/0.jpg`,
              size: 4,
              mime_type: 'image/jpeg',
            },
          ]),
        ],
        /PRO_REQUIRED/,
      );
      await reject('can_read_chat_media($1,$2,$3)', [rid, key, uid(0)], /permission denied/);
      await user(0);
      await rpc('delete_own_chat_message($1)', [sentMedia.id]);
      await service();
      assert.equal(await rpc('can_read_chat_media($1,$2,$3)', [rid, key, uid(0)]), false);
    });
    await test('Reports reject outsiders and Free viewers and deduplicate moderation work', async () => {
      await user(2);
      const target = (await rpc('get_chat_messages_v2($1)', [rid])).find(
        (m) => m.sender_id === uid(1),
      );
      assert(target);
      const one = await rpc('report_chat_message($1,$2,$3)', [target.id, 'spam', 'Repeated audit']);
      assert.equal(
        await rpc('report_chat_message($1,$2,$3)', [target.id, 'spam', 'Repeated audit']),
        one,
      );
      await user(20);
      await reject('report_chat_message($1,$2)', [target.id, 'spam'], /NOT_ROOM_MEMBER/);
      await user(4);
      await reject('report_chat_message($1,$2)', [target.id, 'spam'], /PLUS_REQUIRED/);
      await admin();
      assert.equal(
        (
          await db.query(
            'select id from public.moderation_queue where message_id=$1 and reporter_id=$2',
            [target.id, uid(2)],
          )
        ).rows.length,
        1,
      );
    });
    await test('Room-list counts bypass no health RLS; blocks remove chat and presence in both directions', async () => {
      await user(0);
      assert.equal((await rpc('get_my_rooms()'))[0].member_count, 20);
      await rpc('block_user($1)', [uid(1)]);
      await user(1);
      assert(!(await rpc('get_chat_messages_v2($1)', [rid])).some((m) => m.sender_id === uid(0)));
      assert.equal(
        (
          await db.query('select id from public.chat_messages where room_id=$1 and sender_id=$2', [
            rid,
            uid(0),
          ])
        ).rows.length,
        0,
      );
      await user(0);
      await rpc('set_chat_typing($1,true)', [rid]);
      await user(1);
      assert(!(await rpc('get_chat_typing($1)', [rid])).some((p) => p.user_id === uid(0)));
    });
    console.log(`Chat concurrency database tests: ${passed} passed, 0 failed`);
  } finally {
    await db.exec('rollback;reset role');
  }
}
