import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Sheet, space, dark } from '@calipartner/ui';
import { ActivityStep } from '@/components/onboarding/ActivityStep';
import { BodyStatsStep } from '@/components/onboarding/BodyStatsStep';
import { GoalStep } from '@/components/onboarding/GoalStep';
import { HealthScreeningStep } from '@/components/onboarding/HealthScreeningStep';
import { HowCalculatedStep } from '@/components/onboarding/HowCalculatedStep';
import { InvitePreviewModal } from '@/components/onboarding/InvitePreviewModal';
import { PartnerFinderOfferModal } from '@/components/onboarding/PartnerFinderOfferModal';
import { RatePickerStep } from '@/components/onboarding/RatePickerStep';
import { StepHeader } from '@/components/onboarding/StepHeader';
import { SummaryStep } from '@/components/onboarding/SummaryStep';
import { TargetDateStep } from '@/components/onboarding/TargetDateStep';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import { OnboardingStateMachine, type OnboardingStep } from '@/services/onboardingStateMachine';

/**
 * The 7 active linear onboarding steps.
 */
export const ACTIVE_ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'goal',
  'body_stats',
  'activity_level',
  'rate_selection',
  'target_weight_date',
  'health_screening',
  'completed',
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteCode?: string }>();
  const { user, profile } = useAuth();
  const { saveGoalProfile, saveScreening } = useTargets();

  // Instantiate the state machine with preloaded profile data if available
  const [machine] = useState(() => {
    return new OnboardingStateMachine({
      sex: profile?.sex ?? 'male',
      dateOfBirth: profile?.date_of_birth ?? '',
      heightCm: profile?.height_cm ?? 175,
      units: profile?.units ?? 'metric',
      weightKg: 70,
      activityLevel: 'moderate',
      goal: 'cut',
      weeklyRateKg: 0.5,
    });
  });

  // Local snapshot of machine state to trigger re-renders
  const [snapshot, setSnapshot] = useState(() => machine.getState());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sub-sheets & modals (A11, A12, A15)
  const [showHowCalculatedSheet, setShowHowCalculatedSheet] = useState(false);
  const [showPartnerOffer, setShowPartnerOffer] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(!!params.inviteCode);

  const updateState = () => {
    setSnapshot(machine.getState());
  };

  const currentStep = snapshot.currentStep;
  const currentStepIndex = Math.max(0, ACTIVE_ONBOARDING_STEPS.indexOf(currentStep));
  const totalSteps = ACTIVE_ONBOARDING_STEPS.length;

  // Step header titles and subtitles
  const stepTitles: Record<OnboardingStep, { title: string; subtitle: string }> = {
    goal: {
      title: t('onboarding.goal.title'),
      subtitle: t('onboarding.goal.subtitle'),
    },
    body_stats: {
      title: t('onboarding.bodyStats.title'),
      subtitle: t('onboarding.bodyStats.subtitle'),
    },
    activity_level: {
      title: t('onboarding.activity.title'),
      subtitle: t('onboarding.activity.subtitle'),
    },
    rate_selection: {
      title: t('onboarding.rate.title'),
      subtitle: t('onboarding.rate.subtitle'),
    },
    target_weight_date: {
      title: t('onboarding.targetDate.title'),
      subtitle: t('onboarding.targetDate.subtitle'),
    },
    health_screening: {
      title: t('onboarding.healthScreening.title'),
      subtitle: t('onboarding.healthScreening.subtitle'),
    },
    review_calculation: {
      title: t('onboarding.howCalculated.title'),
      subtitle: t('onboarding.howCalculated.subtitle'),
    },
    completed: {
      title: t('onboarding.summary.title'),
      subtitle: t('onboarding.summary.subtitle'),
    },
  };

  // Navigation handlers
  const handleNext = () => {
    playClickSound();
    if (currentStep === 'health_screening') {
      machine.goToStep('completed');
      updateState();
      return true;
    }
    const success = machine.next();
    if (machine.getState().currentStep === 'review_calculation') {
      machine.goToStep('completed');
    }
    updateState();
    return success;
  };

  const handleBack = () => {
    playClickSound();
    if (currentStep === 'completed') {
      machine.goToStep('health_screening');
      updateState();
      return;
    }
    machine.back();
    if (machine.getState().currentStep === 'review_calculation') {
      machine.goToStep('health_screening');
    }
    updateState();
  };

  const handleSkip = () => {
    playClickSound();
    if (currentStep === 'health_screening') {
      machine.goToStep('completed');
      updateState();
      return;
    }
    machine.next();
    if (machine.getState().currentStep === 'review_calculation') {
      machine.goToStep('completed');
    }
    updateState();
  };

  const handleGoToStep = (step: OnboardingStep) => {
    playClickSound();
    machine.goToStep(step);
    updateState();
  };

  // Field change handlers
  const handleSelectGoal = (goal: Goal) => {
    machine.setGoal(goal);
    updateState();
  };

  const handleChangeUnits = (units: Units) => {
    machine.setUnits(units);
    updateState();
  };

  const handleChangeSex = (sex: Sex) => {
    machine.setBodyStats({ sex });
    updateState();
  };

  const handleChangeDateOfBirth = (dob: string) => {
    machine.setBodyStats({ dateOfBirth: dob });
    updateState();
  };

  const handleChangeHeightCm = (heightCm: number) => {
    machine.setBodyStats({ heightCm });
    updateState();
  };

  const handleChangeWeightKg = (weightKg: number) => {
    machine.setBodyStats({ weightKg });
    updateState();
  };

  const handleChangeBodyFat = (bodyFat: number | null) => {
    machine.setBodyStats({ bodyFatPercentage: bodyFat });
    updateState();
  };

  const handleSelectActivityLevel = (level: ActivityLevel) => {
    machine.setActivityLevel(level);
    updateState();
  };

  const handleSelectRate = (rateKg: number) => {
    machine.setWeeklyRate(rateKg);
    updateState();
  };

  const handleChangeTargetWeight = (weightKg: number | null) => {
    machine.setTargetWeightAndDate(weightKg, snapshot.targetDate);
    updateState();
  };

  const handleChangeTargetDate = (date: string | null) => {
    machine.setTargetWeightAndDate(snapshot.targetWeightKg, date);
    updateState();
  };

  const handleChangePregnant = (val: boolean) => {
    machine.setHealthScreening({ pregnantOrBreastfeeding: val });
    updateState();
  };

  const handleChangeDiabetes = (val: boolean) => {
    machine.setHealthScreening({ hasDiabetesOrMedication: val });
    updateState();
  };

  const handleChangeEatingDisorder = (val: boolean) => {
    machine.setHealthScreening({ hasEatingDisorderHistory: val });
    updateState();
  };

  // Final Save Handler (A10 "Looks good")
  const handleSaveTargets = async () => {
    playSuccessSound();
    const effectiveUserId = user?.id ?? 'guest-user';
    setIsSaving(true);
    setSaveError(null);

    try {
      const goalProfile = machine.buildGoalProfile(effectiveUserId);
      const screening = machine.buildHealthScreening(effectiveUserId);

      // Save goal profile
      const goalRes = await saveGoalProfile(goalProfile);
      if (!goalRes.success && goalRes.error && user?.id) {
        setSaveError(goalRes.error);
        setIsSaving(false);
        return;
      }

      // Save health screening
      await saveScreening(screening);
      setIsSaving(false);

      // Offer Partner Finder (Spec A12 / ONB-12) if unprompted, or proceed
      setShowPartnerOffer(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setSaveError(message);
      setIsSaving(false);
    }
  };

  const currentInfo = stepTitles[currentStep];
  const canSkipCurrent = currentStep === 'target_weight_date' || currentStep === 'health_screening';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step Header with 4px progress bar & back button */}
        <StepHeader
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          title={currentInfo.title}
          subtitle={currentInfo.subtitle}
          onBack={handleBack}
          canGoBack={currentStepIndex > 0}
          onSkip={handleSkip}
          canSkip={canSkipCurrent}
        />

        {/* Step Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 'goal' && (
            <GoalStep
              selectedGoal={snapshot.goal}
              onSelectGoal={handleSelectGoal}
              onAutoAdvance={handleNext}
            />
          )}

          {currentStep === 'body_stats' && (
            <BodyStatsStep
              units={snapshot.units}
              sex={snapshot.sex}
              dateOfBirth={snapshot.dateOfBirth}
              heightCm={snapshot.heightCm}
              weightKg={snapshot.weightKg}
              bodyFatPercentage={snapshot.bodyFatPercentage}
              goal={snapshot.goal}
              errorDateOfBirth={snapshot.errors.dateOfBirth}
              errorHeight={snapshot.errors.height}
              errorWeight={snapshot.errors.weight}
              errorBodyFat={snapshot.errors.bodyFat}
              onChangeUnits={handleChangeUnits}
              onChangeSex={handleChangeSex}
              onChangeDateOfBirth={handleChangeDateOfBirth}
              onChangeHeightCm={handleChangeHeightCm}
              onChangeWeightKg={handleChangeWeightKg}
              onChangeBodyFat={handleChangeBodyFat}
            />
          )}

          {currentStep === 'activity_level' && (
            <ActivityStep
              selectedActivityLevel={snapshot.activityLevel}
              onSelectActivityLevel={handleSelectActivityLevel}
            />
          )}

          {currentStep === 'rate_selection' && (
            <RatePickerStep
              goal={snapshot.goal}
              units={snapshot.units}
              selectedRateKg={snapshot.weeklyRateKg}
              calculatedTargets={snapshot.calculatedTargets}
              errorMessage={snapshot.errors.rate}
              onSelectRate={handleSelectRate}
            />
          )}

          {currentStep === 'target_weight_date' && (
            <TargetDateStep
              units={snapshot.units}
              targetWeightKg={snapshot.targetWeightKg}
              targetDate={snapshot.targetDate}
              calculatedTargets={snapshot.calculatedTargets}
              errorTargetWeight={snapshot.errors.targetWeight}
              errorTargetDate={snapshot.errors.targetDate}
              onChangeTargetWeight={handleChangeTargetWeight}
              onChangeTargetDate={handleChangeTargetDate}
              onSkip={handleSkip}
            />
          )}

          {currentStep === 'health_screening' && (
            <HealthScreeningStep
              sex={snapshot.sex}
              pregnantOrBreastfeeding={snapshot.healthScreening.pregnantOrBreastfeeding}
              hasDiabetesOrMedication={snapshot.healthScreening.hasDiabetesOrMedication}
              hasEatingDisorderHistory={snapshot.healthScreening.hasEatingDisorderHistory}
              onChangePregnant={handleChangePregnant}
              onChangeDiabetes={handleChangeDiabetes}
              onChangeEatingDisorder={handleChangeEatingDisorder}
              onSkip={handleSkip}
            />
          )}

          {currentStep === 'completed' && (
            <SummaryStep
              goal={snapshot.goal}
              stepGoal={snapshot.stepGoal}
              waterMlGoal={snapshot.waterMlGoal}
              calculatedTargets={snapshot.calculatedTargets}
              isSaving={isSaving}
              saveError={saveError}
              onSave={handleSaveTargets}
              onGoBackToStats={() => handleGoToStep('body_stats')}
              onGoBackToRate={() => handleGoToStep('rate_selection')}
              onOpenHowCalculated={() => setShowHowCalculatedSheet(true)}
            />
          )}
        </ScrollView>

        {/* Bottom Action Footer (For steps prior to completed target reveal) */}
        {currentStep !== 'completed' && (
          <View style={styles.footer}>
            <Button
              variant="primary"
              size="lg"
              label={`${t('onboarding.next')} →`}
              onPress={handleNext}
              testID="btn-onboarding-next"
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* A11 How We Calculated This Sheet */}
      <Sheet
        visible={showHowCalculatedSheet}
        onClose={() => setShowHowCalculatedSheet(false)}
        testID="sheet-how-calculated"
      >
        <ScrollView style={styles.sheetScroll}>
          <HowCalculatedStep
            calculatedTargets={snapshot.calculatedTargets}
            bodyFatPercentage={snapshot.bodyFatPercentage}
          />
        </ScrollView>
      </Sheet>

      {/* A12 Partner Finder Offer Modal */}
      <PartnerFinderOfferModal
        visible={showPartnerOffer}
        onClose={() => {
          setShowPartnerOffer(false);
          router.replace('/today' as never);
        }}
        onAccept={() => {
          setShowPartnerOffer(false);
          router.replace('/today' as never);
        }}
        testID="modal-partner-finder-offer"
      />

      {/* A15 Invite Preview Modal */}
      <InvitePreviewModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onJoin={() => {
          setShowInviteModal(false);
        }}
        inviterName="Rahul"
        testID="modal-invite-preview"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  flexOne: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: space[4],
  },
  footer: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
    minHeight: 76,
    justifyContent: 'center',
  },
  sheetScroll: {
    maxHeight: 500,
  },
});
