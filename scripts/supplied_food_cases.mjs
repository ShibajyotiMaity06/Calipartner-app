import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function runSuppliedFoodTests(db) {
  const foods = JSON.parse(await readFile('app/assets/supplied_foods.json', 'utf8'));
  const ids = foods.map((food) => food.id);
  assert.equal(foods.length, 247);
  const query = () => db.query('select * from public.foods where id = any($1::uuid[])', [ids]);
  assert.equal((await query()).rows.length, 247);
  await db.exec(
    await readFile('supabase/migrations/20261103140000_supplied_individual_foods.sql', 'utf8'),
  );
  const rows = (await query()).rows;
  assert.equal(rows.length, 247);
  for (const food of foods) {
    const row = rows.find((item) => item.id === food.id);
    assert.equal(row.name, food.name);
    assert.equal(row.owner_id, null);
    assert.deepEqual(row.serving_units, food.serving_units);
    assert.deepEqual(row.nutrition_details, food.nutrition_details);
    assert.equal(Number(row.calories_per_100g), food.calories_per_100g);
    assert.equal(Number(row.protein_per_100g), food.protein_per_100g);
  }
  await db.exec('begin');
  try {
    await db.exec(
      `set local role authenticated; select set_config('request.jwt.claims','{"sub":"fc039999-0000-4000-8000-000000000001","role":"authenticated"}',true)`,
    );
    assert.equal((await query()).rows.length, 247);
    const result = await db.query(
      "update public.foods set name = 'tampered' where id = $1 returning id",
      [ids[0]],
    );
    assert.equal(result.rows.length, 0);
  } finally {
    await db.exec('rollback; reset role');
  }
  console.log(
    'Supplied food database tests: 247 records preserved, idempotent migration, readable catalog and protected writes passed',
  );
}
