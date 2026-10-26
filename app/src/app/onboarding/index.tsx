import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, onboardingLayout as layout, space, useTheme } from '@calipartner/ui';
import {
  OnboardingStateMachine,
  ONBOARDING_STEPS_ORDER,
  type OnboardingStep,
} from '@/services/onboardingStateMachine';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/services/onboardingDraft';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { GoalStep } from '@/components/onboarding/GoalStep';
import { ActivityStep } from '@/components/onboarding/ActivityStep';
import { MotivationStep } from '@/components/onboarding/MotivationStep';
import { TrainingStep } from '@/components/onboarding/TrainingStep';
import { PremiumStep } from '@/components/onboarding/PremiumStep';
import { PlanReviewStep, PlanSafetyNotice } from '@/components/onboarding/PlanReviewStep';
import { GymCalculationStep } from '@/components/onboarding/GymCalculationStep';
import { HealthScreeningStep } from '@/components/onboarding/HealthScreeningStep';
import {
  PlanChoice,
  NumberField,
  PlanCard,
  planStyles,
} from '@/components/onboarding/PlanPrimitives';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { PartnerFinderOfferModal } from '@/components/onboarding/PartnerFinderOfferModal';

export const ACTIVE_ONBOARDING_STEPS = ONBOARDING_STEPS_ORDER;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, isLoading, needsProfileSetup, profileError, refreshProfile } = useAuth();
  const { saveGoalProfile, saveScreening } = useTargets();
  const { colors, reduceMotion } = useTheme();
  const { isOnline } = useNetworkStatus();
  const [machine, setMachine] = useState<OnboardingStateMachine | null>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<OnboardingStateMachine['getState']> | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [sheet, setSheet] = useState<'calculation' | 'health' | null>(null);
  const [showPartnerOffer, setShowPartnerOffer] = useState(false);
  const savingRef = useRef(false);
  const completedRef = useRef(false);
  const draftWrites = useRef(Promise.resolve());
  const scroll = useRef<ScrollView>(null);
  const ownerId = user?.id ?? 'guest-user';
  const owner = useRef(ownerId);
  owner.current = ownerId;

  useEffect(() => {
    if (isLoading) return;
    if (needsProfileSetup) {
      router.replace('/auth/profile-setup');
      return;
    }
    if (!user || !profile) {
      if (!user) router.replace('/welcome');
      return;
    }
    let active = true;
    setMachine(null);
    setSnapshot(null);
    setLoadError(null);
    completedRef.current = false;
    const hydrate = async () => {
      const db = await getDb();
      const draft = await loadOnboardingDraft(db, ownerId);
      const next = new OnboardingStateMachine({
        nickname: profile.nickname,
        sex: profile.sex,
        dateOfBirth: profile.date_of_birth,
        heightCm: 0,
        weightKg: 0,
        units: 'metric',
        ...draft,
      });
      // An interrupted store sheet returns to the reviewable feature preview.
      if (next.getState().currentStep === 'paywall') next.goToStep('premium');
      if (active) {
        setMachine(next);
        setSnapshot(next.getState());
      }
    };
    void hydrate().catch(() => {
      if (active) setLoadError(t('common.errorBody'));
    });
    return () => {
      active = false;
    };
    // Identity inputs are captured when this account's draft is hydrated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, profile?.id, isLoading, needsProfileSetup, retry, router]);

  useEffect(() => {
    if (!snapshot || completedRef.current) return;
    const pending = snapshot;
    draftWrites.current = draftWrites.current
      .catch(() => {})
      .then(async () => {
        if (completedRef.current || owner.current !== ownerId) return;
        await saveOnboardingDraft(await getDb(), ownerId, pending);
        if (owner.current === ownerId) setDraftError(false);
      })
      .catch(() => {
        if (owner.current === ownerId) setDraftError(true);
      });
  }, [snapshot, ownerId]);

  const update = () => {
    if (machine) setSnapshot(machine.getState());
  };
  const move = (step: OnboardingStep) => {
    if (!machine || savingRef.current) return;
    machine.goToStep(step);
    update();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = () => {
    if (!machine || savingRef.current) return;
    if (machine.getState().currentStep === 'goal') {
      router.replace('/welcome');
      return;
    }
    if (machine.getState().currentStep === 'completed') machine.goToStep('premium');
    else machine.back();
    update();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!snapshot || sheet || showPartnerOffer) return false;
      back();
      return true;
    });
    return () => listener.remove();
  });

  const next = () => {
    if (!machine) return;
    machine.next();
    update();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const save = async (recommended: boolean) => {
    if (!machine || !user || !profile || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (recommended) {
        machine.useRecommendedRate();
        update();
      }
      if (!machine.validateStep('body_stats').isValid) {
        setSaveError(t('setup.detailsError'));
        return;
      }
      const validation = machine.validateStep('rate_selection');
      if (!validation.isValid) {
        setSaveError(
          t(validation.errors.targetWeight ? 'setup.targetDirectionError' : 'setup.chooseSafePace'),
        );
        return;
      }
      const goal = machine.buildGoalProfile(user.id);
      // Retried completion uses the same client UUID, including after app restart.
      await draftWrites.current;
      await saveOnboardingDraft(await getDb(), user.id, machine.getState());
      const screening = await saveScreening(machine.buildHealthScreening(user.id));
      if (!screening.success) throw new Error(screening.error ?? t('common.errorBody'));
      const saved = await saveGoalProfile(goal);
      if (!saved.success) throw new Error(saved.error ?? t('common.errorBody'));
      if (owner.current !== user.id) return;
      completedRef.current = true;
      await draftWrites.current;
      await clearOnboardingDraft(await getDb(), user.id).catch(() => {});
      setShowPartnerOffer(true);
    } catch {
      setSaveError(t('common.errorBody'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!snapshot || !machine)
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
        <View style={styles.center}>
          <Text fontSet="onboarding" color={colors.textMid} accessibilityLiveRegion="polite">
            {loadError ?? (profileError ? t('common.errorBody') : t('setup.preparing'))}
          </Text>
          {loadError || profileError ? (
            <Button
              fontSet="onboarding"
              label={t('setup.retry')}
              onPress={() => {
                if (profileError) void refreshProfile();
                else setRetry((value) => value + 1);
              }}
              testID="onboarding-retry"
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  const current = snapshot.currentStep;
  const index = Math.max(0, ACTIVE_ONBOARDING_STEPS.indexOf(current));
  const titles: Record<OnboardingStep, string> = {
    goal: t('setup.goalTitle', { name: snapshot.nickname || profile?.nickname || '' }),
    motivation: t('setup.motivationTitle'),
    activity_level: t('onboarding.activity.title'),
    body_stats: t('setup.trainingTitle'),
    rate_selection: t('setup.paceTitle'),
    daily_goals: t('setup.dailyGoalsTitle'),
    premium: t('setup.premiumTitle'),
    paywall: t('setup.premiumTitle'),
    completed: t('setup.reviewTitle'),
    health_screening: t('setup.privateHealth'),
    review_calculation: t('setup.howCalculated'),
    target_weight_date: t('setup.paceTitle'),
  };
  const subtitle =
    current === 'goal'
      ? t('setup.goalSubtitle')
      : current === 'activity_level'
        ? t('setup.activitySubtitle')
        : current === 'body_stats'
          ? t('setup.trainingSubtitle')
          : current === 'daily_goals'
            ? t('setup.dailyGoalsSubtitle')
            : current === 'rate_selection'
              ? t('setup.paceSubtitle')
              : current === 'premium' || current === 'paywall'
                ? t('setup.premiumSubtitle')
                : current === 'completed'
                  ? t('setup.reviewSubtitle')
                  : null;
  const setWeight = (value: number) => {
    machine.setBodyStats({ weightKg: value });
    update();
  };
  const setDays = (value: number) => {
    machine.setGymDays(value);
    update();
  };
  const closePremium = () => move('completed');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.frame}>
          <View style={styles.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              onPress={back}
              style={styles.iconButton}
              testID="btn-onboarding-back"
            >
              <Ionicons name="arrow-back-outline" size={layout.icon} color={colors.textHi} />
            </Pressable>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid} tabular>
              {t('onboarding.stepIndicator', {
                current: index + 1,
                total: ACTIVE_ONBOARDING_STEPS.length,
              })}
            </Text>
            {current === 'premium' || current === 'paywall' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('setup.closePremium')}
                onPress={closePremium}
                style={styles.iconButton}
                testID="btn-premium-close"
              >
                <Ionicons name="close-outline" size={layout.icon} color={colors.textHi} />
              </Pressable>
            ) : (
              <View style={styles.iconButton} />
            )}
          </View>
          <View
            style={[styles.track, { backgroundColor: colors.s3 }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: ACTIVE_ONBOARDING_STEPS.length, now: index + 1 }}
          >
            <View
              testID="onboarding-progress-fill"
              style={[
                styles.track,
                {
                  backgroundColor: colors.textHi,
                  width: `${((index + 1) / ACTIVE_ONBOARDING_STEPS.length) * 100}%`,
                },
              ]}
            />
          </View>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              fontSet="onboarding"
              variant="title1"
              color={colors.textHi}
              accessibilityRole="header"
              testID="onboarding-title"
            >
              {titles[current]}
            </Text>
            {subtitle ? (
              <Text fontSet="onboarding" color={colors.textMid}>
                {subtitle}
              </Text>
            ) : null}
            {isOnline === false ? (
              <Text
                fontSet="onboarding"
                variant="bodyS"
                color={colors.textMid}
                accessibilityLiveRegion="polite"
              >
                {t('setup.offlineDraft')}
              </Text>
            ) : null}
            {draftError ? (
              <Pressable
                onPress={update}
                accessibilityRole="button"
                style={planStyles.link}
                testID="retry-draft"
              >
                <Text fontSet="onboarding" color={colors.danger}>
                  {t('setup.draftError')}
                </Text>
              </Pressable>
            ) : null}
            {current === 'goal' ? (
              <GoalStep
                selectedGoal={snapshot.goal}
                onSelectGoal={(goal) => {
                  machine.setGoal(goal);
                  update();
                }}
              />
            ) : null}
            {current === 'motivation' ? <MotivationStep goal={snapshot.goal} /> : null}
            {current === 'activity_level' ? (
              <ActivityStep
                selectedActivityLevel={snapshot.activityLevel}
                onSelectActivityLevel={(value) => {
                  machine.setActivityLevel(value);
                  update();
                }}
              />
            ) : null}
            {current === 'body_stats' ? (
              <TrainingStep
                state={snapshot}
                onWeight={setWeight}
                onHeight={(value) => {
                  machine.setBodyStats({ heightCm: value });
                  update();
                }}
                onDays={setDays}
              />
            ) : null}
            {current === 'rate_selection' ? (
              <View style={planStyles.section}>
                {snapshot.goal !== 'maintain' ? (
                  <PlanCard>
                    <NumberField
                      optional
                      label={t('setup.targetWeight')}
                      value={snapshot.targetWeightKg}
                      onChange={(value) => {
                        machine.setTargetWeightAndDate(value, null);
                        update();
                      }}
                      testID="input-target-weight"
                    />
                    {snapshot.errors.targetWeight ? (
                      <Text fontSet="onboarding" color={colors.danger} accessibilityRole="alert">
                        {t('setup.targetDirectionError')}
                      </Text>
                    ) : null}
                  </PlanCard>
                ) : (
                  <PlanCard>
                    <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
                      {t('setup.maintainPace')}
                    </Text>
                    <Text fontSet="onboarding" color={colors.textMid}>
                      {t('setup.maintainPaceBody')}
                    </Text>
                  </PlanCard>
                )}
                <View accessibilityRole="radiogroup" style={planStyles.section}>
                  {snapshot.calculatedTargets?.presetRates.map((rate) => (
                    <PlanChoice
                      key={rate.rateKgPerWeek}
                      testID={`rate-card-${rate.rateKgPerWeek}`}
                      title={t('setup.rate', { rate: rate.rateKgPerWeek })}
                      description={`${t('setup.kcalDay', { kcal: rate.targetKcal.toLocaleString() })}${rate.rateKgPerWeek === snapshot.calculatedTargets?.recommendedRateKg ? ` - ${t('setup.recommended')}` : ''}`}
                      selected={snapshot.weeklyRateKg === rate.rateKgPerWeek}
                      onPress={() => {
                        machine.setWeeklyRate(rate.rateKgPerWeek);
                        update();
                      }}
                    />
                  ))}
                </View>
                {snapshot.goal !== 'maintain' ? (
                  <NumberField
                    label={t('fixes.customPace')}
                    value={snapshot.weeklyRateKg}
                    onChange={(value) => {
                      machine.setWeeklyRate(value ?? NaN);
                      update();
                    }}
                    testID="input-custom-pace"
                  />
                ) : null}
                <PlanSafetyNotice result={snapshot.calculatedTargets} />
                {snapshot.errors.rate ? (
                  <Text fontSet="onboarding" accessibilityRole="alert" color={colors.danger}>
                    {t('fixes.invalidPlan')}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => move('goal')}
                  style={planStyles.link}
                  accessibilityRole="button"
                  testID="pace-change-goal"
                >
                  <Text fontSet="onboarding" color={colors.textMid}>
                    {t('setup.changeGoal')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {current === 'daily_goals' ? (
              <PlanCard>
                <NumberField
                  label={t('setup.waterGoal')}
                  value={snapshot.waterMlGoal}
                  onChange={(value) => {
                    machine.setStepAndWaterGoals(undefined, value ?? NaN);
                    update();
                  }}
                  testID="input-water-goal"
                />
                <NumberField
                  label={t('setup.stepGoal')}
                  value={snapshot.stepGoal}
                  onChange={(value) => {
                    machine.setStepAndWaterGoals(value ?? NaN);
                    update();
                  }}
                  testID="input-step-goal"
                />
                {Object.keys(snapshot.errors).length ? (
                  <Text fontSet="onboarding" color={colors.danger} accessibilityRole="alert">
                    {t('setup.dailyGoalsError')}
                  </Text>
                ) : null}
              </PlanCard>
            ) : null}
            {current === 'premium' || current === 'paywall' ? <PremiumStep /> : null}
            {current === 'completed' ? (
              <PlanReviewStep
                state={snapshot}
                onWeight={setWeight}
                onDays={setDays}
                onAdjustment={(value) => {
                  machine.setDailyAdjustment(value);
                  update();
                }}
                onRecommended={() => void save(true)}
                onPlanned={() => void save(false)}
                onCalculation={() => setSheet('calculation')}
                onHealth={() => setSheet('health')}
                onChangeGoal={() => move('goal')}
                saving={saving}
                error={saveError}
              />
            ) : null}
          </ScrollView>
          {current !== 'completed' ? (
            <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
              <Button
                fontSet="onboarding"
                label={t(current === 'premium' ? 'setup.tryNow' : 'setup.next')}
                onPress={next}
                testID="btn-onboarding-next"
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {current === 'paywall' ? (
        <PaywallModal visible onClose={closePremium} context="general" onSuccess={closePremium} />
      ) : null}
      <Modal
        visible={sheet !== null}
        onRequestClose={() => setSheet(null)}
        animationType={reduceMotion ? 'none' : 'slide'}
        accessibilityLabel={t(sheet === 'health' ? 'setup.privateHealth' : 'setup.howCalculated')}
        testID="onboarding-details-sheet"
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Button
              fontSet="onboarding"
              variant="secondary"
              label={t('setup.close')}
              onPress={() => setSheet(null)}
              testID="btn-close-details"
            />
            <Text fontSet="onboarding" variant="title2" color={colors.textHi}>
              {t(sheet === 'health' ? 'setup.privateHealth' : 'setup.howCalculated')}
            </Text>
            {sheet === 'calculation' ? (
              <GymCalculationStep result={snapshot.calculatedTargets} />
            ) : (
              <HealthScreeningStep
                sex={snapshot.sex}
                pregnantOrBreastfeeding={snapshot.healthScreening.pregnantOrBreastfeeding}
                hasDiabetesOrMedication={snapshot.healthScreening.hasDiabetesOrMedication}
                hasEatingDisorderHistory={snapshot.healthScreening.hasEatingDisorderHistory}
                onChangePregnant={(value) => {
                  machine.setHealthScreening({ pregnantOrBreastfeeding: value });
                  update();
                }}
                onChangeDiabetes={(value) => {
                  machine.setHealthScreening({ hasDiabetesOrMedication: value });
                  update();
                }}
                onChangeEatingDisorder={(value) => {
                  machine.setHealthScreening({ hasEatingDisorderHistory: value });
                  update();
                }}
                onSkip={() => setSheet(null)}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {showPartnerOffer ? (
        <PartnerFinderOfferModal
          visible
          onClose={() => router.replace('/today')}
          onAccept={() => router.replace('/today')}
          testID="modal-partner-finder-offer"
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: { flex: 1, width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center' },
  center: { flex: 1, padding: space[6], justifyContent: 'center', gap: space[4] },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  iconButton: {
    width: layout.touch,
    minHeight: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: space[1] },
  content: { padding: space[4], paddingBottom: space[8], gap: space[4] },
  footer: { padding: space[4], borderTopWidth: layout.border },
});
