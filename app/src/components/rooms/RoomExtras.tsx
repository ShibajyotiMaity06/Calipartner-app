import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, HiddenMetric, Text } from '@calipartner/ui';
import { loadRoomExtras, shareRoomWorkout } from '@/services/roomExtrasService';
import { generateClientUuid } from '@/services/foodService';
import { planStyles } from '@/components/onboarding/PlanPrimitives';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t } from '@/i18n';

export function RoomExtras({
  roomId,
  userId,
  canSend,
  refreshToken,
}: {
  roomId: string;
  userId: string;
  partnerId: string | null;
  canSend: boolean;
  refreshToken?: unknown;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRoomExtras>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const { isOnline } = useNetworkStatus();
  const requestIds = useRef(new Map<string, string>());
  const requestId = (key: string) => {
    if (!requestIds.current.has(key)) requestIds.current.set(key, generateClientUuid());
    return requestIds.current.get(key)!;
  };
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadRoomExtras(roomId));
    } catch {
      setError(t('common.errorBody'));
    }
  }, [roomId]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load, refreshToken]);
  const act = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
      await load();
    } catch (error) {
      setError(
        String((error as { message?: string }).message).includes('BOTH_PLUS_REQUIRED')
          ? t('setup.bothPlus')
          : t('common.errorBody'),
      );
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || isOnline === false;
  return (
    <View style={planStyles.section} testID="room-extras">
      <Text variant="heading">{t('setup.workoutsTogether')}</Text>
      {isOnline === false ? <Text>{t('setup.roomOnline')}</Text> : null}
      {error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void load()}
            testID="retry-room-extras"
          />
        </>
      ) : !data ? (
        <Text>{t('common.loading')}</Text>
      ) : null}
      {canSend ? (
        <Button
          variant="secondary"
          label={t('setup.shareWorkout')}
          onPress={() => setShowWorkouts(!showWorkouts)}
          testID="choose-shared-workout"
        />
      ) : (
        <Text variant="bodyS">{t('setup.chatPlus')}</Text>
      )}
      {canSend && showWorkouts ? (
        <>
          <Text variant="bodyS">{t('setup.shareWorkoutConsent')}</Text>
          {data?.workouts.length === 0 ? <Text>{t('setup.noWorkoutsToShare')}</Text> : null}
          {data?.workouts.map((workout) => (
            <Button
              key={workout.id}
              variant="secondary"
              label={`${t('setup.shareWorkout')}: ${workout.name ?? workout.local_date}`}
              disabled={disabled}
              testID={`share-workout-${workout.id}`}
              onPress={() =>
                void act(() =>
                  shareRoomWorkout(requestId(`${roomId}:${workout.id}`), roomId, workout.id),
                )
              }
            />
          ))}
        </>
      ) : null}
      {data?.shares.length === 0 ? (
        <Text variant="bodyS">{t('setup.noSharedWorkouts')}</Text>
      ) : null}
      {data?.shares.map((share) => (
        <Card key={share.id}>
          <View style={planStyles.gap}>
            <Text variant="heading">
              {share.sender}: {share.name ?? t('setup.workout')}
            </Text>
            <Text tabular>
              {share.local_date} · {t('setup.workoutMinutes', { minutes: share.duration_minutes })}
            </Text>
            {share.exercises.map((exercise, index) => (
              <View key={index}>
                <Text>{exercise.name}</Text>
                {exercise.sets.map((set, index) => (
                  <Text key={index} tabular variant="bodyS">
                    {t('setup.sharedSet', {
                      reps: set.reps ?? '—',
                      weight: set.weight_kg ?? '—',
                      seconds: set.duration_seconds ?? '—',
                      meters: set.distance_meters ?? '—',
                    })}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}
