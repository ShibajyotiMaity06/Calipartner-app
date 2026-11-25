import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DropletIcon,
  DumbbellIcon,
  FlameIcon,
  OptionTile,
  PulseIcon,
  ScaleIcon,
  Text,
  TimerIcon,
  colors,
  space,
} from '@calipartner/ui/v1';
import type { OnboardingTrackerKey } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';

interface TrackersStepProps {
  enabledTrackers: Record<OnboardingTrackerKey, boolean>;
  onToggleTracker: (key: OnboardingTrackerKey) => void;
}

const TRACKER_ROWS: readonly [
  readonly [OnboardingTrackerKey, OnboardingTrackerKey],
  readonly [OnboardingTrackerKey, OnboardingTrackerKey],
  readonly [OnboardingTrackerKey, OnboardingTrackerKey],
] = [
  ['calories', 'steps'],
  ['water', 'workouts'],
  ['weight', 'fasting'],
];

function renderTrackerTileIcon(key: OnboardingTrackerKey, selected: boolean) {
  const color = selected ? colors.apricot : colors.textMid;
  switch (key) {
    case 'calories':
      return <FlameIcon size={20} color={color} />;
    case 'steps':
      return <PulseIcon size={20} color={color} />;
    case 'water':
      return <DropletIcon size={20} color={color} />;
    case 'workouts':
      return <DumbbellIcon size={20} color={color} />;
    case 'weight':
      return <ScaleIcon size={20} color={color} />;
    case 'fasting':
      return <TimerIcon size={20} color={color} />;
  }
}

const TRACKER_COPY: Record<
  OnboardingTrackerKey,
  {
    title:
      | 'onboardingV1.trackCalories'
      | 'onboardingV1.trackSteps'
      | 'onboardingV1.trackWater'
      | 'onboardingV1.trackWorkouts'
      | 'onboardingV1.trackWeight'
      | 'onboardingV1.trackFasting';
    meta:
      | 'onboardingV1.trackCaloriesMeta'
      | 'onboardingV1.trackStepsMeta'
      | 'onboardingV1.trackWaterMeta'
      | 'onboardingV1.trackWorkoutsMeta'
      | 'onboardingV1.trackWeightMeta'
      | 'onboardingV1.trackFastingMeta';
  }
> = {
  calories: { title: 'onboardingV1.trackCalories', meta: 'onboardingV1.trackCaloriesMeta' },
  steps: { title: 'onboardingV1.trackSteps', meta: 'onboardingV1.trackStepsMeta' },
  water: { title: 'onboardingV1.trackWater', meta: 'onboardingV1.trackWaterMeta' },
  workouts: { title: 'onboardingV1.trackWorkouts', meta: 'onboardingV1.trackWorkoutsMeta' },
  weight: { title: 'onboardingV1.trackWeight', meta: 'onboardingV1.trackWeightMeta' },
  fasting: { title: 'onboardingV1.trackFasting', meta: 'onboardingV1.trackFastingMeta' },
};

export function TrackersStep({ enabledTrackers, onToggleTracker }: TrackersStepProps) {
  return (
    <View style={styles.root} testID="trackers-grid">
      <View style={styles.grid}>
        {TRACKER_ROWS.map((pair, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {pair.map((key) => {
              const selected = enabledTrackers[key];
              const copy = TRACKER_COPY[key];
              return (
                <OptionTile
                  key={key}
                  title={t(copy.title)}
                  meta={t(copy.meta)}
                  selected={selected}
                  icon={(isSelected) => renderTrackerTileIcon(key, isSelected)}
                  onPress={() => onToggleTracker(key)}
                  testID={`tracker-tile-${key}`}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text variant="meta" color="textLo" style={styles.caption}>
        {t('onboardingV1.trackFooterNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
  },
  grid: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  caption: {
    marginTop: space.xs,
  },
});
