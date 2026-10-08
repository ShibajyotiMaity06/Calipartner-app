import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Sex } from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound, playToggleSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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
  const { colors } = useTheme();

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
      {/* "Why we ask this" Privacy Banner */}
      <View
        style={[
          styles.privacyBanner,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
        testID="health-screening-why-banner"
      >
        <Text style={[styles.privacyTitle, { color: colors.text }]}>
          {t('onboarding.healthScreening.whyWeAskTitle')}
        </Text>
        <Text style={[styles.privacyBody, { color: colors.textMuted }]}>
          {t('onboarding.healthScreening.whyWeAskBody')}
        </Text>
      </View>

      {/* Question 1: Pregnant / Breastfeeding (Hidden for biological males) */}
      {sex !== 'male' && (
        <View
          style={[
            styles.questionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.textColumn}>
            <Text style={[styles.questionLabel, { color: colors.text }]}>
              {t('onboarding.healthScreening.pregnantLabel')}
            </Text>
            <Text style={[styles.questionDesc, { color: colors.textMuted }]}>
              {t('onboarding.healthScreening.pregnantDesc')}
            </Text>
          </View>
          <Switch
            testID="screening-toggle-pregnant"
            value={pregnantOrBreastfeeding}
            onValueChange={handleTogglePregnant}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surface}
            accessibilityLabel={t('onboarding.healthScreening.pregnantLabel')}
          />
        </View>
      )}

      {/* Question 2: Diabetes / Medication */}
      <View
        style={[
          styles.questionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.textColumn}>
          <Text style={[styles.questionLabel, { color: colors.text }]}>
            {t('onboarding.healthScreening.diabetesLabel')}
          </Text>
          <Text style={[styles.questionDesc, { color: colors.textMuted }]}>
            {t('onboarding.healthScreening.diabetesDesc')}
          </Text>
        </View>
        <Switch
          testID="screening-toggle-diabetes"
          value={hasDiabetesOrMedication}
          onValueChange={handleToggleDiabetes}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
          accessibilityLabel={t('onboarding.healthScreening.diabetesLabel')}
        />
      </View>

      {/* Question 3: History of Eating Disorder */}
      <View
        style={[
          styles.questionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.textColumn}>
          <Text style={[styles.questionLabel, { color: colors.text }]}>
            {t('onboarding.healthScreening.edLabel')}
          </Text>
          <Text style={[styles.questionDesc, { color: colors.textMuted }]}>
            {t('onboarding.healthScreening.edDesc')}
          </Text>
        </View>
        <Switch
          testID="screening-toggle-ed"
          value={hasEatingDisorderHistory}
          onValueChange={handleToggleEatingDisorder}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
          accessibilityLabel={t('onboarding.healthScreening.edLabel')}
        />
      </View>

      {/* Skip / Prefer not to say button */}
      <View style={styles.skipContainer}>
        <Pressable
          testID="btn-skip-screening"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.healthScreening.preferNotToSay')}
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
            },
          ]}
        >
          <Text style={[styles.skipButtonText, { color: colors.textMuted }]}>
            {t('onboarding.healthScreening.preferNotToSay')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  privacyBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  privacyTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  privacyBody: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  questionCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 80,
  },
  textColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  questionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  questionDesc: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  skipContainer: {
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  skipButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
