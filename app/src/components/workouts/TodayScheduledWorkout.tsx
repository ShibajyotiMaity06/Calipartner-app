import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Text, space } from '@calipartner/ui';
import { weeklyPlanDayIndex, type WorkoutPlanView } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkoutPlan } from '@/services/workoutRoutineService';
import { WorkoutHubModal } from './WorkoutHubModal';
import { squadStyles } from '@/components/rooms/SquadViews';
import { t } from '@/i18n';

export function TodayScheduledWorkout({
  localDate,
  hasWorkout,
  onSaved,
}: {
  localDate: string;
  hasWorkout: boolean;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [logger, setLogger] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPlan(null);
      setLoading(!!userId);
      setError(false);
      if (userId)
        void getWorkoutPlan(userId)
          .then((next) => {
            if (active) setPlan(next);
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
    }, [userId, retry]),
  );
  if (!userId || hasWorkout) return null;
  if (loading) return <Text>{t('common.loading')}</Text>;
  if (error)
    return (
      <View style={{ gap: space[2] }}>
        <Text accessibilityRole="alert">{t('homeRefresh.routineError')}</Text>
        <Button
          variant="secondary"
          label={t('common.retry')}
          onPress={() => setRetry((value) => value + 1)}
          testID="home-routine-retry"
        />
      </View>
    );
  if (!plan || (!plan.id && !plan.needs_initial)) return null;
  const day = plan.days.find((item) => item.day === weeklyPlanDayIndex(localDate));
  if (day && !day.exercises.length) return null;
  return (
    <View style={squadStyles.card} testID="home-scheduled-workout">
      <Text variant="heading">{t('homeRefresh.scheduledRoutine')}</Text>
      {day ? (
        <>
          <Text variant="title2">{day.title}</Text>
          <Text tabular>{t('squadDesign.minutes', { count: day.minutes })}</Text>
          <Button
            variant="secondary"
            label={t('homeRefresh.startWorkout')}
            onPress={() => setLogger(true)}
            testID="home-start-scheduled-workout"
          />
        </>
      ) : plan.full_access ? (
        <Button
          variant="secondary"
          label={t('homeRefresh.startWorkout')}
          onPress={() => setLogger(true)}
          testID="home-start-scheduled-workout"
        />
      ) : (
        <Button
          variant="secondary"
          label={t('squadDesign.unlock')}
          onPress={() => router.push('/paywall')}
          testID="home-scheduled-workout-upgrade"
        />
      )}
      {logger && (
        <WorkoutHubModal
          visible
          defaultDate={localDate}
          onClose={() => setLogger(false)}
          onSaved={() => {
            setLogger(false);
            onSaved();
          }}
        />
      )}
    </View>
  );
}
