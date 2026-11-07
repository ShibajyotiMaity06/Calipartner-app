import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function runPersonalisedDayTests(db) {
  const uid = (n) => `fa070000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.exec('begin');
  const admin = () => db.exec("reset role;select set_config('request.jwt.claims','',false)");
  const user = async (n) => {
    await admin();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid(n), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
  };
  const rejected = async (sql, args, pattern) => {
    await db.exec('savepoint denied');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to savepoint denied');
  };
  try {
    for (const n of [1, 2]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(n),
        `personalday${n}@example.invalid`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm) values($1,$2,'Preview','1995-01-01','male',175)",
        [uid(n), `personalday${n}`],
      );
    }
    await user(1);
    const enabled = {
      calories: true,
      protein: false,
      carbs: true,
      fat: false,
      steps: true,
      water: true,
    };
    const save = () =>
      db.query(
        'insert into public.tracking_preferences(user_id,request_id,enabled) values($1,$2,$3) on conflict(user_id) do update set request_id=excluded.request_id,enabled=excluded.enabled',
        [uid(1), uid(3), enabled],
      );
    await save();
    await save();
    assert.equal((await db.query('select * from public.tracking_preferences')).rows.length, 1);
    await user(2);
    assert.equal((await db.query('select * from public.tracking_preferences')).rows.length, 0);
    assert.equal(
      (
        await db.query(
          'update public.tracking_preferences set enabled=$1 where user_id=$2 returning user_id',
          [enabled, uid(1)],
        )
      ).rows.length,
      0,
    );
    await rejected(
      'insert into public.tracking_preferences(user_id,request_id,enabled) values($1,$2,$3)',
      [uid(1), uid(4), enabled],
      /row-level security/,
    );
    await user(1);
    await rejected(
      'update public.tracking_preferences set enabled=$1 where user_id=$2',
      [{ ...enabled, water: 1 }, uid(1)],
      /check constraint/,
    );
    await db.query(
      "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros,recompute_reason) values($1,$2,'cut','moderate',80,0.42,2040,150,225,60,1700,2500,3,175,true,'initial_onboarding')",
      [uid(10), uid(1)],
    );
    await rejected(
      "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros,recompute_reason) values($1,$2,'cut','moderate',80,0.38,2080,160,225,60,1700,2500,3,175,true,'initial_onboarding')",
      [uid(11), uid(1)],
      /PLUS_REQUIRED/,
    );
    await admin();
    const content = {
      days: [{ day: 0, workout: { title: 'One day', minutes: 30, exercises: [] }, meals: [] }],
      workout_tips: [],
      diet_tips: [],
    };
    await db.query(
      'insert into public.personal_weekly_plans(user_id,id,preferences,content) values($1,$2,$3,$4)',
      [uid(1), uid(20), { plan_scope: 'day' }, content],
    );
    await user(1);
    const plan = (await db.query('select public.get_personal_weekly_plan() as plan')).rows[0].plan;
    assert.equal(plan.scope, 'day');
    assert.equal(plan.days.length, 1);
    assert.equal(plan.full_access, false);
    await user(2);
    assert.equal(
      (await db.query('select public.get_personal_weekly_plan() as plan')).rows[0].plan,
      null,
    );
    await admin();
    const foods = JSON.parse(await readFile('app/assets/supplied_regional_foods.json', 'utf8'));
    const query = () =>
      db.query('select * from public.foods where id=any($1::uuid[])', [
        foods.map((food) => food.id),
      ]);
    assert.equal((await query()).rows.length, 650);
    await db.exec(
      await readFile('supabase/migrations/20261107000200_supplied_regional_foods.sql', 'utf8'),
    );
    assert.equal((await query()).rows.length, 650);
    for (const row of (await query()).rows) {
      const food = foods.find((food) => food.id === row.id);
      assert.deepEqual(row.serving_units, food.serving_units);
      assert.deepEqual(row.nutrition_details, food.nutrition_details);
      assert.equal(Number(row.calories_per_100g), food.calories_per_100g);
    }
    console.log(
      'Personalised day SQL/RLS: private preferences, idempotent saves, initial custom targets, later paid gates, single-day projections and 650 foods passed',
    );
  } finally {
    await db.exec('rollback;reset role');
  }
}
