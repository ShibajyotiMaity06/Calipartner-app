import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  applyOnboardingTargetOverrides,
  isAtLeast18,
  isGymPlanValid,
  type OnboardingTargetOverrides,
} from '@calipartner/core';
import {
  ChevronLeftIcon,
  IconButton,
  LinkButton,
  PageDots,
  PrimaryButton,
  ProgressBar,
  ScreenWrapper,
  Text as V1Text,
  colors as v1Colors,
  layout as v1Layout,
  space as v1Space,
} from '@calipartner/ui/v1';
import { AuthFormView, type AuthFormMode } from '@/components/auth/AuthFormView';
import { AllSetStep } from '@/components/onboarding/AllSetStep';
import { GymCalculationStep } from '@/components/onboarding/GymCalculationStep';
import { OnboardingQuestion } from '@/components/onboarding/OnboardingQuestion';
import { PaywallV1Step } from '@/components/onboarding/PaywallV1Step';
import { PlanReviewStep } from '@/components/onboarding/PlanReviewStep';
import { ProfileSetupStep } from '@/components/onboarding/ProfileSetupStep';
import { ProTeaserStep } from '@/components/onboarding/ProTeaserStep';
import { RemindersStep, type ReminderPrefs } from '@/components/onboarding/RemindersStep';
import { RevealStepView } from '@/components/onboarding/RevealStepView';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { macroErrorMessage } from '@/i18n/macroErrors';
import { syncAllLocalReminders } from '@/services/localNotificationService';
import { requestNativeHealthPermission } from '@/services/nativeHealthService';
import { requestNotificationPermissions } from '@/services/notificationPermissionService';
import { updateNotificationSettings } from '@/services/notificationSettingsService';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  resumeOnboardingDraft,
  saveOnboardingDraft,
} from '@/services/onboardingDraft';
import { requireOnboardingReview } from '@/services/onboardingReviewService';
import {
  MAX_ONBOARDING_WEEKLY_RATE_KG,
  ONBOARDING_STEPS_ORDER,
  type OnboardingStateMachine,
} from '@/services/onboardingStateMachine';
import {
  finishPairPrompt,
  pendingPairInvite,
  requirePairPrompt,
} from '@/services/pairOnboardingService';

export const ACTIVE_ONBOARDING_STEPS = ONBOARDING_STEPS_ORDER;

const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  meals: true,
  hydration: true,
  partner: true,
};

export default function OnboardingScreen() {
  const { user, profile, isLoading, needsProfileSetup, profileError, refreshProfile } = useAuth();
  const profileReady = profile?.id === user?.id && Boolean(profile);

  if (isLoading || (user && !profileReady && !needsProfileSetup)) {
    return <OnboardingStatus error={Boolean(profileError)} onRetry={() => void refreshProfile()} />;
  }
  const ownerId = user?.id ?? 'guest-user';
  return <Questionnaire key={ownerId} ownerId={ownerId} />;
}

