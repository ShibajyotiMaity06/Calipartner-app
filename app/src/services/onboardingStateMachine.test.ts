import { describe, expect, it } from 'vitest';
import { OnboardingStateMachine, ONBOARDING_STEPS_ORDER } from './onboardingStateMachine';

const adult = {
  nickname: 'Ari',
  sex: 'male' as const,
  dateOfBirth: '2001-01-01',
  heightCm: 175,
  weightKg: 70,
  gymDays: 5,
};

describe('Onboarding redesign state machine', () => {
  it('follows the approved journey after signup and profile setup', () => {
    const machine = new OnboardingStateMachine(adult);
    const visited = [machine.getState().currentStep];
    while (machine.next()) visited.push(machine.getState().currentStep);
    expect(visited).toEqual(ONBOARDING_STEPS_ORDER);
    expect(visited).toEqual([
      'goal',
      'motivation',
      'activity_level',
      'body_stats',
      'rate_selection',
      'daily_goals',
      'premium',
      'paywall',
      'completed',
    ]);
  });

  it('blocks missing body details, minors, invalid training days, and stale calculations', () => {
    const machine = new OnboardingStateMachine({ ...adult, heightCm: 0 });
    machine.goToStep('body_stats');
    expect(machine.next()).toBe(false);
    machine.setBodyStats({ heightCm: 175, dateOfBirth: '2020-01-01' });
    expect(machine.next()).toBe(false);
    machine.setBodyStats({ dateOfBirth: adult.dateOfBirth });
    machine.setGymDays(8);
    expect(machine.getState().calculatedTargets).toBeNull();
    expect(machine.next()).toBe(false);
    machine.setGymDays(3);
    expect(machine.next()).toBe(true);
    machine.setBodyStats({ weightKg: NaN });
    expect(machine.getState().calculatedTargets).toBeNull();
    expect(() => machine.buildGoalProfile('user-a')).toThrow();
  });

  it('prevents both navigation and persistence of unsafe custom plans', () => {
    const machine = new OnboardingStateMachine(adult);
    machine.goToStep('rate_selection');
    machine.setWeeklyRate(1);
    expect(machine.next()).toBe(false);
    expect(() => machine.buildGoalProfile('user-a')).toThrow('safety');
    machine.useRecommendedRate();
    expect(machine.next()).toBe(true);
    machine.setDailyAdjustment(2000);
    expect(() => machine.buildGoalProfile('user-a')).toThrow('safety');
  });

  it('keeps a single UUID across save retries and draft recovery', () => {
    const machine = new OnboardingStateMachine(adult);
    const first = machine.buildGoalProfile('user-a');
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(machine.buildGoalProfile('user-a').id).toBe(first.id);
    const restored = new OnboardingStateMachine(machine.getState());
    expect(restored.buildGoalProfile('user-a').id).toBe(first.id);
    expect(first.gym_days).toBe(5);
    expect(first.input_height_cm).toBe(175);
  });

  it('supports a safe custom daily surplus and recomputes after edits', () => {
    const machine = new OnboardingStateMachine(adult).setGoal('bulk').setDailyAdjustment(300);
    const first = machine.buildGoalProfile('user-a');
    expect(first.weekly_rate_kg).toBeCloseTo(300 / 1100);
    machine.setBodyStats({ weightKg: 72 });
    expect(machine.buildGoalProfile('user-a').daily_calorie_target).not.toBe(
      first.daily_calorie_target,
    );
    machine.setGymDays(0);
    expect(machine.getState().calculatedTargets?.activityMultiplier).toBe(1.35);
    machine.setGoal('maintain');
    expect(machine.buildGoalProfile('user-a').weekly_rate_kg).toBe(0);
  });

  it('rejects goal weights in the wrong direction and permits missing optional goals', () => {
    const machine = new OnboardingStateMachine(adult).setGoal('bulk');
    machine.setTargetWeightAndDate(65, null);
    expect(machine.validateStep('rate_selection').isValid).toBe(false);
    machine.setTargetWeightAndDate(null, null);
    expect(machine.validateStep('rate_selection').isValid).toBe(true);
  });

  it('can dismiss either premium step and go back to edit inputs', () => {
    for (const step of ['premium', 'paywall'] as const) {
      const machine = new OnboardingStateMachine(adult);
      machine.goToStep(step);
      expect(machine.goToStep('completed')).toBe(true);
      expect(machine.goToStep('body_stats')).toBe(true);
      machine.setBodyStats({ weightKg: 72 });
      expect(machine.getState().weightKg).toBe(72);
    }
  });
});

describe('daily water and step goals', () => {
  it('validates whole-number goals and rejects empty or non-finite values', () => {
    const machine = new OnboardingStateMachine();
    machine.setStepAndWaterGoals(8500, 2200);
    expect(machine.validateStep('daily_goals').isValid).toBe(true);
    expect(machine.getState().stepGoal).toBe(8500);
    expect(machine.getState().waterMlGoal).toBe(2200);
    for (const value of [0, -1, NaN, Infinity, 2.5, 100001]) {
      machine.setStepAndWaterGoals(value, 2200);
      expect(machine.validateStep('daily_goals').isValid).toBe(false);
    }
    machine.setStepAndWaterGoals(8500, 20001);
    expect(machine.validateStep('daily_goals').isValid).toBe(false);
  });
});
