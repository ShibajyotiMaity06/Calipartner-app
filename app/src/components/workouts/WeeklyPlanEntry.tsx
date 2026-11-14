import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Button, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { useSquadStyles } from '@/components/rooms/SquadViews';

export function WeeklyPlanEntry({
  workout = false,
  onOpen,
}: {
  workout?: boolean;
  onOpen?: () => void;
}) {
  const styles = useSquadStyles();

  const router = useRouter();
  return (
    <View style={styles.card} testID="preferred-weekly-plan-entry">
      <Text variant="heading">{t(workout ? 'fixNovember.preferred' : 'fixNovember.weekly')}</Text>
      <Text variant="bodyS">{t('fixNovember.empty')}</Text>
      <Button
        variant="secondary"
        label={t('fixNovember.open')}
        onPress={() => {
          onOpen?.();
          router.push('/weekly-plan' as Href);
        }}
        testID="open-personal-weekly-plan"
      />
    </View>
  );
}
