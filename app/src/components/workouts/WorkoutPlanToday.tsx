import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { useSubscription } from '@/hooks/useSubscription';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, homeLayout, radius, space } from '@calipartner/ui';
import { weeklyPlanDayIndex, type PlanDay, type WeeklyPlanView } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalWeeklyPlan } from '@/services/weeklyPlanService';
import { t } from '@/i18n';

export function WorkoutPlanToday({
  localDate,
  onUse,
}: {
  localDate: string;
  onUse: (day: PlanDay) => void;
}) {
  const { colors: dark } = useAppearance();

  const { user } = useAuth();
  const subscription = useSubscription();
  const userId = user?.id;
  const router = useRouter();
  const [used, setUsed] = useState(false);
  const [plan, setPlan] = useState<WeeklyPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setUsed(false);
    setPlan(null);
    setLoading(true);
    setError(false);
    if (!userId) {
      setLoading(false);
      return;
    }
    void getPersonalWeeklyPlan(userId)
      .then((value) => {
        if (active) setPlan(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, localDate, retry]);
  const day =
    plan?.scope === 'day'
      ? plan.days[0]
      : plan?.days.find((item) => item.day === weeklyPlanDayIndex(localDate));
  return (
    <View
      testID="workout-today-plan"
      style={{
        padding: space[3],
        gap: space[3],
        borderWidth: 1,
        borderColor: dark.hairlineLit,
        borderRadius: radius.card,
        backgroundColor: dark.s1,
      }}
    >
      <Text variant="heading">{t('personalDay.todayPlan')}</Text>
      {loading ? (
        <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{t('homeRefresh.routineError')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => setRetry((value) => value + 1)}
            testID="workout-plan-retry"
          />
        </>
      ) : (
          plan
            ? !plan.full_access
            : !(
                subscription.hasActiveAccess &&
                ['plus', 'pro'].includes(subscription.currentTier) &&
                !subscription.isTrial
              )
        ) ? (
        <>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="workout-plan-concealed"
            style={{ gap: space[2], opacity: 0.4 }}
          >
            {[0, 1, 2].map((row) => (
              <View
                key={row}
                style={{
                  minHeight: homeLayout.iconSize,
                  backgroundColor: dark.s3,
                  borderRadius: radius.control,
                }}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            label={t('personalDay.unlockWorkout')}
            onPress={() => router.push('/paywall')}
            testID="workout-plan-upgrade"
          />
        </>
      ) : !day ? (
        <Text>{t('personalDay.noWorkoutPlan')}</Text>
      ) : !day.workout.exercises.length ? (
        <Text>{t('personalDay.restDay')}</Text>
      ) : (
        <>
          <Text>{day.workout.title}</Text>
          {day.workout.exercises.map((exercise, index) => (
            <View key={index} style={{ gap: space[1] }}>
              <Text>{exercise.name}</Text>
              <Text variant="bodyS" tabular>
                {t('personalDay.exercise', {
                  sets: exercise.sets,
                  reps: exercise.reps,
                  rest: exercise.rest_seconds,
                })}
              </Text>
            </View>
          ))}
          <Button
            variant="secondary"
            label={t('homeRefresh.startWorkout')}
            disabled={used}
            onPress={() => {
              if (!used) {
                setUsed(true);
                onUse(day);
              }
            }}
            testID="workout-use-today-plan"
          />
        </>
      )}
    </View>
  );
}
