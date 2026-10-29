import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runCommunityLimitTests(db) {
  await db.exec("reset role;select set_config('request.jwt.claims','',false);begin");
  try {
    await db.exec(`
      insert into auth.users(id,email)
      select ('ce280000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'limit'||i||'@example.com' from generate_series(1,1001) i;
      insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone)
      select ('ce280000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'limit_'||lpad(i::text,4,'0'),'Limit '||i,'1995-01-01','male',175,'UTC' from generate_series(1,1001) i;
      insert into public.goal_profiles(user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee)
      select ('ce280000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i%2=1 then 'maintain' else 'bulk' end,'moderate',70,0,2500,150,80,295,1700,2500 from generate_series(1,1001) i;
      select set_config('request.jwt.claims','{"sub":"ce280000-0000-4000-8000-000000000001","role":"authenticated"}',false);
      set role authenticated;
    `);
    const browse = async (goal = null, query = '', after = '') =>
      (
        await db.query('select public.browse_social_profiles($1,$2,$3) as data', [
          goal,
          query,
          after,
        ])
      ).rows[0].data;
    const people = await browse();
    assert.equal(people.length, 5);
    assert(people.every((p) => Number(p.username.slice(-4)) % 2 === 1));
    assert.deepEqual(
      await browse('bulk'),
      people,
      'A client cannot switch recommendations away from its own goal',
    );
    assert.equal((await browse(null, '', people.at(-1).username)).length, 0);
    assert.equal((await browse('maintain', '@LIMIT_1000'))[0].username, 'limit_1000');
    await db.exec('reset role');
    await db.query('delete from public.goal_profiles where user_id=$1', [
      'ce280000-0000-4000-8000-000000000001',
    ]);
    await db.exec('set role authenticated');
    assert.deepEqual(await browse(), [], 'No goal means no unrelated suggestions');
    assert.equal((await browse(null, 'limit_1000')).length, 1);
    console.log(
      'PASS 1,000 candidates return five own-goal suggestions; paging/filter bypass denied; universal username search and missing-goal behavior preserved',
    );
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      'ce280000-0000-4000-8000-000000001002',
      'shibajyoti.maity06+t4@gmail.com',
    ]);
    const migration = await readFile(
      'supabase/migrations/20261028000019_requested_t4_pro_year.sql',
      'utf8',
    );
    await db.exec(migration);
    const grant = (
      await db.query(
        "select tier,status,source,period_end>now()+interval '364 days' as year from public.entitlements where user_id=$1",
        ['ce280000-0000-4000-8000-000000001002'],
      )
    ).rows[0];
    assert.deepEqual(grant, { tier: 'pro', status: 'paid', source: 'none', year: true });
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.entitlements where tier='pro' and user_id::text like 'ce280000%' ",
        )
      ).rows[0].count,
      1,
    );
    console.log('PASS Requested Pro migration grants one year to the exact email only');
    console.log('Community limit database tests: 2 passed, 0 failed');
  } finally {
    await db.exec('rollback;reset role');
  }
}
