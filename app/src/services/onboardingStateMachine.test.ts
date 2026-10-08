import { describe, expect, it } from 'vitest';
import { OnboardingStateMachine } from './onboardingStateMachine';

describe('OnboardingStateMachine', () => {
  it('initializes with default state', () => {
    const machine = new OnboardingStateMachine();
    const state = machine.getState();

    expect(state.currentStep).toBe('goal');
    expect(state.goal).toBe('cut');
    expect(state.weeklyRateKg).toBe(0.5);
  });

  it('validates each step sequentially according to PRD 6.2 rules', () => {
    const machine = new OnboardingStateMachine();

    // 1. Goal step
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('body_stats');

    // 2. Body stats step - fails when DOB is missing
    expect(machine.next()).toBe(false);
    expect(machine.getState().errors.dateOfBirth).toBeDefined();

    // Blocked if under 18 (AUTH-3)
    machine.setBodyStats({ dateOfBirth: '2020-01-01' });
    expect(machine.next()).toBe(false);
    expect(machine.getState().errors.dateOfBirth).toContain('18 years old');

    // Valid adult DOB, height, weight (25 years old from 2026)
    machine.setBodyStats({
      dateOfBirth: '2001-01-01',
      heightCm: 175,
      weightKg: 70,
      sex: 'male',
    });
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('activity_level');

    // 3. Activity level step
    machine.setActivityLevel('moderate');
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('rate_selection');

    // 4. Rate selection step - live targets are already calculated
    const stateAtRate = machine.getState();
    expect(stateAtRate.calculatedTargets).not.toBeNull();
    expect(stateAtRate.calculatedTargets?.bmr).toBe(1674);
    expect(stateAtRate.calculatedTargets?.tdee).toBe(2594);
    expect(stateAtRate.calculatedTargets?.targetKcal).toBe(2044); // cut 0.5

    // Picking unavailable rate 1.0 (fails floor)
    machine.setWeeklyRate(1.0);
    expect(machine.next()).toBe(false);
    expect(machine.getState().errors.rate).toBeDefined();

    // Pick valid rate 0.5
    machine.setWeeklyRate(0.5);
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('target_weight_date');

    // 5. Target weight and date step (optional)
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('health_screening');

    // 6. Health screening step (optional private questions)
    machine.setHealthScreening({ pregnantOrBreastfeeding: false });
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('review_calculation');

    // 7. Review calculation step
    expect(machine.next()).toBe(true);
    expect(machine.getState().currentStep).toBe('completed');
  });

  it('builds final GoalProfile matching PRD worked example', () => {
    const machine = new OnboardingStateMachine();
    machine.setGoal('cut');
    machine.setBodyStats({
      sex: 'male',
      dateOfBirth: '2001-01-01', // 25y
      heightCm: 175,
      weightKg: 70,
    });
    machine.setActivityLevel('moderate');
    machine.setWeeklyRate(0.5);

    const goalProfile = machine.buildGoalProfile('test-user-123');
    expect(goalProfile.user_id).toBe('test-user-123');
    expect(goalProfile.daily_calorie_target).toBe(2044);
    expect(goalProfile.protein_grams).toBe(140);
    expect(goalProfile.fat_grams).toBe(57);
    expect(goalProfile.carb_grams).toBe(243);
    expect(goalProfile.bmr).toBe(1674);
    expect(goalProfile.tdee).toBe(2594);
  });

  it('allows going back to previous steps and changing inputs', () => {
    const machine = new OnboardingStateMachine();
    machine.next(); // to body_stats
    expect(machine.getState().currentStep).toBe('body_stats');
    machine.back();
    expect(machine.getState().currentStep).toBe('goal');
  });
});
