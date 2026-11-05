import assert from 'node:assert/strict';
export async function runFoodLibraryTests(db) {
  await db.exec("reset role;select set_config('request.jwt.claims','',false);begin");
  const first = 'fa040000-0000-4000-8000-000000000001',
    second = 'fa040000-0000-4000-8000-000000000002';
  const actor = async (id, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, role }) : '',
    ]);
    await db.exec(`set role ${role}`);
  };
  const call = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.data;
  const denied = async (sql, args = []) => {
    await db.exec('savepoint denied');
    let failed = false;
    try {
      await db.query(sql, args);
    } catch {
      failed = true;
      await db.exec('rollback to denied');
    }
    await db.exec('release denied');
    assert(failed, 'Expected unauthorized access to fail');
  };
  try {
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      first,
      'foodlibrary1@example.invalid',
      second,
      'foodlibrary2@example.invalid',
    ]);
    const food = {
      id: 'food-fixture',
      name: 'Test lentils',
      owner_id: null,
      source: 'ifct',
      calories_per_100g: 250,
      protein_per_100g: 55,
      carbs_per_100g: 25,
      fat_per_100g: 2,
    };
    await actor(first);
    for (let i = 0; i < 2; i++)
      await call('select public.set_food_favorite($1,$2,true) as data', [
        'lentils',
        JSON.stringify(food),
      ]);
    assert.equal((await call('select public.get_food_library() as data')).foods.length, 1);
    const clearId = 'fa040000-0000-4000-8000-000000000090';
    const reset = await call('select public.clear_recent_foods($1) as data', [clearId]);
    assert.deepEqual(await call('select public.clear_recent_foods($1) as data', [clearId]), reset);
    assert.equal((await db.query('select * from public.food_recent_resets')).rows.length, 1);
    assert.equal(
      (await call('select public.get_food_library() as data')).recent_foods_cleared_at,
      reset.cleared_at,
    );
    assert.equal((await call('select public.get_food_library() as data')).foods.length, 1);
    await denied('select public.set_food_favorite($1,$2,true)', [
      'private',
      JSON.stringify({ ...food, owner_id: second }),
    ]);
    await call('select public.record_food_search($1) as data', ['  LENTILS  ']);
    await call('select public.record_food_search($1) as data', ['lentils']);
    assert.deepEqual((await call('select public.get_food_library() as data')).searches, [
      'lentils',
    ]);
    await actor(second);
    assert.deepEqual(await call('select public.get_food_library() as data'), {
      foods: [],
      searches: [],
      recent_foods_cleared_at: null,
    });
    assert.equal((await db.query('select * from public.food_favorites')).rows.length, 0);
    assert.equal((await db.query('select * from public.food_search_history')).rows.length, 0);
    assert.equal((await db.query('select * from public.food_recent_resets')).rows.length, 0);
    await denied('select public.clear_recent_foods($1)', [clearId]);
    await denied('insert into public.food_recent_resets(id,user_id) values($1,$2)', [
      clearId,
      first,
    ]);
    await denied('insert into public.food_favorites(user_id,food_key,food) values($1,$2,$3)', [
      first,
      'spoof',
      JSON.stringify(food),
    ]);
    await call('select public.record_food_search($1) as data', ['rice']);
    await actor(first);
    await call('select public.clear_food_search_history() as data');
    await call('select public.clear_food_search_history() as data');
    const cleared = await call('select public.get_food_library() as data');
    assert.equal(cleared.foods.length, 1);
    assert.deepEqual(cleared.searches, []);
    await call('select public.set_food_favorite($1,$2,false) as data', ['lentils', null]);
    await call('select public.set_food_favorite($1,$2,false) as data', ['lentils', null]);
    assert.equal((await call('select public.get_food_library() as data')).foods.length, 0);
    await actor(second);
    assert.deepEqual((await call('select public.get_food_library() as data')).searches, ['rice']);
    await actor(null, 'anon');
    await denied('select public.get_food_library()');
    await denied('select public.clear_recent_foods($1)', [clearId]);
    console.log(
      'Food library SQL/RLS tests: private favourites/searches, ownership, canonical retry keys, acknowledged removal and isolated history clearing passed',
    );
  } finally {
    await db.exec('reset role;rollback');
  }
}
