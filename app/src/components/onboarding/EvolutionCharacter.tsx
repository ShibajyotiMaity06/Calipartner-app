import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { onboardingLayout as layout, space, Text, useTheme } from '@calipartner/ui';
import type { Goal } from '@calipartner/core';
import type { CharacterGender } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';

// Metro resolves each bundled WebP from a static asset path.
/* eslint-disable @typescript-eslint/no-require-imports */
const images: Record<
  `${CharacterGender}_${Exclude<Goal, 'maintain'>}`,
  readonly ImageSourcePropType[]
> = {
  male_cut: [
    require('../../../assets/images/onboarding/male_cut_01.webp'),
    require('../../../assets/images/onboarding/male_cut_02.webp'),
    require('../../../assets/images/onboarding/male_cut_03.webp'),
    require('../../../assets/images/onboarding/male_cut_04.webp'),
    require('../../../assets/images/onboarding/male_cut_05.webp'),
    require('../../../assets/images/onboarding/male_cut_06.webp'),
    require('../../../assets/images/onboarding/male_cut_07.webp'),
    require('../../../assets/images/onboarding/male_cut_08.webp'),
    require('../../../assets/images/onboarding/male_cut_09.webp'),
    require('../../../assets/images/onboarding/male_cut_10.webp'),
    require('../../../assets/images/onboarding/male_cut_11.webp'),
  ],
  male_bulk: [
    require('../../../assets/images/onboarding/male_bulk_01.webp'),
    require('../../../assets/images/onboarding/male_bulk_02.webp'),
    require('../../../assets/images/onboarding/male_bulk_03.webp'),
    require('../../../assets/images/onboarding/male_bulk_04.webp'),
    require('../../../assets/images/onboarding/male_bulk_05.webp'),
    require('../../../assets/images/onboarding/male_bulk_06.webp'),
    require('../../../assets/images/onboarding/male_bulk_07.webp'),
    require('../../../assets/images/onboarding/male_bulk_08.webp'),
    require('../../../assets/images/onboarding/male_bulk_09.webp'),
    require('../../../assets/images/onboarding/male_bulk_10.webp'),
    require('../../../assets/images/onboarding/male_bulk_11.webp'),
  ],
  female_cut: [
    require('../../../assets/images/onboarding/female_cut_01.webp'),
    require('../../../assets/images/onboarding/female_cut_02.webp'),
    require('../../../assets/images/onboarding/female_cut_03.webp'),
    require('../../../assets/images/onboarding/female_cut_04.webp'),
    require('../../../assets/images/onboarding/female_cut_05.webp'),
    require('../../../assets/images/onboarding/female_cut_06.webp'),
    require('../../../assets/images/onboarding/female_cut_07.webp'),
    require('../../../assets/images/onboarding/female_cut_08.webp'),
    require('../../../assets/images/onboarding/female_cut_09.webp'),
    require('../../../assets/images/onboarding/female_cut_10.webp'),
    require('../../../assets/images/onboarding/female_cut_11.webp'),
  ],
  female_bulk: [
    require('../../../assets/images/onboarding/female_bulk_01.webp'),
    require('../../../assets/images/onboarding/female_bulk_02.webp'),
    require('../../../assets/images/onboarding/female_bulk_03.webp'),
    require('../../../assets/images/onboarding/female_bulk_04.webp'),
    require('../../../assets/images/onboarding/female_bulk_05.webp'),
    require('../../../assets/images/onboarding/female_bulk_06.webp'),
    require('../../../assets/images/onboarding/female_bulk_07.webp'),
    require('../../../assets/images/onboarding/female_bulk_08.webp'),
    require('../../../assets/images/onboarding/female_bulk_09.webp'),
    require('../../../assets/images/onboarding/female_bulk_10.webp'),
    require('../../../assets/images/onboarding/female_bulk_11.webp'),
  ],
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function EvolutionCharacter({
  gender,
  goal,
  stage,
}: {
  gender: CharacterGender | null;
  goal: Goal;
  stage: number;
}) {
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(null);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const source = gender && goal !== 'maintain' ? images[`${gender}_${goal}`][stage - 1] : undefined;
  if (!source) return null;
  const imageHeight = Math.min(
    stage === 11 ? layout.characterSummaryHeight : layout.characterHeight,
    Math.max(layout.characterMinHeight, height * 0.44),
  );
  return (
    <View style={styles.frame}>
      {failedSource === source ? (
        <Text variant="bodyS" color={colors.textMid}>
          {t('characterSetup.imageUnavailable')}
        </Text>
      ) : (
        <Image
          source={source}
          resizeMode="contain"
          style={[styles.image, { height: imageHeight }]}
          accessible
          accessibilityLabel={t('characterSetup.imageAlt', { stage })}
          onError={() => setFailedSource(source)}
          testID={`onboarding-character-${stage}`}
        />
      )}
      {stage === 11 && (
        <Text variant="bodyS" color={colors.textMid} style={styles.caption}>
          {t('characterSetup.imageNote')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  image: { width: '100%' },
  caption: { textAlign: 'center' },
});
