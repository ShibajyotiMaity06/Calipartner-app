import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Sex } from '@calipartner/core';
import { Text, SwitchRow, Button, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound, playToggleSound } from '@/lib/sound';

interface HealthScreeningStepProps {
  sex?: Sex;
  pregnantOrBreastfeeding: boolean;
  hasDiabetesOrMedication: boolean;
  hasEatingDisorderHistory: boolean;
  onChangePregnant: (val: boolean) => void;
  onChangeDiabetes: (val: boolean) => void;
  onChangeEatingDisorder: (val: boolean) => void;
  onSkip: () => void;
}

export function HealthScreeningStep({
  sex = 'male',
  pregnantOrBreastfeeding,
  hasDiabetesOrMedication,
  hasEatingDisorderHistory,
  onChangePregnant,
  onChangeDiabetes,
  onChangeEatingDisorder,
  onSkip,
}: HealthScreeningStepProps) {
  const handleTogglePregnant = (val: boolean) => {
    playToggleSound();
    onChangePregnant(val);
  };

  const handleToggleDiabetes = (val: boolean) => {
    playToggleSound();
    onChangeDiabetes(val);
  };

  const handleToggleEatingDisorder = (val: boolean) => {
    playToggleSound();
    onChangeEatingDisorder(val);
  };

  const handleSkip = () => {
    playClickSound();
    onSkip();
  };

  return (
    <View style={styles.container}>
      {/* Privacy note banner */}
      <View style={styles.privacyBanner} testID="health-screening-why-banner">
        <Text variant="body" color={dark.textHi} style={styles.privacyTitle}>
          A few private questions
        </Text>
        <Text variant="label" color={dark.textMid} style={styles.privacyBody}>
          Used only to hide fasting and show cautions. Never shared with your room.
        </Text>
      </View>

      {/* Three SwitchRows (Spec A08) */}
      <View style={styles.switchList}>
        {/* Question 1: Pregnant / Breastfeeding (Hidden for biological males) */}
        {sex !== 'male' && (
          <SwitchRow
            title={t('onboarding.healthScreening.pregnantLabel')}
            consequence={t('onboarding.healthScreening.pregnantDesc')}
            value={pregnantOrBreastfeeding}
            onValueChange={handleTogglePregnant}
            testID="screening-toggle-pregnant"
            style={styles.switchCard}
          />
        )}

        {/* Question 2: Diabetes / Medication */}
        <SwitchRow
          title={t('onboarding.healthScreening.diabetesLabel')}
          consequence={t('onboarding.healthScreening.diabetesDesc')}
          value={hasDiabetesOrMedication}
          onValueChange={handleToggleDiabetes}
          testID="screening-toggle-diabetes"
          style={styles.switchCard}
        />

        {/* Question 3: History of Eating Disorder */}
        <SwitchRow
          title={t('onboarding.healthScreening.edLabel')}
          consequence={t('onboarding.healthScreening.edDesc')}
          value={hasEatingDisorderHistory}
          onValueChange={handleToggleEatingDisorder}
          testID="screening-toggle-ed"
          style={styles.switchCard}
        />
      </View>

      {/* Prominent Skip button for optional health check (Spec A08) */}
      <View style={styles.skipContainer}>
        <Button
          variant="secondary"
          size="md"
          label={t('onboarding.skip')}
          onPress={handleSkip}
          testID="btn-skip-health-screening"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    gap: space[4],
    paddingTop: space[2],
  },
  privacyBanner: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[1],
  },
  privacyTitle: {
    fontWeight: '600',
  },
  privacyBody: {
    lineHeight: 18,
  },
  switchList: {
    gap: space[3],
  },
  switchCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
  },
  skipContainer: {
    marginTop: space[2],
    alignItems: 'center',
  },
});
