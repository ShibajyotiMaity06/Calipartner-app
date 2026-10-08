import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface StepHeaderProps {
  currentStepIndex: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  canGoBack: boolean;
}

export function StepHeader({
  currentStepIndex,
  totalSteps,
  title,
  subtitle,
  onBack,
  canGoBack,
}: StepHeaderProps) {
  const { colors } = useTheme();
  const progressPercent = Math.min(100, Math.max(0, ((currentStepIndex + 1) / totalSteps) * 100));

  const handleBack = () => {
    playClickSound();
    if (onBack) onBack();
  };

  return (
    <View style={styles.container} accessible accessibilityRole="header">
      {/* Top row with Back button and Step indicator */}
      <View style={styles.topRow}>
        {canGoBack && onBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            testID="btn-onboarding-back"
            style={({ pressed }) => [
              styles.backButton,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.surface },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.backText, { color: colors.text }]}>← {t('onboarding.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        <Text
          testID="step-indicator-text"
          style={[styles.stepIndicator, { color: colors.textMuted }]}
          accessibilityLabel={t('onboarding.stepIndicator', {
            current: currentStepIndex + 1,
            total: totalSteps,
          })}
        >
          {t('onboarding.stepIndicator', {
            current: currentStepIndex + 1,
            total: totalSteps,
          })}
        </Text>
      </View>

      {/* Progress Bar */}
      <View
        style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: totalSteps, now: currentStepIndex + 1 }}
      >
        <View
          testID="onboarding-progress-fill"
          style={[
            styles.progressFill,
            { width: `${progressPercent}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>

      {/* Title & Subtitle */}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]} testID="onboarding-step-title">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} testID="onboarding-step-subtitle">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPlaceholder: {
    width: 60,
  },
  backText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  stepIndicator: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  textContainer: {
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
