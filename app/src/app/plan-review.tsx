import React, { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Text, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { useSubscription } from '@/hooks/useSubscription';
import { OnboardingStateMachine, type OnboardingState } from '@/services/onboardingStateMachine';
import { TrainingStep } from '@/components/onboarding/TrainingStep';
import { GoalStep } from '@/components/onboarding/GoalStep';
import { ActivityStep } from '@/components/onboarding/ActivityStep';
import { PlanReviewStep } from '@/components/onboarding/PlanReviewStep';
import { GymCalculationStep } from '@/components/onboarding/GymCalculationStep';
import { NumberField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export default function MonthlyPlanReviewScreen() {
  const { user, profile } = useAuth();
  const { currentGoalProfile: goal, saveGoalProfile } = useTargets();
  const subscription = useSubscription();
  const { colors } = useTheme();
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const machine = useRef<OnboardingStateMachine | null>(null);
  const owner = useRef<string | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const update = () => setState(machine.current?.getState() ?? null);
  useEffect(() => {
    if (owner.current !== user?.id) {
      machine.current = null;
      setState(null);
      owner.current = user?.id ?? null;
    }
    if (!goal || !profile || machine.current) return;
    machine.current = new OnboardingStateMachine({
      goal: goal.goal,
      sex: profile.sex,
      dateOfBirth: profile.date_of_birth,
      heightCm: goal.input_height_cm ?? profile.height_cm,
      weightKg: goal.current_weight_kg,
      bodyFatPercentage: goal.body_fat_percentage,
      activityLevel: goal.activity_level,
      gymDays: goal.gym_days ?? 3,
      weeklyRateKg: goal.weekly_rate_kg,
      targetWeightKg: goal.target_weight_kg,
      targetDate: goal.target_date,
      stepGoal: goal.step_goal,
      waterMlGoal: goal.water_ml_goal,
    });
    update();
  }, [goal, profile, user?.id]);
  const save = async (recommended: boolean) => {
    if (
      !machine.current ||
      !user ||
      savingRef.current ||
      !subscription.hasPlan ||
      subscription.currentTier !== 'pro'
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (recommended) machine.current.useRecommendedRate();
      update();
      const next = machine.current.buildGoalProfile(user.id);
      const result = await saveGoalProfile({ ...next, recompute_reason: 'manual_edit' });
      if (!result.success) throw new Error(result.error);
      router.back();
    } catch {
      setError(t('setup.chooseSafePace'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const allowed = subscription.hasPlan && subscription.currentTier === 'pro';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={planStyles.reviewContent}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          variant="tertiary"
          label={t('setup.close')}
          onPress={() => router.back()}
          testID="close-plan-review"
        />
        <Text variant="title2">{t('setup.reviewMonthly')}</Text>
        {subscription.loading ? (
          <Text>{t('common.loading')}</Text>
        ) : subscription.error ? (
          <>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              label={t('setup.retry')}
              onPress={() => void subscription.refresh()}
              testID="retry-plan-access"
            />
          </>
        ) : !allowed ? (
          <Text>{t('setup.proReviewFeature')}</Text>
        ) : !state ? (
          <Text>{t('onboarding.summary.emptyBody')}</Text>
        ) : (
          <>
            <Text>{t('setup.reviewMonthlyBody')}</Text>
            <GoalStep
              selectedGoal={state.goal}
              onSelectGoal={(value) => {
                machine.current?.setGoal(value);
                update();
              }}
            />
            <NumberField
              optional
              label={t('setup.targetWeight')}
              value={state.targetWeightKg}
              onChange={(value) => {
                machine.current?.setTargetWeightAndDate(value, null);
                update();
              }}
              testID="monthly-goal-weight"
            />
            <ActivityStep
              selectedActivityLevel={state.activityLevel}
              onSelectActivityLevel={(value) => {
                machine.current?.setActivityLevel(value);
                update();
              }}
            />
            <TrainingStep
              state={state}
              onWeight={(value) => {
                machine.current?.setBodyStats({ weightKg: value });
                update();
              }}
              onHeight={(value) => {
                machine.current?.setBodyStats({ heightCm: value });
                update();
              }}
              onDays={(value) => {
                machine.current?.setGymDays(value);
                update();
              }}
            />
            <PlanReviewStep
              state={state}
              onWeight={(value) => {
                machine.current?.setBodyStats({ weightKg: value });
                update();
              }}
              onDays={(value) => {
                machine.current?.setGymDays(value);
                update();
              }}
              onAdjustment={(value) => {
                machine.current?.setDailyAdjustment(value);
                update();
              }}
              onRecommended={() => void save(true)}
              onPlanned={() => void save(false)}
              onChangeGoal={() => scroll.current?.scrollTo({ y: 0, animated: false })}
              saving={saving}
              error={error}
            />
            <GymCalculationStep result={state.calculatedTargets} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
