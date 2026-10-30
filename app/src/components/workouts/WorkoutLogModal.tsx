import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  Button,
  Card,
  dark,
  onboardingLayout as layout,
  radius,
  space,
  Text,
  type as typography,
} from '@calipartner/ui';
import {
  addDaysToDateString,
  formatCalendarDate,
  validWorkoutLog,
  type WorkoutWithDetails,
} from '@calipartner/core';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useRooms } from '@/hooks/useRooms';
import { useSubscription } from '@/hooks/useSubscription';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { logWorkoutExercise } from '@/services/workoutLogService';
import { shareRoomWorkout } from '@/services/roomExtrasService';
import { flushOutbox } from '@/services/syncService';
import { generateClientUuid } from '@/services/foodService';
import { t } from '@/i18n';
import exercises from '@/data/exercises_seed.json';

type Category = 'upper' | 'lower' | 'core' | 'full';
const groups: Record<Category, string[]> = {
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs'],
  core: ['core'],
  full: ['full_body'],
};
export interface WorkoutLogModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenProgress?: () => void;
  testID?: string;
  initialCategory?: Category;
}
export function WorkoutLogModal({
  visible,
  onClose,
  testID = 'workout-log-modal',
  initialCategory,
}: WorkoutLogModalProps) {
  const { localDate: today } = useCurrentLocalDate();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { hasActiveAccess } = useSubscription();
  const [date, setDate] = useState(today);
  const { workouts, loading, error: loadError, refresh } = useWorkouts(date);
  const { rooms, loading: roomsLoading, error: roomsError, refresh: refreshRooms } = useRooms();
  const [stage, setStage] = useState<'diary' | 'category' | 'exercise' | 'sets'>('diary');
  const [category, setCategory] = useState<Category>('upper');
  const [query, setQuery] = useState('');
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState([{ reps: '', weight: '' }]);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<WorkoutWithDetails | null>(null);
  const [sharing, setSharing] = useState(false),
    [shared, setShared] = useState(false);
  const lock = useRef(false);
  const shareIds = useRef(new Map<string, string>());
  useEffect(() => {
    if (!visible) return;
    setDate(today);
    setStage(initialCategory ? 'exercise' : 'diary');
    if (initialCategory) setCategory(initialCategory);
    setQuery('');
    setSaved(null);
    setSharing(false);
    setShared(false);
    setError(null);
  }, [visible, today, initialCategory]);
  const closeStep = () => {
    if (busy) return;
    if (sharing) setSharing(false);
    else if (stage === 'sets') setStage('exercise');
    else if (stage === 'exercise') setStage('category');
    else if (stage === 'category') setStage('diary');
    else onClose();
  };
  useBrowserModalBack(visible, onClose, {
    depth: ['diary', 'category', 'exercise', 'sets'].indexOf(stage),
    onDepthChange: (depth) =>
      setStage((['diary', 'category', 'exercise', 'sets'] as const)[depth] ?? 'diary'),
  });
  const save = async () => {
    if (lock.current) return;
    const values = sets.map((set) => ({ reps: Number(set.reps), weightKg: Number(set.weight) }));
    if (!validWorkoutLog(values, Number(minutes))) {
      setError(t('repairs.workoutInvalid'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const logged = await logWorkoutExercise(await getDb(), {
        userId: user?.id ?? 'guest-user',
        localDate: date,
        exerciseName: exercise,
        durationMinutes: Number(minutes),
        sets: values,
      });
      setSaved(logged);
      setStage('diary');
      setSharing(false);
      setShared(false);
      await refresh();
      if (isOnline && user) void flushOutbox(await getDb(), getSupabase()).catch(() => {});
    } catch {
      setError(t('repairs.actionError'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const share = async (roomId: string) => {
    if (!saved || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const db = await getDb();
      if (!isOnline) throw new Error('SYNC_PENDING');
      await flushOutbox(db, getSupabase());
      const rows = (
        await Promise.all(
          ['local_workouts', 'local_workout_exercises', 'local_workout_sets'].map((table) =>
            db.getAllAsync<{ sync_state: string }>(
              `SELECT sync_state FROM ${table} WHERE ${table === 'local_workouts' ? 'id' : 'workout_id'} = ?`,
              [saved.id],
            ),
          ),
        )
      ).flat();
      if (rows.some((row) => row.sync_state !== 'synced')) throw new Error('SYNC_PENDING');
      const key = `${saved.id}:${roomId}`;
      if (!shareIds.current.has(key)) shareIds.current.set(key, generateClientUuid());
      await shareRoomWorkout(shareIds.current.get(key)!, roomId, saved.id);
      setShared(true);
      setSharing(false);
    } catch (failure) {
      const message = String((failure as Error).message);
      setError(t(message.includes('PRIVACY') ? 'repairs.sharePrivacy' : 'repairs.sharePending'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const filtered = exercises.filter(
    (item) =>
      groups[category].includes(item.muscle_group) &&
      item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeStep} testID={testID}>
      <SafeAreaView style={styles.screen}>
        <Button
          variant="tertiary"
          label={t('repairs.back')}
          onPress={closeStep}
          disabled={busy}
          testID="btn-workout-log-back"
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title2">{t('repairs.workoutLog')}</Text>
          <View style={styles.date}>
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('capture.previousDay')}
              disabled={busy}
              onPress={() => setDate(addDaysToDateString(date, -1))}
              testID="workout-previous-day"
            />
            <Text tabular>{formatCalendarDate(date)}</Text>
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('capture.nextDay')}
              disabled={busy}
              onPress={() => setDate(addDaysToDateString(date, 1))}
              testID="workout-next-day"
            />
          </View>
          {error ? (
            <Text color={dark.danger} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {stage === 'diary' ? (
            <>
              <Button
                label={t('repairs.logWorkout')}
                onPress={() => {
                  setStage('category');
                  setError(null);
                }}
                testID="btn-log-workout"
              />
              {loading ? (
                <Text>{t('common.loading')}</Text>
              ) : loadError ? (
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void refresh()}
                />
              ) : !workouts.length ? (
                <Text>{t('repairs.workoutEmpty')}</Text>
              ) : null}
              {workouts.map((workout) => (
                <Card key={workout.id} testID={`logged-workout-${workout.id}`}>
                  <Text variant="heading">{workout.name}</Text>
                  {workout.exercises.map((item) => (
                    <View key={item.id} style={styles.gap}>
                      <Text>{item.exercise_name}</Text>
                      {(item.sets ?? []).map((set) => (
                        <Text tabular key={set.id}>
                          {t('repairs.setLabel', {
                            number: set.set_number,
                            weight: set.weight_kg ?? 0,
                            reps: set.reps ?? 0,
                          })}
                        </Text>
                      ))}
                    </View>
                  ))}
                  {hasActiveAccess ? (
                    <Button
                      variant="secondary"
                      label={t('repairs.shareWorkout')}
                      onPress={() => {
                        setSaved(workout);
                        setSharing(true);
                        setShared(false);
                      }}
                      testID={`share-saved-workout-${workout.id}`}
                    />
                  ) : null}
                </Card>
              ))}
              {saved ? (
                <Text accessibilityLiveRegion="polite">
                  {t(shared ? 'repairs.sharedWorkout' : 'repairs.savedWorkout')}
                </Text>
              ) : null}
              {sharing ? (
                <View style={styles.gap}>
                  <Text variant="heading">{t('repairs.chooseRoom')}</Text>
                  {roomsLoading ? (
                    <Text>{t('common.loading')}</Text>
                  ) : roomsError ? (
                    <Button
                      variant="secondary"
                      label={t('common.retry')}
                      onPress={() => void refreshRooms()}
                    />
                  ) : !rooms.length ? (
                    <Text>{t('roomAudit.noRooms')}</Text>
                  ) : null}
                  {rooms.map((room) => (
                    <Button
                      key={room.id}
                      variant="secondary"
                      label={room.name}
                      disabled={busy || !isOnline || room.state !== 'active'}
                      onPress={() => void share(room.id)}
                      testID={`share-workout-room-${room.id}`}
                    />
                  ))}
                  {!isOnline ? <Text>{t('repairs.sharePending')}</Text> : null}
                </View>
              ) : null}
            </>
          ) : stage === 'category' ? (
            <>
              <Text variant="heading">{t('repairs.categories')}</Text>
              {(Object.keys(groups) as Category[]).map((value) => (
                <Button
                  key={value}
                  variant="secondary"
                  label={t(`repairs.${value}`)}
                  onPress={() => {
                    setCategory(value);
                    setQuery('');
                    setStage('exercise');
                  }}
                  testID={`workout-category-${value}`}
                />
              ))}
            </>
          ) : stage === 'exercise' ? (
            <>
              <Text variant="heading">{t('repairs.exercises')}</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('repairs.searchExercises')}
                accessibilityLabel={t('repairs.searchExercises')}
                placeholderTextColor={dark.textLo}
                style={styles.input}
                testID="workout-exercise-search"
              />
              {!filtered.length ? <Text>{t('repairs.noExercises')}</Text> : null}
              {filtered.map((item) => (
                <Button
                  key={item.id}
                  variant="secondary"
                  label={item.name}
                  onPress={() => {
                    setExercise(item.name);
                    setSets([{ reps: '', weight: '' }]);
                    setMinutes('');
                    setStage('sets');
                    setError(null);
                  }}
                  testID={`workout-exercise-${item.id}`}
                />
              ))}
            </>
          ) : (
            <>
              <Text variant="heading">{exercise}</Text>
              <Text>{t('repairs.minutes')}</Text>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                editable={!busy}
                style={styles.input}
                accessibilityLabel={t('repairs.minutes')}
                testID="workout-duration"
              />
              {sets.map((set, index) => (
                <Card key={index}>
                  <Text tabular>
                    {t('repairs.sets')} {index + 1}
                  </Text>
                  <Text>{t('repairs.reps')}</Text>
                  <TextInput
                    value={set.reps}
                    onChangeText={(reps) =>
                      setSets((all) =>
                        all.map((item, i) => (i === index ? { ...item, reps } : item)),
                      )
                    }
                    keyboardType="number-pad"
                    editable={!busy}
                    style={styles.input}
                    accessibilityLabel={`${t('repairs.reps')} ${index + 1}`}
                    testID={`workout-reps-${index}`}
                  />
                  <Text>{t('repairs.weight')}</Text>
                  <TextInput
                    value={set.weight}
                    onChangeText={(weight) =>
                      setSets((all) =>
                        all.map((item, i) => (i === index ? { ...item, weight } : item)),
                      )
                    }
                    keyboardType="decimal-pad"
                    editable={!busy}
                    style={styles.input}
                    accessibilityLabel={`${t('repairs.weight')} ${index + 1}`}
                    testID={`workout-weight-${index}`}
                  />
                  {sets.length > 1 ? (
                    <Button
                      variant="tertiary"
                      label={t('repairs.removeSet', { number: index + 1 })}
                      onPress={() => setSets((all) => all.filter((_, i) => i !== index))}
                      disabled={busy}
                      testID={`workout-remove-set-${index}`}
                    />
                  ) : null}
                </Card>
              ))}
              <Button
                variant="secondary"
                label={t('repairs.addSet')}
                disabled={busy || sets.length >= 50}
                onPress={() => setSets((all) => [...all, { reps: '', weight: '' }])}
                testID="workout-add-set"
              />
              <Button
                label={t('repairs.saveWorkout')}
                disabled={busy}
                onPress={() => void save()}
                testID="workout-save"
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], paddingBottom: space[8], gap: space[3] },
  date: { gap: space[2], alignItems: 'center' },
  gap: { gap: space[2] },
  input: {
    ...typography.body,
    color: dark.textHi,
    minHeight: layout.touch,
    padding: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.s1,
  },
});
