import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function runWeeklyPlanTests(db) {
  const uid = (i) => `fc040000-0000-4000-8000-${String(i).padStart(12, '0')}`;
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
  const rejects = async (sql, args, pattern) => {
    await db.exec('savepoint invalid');
    await assert.rejects(() => db.query(sql, args), pattern);
    await db.exec('rollback to savepoint invalid');
  };
  const preferences = {
    workout_days: [0],
    location: 'home',
    equipment: ['bodyweight'],
    experience: 'beginner',
    session_minutes: 30,
    limitations: '',
    country: 'India',
    cuisine: 'Indian',
    diet: 'mixed',
    allergies: [],
    exclusions: [],
    meals_per_day: 3,
    cooking_minutes: 30,
    budget: 'economical',
  };
  const content = {
    days: Array.from({ length: 7 }, (_, day) => ({
      day,
      workout: {
        title: day ? 'Private Tuesday workout' : 'Monday workout',
        minutes: day ? 0 : 30,
        exercises: day
          ? []
          : [{ name: 'Squat', equipment: 'bodyweight', sets: 3, reps: 10, rest_seconds: 60 }],
      },
      meals: [
        {
          name: day ? 'Private other-day food' : 'Monday food',
          calories: 2100,
          protein: 120,
          carbs: 270,
          fat: 60,
          ingredients: ['rice'],
          portion: 'one portion',
          alternatives: [
            {
              name: 'Private meal alternative',
              ingredients: ['private ingredient'],
              portion: 'one measured portion',
              calories: 2100,
              protein: 120,
              carbs: 270,
              fat: 60,
            },
          ],
        },
      ],
    })),
    workout_tips: ['Private workout tip'],
    diet_tips: ['Private diet tip'],
  };
  await admin();
  await db.exec('begin');
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        uid(i),
        `weekly${i}@example.com`,
      ]);
      await db.query(
        "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone) values($1,$2,'Weekly plan','1995-01-01','male',175,'America/New_York')",
        [uid(i), `weekly_${i}`],
      );
    }
    await user(1);
    await rpc('accept_ai_processing_consent($1)', ['1.1-weekly-plan']);
    await rejects('select * from public.personal_weekly_plans', [], /permission denied/);
    await rejects(
      'select public.reserve_weekly_plan($1,$2,$3)',
      [uid(1), uid(10), preferences],
      /permission denied/,
    );
    await admin();
    await db.exec('set role service_role');
    const reservation = await rpc('reserve_weekly_plan($1,$2,$3)', [uid(1), uid(10), preferences]);
    await rejects(
      'select public.reserve_weekly_plan($1,$2,$3)',
      [uid(1), uid(10), preferences],
      /PLAN_BUSY/,
    );
    await rejects(
      'select public.reserve_weekly_plan($1,$2,$3)',
      [uid(2), uid(11), preferences],
      /CONSENT_REQUIRED/,
    );
    await rpc('finish_weekly_plan($1,$2,$3,$4)', [uid(1), uid(10), reservation.lease, content]);
    assert.equal(
      (await rpc('reserve_weekly_plan($1,$2,$3)', [uid(1), uid(10), preferences])).cached,
      true,
    );
    await user(1);
    let plan = await rpc('get_personal_weekly_plan()');
    assert.equal(plan.days.length, 1);
    assert.equal(plan.days[0].day, 0);
    assert.deepEqual(plan.workout_tips, []);
    assert.ok(!JSON.stringify(plan).includes('Private'));
    await rejects(
      'select public.edit_weekly_routine($1,$2,$3,$4,$5)',
      [uid(20), uid(10), 1, 0, []],
      /PURCHASED_PLUS_REQUIRED/,
    );
    await admin();
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','trial',now()+interval '7 days')",
      [uid(1)],
    );
    await user(1);
    assert.equal((await rpc('get_personal_weekly_plan()')).days.length, 1);
    await admin();
    await db.query("update public.entitlements set status='paid' where user_id=$1", [uid(1)]);
    await user(1);
    plan = await rpc('get_personal_weekly_plan()');
    assert.equal(plan.days.length, 7);
    assert.equal(plan.diet_tips[0], 'Private diet tip');
    const exercises = [
      { name: 'Split squat', equipment: 'bodyweight', sets: 2, reps: 8, rest_seconds: 60 },
    ];
    const args = [uid(20), uid(10), 1, 0, exercises];
    const edited = await rpc('edit_weekly_routine($1,$2,$3,$4,$5)', args);
    assert.equal(edited.revision, 2);
    assert.equal(edited.days[0].workout.exercises[0].name, 'Split squat');
    assert.equal((await rpc('edit_weekly_routine($1,$2,$3,$4,$5)', args)).revision, 2);
    await rejects(
      'select public.edit_weekly_routine($1,$2,$3,$4,$5)',
      [uid(20), uid(10), 1, 0, []],
      /IDEMPOTENCY_CONFLICT/,
    );
    await rejects(
      'select public.edit_weekly_routine($1,$2,$3,$4,$5)',
      [uid(21), uid(10), 2, 0, [{ ...exercises[0], equipment: 'legpress' }]],
      /INVALID_PLAN/,
    );
    await user(2);
    assert.equal(await rpc('get_personal_weekly_plan()'), null);
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()-interval '1 second' where user_id=$1",
      [uid(1)],
    );
    await user(1);
    assert.equal((await rpc('get_personal_weekly_plan()')).days.length, 1);
    await admin();
    await db.query(
      "update public.entitlements set period_end=now()+interval '1 day',status='paid',tier='pro' where user_id=$1",
      [uid(1)],
    );
    await user(1);
    assert.equal((await rpc('get_personal_weekly_plan()')).days.length, 7);
    const room = await rpc('create_room_v3($1,$2)', [uid(50), 'Plan copy squad']);
    await user(2);
    await rpc('join_by_code($1)', [room.code]);
    const foods = JSON.parse(await readFile('app/assets/bundled_foods.json', 'utf8'));
    const chicken = foods.find(
      (food) => food.name === 'Chicken breast, roasted, skinless (grilled chicken breast)',
    );
    const egg = foods.find((food) => food.name === 'Chicken Eggs');
    const localDate = (
      await db.query("select (now() at time zone 'America/New_York')::date::text as day")
    ).rows[0].day;
    for (const [index, food] of [chicken, egg].entries()) {
      const entry = {
        id: uid(60 + index),
        user_id: uid(2),
        food_id: food.id,
        food_name: food.name,
        meal_section: 'lunch',
        quantity: 100,
        unit: 'g',
        calories: food.calories_per_100g,
        protein: food.protein_per_100g,
        carbs: food.carbs_per_100g,
        fat: food.fat_per_100g,
        local_date: localDate,
        source: 'search',
      };
      // Match the server date without assuming the execution host's time zone.
      const changes = [
        { id: entry.id, entity: 'food_entries', operation: 'upsert', payload: entry },
        {
          id: uid(70 + index),
          entity: 'user_food_stats',
          operation: 'upsert',
          payload: {
            user_id: uid(2),
            food_id: food.id,
            use_count: 1,
            last_quantity: 100,
            last_unit: 'g',
            last_meal_section: 'lunch',
            last_used_at: new Date().toISOString(),
          },
        },
      ];
      await rpc('save_tracking_changes($1)', [changes]);
      await rpc('save_tracking_changes($1)', [changes]);
    }
    await user(1);
    const today = await rpc('get_squad_today($1)', [uid(50)]),
      peer = today.members.find((m) => m.user_id === uid(2));
    assert.equal(peer.calories, 293);
    assert.equal(peer.protein, 44.32);
    const copyArgs = [uid(80), uid(50), uid(2), uid(60), 'dinner'];
    const copy = await rpc('copy_squad_food($1,$2,$3,$4,$5)', copyArgs);
    assert.equal(copy.calories, 165);
    assert.equal(copy.user_id, uid(1));
    assert.equal((await rpc('copy_squad_food($1,$2,$3,$4,$5)', copyArgs)).id, copy.id);
    await rejects(
      'select public.copy_squad_food($1,$2,$3,$4,$5)',
      [uid(81), uid(50), uid(1), uid(80), 'dinner'],
      /OWN_FOOD/,
    );
    await user(3);
    await rejects(
      'select public.copy_squad_food($1,$2,$3,$4,$5)',
      [uid(82), uid(50), uid(2), uid(60), 'dinner'],
      /NOT_ROOM_MEMBER/,
    );
    await admin();
    await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
      uid(2),
      uid(1),
    ]);
    await user(1);
    await rejects(
      'select public.copy_squad_food($1,$2,$3,$4,$5)',
      [uid(83), uid(50), uid(2), uid(60), 'dinner'],
      /USER_BLOCKED/,
    );
    await rejects('select public.recover_food_energy($1,$2)', [uid(110), 165], /permission denied/);
    await admin();
    await db.query(
      "insert into public.foods(id,source,name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g) values($1,'usda','Legacy USDA chicken',0,31,0,3.6)",
      [uid(110)],
    );
    await db.query(
      "insert into public.food_entries(id,user_id,food_id,food_name,meal_section,quantity,unit,calories,protein,carbs,fat,local_date,source) values($1,$2,$3,'Legacy USDA chicken','lunch',50,'g',0,15.5,0,1.8,current_date,'search')",
      [uid(111), uid(2), uid(110)],
    );
    await db.exec('set role service_role');
    await rpc('recover_food_energy($1,$2)', [uid(110), 165]);
    await admin();
    assert.equal(
      Number(
        (await db.query('select calories from public.food_entries where id=$1', [uid(111)])).rows[0]
          .calories,
      ),
      82.5,
    );
    await admin();
    await db.exec('set role anon');
    await rejects('select public.get_personal_weekly_plan()', [], /permission denied/);
    console.log(
      'Weekly plans and food repairs: owner isolation, Monday-only Free/trial, paid Plus/Pro, expiry, hidden payloads, retry leases, routine edits, chicken/egg acknowledged saves, exact Squad calories and guarded food copies passed',
    );
  } finally {
    await admin();
    await db.exec('rollback');
  }
}
