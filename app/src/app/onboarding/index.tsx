import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { applyOnboardingTargetOverrides, type OnboardingTargetOverrides } from '@calipartner/core';
import {
  Button,
  NavigationIcon,
  Text,
  controls,
  onboardingLayout as layout,
  space,
  useTheme,
} from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { macroErrorMessage } from '@/i18n/macroErrors';
import {
  MAX_ONBOARDING_WEEKLY_RATE_KG,
  ONBOARDING_STEPS_ORDER,
  type OnboardingStateMachine,
} from '@/services/onboardingStateMachine';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  resumeOnboardingDraft,
  saveOnboardingDraft,
} from '@/services/onboardingDraft';
import { requireOnboardingReview } from '@/services/onboardingReviewService';
import { afterSetupDestination, requirePairPrompt } from '@/services/pairOnboardingService';
import { PlanReviewStep } from '@/components/onboarding/PlanReviewStep';
import { GymCalculationStep } from '@/components/onboarding/GymCalculationStep';
import { EvolutionCharacter } from '@/components/onboarding/EvolutionCharacter';
import { OnboardingQuestion, questionCopy } from '@/components/onboarding/OnboardingQuestion';
import { FinishOnboardingProfile } from '@/components/onboarding/FinishOnboardingProfile';
import { PlanCard } from '@/components/onboarding/PlanPrimitives';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { OnboardingAuthModal } from '@/components/onboarding/OnboardingAuthModal';
import { fetchWebCatalog } from '@/services/webBillingService';

export const ACTIVE_ONBOARDING_STEPS = ONBOARDING_STEPS_ORDER;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, isLoading, needsProfileSetup, profileError, refreshProfile } = useAuth();
  const profileReady = profile?.id === user?.id && Boolean(profile);

  if (isLoading || (user && !profileReady && !needsProfileSetup)) {
    return <OnboardingStatus error={Boolean(profileError)} onRetry={() => void refreshProfile()} />;
  }
  const ownerId = user?.id ?? 'guest-user';
  return <Questionnaire key={ownerId} ownerId={ownerId} />;
}

function OnboardingStatus({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <View style={styles.center}>
        <Text color={colors.textMid} accessibilityLiveRegion="polite">
          {t(error ? 'common.errorBody' : 'setup.preparing')}
        </Text>
        {error && <Button label={t('setup.retry')} onPress={onRetry} testID="onboarding-retry" />}
      </View>
    </SafeAreaView>
  );
}

