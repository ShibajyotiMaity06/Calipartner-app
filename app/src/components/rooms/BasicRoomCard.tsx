import React from 'react';
import { View } from 'react-native';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { Card, HiddenMetric, Text } from '@calipartner/ui';
import { planStyles } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export function BasicRoomCard({ members }: { members: RoomMemberSnapshot[] }) {
  return (
    <View style={planStyles.section} testID="basic-room-summary">
      {members.map((person) => {
        const { metrics } = person;
        return (
          <Card key={person.user_id}>
            <View style={planStyles.gap}>
              <Text variant="heading">{person.nickname}</Text>
              {typeof metrics.calories === 'number' ? (
                <Text tabular>{t('setup.kcalDay', { kcal: metrics.calories })}</Text>
              ) : (
                <HiddenMetric label={t('setup.nutritionPrivate')} />
              )}
              {metrics.macros === 'locked' ? (
                <HiddenMetric label={t('setup.nutritionPrivate')} />
              ) : (
                <Text tabular>
                  {t('setup.sharedMacros', {
                    protein: metrics.macros.protein,
                    carbs: metrics.macros.carbs,
                    fiber: metrics.macros.fiber ?? 0,
                  })}
                </Text>
              )}
              {metrics.logged_today === 'locked' ? (
                <HiddenMetric label={t('setup.logPrivate')} />
              ) : (
                <Text>
                  {t(metrics.logged_today ? 'setup.loggedToday' : 'setup.notLoggedToday')}
                </Text>
              )}
              {metrics.workout_status === 'locked' ? (
                <HiddenMetric label={t('setup.workoutPrivate')} />
              ) : (
                <Text>
                  {t(
                    metrics.workout_status.worked_out
                      ? 'setup.trainedToday'
                      : 'setup.notTrainedToday',
                  )}
                </Text>
              )}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
