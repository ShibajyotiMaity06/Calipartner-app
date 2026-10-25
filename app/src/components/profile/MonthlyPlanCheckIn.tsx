import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { isMonthlyReviewDue } from '@calipartner/core';
import { Button, Card, Text } from '@calipartner/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { planStyles } from '@/components/onboarding/PlanPrimitives';

export function MonthlyPlanCheckIn() {
  const { entitlement } = useSubscription();
  const { currentGoalProfile } = useTargets();
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  if (
    dismissed ||
    !currentGoalProfile ||
    !isMonthlyReviewDue(currentGoalProfile.confirmed_at, entitlement)
  )
    return null;
  return (
    <Card testID="monthly-plan-check-in">
      <View style={planStyles.gap}>
        <Text variant="heading">{t('setup.reviewMonthly')}</Text>
        <Text variant="bodyS">{t('setup.reviewMonthlyBody')}</Text>
        <Button
          variant="secondary"
          label={t('setup.reviewMonthlyAction')}
          onPress={() => router.push('/plan-review' as never)}
          testID="review-monthly-plan"
        />
        <Button
          variant="tertiary"
          label={t('setup.reviewMonthlyLater')}
          onPress={() => setDismissed(true)}
          testID="dismiss-monthly-plan"
        />
      </View>
    </Card>
  );
}