function Questionnaire({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const { checkoutDone } = useLocalSearchParams<{ checkoutDone?: string }>();
  const { user, profile, updateProfile } = useAuth();
  const { saveGoalProfile } = useTargets();
  const { colors, reduceMotion } = useTheme();
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
  const [paywallClosed, setPaywallClosed] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [showProfileSetupModal, setShowProfileSetupModal] = useState(false);
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
      const next = resumeOnboardingDraft(
        ownDraft ?? guestDraft,
        identityRef.current,
        Boolean(guestDraft),
      );
      if (guestDraft && ownerId !== 'guest-user') {
        await saveOnboardingDraft(db, ownerId, next.getState());
        await clearOnboardingDraft(db, 'guest-user');
      }
      if (!cancelled) {
        setMachine(next);
        setSnapshot(next.getState());
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
    if (!snapshot || completed.current) return;
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

  useEffect(() => {
    if (ownerId === 'guest-user' && snapshot?.currentStep === 'profile' && machine) {
      machine.goToStep('height');
      update();
    }
  }, [ownerId, snapshot?.currentStep, machine]);

  const update = () => {
    if (machine) setSnapshot(machine.getState());
  };
  const back = () => {
    if (!machine || savingRef.current) return;
    if (!machine.back()) return;
    if (ownerId === 'guest-user' && machine.getState().currentStep === 'profile') {
      machine.back();
    }
    Keyboard.dismiss();
    setSaveError(null);
    setPaywallClosed(false);
    update();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (Platform.OS !== 'android' || !snapshot) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (
        calculation ||
        (snapshot.currentStep === 'paywall' &&
          (identity || user) &&
          !paywallClosed &&
          checkoutDone !== '1')
      )
        return false;
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
  const copy = questionCopy[step];
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
      } catch {
        goal = baseGoal;
        machine.setTargetOverrides({});
      }
      next();
    } catch (error) {
      setSaveError(macroErrorMessage(error));
    }
  };

  const finish = async () => {
    if (savingRef.current || completed.current) return;
    if (!identity && !user) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (!isOnline) {
        setPaywallClosed(true);
        setSaveError(t('setup.offlineDraft'));
        return;
      }
      const targetUserId = user?.id ?? ownerId;
      const state = machine.getState();
      let goal;
      try {
        goal = applyOnboardingTargetOverrides(
          machine.buildGoalProfile(targetUserId),
          state.sex ?? identity?.sex ?? 'male',
          state.targetOverrides,
        );
      } catch {
        // Safe fallback: if custom target overrides violate safety bounds,
        // use calculated base targets so the user is never blocked or shown an error
        goal = machine.buildGoalProfile(targetUserId);
      }
      if (goal.weekly_rate_kg > MAX_ONBOARDING_WEEKLY_RATE_KG) {
        goal.weekly_rate_kg = MAX_ONBOARDING_WEEKLY_RATE_KG;
      }
      await draftWrites.current;
      await saveOnboardingDraft(await getDb(), targetUserId, state);
      if (!active.current) return;
      const needsProfileUpdate =
        identity &&
        (state.nickname.trim() !== identity.nickname ||
          state.heightCm !== identity.height_cm ||
          state.sex !== identity.sex ||
          state.units !== identity.units);
      if (updateProfile && needsProfileUpdate) {
        const result = await updateProfile({
          nickname: state.nickname.trim(),
          height_cm: state.heightCm,
          sex: state.sex,
          units: state.units,
        });
        if (result?.error) throw result.error;
      }
      if (!active.current) return;
      await requirePairPrompt(targetUserId);
      await requireOnboardingReview(targetUserId, Platform.OS);
      if (!active.current) return;
      const saved = await saveGoalProfile(goal);
      if (!saved.success) throw new Error(saved.error ?? t('common.errorBody'));
      if (!active.current) return;
      const destination = await afterSetupDestination(targetUserId);
      if (!active.current) return;
      completed.current = true;
      await clearOnboardingDraft(await getDb(), targetUserId).catch(() => {});
      await clearOnboardingDraft(await getDb(), 'guest-user').catch(() => {});
      if (active.current) router.replace(destination as never);
    } catch (error) {
      if (active.current) {
        setPaywallClosed(true);
        setSaveError(macroErrorMessage(error));
      }
    } finally {
      savingRef.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <View style={styles.frame}>
        <View style={styles.nav}>
          {step !== 'goal' ? (
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('onboarding.back')}
              iconOnly
              icon={<NavigationIcon action="back" />}
              onPress={back}
              disabled={saving}
              style={styles.iconButton}
              testID="btn-onboarding-back"
            />
          ) : (
            <View style={styles.iconButton} />
          )}
          {index >= 0 && (
            <Text variant="bodyS" color={colors.textMid} tabular>
              {t('onboarding.stepIndicator', {
                current: index + 1,
                total: ACTIVE_ONBOARDING_STEPS.length,
              })}
            </Text>
          )}
          {!user ? (
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('entryRefresh.logIn')}
              onPress={() => router.push({ pathname: '/auth/sign-in', params: { mode: 'signin' } })}
              disabled={saving}
              style={styles.iconButton}
              testID="btn-onboarding-login"
            />
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
        {index >= 0 && (
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
                  backgroundColor: colors.apricot,
                  width: `${((index + 1) / ACTIVE_ONBOARDING_STEPS.length) * 100}%`,
                },
              ]}
            />
          </View>
        )}
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.question}>
            {step !== 'reveal' && (step !== 'profile' || !identity) && (
              <Text variant="title1" accessibilityRole="header" testID="onboarding-title">
                {t(copy.title)}
              </Text>
            )}
            {copy.subtitle && <Text color={colors.textMid}>{t(copy.subtitle)}</Text>}
            {isOnline === false && (
              <Text variant="bodyS" accessibilityLiveRegion="polite">
                {t('setup.offlineDraft')}
              </Text>
            )}
            {draftError && (
              <Button
                variant="tertiary"
                label={t('setup.draftError')}
                onPress={update}
                testID="retry-draft"
              />
            )}
            {step === 'plan_summary' ? (
              <PlanReviewStep
                state={snapshot}
                onPlanned={continueToReveal}
                onCalculation={() => showCalculation(true)}
                error={saveError}
                onClearError={() => setSaveError(null)}
                saving={false}
              />
            ) : step === 'profile' ? (
              !identity ? (
                <FinishOnboardingProfile
                  state={snapshot}
                  waitForDraft={() => draftWrites.current}
                  onComplete={next}
                />
              ) : (
                <PlanCard>
                  <Text variant="heading">{t('profileSetup.usernameLabel')}</Text>
                  <Text tabular>@{identity.username}</Text>
                  <Text variant="heading">{t('setup.place')}</Text>
                  <Text>{identity.place || '—'}</Text>
                </PlanCard>
              )
            ) : step === 'reveal' ? (
              <View style={styles.reveal} testID="onboarding-peak-reveal">
                <EvolutionCharacter
                  gender={snapshot.characterGender}
                  goal={snapshot.goal}
                  stage={11}
                  reveal
                />
                <Text variant="title1" accessibilityRole="header" style={styles.revealTitle}>
                  {t('characterSetup.revealTitle')}
                </Text>
              </View>
            ) : step === 'paywall' ? (
              <>
                {(identity || user) && (paywallClosed || checkoutDone === '1') && (
                  <Button
                    label={t(saveError ? 'setup.retry' : 'setup.next')}
                    loading={saving}
                    disabled={saving}
                    onPress={() => void finish()}
                    testID="finish-onboarding-retry"
                  />
                )}
                {saveError && (
                  <Text
                    color={colors.danger}
                    accessibilityRole="alert"
                    testID="onboarding-save-error"
                  >
                    {saveError}
                  </Text>
                )}
              </>
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
          </View>
          {index > 0 && index <= 11 && (
            <EvolutionCharacter
              gender={snapshot.characterGender}
              goal={snapshot.goal}
              stage={index}
            />
          )}
        </ScrollView>
        {(step === 'reveal' ||
          (step !== 'plan_summary' &&
            step !== 'paywall' &&
            (step !== 'profile' || Boolean(identity)))) && (
          <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
            <Button
              label={t('setup.next')}
              onPress={() => {
                if (step === 'reveal' && !user) {
                  setAuthModalVisible(true);
                  return;
                }
                next();
              }}
              testID={step === 'reveal' ? 'onboarding-open-paywall' : 'btn-onboarding-next'}
            />
          </View>
        )}
      </View>
      <PaywallModal
        visible={
          step === 'paywall' && Boolean(identity || user) && !paywallClosed && checkoutDone !== '1'
        }
        preloadPrices={isOnline === true}
        completionPending={saving}
        context="general"
        onClose={() => void finish()}
        onContinueFree={() => void finish()}
        onSuccess={() => void finish()}
      />
      <OnboardingAuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onAuthenticated={() => {
          setAuthModalVisible(false);
          if (!profile) {
            setShowProfileSetupModal(true);
          } else {
            next();
          }
        }}
      />
      {showProfileSetupModal && (
        <Modal
          visible={showProfileSetupModal}
          animationType={reduceMotion ? 'none' : 'slide'}
          onRequestClose={() => {}}
        >
          <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.question}>
                <Text variant="title1" accessibilityRole="header">
                  {t('characterSetup.profileTitle')}
                </Text>
                <Text color={colors.textMid}>{t('setup.usernameRules')}</Text>
                <FinishOnboardingProfile
                  state={snapshot}
                  waitForDraft={() => draftWrites.current}
                  onComplete={() => {
                    setShowProfileSetupModal(false);
                    next();
                  }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
      <Modal
        visible={calculation}
        onRequestClose={() => showCalculation(false)}
        animationType={reduceMotion ? 'none' : 'slide'}
        accessibilityLabel={t('setup.howCalculated')}
        testID="onboarding-details-sheet"
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Button
              variant="secondary"
              label={t('setup.close')}
              onPress={() => showCalculation(false)}
              testID="btn-close-details"
            />
            <GymCalculationStep result={snapshot.calculatedTargets} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: { flex: 1, width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[5],
    gap: space[4],
  },
  nav: {
    paddingHorizontal: space[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: { minWidth: layout.touch, minHeight: layout.touch },
  track: { height: controls.progressHeight },
  content: { flexGrow: 1, padding: space[5], gap: space[5] },
  question: { gap: space[3] },
  reveal: { alignItems: 'center', gap: space[3] },
  revealTitle: { textAlign: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: space[5] },
});