function OnboardingStatus({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return (
    <SafeAreaView style={v1Styles.safe}>
      <View style={v1Styles.center}>
        <V1Text variant="body" color="textMid" accessibilityLiveRegion="polite">
          {t(error ? 'common.errorBody' : 'setup.preparing')}
        </V1Text>
        {error && onRetry ? (
          <PrimaryButton
            title={t('setup.retry')}
            showArrow={false}
            onPress={onRetry}
            testID="onboarding-retry"
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Questionnaire({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const { checkoutDone } = useLocalSearchParams<{ checkoutDone?: string }>();
  const { user, profile, createProfile, updateProfile, changeUsername } = useAuth();
  const { saveGoalProfile } = useTargets();
  const { isOnline } = useNetworkStatus();

  const [machine, setMachine] = useState<OnboardingStateMachine | null>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<OnboardingStateMachine['getState']> | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [calculation, showCalculation] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [authMode, setAuthMode] = useState<AuthFormMode>('signup');
  const [paywallViewMode, setPaywallViewMode] = useState<'compare' | 'all_plans'>('compare');
  const [handleInput, setHandleInput] = useState(profile?.username ?? '');
  const [handleValid, setHandleValid] = useState(Boolean(profile?.username));
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [finishingNav, setFinishingNav] = useState(false);

  const savingRef = useRef(false);
  const completed = useRef(false);
  const active = useRef(false);
  const draftWrites = useRef(Promise.resolve());
  const scroll = useRef<ScrollView>(null);
  const identity = profile?.id === ownerId ? profile : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    setLoadError(false);
    const hydrate = async () => {
      const db = await getDb();
      const ownDraft = await loadOnboardingDraft(db, ownerId);
      const guestDraft = ownDraft ? null : await loadOnboardingDraft(db, 'guest-user');
      if (cancelled) return;
      const nextMachine = resumeOnboardingDraft(
        ownDraft ?? guestDraft,
        identityRef.current,
        Boolean(guestDraft),
      );
      if (guestDraft && ownerId !== 'guest-user') {
        await saveOnboardingDraft(db, ownerId, nextMachine.getState());
        await clearOnboardingDraft(db, 'guest-user');
      }
      if (!cancelled) {
        setMachine(nextMachine);
        setSnapshot(nextMachine.getState());
      }
    };
    void hydrate().catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [ownerId, retry]);

  useEffect(() => {
    if (!snapshot || completed.current || snapshot.currentStep === 'all_set') return;
    draftWrites.current = draftWrites.current.then(async () => {
      if (completed.current || !active.current) return;
      try {
        await saveOnboardingDraft(await getDb(), ownerId, snapshot);
        if (active.current) setDraftError(false);
      } catch {
        if (active.current) setDraftError(true);
      }
    });
  }, [snapshot, ownerId]);

  const update = () => {
    if (machine) setSnapshot(machine.getState());
  };

  useEffect(() => {
    if (user && snapshot?.currentStep === 'auth' && machine) {
      machine.goToStep('pro_coach');
      update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, snapshot?.currentStep, machine]);

  useEffect(() => {
    if (checkoutDone === '1' && snapshot?.currentStep === 'paywall' && machine) {
      machine.goToStep('profile');
      update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutDone, snapshot?.currentStep, machine]);

  const back = () => {
    if (!machine || savingRef.current) return;
    if (snapshot?.currentStep === 'paywall' && paywallViewMode === 'all_plans') {
      setPaywallViewMode('compare');
      return;
    }
    if (!machine.back()) return;
    if (user && machine.getState().currentStep === 'auth') {
      machine.back();
    }
    Keyboard.dismiss();
    setSaveError(null);
    update();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || !snapshot) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (calculation || snapshot.currentStep === 'all_set') return false;
      back();
      return true;
    });
    return () => listener.remove();
  });

  if (!snapshot || !machine) {
    return <OnboardingStatus error={loadError} onRetry={() => setRetry((value) => value + 1)} />;
  }

  const step = snapshot.currentStep;
  const index = ACTIVE_ONBOARDING_STEPS.findIndex((numbered) => numbered === step);

  const next = () => {
    const moved = machine.next();
    update();
    if (moved) {
      Keyboard.dismiss();
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const continueToReveal = (overrides: OnboardingTargetOverrides = {}) => {
    setSaveError(null);
    try {
      const baseGoal = machine.buildGoalProfile(ownerId);
      let goal;
      try {
        goal = applyOnboardingTargetOverrides(
          baseGoal,
          snapshot.sex ?? identity?.sex ?? 'male',
          overrides,
        );
        if (goal.weekly_rate_kg > MAX_ONBOARDING_WEEKLY_RATE_KG) {
          goal.weekly_rate_kg = MAX_ONBOARDING_WEEKLY_RATE_KG;
        }
        machine.setTargetOverrides(overrides);
        if (machine.goToStep('reveal')) {
          update();
        }
      } catch (e) {
        setSaveError(macroErrorMessage(e));
      }
    } catch (e) {
      setSaveError(macroErrorMessage(e));
    }
  };

  const advanceAfterReminders = (prefs: ReminderPrefs) => {
    machine.setReminderPrefs(prefs);
    if (user) {
      machine.goToStep('pro_coach');
    } else {
      machine.goToStep('auth');
    }
    update();
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const handleTurnOnReminders = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await requestNotificationPermissions('reminder_configured').catch(() => false);
      advanceAfterReminders(snapshot.reminderPrefs ?? DEFAULT_REMINDER_PREFS);
    } finally {
      if (active.current) setReminderBusy(false);
    }
  };

  const handleSkipReminders = () => {
    if (reminderBusy) return;
    advanceAfterReminders({ meals: false, hydration: false, partner: false });
  };

  const handleSaveProfileAndPlan = async () => {
    if (savingRef.current || isOnline === false) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await draftWrites.current;
      const targetUserId = user?.id ?? ownerId;
      const cleanHandle = handleInput.trim().toLowerCase();
      const safeHeight =
        snapshot.heightCm &&
        Number.isFinite(snapshot.heightCm) &&
        snapshot.heightCm >= 50 &&
        snapshot.heightCm <= 300
          ? snapshot.heightCm
          : 175;
      const now = new Date();
      const defaultDob = `${now.getFullYear() - 25}-01-01`;
      const safeDob =
        snapshot.dateOfBirth && isAtLeast18(snapshot.dateOfBirth)
          ? snapshot.dateOfBirth
          : defaultDob;
      const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const displayName = snapshot.nickname?.trim() || cleanHandle;

      if (!identity) {
        const created = await createProfile({
          username: cleanHandle,
          nickname: displayName,
          avatar_url: null,
          date_of_birth: safeDob,
          sex: snapshot.sex ?? 'female',
          height_cm: safeHeight,
          units: snapshot.units ?? 'metric',
          timezone: resolvedTimezone,
        });
        if (created.error) {
          throw created.error;
        }
      } else {
        if (cleanHandle && cleanHandle !== identity.username) {
          const handleChanged = await changeUsername(cleanHandle);
          if (handleChanged.error) throw handleChanged.error;
        }
        const updated = await updateProfile({
          nickname: displayName,
          sex: snapshot.sex ?? identity.sex,
          height_cm: safeHeight,
          units: snapshot.units ?? identity.units,
          timezone: resolvedTimezone,
        });
        if (updated.error) throw updated.error;
      }

      const baseGoal = machine.buildGoalProfile(targetUserId);
      const goal = applyOnboardingTargetOverrides(
        baseGoal,
        snapshot.sex ?? identity?.sex ?? 'male',
        snapshot.targetOverrides ?? {},
      );
      if (goal.weekly_rate_kg > MAX_ONBOARDING_WEEKLY_RATE_KG) {
        goal.weekly_rate_kg = MAX_ONBOARDING_WEEKLY_RATE_KG;
      }

      const saved = await saveGoalProfile(goal);
      if (!saved.success) {
        throw new Error(saved.error ?? t('common.errorBody'));
      }

      await requireOnboardingReview(targetUserId, Platform.OS);

      const rem = snapshot.reminderPrefs ?? DEFAULT_REMINDER_PREFS;
      void updateNotificationSettings({
        meal_reminders_enabled: rem.meals,
        water_reminders_enabled: rem.hydration,
        partner_activity_enabled: rem.partner,
      })
        .then((updatedSettings) => {
          if (updatedSettings) void syncAllLocalReminders(updatedSettings).catch(() => {});
        })
        .catch(() => {});

      completed.current = true;
      await clearOnboardingDraft(await getDb(), targetUserId).catch(() => {});
      await clearOnboardingDraft(await getDb(), 'guest-user').catch(() => {});

      machine.goToStep('all_set');
      if (active.current) update();
    } catch (error) {
      completed.current = false;
      if (active.current) setSaveError(macroErrorMessage(error));
    } finally {
      savingRef.current = false;
      if (active.current) setSaving(false);
    }
  };

  const handleLeaveAllSet = async (choice: 'today' | 'invite') => {
    if (finishingNav) return;
    setFinishingNav(true);
    try {
      const targetUserId = user?.id ?? ownerId;
      if (choice === 'invite') {
        await requirePairPrompt(targetUserId).catch(() => {});
        router.replace('/pair-start');
        return;
      }
      await finishPairPrompt(targetUserId).catch(() => {});
      const inviteToken = await pendingPairInvite().catch(() => null);
      if (inviteToken) {
        router.replace(`/invite/${inviteToken}` as never);
        return;
      }
      router.replace('/(tabs)/today');
    } finally {
      if (active.current) setFinishingNav(false);
    }
  };

  const calculationModal = (
    <Modal
      visible={calculation}
      onRequestClose={() => showCalculation(false)}
      animationType="slide"
      accessibilityLabel={t('setup.howCalculated')}
      testID="onboarding-details-sheet"
    >
      <SafeAreaView style={v1Styles.safe}>
        <ScrollView contentContainerStyle={v1Styles.modalScroll}>
          <PrimaryButton
            title={t('setup.close')}
            showArrow={false}
            onPress={() => showCalculation(false)}
            testID="btn-close-details"
          />
          <GymCalculationStep result={snapshot.calculatedTargets} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Screen 17 & 18 · Auth
  if (step === 'auth') {
    return (
      <>
        <AuthFormView
          mode={authMode}
          onModeChange={setAuthMode}
          onBack={back}
          onAuthenticated={() => {
            machine.goToStep('pro_coach');
            update();
          }}
          testID="onboarding-screen-auth"
        />
        {calculationModal}
      </>
    );
  }

  // Screen 22 & 23 · Paywall & All plans
  if (step === 'paywall') {
    return (
      <>
        <PaywallV1Step
          viewMode={paywallViewMode}
          onViewModeChange={setPaywallViewMode}
          onBack={back}
          onContinueProSuccess={() => {
            setPaywallViewMode('compare');
            next();
          }}
          onContinueFree={() => {
            setPaywallViewMode('compare');
            next();
          }}
        />
        {calculationModal}
      </>
    );
  }

  // Screen 25 · All set celebration
  if (step === 'all_set') {
    return (
      <>
        <AllSetStep
          nickname={snapshot.nickname}
          loading={finishingNav}
          onGoToToday={() => void handleLeaveAllSet('today')}
          onInvitePartner={() => void handleLeaveAllSet('invite')}
        />
        {calculationModal}
      </>
    );
  }

  const isProTeaser = step === 'pro_coach' || step === 'pro_partners' || step === 'pro_adaptive';
  const showProgressBar = index >= 0 || step === 'reveal';
  const progress =
    step === 'reveal' ? 1 : index >= 0 ? (index + 1) / ACTIVE_ONBOARDING_STEPS.length : 0;
  const isGoal = step === 'goal';
  const isFlexNonScrolling =
    step === 'height' || step === 'weight' || step === 'gym_days' || step === 'target_weight';
  const hasAnyTracker = Object.values(snapshot.enabledTrackers).some(Boolean);

  const isNextDisabled =
    saving ||
    healthConnecting ||
    reminderBusy ||
    (step === 'nickname' && !snapshot.nickname.trim()) ||
    (step === 'trackers' && !hasAnyTracker) ||
    (step === 'plan_summary' &&
      (!snapshot.calculatedTargets || !isGymPlanValid(snapshot.calculatedTargets))) ||
    (step === 'profile' && (!handleValid || isOnline === false));

  const handleStepBack = () => {
    if (isGoal) {
      router.replace('/welcome');
      return;
    }
    back();
  };

  const handleTargetSkip = () => {
    machine.setTargetWeightAndDate(null, null);
    next();
  };

  const handleStepNext = async () => {
    if (isGoal && !snapshot.goalSelected && snapshot.goal !== 'maintain') {
      machine.setGoal('cut');
    } else if (step === 'target_weight' && snapshot.targetWeightKg === null) {
      const baseWeight = snapshot.weightKg > 0 ? snapshot.weightKg : 70;
      const suggestedTargetKg =
        snapshot.goal === 'cut'
          ? Math.max(30, Math.round(baseWeight * 0.9 * 2) / 2)
          : Math.min(250, Math.round(baseWeight * 1.07 * 2) / 2);
      machine.setTargetWeightAndDate(suggestedTargetKg, null);
    } else if (step === 'health_sync' && Platform.OS !== 'web') {
      setHealthConnecting(true);
      try {
        await requestNativeHealthPermission().catch(() => 'unavailable');
      } finally {
        setHealthConnecting(false);
      }
    } else if (step === 'plan_summary') {
      continueToReveal({});
      return;
    } else if (step === 'reminders') {
      await handleTurnOnReminders();
      return;
    } else if (step === 'profile') {
      await handleSaveProfileAndPlan();
      return;
    }
    next();
  };

  const primaryTitle =
    step === 'health_sync'
      ? Platform.OS === 'ios'
        ? t('onboardingV1.healthCtaIos')
        : Platform.OS === 'android'
          ? t('onboardingV1.healthCtaAndroid')
          : t('setup.next')
      : step === 'plan_summary'
        ? t('onboardingV1.planCta')
        : step === 'reveal'
          ? t('onboardingV1.revealCta')
          : step === 'reminders'
            ? t('onboardingV1.remindersCta')
            : step === 'pro_adaptive'
              ? t('onboardingV1.proSeePlansCta')
              : isProTeaser
                ? t('onboardingV1.proContinue')
                : step === 'profile'
                  ? saving
                    ? t('setup.statusSaving')
                    : t('onboardingV1.profileCta')
                  : t('setup.next');

  const primaryTestID =
    step === 'plan_summary'
      ? 'continue-calculated-plan'
      : step === 'reveal'
        ? 'onboarding-open-paywall'
        : step === 'reminders'
          ? 'btn-turn-on-reminders'
          : isProTeaser
            ? 'btn-pro-teaser-next'
            : step === 'profile'
              ? 'btn-submit-profile'
              : 'btn-onboarding-next';

  const proActiveIndex = step === 'pro_coach' ? 0 : step === 'pro_partners' ? 1 : 2;

  return (
    <>
      <ScreenWrapper
        scroll={!isFlexNonScrolling}
        keyboardAvoiding={step === 'nickname' || step === 'profile'}
        testID={`onboarding-screen-${step}`}
        navRow={
          <View style={v1Styles.navRow}>
            <IconButton
              icon={<ChevronLeftIcon size={18} color={v1Colors.textHi} />}
              size={44}
              onPress={handleStepBack}
              disabled={saving || healthConnecting || reminderBusy}
              accessibilityLabel={t('onboarding.back')}
              testID="btn-onboarding-back"
            />
            {showProgressBar ? (
              <View style={v1Styles.progressWrap}>
                <ProgressBar progress={progress} height={4} testID="onboarding-progress-fill" />
              </View>
            ) : isProTeaser ? (
              <View style={v1Styles.skipWrap}>
                <Pressable
                  onPress={() => {
                    machine.goToStep('paywall');
                    update();
                  }}
                  accessibilityRole="button"
                  style={v1Styles.skipBtn}
                  testID="btn-pro-teaser-skip"
                >
                  <V1Text variant="meta" color="textMid">
                    {t('onboardingV1.proSkip')}
                  </V1Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        footer={
          <View style={v1Styles.footer}>
            {isGoal ? (
              <V1Text variant="meta" color="textLo" style={v1Styles.footerHint}>
                {t('onboardingV1.goalFooterNote')}
              </V1Text>
            ) : null}
            {step === 'reminders' ? (
              <V1Text variant="micro" color="textLo" style={v1Styles.footerHint}>
                {t('onboardingV1.remindersFooterNote')}
              </V1Text>
            ) : null}
            {isProTeaser ? (
              <View style={v1Styles.dotsWrap}>
                <PageDots count={3} activeIndex={proActiveIndex} testID="pro-teaser-dots" />
              </View>
            ) : null}
            <PrimaryButton
              title={primaryTitle}
              showArrow
              loading={healthConnecting || saving || reminderBusy}
              disabled={isNextDisabled}
              onPress={() => void handleStepNext()}
              testID={primaryTestID}
            />
            {step === 'target_weight' ? (
              <View style={v1Styles.footerSecondary}>
                <LinkButton
                  title={t('onboardingV1.skipForNow')}
                  onPress={handleTargetSkip}
                  testID="btn-skip-target-weight"
                />
              </View>
            ) : null}
            {step === 'health_sync' && Platform.OS !== 'web' ? (
              <View style={v1Styles.footerSecondary}>
                <LinkButton
                  title={t('onboardingV1.healthNotNow')}
                  disabled={healthConnecting}
                  onPress={next}
                  testID="btn-skip-health-sync"
                />
              </View>
            ) : null}
            {step === 'reminders' ? (
              <View style={v1Styles.footerSecondary}>
                <LinkButton
                  title={t('onboardingV1.remindersNotNow')}
                  disabled={reminderBusy}
                  onPress={handleSkipReminders}
                  testID="btn-skip-reminders"
                />
              </View>
            ) : null}
          </View>
        }
      >
        {isOnline === false ? (
          <V1Text
            variant="meta"
            color="textLo"
            accessibilityLiveRegion="polite"
            style={v1Styles.statusNote}
          >
            {t('setup.offlineDraft')}
          </V1Text>
        ) : null}
        {draftError ? (
          <View style={v1Styles.footerSecondary}>
            <LinkButton title={t('setup.draftError')} onPress={update} testID="retry-draft" />
          </View>
        ) : null}

        {step === 'plan_summary' ? (
          <PlanReviewStep
            variant="v1"
            state={snapshot}
            onPlanned={continueToReveal}
            onCalculation={() => showCalculation(true)}
            error={saveError}
            onClearError={() => setSaveError(null)}
            saving={false}
          />
        ) : step === 'reveal' ? (
          <RevealStepView state={snapshot} />
        ) : step === 'reminders' ? (
          <RemindersStep
            nickname={snapshot.nickname}
            prefs={snapshot.reminderPrefs ?? DEFAULT_REMINDER_PREFS}
            onChangePrefs={(prefs) => {
              machine.setReminderPrefs(prefs);
              update();
            }}
          />
        ) : isProTeaser ? (
          <ProTeaserStep slide={step} nickname={snapshot.nickname} goal={snapshot.goal} />
        ) : step === 'profile' ? (
          <ProfileSetupStep
            nickname={snapshot.nickname}
            initialUsername={handleInput}
            initialAvatarUri={avatarPreviewUri}
            onChangeUsername={setHandleInput}
            onChangeValid={setHandleValid}
            onChangePhotoUri={setAvatarPreviewUri}
            errorMessage={saveError}
          />
        ) : (
          <OnboardingQuestion
            key={step}
            step={step}
            state={snapshot}
            machine={machine}
            update={update}
            identityConfirmed={Boolean(identity)}
          />
        )}
      </ScreenWrapper>
      {calculationModal}
    </>
  );
}

const v1Styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: v1Space.xl,
    gap: v1Space.lg,
  },
  modalScroll: {
    flexGrow: 1,
    padding: v1Space.xl,
    gap: v1Space.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: v1Space.lg,
  },
  progressWrap: {
    flex: 1,
  },
  skipWrap: {
    marginLeft: 'auto',
  },
  skipBtn: {
    minWidth: v1Layout.minTouchTarget,
    minHeight: v1Layout.minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: v1Space.md,
  },
  footer: {
    width: '100%',
  },
  footerHint: {
    textAlign: 'center',
    marginBottom: v1Space.md,
  },
  dotsWrap: {
    alignItems: 'center',
    marginBottom: v1Space.lg,
  },
  footerSecondary: {
    alignItems: 'center',
    marginTop: v1Space.sm,
  },
  statusNote: {
    marginBottom: v1Space.md,
  },
});
