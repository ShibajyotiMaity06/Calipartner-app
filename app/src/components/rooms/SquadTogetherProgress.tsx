import React from 'react';
import { View } from 'react-native';
import { Text } from '@calipartner/ui';
import { squadTogetherProgress, type RankedSquadMember } from '@calipartner/core';
import { ProgressTrack, squadStyles } from './SquadViews';
import { t } from '@/i18n';

export function SquadTogetherProgress({ members }: { members: RankedSquadMember[] }) {
  const progress = squadTogetherProgress(members);
  return (
    <View style={squadStyles.card} testID="squad-together-progress">
      <Text variant="heading">{t('homeRefresh.togetherToday')}</Text>
      <Text tabular>
        {progress.percent === null
          ? t('squadDesign.noGoals')
          : t('homeRefresh.squadTogetherPercent', { percent: progress.percent })}
      </Text>
      <ProgressTrack percent={progress.percent} />
      <Text variant="bodyS">
        {t('homeRefresh.squadTogetherCoverage', {
          count: progress.available,
          total: progress.total,
        })}
      </Text>
    </View>
  );
}
