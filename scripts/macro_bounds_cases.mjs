import assert from 'node:assert/strict';

export async function runMacroBoundsTests(db) {
  const id = (n) => `fa080000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.exec('begin');
  try {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      id(1),
      'macrobounds@example.invalid',
    ]);
    await db.query(
      "insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm) values($1,'macrobounds','Macro','1995-01-01','male',175)",
      [id(1)],
    );
    await db.query(
      "insert into public.entitlements(user_id,tier,status,period_end) values($1,'plus','paid',now()+interval '1 day')",
      [id(1)],
    );
    const tdee = Number(
      (
        await db.query(
          "select round((10*80+6.25*175-5*extract(year from age(current_date,date '1995-01-01'))+5)*1.47) as value",
        )
      ).rows[0].value,
    );
    const calories = tdee - 550;
    const protein = 176,
      fat = 96;
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id(1), role: 'authenticated' }),
    ]);
    await db.exec('set role authenticated');
    const insert = (n, p, c, f, claimedTdee = tdee) => {
      const kcal = p * 4 + c * 4 + f * 9;
      const rate = Math.round((Math.abs(kcal - claimedTdee) / 1100) * 100) / 100;
      return db.query(
        "insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,carb_grams,fat_grams,bmr,tdee,gym_days,input_height_cm,custom_macros) values($1,$2,'cut','moderate',80,$3,$4,$5,$6,$7,1744,$8,3,175,true)",
        [id(n), id(1), rate, kcal, p, c, f, claimedTdee],
      );
    };
    const denied = async (run, code) => {
      await db.exec('savepoint invalid_macro');
      await assert.rejects(run, code);
      await db.exec('rollback to savepoint invalid_macro');
    };
    // Redistributing protein keeps energy unchanged at either inclusive boundary.
    await insert(10, protein + 50, carbs - 50, fat);
    await insert(11, protein - 50, carbs + 50, fat);
    await denied(() => insert(12, protein + 51, carbs - 51, fat), /MACRO_RANGE_PROTEIN/);
    await denied(() => insert(13, protein - 51, carbs + 51, fat), /MACRO_RANGE_PROTEIN/);
    // Derived totals remain plausible, but excess carbs/fat and fake TDEE cannot move the anchor.
    await denied(() => insert(14, protein, carbs + 126, fat - 30), /MACRO_RANGE_CARBS/);
    await denied(() => insert(15, protein - 26, carbs - 100, fat + 56), /MACRO_RANGE_FAT/);
    await denied(() => insert(16, protein, carbs + 126, fat, tdee + 200), /MACRO_RANGE_CALORIES/);
    // Repeated overrides cannot walk another 50 grams from the previous custom value.
    await denied(() => insert(17, protein + 100, carbs - 100, fat), /MACRO_RANGE_PROTEIN/);
    console.log(
      'Macro bounds SQL: inclusive protein limits, stable anchors, forged TDEE, carb/fat limits and repeated-edit bypasses passed',
    );
  } finally {
    await db.exec('rollback; reset role');
  }
}
