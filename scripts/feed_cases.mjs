import assert from 'node:assert/strict';

export async function runFeedTests(db) {
  const userId = (i) => 'eabf0000-0000-4000-8000-' + String(i).padStart(12, '0');
  const id = (i) => 'eacf0000-0000-4000-8000-' + String(i).padStart(12, '0');
  const [alice, bob, charlie, outsider] = [1, 2, 3, 4].map(userId);
  const rpc = async (name, ...args) =>
    (
      await db.query(
        `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`,
        args,
      )
    ).rows[0].result;
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const login = async (id) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const service = async () => {
    await admin();
    await db.exec('set role service_role');
  };
  const denied = async (fn, reason = /permission denied/) => {
    await db.exec('savepoint feed_denied');
    await assert.rejects(fn, reason);
    await db.exec('rollback to savepoint feed_denied');
  };
  const reserve = (post, audience, compare = false) =>
    rpc('reserve_feed_post', post, 'A walk', 'Trail at dawn', 'image/jpeg', audience, compare);

  await admin();
  await db.exec('begin');
  try {
    for (const [index, actor] of [alice, bob, charlie, outsider].entries()) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        actor,
        `feed_${index}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone,discoverable) values($1,$2::text,$2::text,'1993-02-01','male',170,'Pacific/Kiritimati',true)",
        [actor, `feed_${index}`],
      );
    }
    await db.query(
      "insert into public.friend_requests(id,sender_id,recipient_id,status) values($1,$2,$3,'accepted')",
      [id(1), alice, bob],
    );
    await login(alice);
    const room = await rpc('create_room_v3', id(2), 'Feed squad');
    await login(charlie);
    await rpc('join_by_code', room.code);
    await login(alice);
    await rpc(
      'set_social_profile',
      alice,
      id(15),
      new Date().toISOString(),
      'Training for a walk',
      '',
      '',
      '',
      true,
    );
    await denied(() => reserve(id(3), 'community'), /FEED_RULES_REQUIRED/);
    await rpc('accept_feed_rules');
    await rpc('accept_feed_rules');
    assert.equal(await reserve(id(3), 'community', true), id(3));
    assert.equal(await reserve(id(3), 'community', true), id(3));
    await denied(() => reserve(id(3), 'friends', true), /FEED_DRAFT_CHANGED/);
    await reserve(id(4), 'friends');
    await reserve(id(5), 'squads');
    assert.deepEqual(await rpc('list_feed_posts'), []);
    await denied(() => rpc('publish_feed_post', id(3), alice));
    await denied(() => rpc('feed_media_for_viewer', id(3), alice));
    await denied(() => rpc('feed_compare_inputs', id(3), alice));
    await denied(() => db.query('select * from public.feed_posts'));
    await denied(() => db.query('select * from public.feed_reports'));
    await service();
    for (const post of [id(3), id(4), id(5)])
      assert.equal(await rpc('publish_feed_post', post, alice), post);
    assert.equal(await rpc('publish_feed_post', id(3), alice), id(3));
    assert.equal(await rpc('feed_media_for_viewer', id(4), outsider), null);
    assert.equal(await rpc('feed_media_for_viewer', id(4), bob), 'feed/' + alice + '/' + id(4));
    assert.deepEqual(await rpc('feed_compare_inputs', id(3), bob), { status: 'locked' });
    console.log(
      'PASS Feed publishing requires adult access, consent and a service acknowledgement; drafts and storage paths stay private',
    );

    await login(outsider);
    assert.deepEqual(
      (await rpc('list_feed_posts')).map((p) => p.id),
      [id(3)],
    );
    assert.equal(await rpc('get_feed_post', id(4)), null);
    assert.equal(await rpc('get_feed_post', id(5)), null);
    assert.equal((await rpc('get_feed_profile', alice)).bio, 'Training for a walk');
    await login(charlie);
    assert.deepEqual(
      (await rpc('list_feed_posts')).map((p) => p.id),
      [id(5), id(3)],
    );
    await login(bob);
    const rows = await rpc('list_feed_posts');
    assert.deepEqual(
      rows.map((p) => p.id),
      [id(4), id(3)],
    );
    assert.deepEqual(
      (await rpc('list_feed_posts', rows[0].published_at, rows[0].id)).map((p) => p.id),
      [id(3)],
    );
    assert.equal(await rpc('get_feed_post', id(5)), null);
    assert.equal((await rpc('set_feed_like', id(4), true)).likes, 1);
    assert.equal((await rpc('set_feed_like', id(4), true)).likes, 1);
    assert.equal((await rpc('set_feed_like', id(4), false)).likes, 0);
    await rpc('accept_feed_rules');
    await denied(() => rpc('add_feed_comment', id(4), bob, id(6), 'Nice walk'));
    await service();
    assert.equal(await rpc('add_feed_comment', id(4), bob, id(6), 'Nice walk'), id(6));
    assert.equal(await rpc('add_feed_comment', id(4), bob, id(6), 'Nice walk'), id(6));
    await denied(
      () => rpc('add_feed_comment', id(4), outsider, id(8), 'Private comment'),
      /FEED_UNAVAILABLE/,
    );
    await login(alice);
    assert.equal((await rpc('list_feed_comments', id(4))).length, 1);
    assert.equal(await rpc('report_feed_content', id(9), id(4), id(6), 'spam'), true);
    assert.equal(await rpc('report_feed_content', id(10), id(4), id(6), 'spam'), true);
    assert.equal(await rpc('delete_feed_comment', id(6)), false);
    await login(bob);
    assert.equal(await rpc('delete_feed_comment', id(6)), true);
    assert.equal(await rpc('delete_feed_comment', id(6)), true);
    assert.deepEqual(await rpc('list_feed_comments', id(4)), []);
    console.log(
      'PASS Feed audiences, cursor paging, bio visibility, like and comment replay, ownership and reports',
    );

    await login(alice);
    const targets = await rpc('feed_share_targets', id(3));
    assert.deepEqual(
      targets.people.map((p) => p.id),
      [bob, charlie],
    );
    assert.deepEqual(
      targets.squads.map((r) => r.id),
      [room.room_id],
    );
    assert.equal(await rpc('share_feed_post', id(11), id(3), bob, false), 1);
    assert.equal(await rpc('share_feed_post', id(11), id(3), bob, false), 1);
    assert.equal(await rpc('share_feed_post', id(12), id(3), room.room_id, true), 1);
    assert.equal(await rpc('share_feed_post', id(16), id(3), charlie, false), 1);
    await denied(
      () => rpc('share_feed_post', id(13), id(4), room.room_id, true),
      /FEED_UNAVAILABLE/,
    );
    await denied(() => rpc('share_feed_post', id(13), id(5), outsider, false), /FEED_UNAVAILABLE/);
    await login(charlie);
    assert.deepEqual(
      (await rpc('list_feed_posts', null, null, null, true)).map((p) => p.id),
      [id(3)],
    );
    await login(bob);
    assert.deepEqual(
      (await rpc('list_feed_posts', null, null, null, true)).map((p) => p.id),
      [id(3)],
    );
    await login(outsider);
    assert.deepEqual(await rpc('list_feed_posts', null, null, null, true), []);
    console.log(
      'PASS Feed shares reach accepted friends and eligible squad members without granting new post access',
    );

    await admin();
    await db.query(
      "insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from) values($1,'maintain','moderate',70,0,2500,150,80,295,1700,2500,now()-interval '2 days')",
      [alice],
    );
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','paid',now()+interval '1 hour'),($2,'pro','paid',now()+interval '1 hour')",
      [bob, charlie],
    );
    await service();
    const comparison = await rpc('feed_compare_inputs', id(3), bob);
    assert.equal(comparison.status, 'ready');
    assert.equal(comparison.author.targets.calories, 2500);
    assert.equal(
      comparison.date,
      (await db.query("select (now() at time zone 'Pacific/Kiritimati')::date::text as day"))
        .rows[0].day,
    );
    assert.equal((await rpc('feed_compare_inputs', id(3), charlie)).status, 'ready');
    assert.deepEqual(await rpc('feed_compare_inputs', id(4), bob), { status: 'hidden' });
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()-interval '1 second' where user_id=$1",
      [bob],
    );
    await service();
    assert.deepEqual(await rpc('feed_compare_inputs', id(3), bob), { status: 'locked' });
    await login(alice);
    await rpc(
      'set_social_profile',
      alice,
      id(17),
      new Date(Date.now() + 1000).toISOString(),
      'Private bio',
      '',
      '',
      '',
      false,
    );
    await login(bob);
    assert.equal(await rpc('get_feed_post', id(3)), null);
    assert.equal((await rpc('get_feed_profile', alice)).bio, '');
    assert.deepEqual(await rpc('list_feed_posts', null, null, null, true), []);
    await login(alice);
    await rpc('block_social_profile', alice, bob);
    await login(bob);
    assert.equal(await rpc('get_feed_post', id(4)), null);
    assert.equal(await rpc('get_feed_profile', alice), null);
    await service();
    assert.equal(await rpc('feed_media_for_viewer', id(4), bob), null);
    assert.equal(await rpc('delete_feed_post', id(5), bob), null);
    assert.match(await rpc('delete_feed_post', id(5), alice), /feed\//);
    assert.equal(await rpc('feed_media_for_viewer', id(5), charlie), null);
    await admin();
    await db.exec('set role anon');
    await denied(() => rpc('list_feed_posts'));
    console.log(
      'PASS Feed compare honors live Plus and Pro entitlement and opt-in; blocks, deletion and privacy changes revoke access',
    );
    console.log('Feed SQL/RLS tests: 4 groups passed, 0 failed');
  } finally {
    await db.exec('rollback');
    await admin();
  }
}
