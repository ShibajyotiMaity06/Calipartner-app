import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BrandRingMark,
  Card,
  DumbbellIcon,
  HeartIcon,
  PulseIcon,
  ScaleIcon,
  ScreenTitle,
  SwitchRow,
  Text,
  borders,
  colors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

interface HealthSyncStepProps {
  options: {
    steps: boolean;
    weight: boolean;
    workouts: boolean;
  };
  onChangeOption: (key: 'steps' | 'weight' | 'workouts', value: boolean) => void;
}

export function HealthSyncStep({ options, onChangeOption }: HealthSyncStepProps) {
  const isWeb = Platform.OS === 'web';
  const isIos = Platform.OS === 'ios';
  const subtitleKey = isWeb
    ? 'onboardingV1.healthSubtitleWeb'
    : isIos
      ? 'onboardingV1.healthSubtitleIos'
      : 'onboardingV1.healthSubtitleAndroid';

  return (
    <View style={styles.root} testID="health-sync-step">
      <ScreenTitle
        eyebrow={t('onboardingV1.healthEyebrow')}
        title={t('onboardingV1.healthTitle')}
        accentWord={t('onboardingV1.healthAccent')}
        subtitle={t(subtitleKey)}
        spacingBottom={space.xl}
        testID="onboarding-title"
      />

      <View style={styles.bridgeRow} accessible={false}>
        <View style={styles.bridgeTile}>
          <HeartIcon size={24} color={colors.textMid} />
        </View>
        <View style={styles.dotsRow}>
          <View style={[styles.dot, styles.dotMuted]} />
          <View style={[styles.dot, styles.dotMid]} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>
        <View style={styles.bridgeTile}>
          <BrandRingMark size={24} />
        </View>
      </View>

      {isWeb ? (
        <Card variant="default" style={styles.webCard} testID="health-sync-web-card">
          <Text variant="rowTitle" color="textHi" style={styles.webTitle}>
            {t('onboardingV1.healthWebTitle')}
          </Text>
          <Text variant="body" color="textMid">
            {t('onboardingV1.healthWebBody')}
          </Text>
        </Card>
      ) : (
        <>
          <Card variant="default" style={styles.switchCard} testID="health-sync-options-card">
            <SwitchRow
              title={t('onboardingV1.healthStepsTitle')}
              meta={t('onboardingV1.healthStepsDesc')}
              icon={<PulseIcon size={20} color={colors.textMid} />}
              value={options.steps}
              onValueChange={(value) => onChangeOption('steps', value)}
              testID="health-sync-switch-steps"
            />
            <SwitchRow
              title={t('onboardingV1.healthWeightTitle')}
              meta={t('onboardingV1.healthWeightDesc')}
              icon={<ScaleIcon size={20} color={colors.textMid} />}
              value={options.weight}
              onValueChange={(value) => onChangeOption('weight', value)}
              testID="health-sync-switch-weight"
            />
            <SwitchRow
              title={t('onboardingV1.healthWorkoutsTitle')}
              meta={t('onboardingV1.healthWorkoutsDesc')}
              icon={<DumbbellIcon size={20} color={colors.textMid} />}
              value={options.workouts}
              onValueChange={(value) => onChangeOption('workouts', value)}
              showDivider={false}
              testID="health-sync-switch-workouts"
            />
          </Card>

          <Text variant="meta" color="textLo" style={styles.note}>
            {t('onboardingV1.healthFooterNote')}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bridgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  bridgeTile: {
    width: 60,
    height: 60,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
  },
  dotMuted: {
    backgroundColor: colors.textOff,
  },
  dotMid: {
    backgroundColor: colors.textLo,
  },
  dotActive: {
    backgroundColor: colors.apricot,
  },
  switchCard: {
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  webCard: {
    padding: space.xl,
    gap: space.sm,
  },
  webTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  note: {
    marginTop: space.md,
  },
});
