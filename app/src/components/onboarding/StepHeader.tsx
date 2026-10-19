import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text, ChevronLeftIcon, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

interface StepHeaderProps {
  currentStepIndex: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  canGoBack: boolean;
  onSkip?: () => void;
  canSkip?: boolean;
}

export function StepHeader({
  currentStepIndex,
  totalSteps,
  title,
  subtitle,
  onBack,
  canGoBack,
  onSkip,
  canSkip,
}: StepHeaderProps) {
  // 4px progress bar calculation
  const progressPercent = Math.min(100, Math.max(0, ((currentStepIndex + 1) / totalSteps) * 100));

  const handleBack = () => {
    playClickSound();
    if (onBack) onBack();
  };

  const handleSkip = () => {
    playClickSound();
    if (onSkip) onSkip();
  };

  return (
    <View style={styles.container} accessible accessibilityRole="header">
      {/* 4px Thin Progress Bar at Top (Spec Part 7.A) */}
      <View
        style={styles.progressTrack}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: totalSteps, now: currentStepIndex + 1 }}
      >
        <View
          testID="onboarding-progress-fill"
          style={[styles.progressFill, { width: `${progressPercent}%` }]}
        />
      </View>

      {/* Top row with Back button, Step indicator, and optional Skip */}
      <View style={styles.topRow}>
        {canGoBack && onBack ? (
          <TouchableOpacity
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            testID="btn-onboarding-back"
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeftIcon size={20} color={dark.textHi} />
            <Text variant="body" color={dark.textHi} style={styles.backText}>
              {t('onboarding.back')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        <Text
          variant="label"
          color={dark.textLo}
          testID="step-indicator-text"
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

        {canSkip && onSkip ? (
          <TouchableOpacity
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            testID="btn-onboarding-skip"
            style={styles.skipButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text variant="bodyS" color={dark.textMid} style={styles.skipText}>
              {t('onboarding.skip')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
      </View>

      {/* Title & Subtitle */}
      <View style={styles.textContainer}>
        <Text
          variant="title1"
          color={dark.textHi}
          style={styles.title}
          testID="onboarding-step-title"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="body"
            color={dark.textMid}
            style={styles.subtitle}
            testID="onboarding-step-subtitle"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
    gap: space[2],
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: dark.s2,
    marginBottom: space[1],
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 60,
  },
  backText: {
    fontWeight: '500',
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  skipText: {
    fontWeight: '500',
  },
  textContainer: {
    paddingTop: space[1],
    gap: space[1],
  },
  title: {
    letterSpacing: -0.4,
  },
  subtitle: {
    lineHeight: 22,
  },
});
