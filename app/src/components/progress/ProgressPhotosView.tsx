import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, space } from '@calipartner/ui';
import { isFeatureAllowed } from '@calipartner/core';
import { useSubscription } from '@/hooks/useSubscription';
import { PhotoVault } from '@/components/trackers/ProgressPhotosModal';
import { LoadingState } from '@/components/LoadingState';
import { t } from '@/i18n';
export function ProgressPhotosView({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const { currentTier, hasActiveAccess, loading, error, refresh } = useSubscription();
  const router = useRouter();
  if (loading && !hasActiveAccess) return <LoadingState />;
  if (error && !hasActiveAccess)
    return (
      <Button
        variant="secondary"
        label={t('common.retry')}
        onPress={() => void refresh()}
        testID="photos-access-retry"
      />
    );
  if (!isFeatureAllowed('progress_photos', hasActiveAccess ? currentTier : 'free'))
    return (
      <View style={{ gap: space[3] }} testID="progress-photos-locked">
        <Text variant="heading">{t('progressRefresh.photoTitle')}</Text>
        <Text>{t('progressRefresh.photoBody')}</Text>
        <Button
          label={t('brandRepair.seePlans')}
          onPress={() => router.push('/paywall')}
          testID="progress-photos-upgrade"
        />
      </View>
    );
  return (
    <PhotoVault
      embedded
      visible
      startDate={startDate}
      endDate={endDate}
      onClose={() => {}}
      testID="progress-photo-vault"
    />
  );
}
