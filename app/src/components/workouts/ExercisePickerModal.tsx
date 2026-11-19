import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Text,
  controls,
  homeLayout,
  radius,
  space,
  type as typography,
  useTheme,
} from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { Exercise } from '@calipartner/core';
import { ModalNavigation } from '@/components/ModalNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { loadAccountTable } from '@/services/accountDataService';
import { generateClientUuid } from '@/services/foodService';
import { createCustomExercise, getExercises } from '@/services/workoutService';
import { ExerciseSetsForm, type ExerciseSetInput } from './ExerciseSetsForm';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (
    exercise: Exercise,
    sets: ExerciseSetInput[],
    custom?: Exercise,
  ) => void | Promise<void>;
  deferCustomSave?: boolean;
  submitLabel?: string;
  testID?: string;
}

const searchKey = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function ExercisePickerModal(props: ExercisePickerModalProps) {
  const { user } = useAuth();
  return props.visible ? (
    <ExercisePicker key={user?.id} {...props} userId={user?.id ?? 'guest-user'} />
  ) : null;
}

function ExercisePicker({
  onClose,
  onSelectExercise,
  deferCustomSave,
  submitLabel,
  testID = 'exercise-picker-modal',
  userId,
}: ExercisePickerModalProps & { userId: string }) {
  const { colors, reduceMotion } = useTheme();
  const [query, setQuery] = useState('');
  const [favourites, setFavourites] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [selection, setSelection] = useState<{ exercise: Exercise; custom?: Exercise } | null>(
    null,
  );
  const [catalog, setCatalog] = useState<Exercise[]>();
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const customId = useRef<string | null>(null);
  const key = searchKey(query);
  const showResults = favourites || !!key;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = await getDb();
        await loadAccountTable(db, 'exercises', userId);
        const results = await getExercises(db, { userId });
        if (active) setCatalog(results);
      } catch {
        if (active) setLoadError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const back = () => {
    if (lock.current) return;
    if (selection) setSelection(null);
    else if (naming) setNaming(false);
    else onClose();
  };
  const close = () => {
    if (!lock.current) onClose();
  };
  useBrowserModalBack(true, close, {
    depth: selection || naming ? 1 : 0,
    onDepthChange: back,
  });

  const results = showResults
    ? (catalog ?? []).filter((item) =>
        favourites ? item.owner_id === userId : searchKey(item.name).includes(key),
      )
    : [];
  const startNaming = () => {
    customId.current = null;
    setName(query.trim().slice(0, 100));
    setSaveError(false);
    setNaming(true);
  };
  const nameWorkout = async () => {
    if (!name.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    setSaveError(false);
    const exercise: Exercise = {
      id: (customId.current ??= generateClientUuid()),
      name: name.trim(),
      muscle_group: 'other',
      equipment: 'none',
      type: 'strength',
      owner_id: userId,
    };
    try {
      if (deferCustomSave) setSelection({ exercise, custom: exercise });
      else {
        const created = await createCustomExercise(
          await getDb(),
          {
            id: exercise.id,
            name: exercise.name,
            muscleGroup: 'other',
            equipment: 'none',
            type: 'strength',
          },
          userId,
        );
        setSelection({ exercise: created });
        setCatalog((current) => (current ? [...current, created] : current));
      }
      setNaming(false);
    } catch {
      setSaveError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      testID={testID}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={back}
    >
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg0 }]}>
        <ModalNavigation
          onBack={selection ? back : undefined}
          onClose={close}
          title={selection ? undefined : t('workouts.exercises.title')}
          disabled={busy}
          closeTestID={testID + '-btn-close'}
          backTestID={testID + '-btn-back'}
        />
        {selection ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ExerciseSetsForm
              key={selection.exercise.id}
              name={selection.exercise.name}
              submitLabel={submitLabel}
              onAdd={async (sets) => {
                lock.current = true;
                setBusy(true);
                try {
                  await onSelectExercise(selection.exercise, sets, selection.custom);
                  onClose();
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            />
          </ScrollView>
        ) : (
          <>
            <View style={styles.row}>
              <View
                testID="workout-search-field"
                style={[
                  styles.search,
                  { backgroundColor: colors.s1, borderColor: colors.hairline },
                ]}
              >
                <Ionicons name="search" size={controls.icon} color={colors.textMid} />
                <TextInput
                  testID={testID + '-input-search'}
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    setFavourites(false);
                  }}
                  placeholder={t('workoutFlow.searchWorkouts')}
                  placeholderTextColor={colors.textLo}
                  accessibilityLabel={t('workoutFlow.searchWorkouts')}
                  style={[styles.input, { color: colors.textHi }]}
                />
              </View>
              <Button
                variant="secondary"
                fullWidth={false}
                iconOnly
                icon={
                  <Ionicons
                    name={favourites ? 'heart' : 'heart-outline'}
                    size={controls.icon}
                    color={colors.textHi}
                  />
                }
                label={t('workoutFlow.myWorkouts')}
                style={styles.heart}
                accessibilityState={{ selected: favourites }}
                onPress={() => setFavourites((value) => !value)}
                testID="workout-my-exercises"
              />
            </View>
            {favourites && <Text variant="heading">{t('workoutFlow.myWorkouts')}</Text>}
            {showResults &&
              (loadError ? (
                <View style={styles.content}>
                  <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                  <Button
                    label={t('common.retry')}
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => {
                      setLoadError(false);
                      setAttempt((value) => value + 1);
                    }}
                    testID={testID + '-btn-retry'}
                  />
                </View>
              ) : !catalog ? (
                <ActivityIndicator
                  accessibilityLabel={t('common.loading')}
                  color={colors.apricot}
                />
              ) : results.length ? (
                <FlatList
                  testID={testID + '-list'}
                  data={results}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.results}
                  renderItem={({ item }) => (
                    <Button
                      variant="secondary"
                      label={item.name}
                      testID={'exercise-item-' + item.id}
                      onPress={() => setSelection({ exercise: item })}
                    />
                  )}
                />
              ) : (
                <View style={styles.content}>
                  <Text variant="bodyS" accessibilityLiveRegion="polite">
                    {t(favourites ? 'workoutFlow.myWorkoutsEmpty' : 'workoutFlow.noWorkoutFound')}
                  </Text>
                  {!favourites && (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={t('workoutFlow.addCustomWorkout')}
                      onPress={startNaming}
                      testID={testID + '-btn-create-custom-empty'}
                    />
                  )}
                </View>
              ))}
          </>
        )}
        {naming && (
          <Modal
            visible
            transparent
            animationType={reduceMotion ? 'none' : 'fade'}
            onRequestClose={back}
            testID="custom-exercise-modal"
          >
            <SafeAreaView style={[styles.dialog, { backgroundColor: colors.modalScrim }]}>
              <ScrollView
                accessibilityViewIsModal
                keyboardShouldPersistTaps="handled"
                style={[styles.dialogCard, { backgroundColor: colors.s1 }]}
                contentContainerStyle={styles.screenContent}
              >
                <ModalNavigation
                  onClose={back}
                  disabled={busy}
                  closeTestID="custom-exercise-cancel"
                />
                <Text variant="heading">{t('workoutFlow.addCustomWorkout')}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                  autoFocus
                  placeholder={t('workoutFlow.workoutName')}
                  placeholderTextColor={colors.textLo}
                  accessibilityLabel={t('workoutFlow.workoutName')}
                  style={[
                    styles.input,
                    styles.nameInput,
                    { color: colors.textHi, borderColor: colors.hairline },
                  ]}
                  testID="input-custom-exercise-name"
                />
                {saveError && <Text accessibilityRole="alert">{t('workoutFlow.error')}</Text>}
                <Button
                  label={t('common.save')}
                  disabled={busy || !name.trim()}
                  onPress={() => void nameWorkout()}
                  testID="btn-save-custom-exercise"
                />
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: space[3], paddingHorizontal: space[4] },
  screenContent: { gap: space[3], padding: space[4] },
  content: { gap: space[3], paddingBottom: space[4] },
  results: { gap: space[2], paddingBottom: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  heart: { alignSelf: 'center' },
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    minHeight: homeLayout.touchSize,
    borderRadius: radius.control,
    borderWidth: controls.border,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: homeLayout.touchSize,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  nameInput: {
    borderWidth: controls.border,
    paddingHorizontal: space[3],
    borderRadius: radius.control,
  },
  dialog: { flex: 1, justifyContent: 'center', padding: space[4] },
  dialogCard: {
    flexGrow: 0,
    width: '100%',
    maxWidth: controls.dialogMaxWidth,
    maxHeight: '90%',
    alignSelf: 'center',
    borderRadius: radius.sheet,
  },
});
