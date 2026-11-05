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
  await runAdditionalProductTests(db);
}

async function runAdditionalProductTests(db) {
  for (const invalid of [
    { bcaa_g: -1 },
    { bcaa_g: 'null' },
    { bcaa_g: 101 },
    { label_protein_per_100g: 101 },
    { not_provided: ['protein'] },
    { not_provided: null },
    { unknown: 1 },
    { locked: 'true' },
  ]) {
    assert.equal(
      (
        await db.query('select public.valid_nutrition_details($1) as valid', [
          JSON.stringify(invalid),
        ])
      ).rows[0].valid,
      false,
    );
  }
  assert.equal(
    (
      await db.query('select public.valid_nutrition_details($1,true) as valid', [
        JSON.stringify({ bcaa_g: 150, label_protein_per_100g: null }),
      ])
    ).rows[0].valid,
    true,
  );
  const products = JSON.parse(await readFile('app/assets/supplied_food_products.json', 'utf8'));
  const ids = products.map((food) => food.id);
  const recipeCount = (await db.query('select count(*) as count from public.recipes')).rows[0]
    .count;
  const query = () => db.query('select * from public.foods where id = any($1::uuid[])', [ids]);
  assert.equal(products.length, 156);
  assert.equal((await query()).rows.length, 156);
  await db.exec(
    await readFile('supabase/migrations/20261105000100_supplied_food_products.sql', 'utf8'),
  );
  const rows = (await query()).rows;
  assert.equal(rows.length, 156);
  assert.equal(
    (await db.query('select count(*) as count from public.recipes')).rows[0].count,
    recipeCount,
  );
  for (const product of products) {
    const row = rows.find((food) => food.id === product.id);
    assert.equal(row.source, 'supplied');
    assert.equal(row.name, product.name);
    assert.equal(row.brand, product.brand);
    assert.equal(row.owner_id, null);
    assert.deepEqual(row.serving_units, product.serving_units);
    assert.deepEqual(row.nutrition_details, product.nutrition_details);
    assert(Math.abs(Number(row.protein_per_100g) - product.protein_per_100g) <= 0.0051);
    assert(Math.abs(Number(row.calories_per_100g) - product.calories_per_100g) <= 0.0051);
  }
  await db.exec('begin');
  try {
    await db.exec(
      `set local role authenticated; select set_config('request.jwt.claims','{"sub":"fc039999-0000-4000-8000-000000000001","role":"authenticated"}',true)`,
    );
    assert.equal((await query()).rows.length, 156);
    const modified = await db.query(
      "update public.foods set name='tampered' where id=$1 returning id",
      [ids[0]],
    );
    assert.equal(modified.rows.length, 0);
  } finally {
    await db.exec('rollback;reset role');
  }
  console.log(
    'Additional supplied product SQL/RLS tests: 156 foods, retained source nulls/servings, idempotent import, no recipe creation and protected catalogue writes passed',
  );
}
