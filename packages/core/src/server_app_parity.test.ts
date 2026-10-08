import { describe, expect, it } from 'vitest';
import { handleCalculateTargets } from '../../../supabase/functions/calculate-targets/index';
import { calculateTargets } from './targets';
import type { CalculateTargetsInput, CalculateTargetsResult } from './types';

describe('Server and App Calculation Parity', () => {
  const testCases: { name: string; input: CalculateTargetsInput }[] = [
    {
      name: 'PRD Worked Example (Male, 25y, 175cm, 70kg, Moderate, Cut 0.5)',
      input: {
        sex: 'male',
        age: 25,
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'moderate',
        goal: 'cut',
        weeklyRateKg: 0.5,
      },
    },
    {
      name: 'Female User (30y, 160cm, 55kg, Sedentary, Maintain)',
      input: {
        sex: 'female',
        age: 30,
        heightCm: 160,
        weightKg: 55,
        activityLevel: 'sedentary',
        goal: 'maintain',
        weeklyRateKg: 0,
      },
    },
    {
      name: 'Other Sex User (28y, 170cm, 65kg, Light, Bulk 0.25)',
      input: {
        sex: 'other',
        age: 28,
        heightCm: 170,
        weightKg: 65,
        activityLevel: 'light',
        goal: 'bulk',
        weeklyRateKg: 0.25,
      },
    },
    {
      name: 'Body Fat Percentage Input with Katch-McArdle',
      input: {
        sex: 'male',
        age: 22,
        heightCm: 180,
        weightKg: 80,
        bodyFatPercentage: 14.5,
        activityLevel: 'very_active',
        goal: 'cut',
        weeklyRateKg: 0.75,
      },
    },
    {
      name: 'Imperial Units Inputs (lb and ft/in)',
      input: {
        sex: 'female',
        age: 26,
        weightLb: 130,
        heightFt: 5,
        heightIn: 4,
        activityLevel: 'moderate',
        goal: 'cut',
        weeklyRateLb: 1.0,
      },
    },
    {
      name: 'Target Weight and Target Date Analysis',
      input: {
        sex: 'male',
        age: 35,
        heightCm: 178,
        weightKg: 85,
        activityLevel: 'moderate',
        goal: 'cut',
        weeklyRateKg: 0.5,
        targetWeightKg: 75,
        targetDate: '2026-06-30',
      },
    },
    {
      name: 'Low BMI Triggering BMI Guard (< 18.5)',
      input: {
        sex: 'female',
        age: 20,
        heightCm: 170,
        weightKg: 45,
        activityLevel: 'light',
        goal: 'cut',
        weeklyRateKg: 0.25,
      },
    },
  ];

  for (const tc of testCases) {
    it(`produces 100% identical targets for: ${tc.name}`, async () => {
      // 1. App / Client-side pure calculation
      const appResult = calculateTargets(tc.input);

      // 2. Server Edge Function handler invocation
      const req = new Request('http://localhost:54321/functions/v1/calculate-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc.input),
      });

      const res = await handleCalculateTargets(req);
      expect(res.status).toBe(200);

      const serverResult = (await res.json()) as CalculateTargetsResult;

      // 3. Compare all numerical and structured outputs
      expect(serverResult.bmr).toBe(appResult.bmr);
      expect(serverResult.rawBmr).toBe(appResult.rawBmr);
      expect(serverResult.tdee).toBe(appResult.tdee);
      expect(serverResult.bmi).toBe(appResult.bmi);
      expect(serverResult.targetKcal).toBe(appResult.targetKcal);
      expect(serverResult.dailyChangeKcal).toBe(appResult.dailyChangeKcal);
      expect(serverResult.macros).toEqual(appResult.macros);
      expect(serverResult.presetRates).toEqual(appResult.presetRates);
      expect(serverResult.safety).toEqual(appResult.safety);

      // Full deep equality
      expect(serverResult).toEqual(appResult);
    });
  }
});
