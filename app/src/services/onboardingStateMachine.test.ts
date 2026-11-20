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
  it('follows the 13 steps after authentication', () => {
    const machine = new OnboardingStateMachine(adult)
      .setCharacterGender('male', true)
      .setGoal('cut');
    const visited = [machine.getState().currentStep];
    while (machine.next()) visited.push(machine.getState().currentStep);
    expect(visited).toEqual([...ONBOARDING_STEPS_ORDER, 'reveal', 'paywall']);
    expect(visited).toEqual([
      'goal',
      'nickname',
      'age',
      'height',
      'weight',
      'activity_level',
      'gym_days',
      'target_weight',
      'rate_selection',
      'step_goal',
      'water_goal',
      'profile',
      'plan_summary',
      'reveal',
      'paywall',
    ]);
  });

  it('blocks missing body details, minors, invalid training days, and stale calculations', () => {
    const machine = new OnboardingStateMachine({ ...adult, heightCm: 0 });
    expect(machine.validateStep('height').isValid).toBe(false);
    machine.setBodyStats({ heightCm: 175, dateOfBirth: '2020-01-01' });
    expect(machine.validateStep('age').isValid).toBe(false);
    machine.setBodyStats({ dateOfBirth: adult.dateOfBirth });
    machine.setGymDays(8);
    expect(machine.getState().calculatedTargets).toBeNull();
    expect(machine.validateStep('gym_days').isValid).toBe(false);
    machine.setGymDays(3);
    expect(machine.validateStep('body_stats').isValid).toBe(true);
    machine.setBodyStats({ weightKg: NaN });
    expect(machine.getState().calculatedTargets).toBeNull();
    expect(() => machine.buildGoalProfile('user-a')).toThrow();
  });

  it('accepts a custom pace and surplus above recommendations while rejecting invalid totals', () => {
    const machine = new OnboardingStateMachine(adult).setGoal('bulk');
    machine.setWeeklyRate(1.5);
    expect(machine.validateStep('rate_selection').isValid).toBe(true);
    expect(machine.buildGoalProfile('user-a').weekly_rate_kg).toBe(1.5);
    machine.setDailyAdjustment(2000);
    expect(machine.buildGoalProfile('user-a').weekly_rate_kg).toBeCloseTo(2000 / 1100);
    machine.setGoal('cut').setDailyAdjustment(10000);
    expect(() => machine.buildGoalProfile('user-a')).toThrow('invalid');
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

  it('requires both choices and blocks a jump past an invalid earlier answer', () => {
    const machine = new OnboardingStateMachine({ ...adult, heightCm: 0 });
    expect(machine.next()).toBe(false);
    machine.setCharacterGender('male', true).setGoal('bulk');
    expect(machine.goToStep('paywall')).toBe(false);
    expect(machine.getState().currentStep).toBe('height');
    machine.setBodyStats({ heightCm: 175 });
    expect(machine.goToStep('paywall')).toBe(true);
    expect(machine.back()).toBe(true);
    expect(machine.getState().currentStep).toBe('reveal');
  });

  it('allows a 2 kg bulk and caps onboarding paces at 3 kg even above advisory guidance', () => {
    const machine = new OnboardingStateMachine(adult)
      .setCharacterGender('male', true)
      .setGoal('bulk');
    expect(machine.setWeeklyRate(2).validateStep('rate_selection').isValid).toBe(true);
    expect(machine.buildGoalProfile('user-a').weekly_rate_kg).toBe(2);
    expect(machine.setWeeklyRate(3).validateStep('rate_selection').isValid).toBe(true);
    expect(
      machine.setWeeklyRate(3.1).validateStep('rate_selection').errors.rateTooHigh,
    ).toBeDefined();
  });

  it('allows a cut past the advisory rate when calories fit and blocks an inadequate deficit', () => {
    const machine = new OnboardingStateMachine(adult)
      .setCharacterGender('male', true)
      .setGoal('cut')
      .setWeeklyRate(0.75);
    expect(machine.validateStep('rate_selection').isValid).toBe(true);
    machine.setWeeklyRate(2);
    expect(machine.validateStep('rate_selection').isValid).toBe(false);
    machine.useRecommendedRate();
    expect(machine.validateStep('rate_selection').isValid).toBe(true);
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
