import { describe, expect, it } from 'vitest';
import {
  calculateBmi,
  calculateBmr,
  calculateDailyChangeKcal,
  calculateMacros,
  calculateRawBmr,
  calculateTargets,
  calculateTdee,
  checkTargetDate,
  getPresetRates,
  isBmiTooLowForCut,
  shouldRecomputeTargets,
} from './targets';

describe('Targets calculation engine', () => {
  describe('PRD 7.2 Golden Tests (Worked Example)', () => {
    // Subject: Male, 25 years, 175 cm, 70 kg, moderately active (1.55)
    const baseStats = {
      sex: 'male' as const,
      age: 25,
      heightCm: 175,
      weightKg: 70,
      activityLevel: 'moderate' as const,
    };

    it('matches exact BMR of 1674 kcal', () => {
      // BMR = 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75 -> 1674
      const raw = calculateRawBmr(baseStats);
      expect(raw).toBe(1673.75);
      const bmr = calculateBmr(baseStats);
      expect(bmr).toBe(1674);
    });

    it('matches exact TDEE of 2594 kcal', () => {
      // 1673.75 x 1.55 = 2594.3125 -> 2594
      const bmr = calculateBmr(baseStats);
      const tdee = calculateTdee(bmr, 'moderate');
      expect(tdee).toBe(2594);
    });

    it('matches exact daily change values for cut and bulk', () => {
      expect(calculateDailyChangeKcal(0.25)).toBe(275);
      expect(calculateDailyChangeKcal(0.5)).toBe(550);
      expect(calculateDailyChangeKcal(0.75)).toBe(825);
      expect(calculateDailyChangeKcal(1.0)).toBe(1100);
    });

    it('matches exact preset cut rates and availability (cut 0.25/0.5/0.75 -> 2319/2044/1769; cut 1.0 unavailable floor)', () => {
      const presets = getPresetRates({
        goal: 'cut',
        weightKg: 70,
        heightCm: 175,
        sex: 'male',
        tdee: 2594,
      });

      expect(presets).toHaveLength(4);

      // Cut 0.25
      const cut025 = presets.find((p) => p.rateKgPerWeek === 0.25)!;
      expect(cut025.targetKcal).toBe(2319);
      expect(cut025.available).toBe(true);

      // Cut 0.5
      const cut05 = presets.find((p) => p.rateKgPerWeek === 0.5)!;
      expect(cut05.targetKcal).toBe(2044);
      expect(cut05.available).toBe(true);

      // Cut 0.75
      const cut075 = presets.find((p) => p.rateKgPerWeek === 0.75)!;
      expect(cut075.targetKcal).toBe(1769);
      expect(cut075.available).toBe(true);
      expect(cut075.advisories).toContain('large_deficit_advisory');

      // Cut 1.0: Unavailable (below the 1500 floor: 2594 - 1100 = 1494)
      const cut10 = presets.find((p) => p.rateKgPerWeek === 1.0)!;
      expect(cut10.targetKcal).toBe(1494);
      expect(cut10.available).toBe(false);
      expect(cut10.reason).toBe('below_calorie_floor');
    });

    it('matches exact preset bulk rates and availability (bulk 0.25/0.5 -> 2869/3144; bulk 0.75 unavailable cap 0.70)', () => {
      const presets = getPresetRates({
        goal: 'bulk',
        weightKg: 70,
        heightCm: 175,
        sex: 'male',
        tdee: 2594,
      });

      expect(presets).toHaveLength(3);

      // Bulk 0.25
      const bulk025 = presets.find((p) => p.rateKgPerWeek === 0.25)!;
      expect(bulk025.targetKcal).toBe(2869);
      expect(bulk025.available).toBe(true);

      // Bulk 0.5: Available with advisory (above 0.5% bw/week: 0.5 > 0.35)
      const bulk05 = presets.find((p) => p.rateKgPerWeek === 0.5)!;
      expect(bulk05.targetKcal).toBe(3144);
      expect(bulk05.available).toBe(true);
      expect(bulk05.advisories).toContain('lean_gain_advisory');

      // Bulk 0.75: Unavailable (above 1% cap: 0.75 > 0.70)
      const bulk075 = presets.find((p) => p.rateKgPerWeek === 0.75)!;
      expect(bulk075.targetKcal).toBe(3419);
      expect(bulk075.available).toBe(false);
      expect(bulk075.reason).toBe('above_rate_cap');
    });

    it('matches exact macros for Cut 0.5 kg/week: 140g protein / 57g fat / 243g carbs', () => {
      // 2044 kcal, 70 kg
      const macros = calculateMacros(2044, 70, 'cut');
      expect(macros.proteinGrams).toBe(140); // 2.0 * 70 = 140g (560 kcal)
      expect(macros.proteinKcal).toBe(560);
      expect(macros.fatGrams).toBe(57); // 25% = 511 kcal -> 57g (511 kcal)
      expect(macros.fatKcal).toBe(511);
      expect(macros.carbGrams).toBe(243); // 2044 - 560 - 511 = 973 kcal -> 243g
      expect(macros.carbKcal).toBe(973);
    });

    it('full calculateTargets reproduces all golden numbers together', () => {
      const result = calculateTargets({
        ...baseStats,
        goal: 'cut',
        weeklyRateKg: 0.5,
      });

      expect(result.bmr).toBe(1674);
      expect(result.tdee).toBe(2594);
      expect(result.targetKcal).toBe(2044);
      expect(result.dailyChangeKcal).toBe(-550);
      expect(result.macros.proteinGrams).toBe(140);
      expect(result.macros.fatGrams).toBe(57);
      expect(result.macros.carbGrams).toBe(243);
      expect(result.safety.calorieFloor).toBe(1500);
      expect(result.safety.isFloorApplied).toBe(false);
      expect(result.safety.isCapApplied).toBe(false);
    });
  });

  describe('Edge cases and safety rules', () => {
    it('handles Imperial inputs (lb and ft/in)', () => {
      // 154.32 lb ≈ 70 kg, 5 ft 9 in = 175.26 cm
      const result = calculateTargets({
        sex: 'male',
        age: 25,
        weightLb: 154.32,
        heightFt: 5,
        heightIn: 9,
        activityLevel: 'moderate',
        goal: 'cut',
        weeklyRateLb: 1.1, // ~0.5 kg/week
      });

      expect(result.bmr).toBeCloseTo(1674, -1);
      expect(result.tdee).toBeCloseTo(2594, -1);
      expect(result.targetKcal).toBeCloseTo(2044, -1);
    });

    it('handles "other" sex with -78 offset and 1350 calorie floor', () => {
      const bmr = calculateBmr({
        sex: 'other',
        age: 25,
        heightCm: 175,
        weightKg: 70,
      });
      // 10*70 + 6.25*175 - 5*25 - 78 = 700 + 1093.75 - 125 - 78 = 1590.75 -> 1591
      expect(bmr).toBe(1591);

      const targets = calculateTargets({
        sex: 'other',
        age: 25,
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'sedentary', // 1590.75 * 1.2 = 1908.9 -> 1909
        goal: 'cut',
        weeklyRateKg: 0.75, // daily change 825 -> target 1909 - 825 = 1084 < 1350 floor
      });

      expect(targets.safety.calorieFloor).toBe(1350);
      expect(targets.safety.isFloorApplied).toBe(true);
    });

    it('handles "female" sex with -161 offset and 1200 calorie floor', () => {
      const bmr = calculateBmr({
        sex: 'female',
        age: 25,
        heightCm: 165,
        weightKg: 55,
      });
      // 10*55 + 6.25*165 - 5*25 - 161 = 550 + 1031.25 - 125 - 161 = 1295.25 -> 1295
      expect(bmr).toBe(1295);

      const targets = calculateTargets({
        sex: 'female',
        age: 25,
        heightCm: 165,
        weightKg: 55,
        activityLevel: 'light', // 1295.25 * 1.375 = 1780.97 -> 1781
        goal: 'cut',
        weeklyRateKg: 0.5, // 1781 - 550 = 1231 >= 1200 floor
      });

      expect(targets.targetKcal).toBe(1231);
      expect(targets.safety.calorieFloor).toBe(1200);
      expect(targets.safety.isFloorApplied).toBe(false);
    });

    it('computes Katch-McArdle BMR when body fat % is provided', () => {
      // 70 kg with 15% body fat: lean mass = 70 * 0.85 = 59.5 kg
      // BMR = 370 + 21.6 * 59.5 = 370 + 1285.2 = 1655.2 -> 1655
      const bmr = calculateBmr({
        sex: 'male',
        age: 25,
        heightCm: 175,
        weightKg: 70,
        bodyFatPercentage: 15,
      });
      expect(bmr).toBe(1655);
    });

    it('enforces BMI guard: no cut plans when BMI is below 18.5', () => {
      // 175 cm, 50 kg -> BMI = 50 / (1.75^2) = 16.33 < 18.5
      expect(calculateBmi(50, 175)).toBe(16.33);
      expect(isBmiTooLowForCut(50, 175)).toBe(true);

      const presets = getPresetRates({
        goal: 'cut',
        weightKg: 50,
        heightCm: 175,
        sex: 'male',
        tdee: 2000,
      });

      presets.forEach((preset) => {
        expect(preset.available).toBe(false);
        expect(preset.reason).toBe('bmi_too_low');
      });
    });

    it('handles very light users (e.g., 42 kg female) where calorie floor and rate cap trigger', () => {
      const presets = getPresetRates({
        goal: 'cut',
        weightKg: 42,
        heightCm: 150,
        sex: 'female',
        tdee: 1400,
      });

      // Calorie floor is 1200
      // 0.25 kg: change 275 -> 1125 < 1200 -> unavailable
      presets.forEach((p) => {
        expect(p.available).toBe(false);
        expect(p.reason).toBe('below_calorie_floor');
      });
    });

    it('handles heavy users (e.g. 130 kg male) with higher rate cap', () => {
      const targets = calculateTargets({
        sex: 'male',
        age: 35,
        heightCm: 188,
        weightKg: 130,
        activityLevel: 'moderate',
        goal: 'bulk',
        weeklyRateKg: 1.0,
      });

      // 1% of 130 kg is 1.3 kg/week. Rate 1.0 kg/week is within cap.
      expect(targets.safety.rateCapKgPerWeek).toBe(1.3);
      expect(targets.safety.isCapApplied).toBe(false);
    });

    it('evaluates aggressive target-date and computes earliest realistic date', () => {
      const refDate = new Date('2026-01-01T00:00:00Z');
      // Target: lose 10 kg in 4 weeks (requires 2.5 kg/week, but 70kg cap is 0.70 kg/week)
      const targetDate = '2026-01-29'; // 28 days = 4 weeks
      const analysis = checkTargetDate({
        currentWeightKg: 70,
        targetWeightKg: 60,
        targetDate,
        referenceDate: refDate,
      });

      expect(analysis.isRealistic).toBe(false);
      expect(analysis.requiredRateKgPerWeek).toBe(2.5);
      expect(analysis.capKgPerWeek).toBe(0.7);
      // Min weeks needed: 10 / 0.7 = 14.2857 weeks = 100 days
      expect(analysis.earliestRealisticDate).toBe('2026-04-11');
    });

    it('evaluates realistic target-date', () => {
      const refDate = new Date('2026-01-01T00:00:00Z');
      // Target: lose 5 kg in 20 weeks = 0.25 kg/week <= 0.70 cap
      const targetDate = '2026-05-21';
      const analysis = checkTargetDate({
        currentWeightKg: 70,
        targetWeightKg: 65,
        targetDate,
        referenceDate: refDate,
      });

      expect(analysis.isRealistic).toBe(true);
      expect(analysis.requiredRateKgPerWeek).toBeCloseTo(0.25, 1);
    });

    it('triggers recomputation rules on weight change >= 2 kg or manual edits', () => {
      const current = {
        current_weight_kg: 70,
        goal: 'cut' as const,
        weekly_rate_kg: 0.5,
        activity_level: 'moderate' as const,
      };

      // 1 kg change does not trigger
      expect(
        shouldRecomputeTargets(current, { current_weight_kg: 71 }),
      ).toEqual({
        shouldRecompute: false,
        reasons: [],
      });

      // 2 kg change triggers weight_change
      expect(
        shouldRecomputeTargets(current, { current_weight_kg: 72 }),
      ).toEqual({
        shouldRecompute: true,
        reasons: ['weight_change'],
      });

      // Goal change triggers manual_edit
      expect(
        shouldRecomputeTargets(current, { goal: 'bulk' }),
      ).toEqual({
        shouldRecompute: true,
        reasons: ['manual_edit'],
      });

      // Activity level change triggers manual_edit
      expect(
        shouldRecomputeTargets(current, { activity_level: 'light' }),
      ).toEqual({
        shouldRecompute: true,
        reasons: ['manual_edit'],
      });
    });
  });
});
