import assert from 'node:assert/strict';
export async function runFriendTests(db) {
  let passed = 0;
  const uid = (i) => `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const rid = (i) => `40000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const scalar = async (sql, args = []) =>
    Object.values((await db.query(sql, args)).rows[0] ?? { value: null })[0];
  const admin = () => db.exec(`reset role;select set_config('request.jwt.claims','',false);`);
  const user = async (i) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(i), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const fails = (sql, pattern, args = []) => assert.rejects(() => db.query(sql, args), pattern);
  const test = async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log(`PASS ${name}`);
    } catch (error) {
      throw new Error(name, { cause: error });
    }
  };
  const send = (sender, recipient, id) =>
    scalar('select public.send_friend_request($1,$2,$3)', [uid(sender), rid(id), uid(recipient)]);
  const respond = (actor, request, action) =>
    scalar('select public.respond_friend_request($1,$2,$3)', [uid(actor), rid(request), action]);
  const setProfile = (
    actor,
    mutation,
    bio,
    isPublic,
    editedAt = new Date().toISOString(),
    url = 'https://example.com/fitness',
  ) =>
    scalar('select public.set_social_profile($1,$2,$3,$4,$5,$6,$7,$8)', [
      uid(actor),
      rid(mutation),
      editedAt,
      bio,
      'Strength',
      '@ari_fit',
      url,
      isPublic,
    ]);
  const plan = async (i, tier, status = 'paid') => {
    await admin();
    await db.query(
      `insert into public.entitlements(user_id,tier,status,period_end) values($1,$2,$3,now()+interval '1 day') on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,period_end=excluded.period_end`,
      [uid(i), tier, status],
    );
  };
  await admin();
  for (let i = 1; i <= 18; i++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid(i),
      `social_${i}@example.com`,
    ]);
    await db.query(
      `insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm) values($1,$2,$3,'1995-01-01','male',175)`,
      [uid(i), `social_${i}`, `Social ${i}`],
    );
  }
  await test('Social and friend tables require RPCs and reject anonymous reads', async () => {
    await user(1);
    assert.equal(await scalar('select count(*)::int from public.social_profiles'), 0);
    assert.equal(await scalar('select count(*)::int from public.friend_request_sends'), 0);
    await fails(
      'insert into public.friend_request_sends(id,sender_id) values($1,$2)',
      /row-level security/,
      [rid(99), uid(1)],
    );
    await fails('select public.social_profile_json($1,$2)', /permission denied/, [uid(2), uid(2)]);
    await admin();
    await db.exec('set role anon');
    await fails("select public.search_social_profiles('social')", /permission denied/);
  });
  await test('Private social fields stay private and public profiles never contain health or contact secrets', async () => {
    await user(1);
    await setProfile(1, 1, 'Private bio', false);
    assert.equal(
      (await scalar('select public.get_social_profile($1)', [uid(1)])).bio,
      'Private bio',
    );
    await user(2);
    const profile = await scalar('select public.get_social_profile($1)', [uid(1)]);
    assert.equal(profile.bio, '');
    assert.equal(profile.website_url, '');
    assert.equal(profile.instagram_handle, '');
    for (const field of [
      'email',
      'date_of_birth',
      'sex',
      'height_cm',
      'place',
      'calories',
      'weight_kg',
    ])
      assert.equal(profile[field], undefined);
    await user(1);
    await setProfile(1, 2, 'Shared bio', true, new Date(Date.now() + 1000).toISOString());
    await user(2);
    assert.equal(
      (await scalar('select public.get_social_profile($1)', [uid(1)])).bio,
      'Shared bio',
    );
  });
  await test('Profile updates validate links, reject another actor and ignore stale offline writes', async () => {
    await user(1);
    await fails(
      'select public.set_social_profile($1,$2,now(),$3,$4,$5,$6,true)',
      /NOT_AUTHORIZED/,
      [uid(2), rid(3), 'Bio', '', '', 'https://example.com'],
    );
    await fails(
      'select public.set_social_profile($1,$2,now(),$3,$4,$5,$6,true)',
      /check constraint/,
      [uid(1), rid(4), 'Bio', '', '', 'javascript:alert(1)'],
    );
    await setProfile(1, 5, 'Stale bio', true, '2026-01-01T00:00:00Z');
    assert.equal(
      (await scalar('select public.get_social_profile($1)', [uid(1)])).bio,
      'Shared bio',
    );
    await fails(
      'insert into public.social_profiles(user_id,mutation_id,edited_at) values($1,$2,now())',
      /row-level security/,
      [uid(1), rid(6)],
    );
  });
  await test('Username search excludes hidden users, supports @ and treats underscore literally', async () => {
    await admin();
    await db.query('update public.profiles set discoverable=false where id=$1', [uid(18)]);
    await db.query("update public.profiles set username='SoCiAl_17' where id=$1", [uid(17)]);
    await user(1);
    const matches = await scalar("select public.search_social_profiles('@SOCIAL_')");
    assert.equal(matches.length, 10);
    assert.ok(
      matches.every((p) => p.username.toLowerCase().startsWith('social_') && p.id !== uid(1)),
    );
    assert.equal(
      (await scalar("select public.search_social_profiles('@SOCIAL_17')"))[0].id,
      uid(17),
    );
    assert.deepEqual(await scalar("select public.search_social_profiles('social%')"), []);
    assert.deepEqual(await scalar("select public.search_social_profiles('social_18')"), []);
    await fails('select public.get_social_profile($1)', /PROFILE_UNAVAILABLE/, [uid(18)]);
  });
  await test('Free sends exactly three requests; duplicate retries and reciprocal requests do not spend extra quota', async () => {
    await user(1);
    for (const [target, id] of [
      [2, 10],
      [3, 11],
      [4, 12],
    ])
      await send(1, target, id);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, 0);
    await send(1, 2, 10);
    assert.equal((await send(1, 2, 13)).request_id, rid(10));
    assert.equal((await scalar('select public.get_friend_request_quota()')).sent, 3);
    await fails('select public.send_friend_request($1,$2,$3)', /FRIEND_WEEKLY_LIMIT/, [
      uid(1),
      rid(14),
      uid(5),
    ]);
    await user(3);
    assert.equal((await send(3, 1, 15)).request_id, rid(11));
    assert.equal((await scalar('select public.get_friend_request_quota()')).sent, 0);
  });
  await test('Only the recipient accepts, both see the friendship, and no room is created automatically', async () => {
    await user(1);
    await fails('select public.respond_friend_request($1,$2,$3)', /NOT_AUTHORIZED/, [
      uid(1),
      rid(10),
      'accept',
    ]);
    await user(7);
    await fails('select public.respond_friend_request($1,$2,$3)', /NOT_AUTHORIZED/, [
      uid(7),
      rid(10),
      'accept',
    ]);
    await admin();
    const roomCount = await scalar('select count(*)::int from public.rooms');
    await user(2);
    await respond(2, 10, 'accept');
    await respond(2, 10, 'accept');
    assert.equal((await scalar('select public.get_friend_inbox()')).friends[0].id, uid(1));
    await user(1);
    assert.equal((await scalar('select public.get_friend_inbox()')).friends[0].id, uid(2));
    await admin();
    assert.equal(await scalar('select count(*)::int from public.rooms'), roomCount);
  });
  await test('Declining, cancelling and removing never refund this week allowance', async () => {
    await user(3);
    await respond(3, 11, 'decline');
    await user(1);
    await respond(1, 12, 'cancel');
    await user(2);
    await respond(2, 10, 'remove');
    await respond(2, 10, 'remove');
    await user(1);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, 0);
    await fails('select public.send_friend_request($1,$2,$3)', /FRIEND_WEEKLY_LIMIT/, [
      uid(1),
      rid(16),
      uid(2),
    ]);
    const changed = await db.query(
      'delete from public.friend_requests where sender_id=$1 returning id',
      [uid(1)],
    );
    assert.equal(changed.rows.length, 0);
  });
  await test('Live Plus and Pro bypass weekly quota but lapsed plans do not', async () => {
    await plan(1, 'plus');
    await user(1);
    await send(1, 5, 17);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, null);
    await plan(6, 'pro');
    await user(6);
    for (const [target, id] of [
      [7, 20],
      [8, 21],
      [9, 22],
      [10, 23],
    ])
      await send(6, target, id);
    assert.equal((await scalar('select public.get_friend_request_quota()')).sent, 4);
    await plan(6, 'pro', 'lapsed');
    await admin();
    for (const [id, hours] of [
      [20, 4],
      [21, 3],
      [22, 2],
      [23, 1],
    ])
      await db.query(
        "update public.friend_request_sends set created_at=now()-($2::int * interval '1 hour') where id=$1",
        [rid(id), hours],
      );
    await user(6);
    const quota = await scalar('select public.get_friend_request_quota()');
    await admin();
    const resetsAt = await scalar(
      "select created_at+interval '7 days' from public.friend_request_sends where id=$1",
      [rid(21)],
    );
    assert.equal(Date.parse(quota.resets_at), new Date(resetsAt).getTime());
    await user(6);
    await fails('select public.send_friend_request($1,$2,$3)', /FRIEND_WEEKLY_LIMIT/, [
      uid(6),
      rid(24),
      uid(11),
    ]);
  });
  await test('Seven-day expiry refills free allowance; timezone edits do not', async () => {
    await admin();
    await db.query(
      "update public.friend_request_sends set created_at=now()-interval '7 days' where sender_id=$1",
      [uid(6)],
    );
    await user(6);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, 3);
    await send(6, 11, 25);
    await admin();
    await db.query("update public.profiles set timezone='Pacific/Kiritimati' where id=$1", [
      uid(6),
    ]);
    await user(6);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, 2);
  });
  await test('Account-bound reads and writes reject a token that changed to another user', async () => {
    await user(2);
    await fails('select public.send_friend_request($1,$2,$3)', /NOT_AUTHORIZED/, [
      uid(1),
      rid(30),
      uid(7),
    ]);
    await fails('select public.get_friend_inbox($1)', /NOT_AUTHORIZED/, [uid(1)]);
    await fails('select public.search_social_profiles($1,$2)', /NOT_AUTHORIZED/, [
      'social',
      uid(1),
    ]);
    await fails('select public.get_social_profile($1,$2)', /NOT_AUTHORIZED/, [uid(7), uid(1)]);
  });
  await test('Blocking hides both directions and cancels the connection without refunding quota', async () => {
    await user(1);
    await scalar('select public.block_social_profile($1,$2)', [uid(1), uid(5)]);
    await fails('select public.get_social_profile($1)', /PROFILE_UNAVAILABLE/, [uid(5)]);
    await user(5);
    await fails('select public.get_social_profile($1)', /PROFILE_UNAVAILABLE/, [uid(1)]);
    await user(1);
    await scalar('select public.unblock_user($1)', [uid(5)]);
    assert.equal(
      (await scalar('select public.get_friend_inbox()')).outgoing.some((p) => p.id === uid(5)),
      false,
    );
  });
  await test('Reports are idempotent and belong to the reporting actor', async () => {
    await user(2);
    const args = [uid(2), rid(40), uid(7), 'Spam', 'Profile details'];
    await scalar('select public.report_social_profile($1,$2,$3,$4,$5)', args);
    await scalar('select public.report_social_profile($1,$2,$3,$4,$5)', args);
    await user(3);
    await fails('select public.report_social_profile($1,$2,$3,$4,$5)', /NOT_AUTHORIZED/, [
      uid(3),
      rid(40),
      uid(7),
      'Spam',
      '',
    ]);
    await admin();
    assert.equal(
      await scalar('select count(*)::int from public.reports where id=$1', [rid(40)]),
      1,
    );
  });
  await test('Deleting a recipient account does not refund the sender weekly quota', async () => {
    await user(12);
    await send(12, 13, 50);
    await send(12, 14, 51);
    await send(12, 15, 52);
    await admin();
    await db.query('delete from auth.users where id=$1', [uid(13)]);
    assert.equal(
      await scalar('select count(*)::int from public.friend_requests where id=$1', [rid(50)]),
      0,
    );
    await user(12);
    assert.equal((await scalar('select public.get_friend_request_quota()')).remaining, 0);
    await fails('select public.send_friend_request($1,$2,$3)', /FRIEND_WEEKLY_LIMIT/, [
      uid(12),
      rid(53),
      uid(16),
    ]);
  });
  console.log(`Friends database tests: ${passed} passed, 0 failed`);
}
