import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Text, homeLayout, radius, space } from '@calipartner/ui';
import {
  addDaysToDateString,
  FREE_WORKOUT_SAMPLES,
  weeklyPlanDayIndex,
  type Exercise,
  type PlanPreferences,
  type WorkoutRoutineExercise,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { newWorkoutSessionRequest, saveNewWorkoutSession } from '@/services/workoutSessionService';
import { WeeklyPlanForm } from '@/components/onboarding/WeeklyPlanForm';
import { WeeklyPlanPreparing } from '@/components/onboarding/WeeklyPlanPreparing';
import { ExercisePickerModal } from './ExercisePickerModal';
import { ExerciseSetsForm, type ExerciseSetInput } from './ExerciseSetsForm';
import { t, getLocale } from '@/i18n';
import type { WorkoutHubModalProps } from './WorkoutHubModal';

export function WorkoutDayModal({
  visible,
  onClose,
  defaultDate,
  onSaved,
  testID = 'workout-hub-modal',
}: WorkoutHubModalProps) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const { user } = useAuth(),
    { localDate: today } = useCurrentLocalDate(),
    router = useRouter();
  const [date, setDate] = useState(defaultDate && defaultDate <= today ? defaultDate : today);
  const present = date === today;
  const routine = useWorkoutPlan(visible && present),
    history = useWorkouts(date);
  const plan = routine.plan,
    day = plan?.days.find((day) => day.day === weeklyPlanDayIndex(date));
  const [picker, setPicker] = useState(false),
    [editing, setEditing] = useState<WorkoutRoutineExercise | null>(null),
    [logging, setLogging] = useState<WorkoutRoutineExercise | null>(null);
  const [buildDraft, setBuildDraft] = useState<PlanPreferences | null>(null);
  const [building, setBuilding] = useState(false),
    [form, setForm] = useState(false),
    [busy, setBusy] = useState(false),
    [allLogged, setAllLogged] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const session = useRef(newWorkoutSessionRequest()),
    lock = useRef(false);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const close = () => {
    if (busy || building) return;
    if (editing) setEditing(null);
    else if (logging) setLogging(null);
    else if (form) setForm(false);
    else onClose();
  };
  useBrowserModalBack(visible, close);
  useEffect(() => {
    if (visible) {
      setDate(defaultDate && defaultDate <= today ? defaultDate : today);
      setError(null);
      setNotice(null);
      setAllLogged(false);
      session.current = newWorkoutSessionRequest();
    }
  }, [visible, defaultDate, today, user?.id]);
  const dateLabel = new Date(date + 'T12:00:00Z').toLocaleDateString(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const message = (failure: unknown) => {
    const code = failure instanceof Error ? failure.message : '';
    return t(
      code.includes('WORKOUT_LIFETIME_LIMIT')
        ? 'workoutFlow.lifetimeLimit'
        : code.includes('WORKOUT_COOLDOWN')
          ? 'workoutFlow.cooldown'
          : code.includes('PLAN_BUSY')
            ? 'workoutFlow.busy'
            : code.includes('PLAN_RATE_LIMITED')
              ? 'workoutFlow.rateLimit'
              : code.includes('PLAN_STALE')
                ? 'workoutFlow.stale'
                : 'workoutFlow.buildError',
    );
  };
  const save = async (
    exercises: { exerciseName: string; exerciseId?: string; sets: ExerciseSetInput[] }[],
  ) => {
    if (lock.current || !present) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const actor = user?.id;
    try {
      if (!actor) throw new Error('UNAUTHENTICATED');
      const saved = await saveNewWorkoutSession(session.current, {
        userId: actor,
        localDate: today,
        type: 'strength',
        name: exercises.length === 1 ? exercises[0]!.exerciseName : (day?.title ?? null),
        durationMinutes: 0,
        distanceKm: 0,
        notes: null,
        effortRating: null,
        exercises: exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({ ...set, isWarmup: false, completed: true })),
        })),
      });
      if (owner.current !== actor) throw new Error('ACCOUNT_CHANGED');
      session.current = newWorkoutSessionRequest();
      setNotice(t('workoutFlow.saved'));
      setLogging(null);
      await history.refresh();
      onSaved?.(saved);
    } catch (failure) {
      setError(t('workoutFlow.error'));
      throw failure;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const custom = async (exercise: Exercise, sets: ExerciseSetInput[]) =>
    save([{ exerciseId: exercise.id, exerciseName: exercise.name, sets }]);
  const editExercise = async (
    exercise: WorkoutRoutineExercise | null,
    sets?: ExerciseSetInput[],
  ) => {
    if (!plan || !day || !exercise || busy) return;
    setBusy(true);
    setError(null);
    try {
      await routine.edit({
        days: plan.days.map((item) =>
          item.day !== day.day
            ? item
            : {
                ...item,
                exercises: sets
                  ? item.exercises.map((value) =>
                      value.id === exercise.id ? { ...value, targetSets: sets } : value,
                    )
                  : item.exercises.filter((value) => value.id !== exercise.id),
              },
        ),
      });
      setEditing(null);
      setNotice(t('workoutFlow.planSaved'));
    } catch (failure) {
      setError(message(failure));
      throw failure;
    } finally {
      setBusy(false);
    }
  };
  const targetForm = editing ?? logging;
  const renderLogs = () => (
    <View style={styles.stack} testID="workout-day-history">
      {history.loading ? (
        <Text>{t('common.loading')}</Text>
      ) : history.error ? (
        <>
          <Text accessibilityRole="alert">{t('workoutFlow.error')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void history.refresh()}
            testID="workout-history-retry"
          />
        </>
      ) : !history.workouts.length ? (
        <Text>{t('workoutFlow.historyEmpty')}</Text>
      ) : (
        history.workouts.map((workout) => (
          <View key={workout.id} style={styles.card}>
            <Text variant="heading">{workout.name ?? t('workouts.types.strength')}</Text>
            {workout.exercises.map((exercise) => (
              <View key={exercise.id}>
                <Text>{exercise.exercise_name}</Text>
                {exercise.sets
                  ?.filter((set) => set.completed)
                  .map((set) => (
                    <Text key={set.id} variant="bodyS" tabular>
                      {t('workoutFlow.setSummary', {
                        set: set.set_number,
                        reps: set.reps ?? 0,
                        weight: set.weight_kg ?? 0,
                      })}
                    </Text>
                  ))}
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
  return (
    <Modal visible={visible} onRequestClose={close} animationType="none" testID={testID}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text variant="heading" style={styles.flex}>
            {t('workoutFlow.title')}
          </Text>
          <Pressable
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.close')}
            onPress={close}
            disabled={busy || building}
            testID="workout-day-close"
          >
            <Ionicons name="close" size={homeLayout.iconSize} color={dark.textHi} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.datePill} testID="workout-day-date">
            <Pressable
              style={styles.dateIcon}
              accessibilityRole="button"
              accessibilityLabel={t('workoutFlow.previous')}
              disabled={busy || building}
              onPress={() => {
                setDate((value) => addDaysToDateString(value, -1));
                setNotice(null);
                setError(null);
              }}
              testID="workout-day-previous"
            >
              <Ionicons name="chevron-back" size={18} color={dark.textHi} />
            </Pressable>
            <View style={styles.dateCenter}>
              <Ionicons name="calendar-outline" size={18} color={dark.copper} />
              <Text variant="body" color={dark.textHi} tabular style={styles.dateText}>
                {dateLabel}
              </Text>
            </View>
            <Pressable
              style={styles.dateIcon}
              accessibilityRole="button"
              accessibilityLabel={t('workoutFlow.next')}
              disabled={present || busy || building}
              onPress={() => setDate((value) => addDaysToDateString(value, 1))}
              testID="workout-day-next"
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={present ? dark.textOff : dark.textHi}
              />
            </Pressable>
          </View>
          {error && (
            <View style={styles.stack}>
              <Text accessibilityRole="alert" color={dark.danger}>
                {error}
              </Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => {
                  setError(null);
                  void routine.refresh();
                }}
                testID="workout-day-retry"
              />
            </View>
          )}
          {notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
          {!present ? (
            renderLogs()
          ) : (
            <>
              {routine.loading ? (
                <Text accessibilityLiveRegion="polite">{t('workoutFlow.preparing')}</Text>
              ) : routine.error ? (
                <>
                  <Text accessibilityRole="alert">{t('workoutFlow.planError')}</Text>
                  <Button
                    variant="secondary"
                    label={t('common.retry')}
                    onPress={() => void routine.refresh()}
                    testID="workout-plan-retry"
                  />
                </>
              ) : plan?.full_access ? (
                <>
                  <Pressable
                    style={[
                      styles.actionCard,
                      (!plan.can_rebuild || busy) && styles.actionCardDisabled,
                    ]}
                    disabled={!plan.can_rebuild || busy}
                    onPress={() => {
                      setBuildDraft(plan.preferences);
                      setForm(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('workoutFlow.build')}
                    testID="workout-build-new-plan"
                  >
                    <View style={styles.actionIconBox}>
                      <Ionicons name="calendar-outline" size={24} color={dark.copper} />
                    </View>
                    <View style={styles.actionContent}>
                      <Text variant="heading" color={dark.textHi}>
                        {t('workoutFlow.build')}
                      </Text>
                      <Text variant="bodyS" color={dark.textMid}>
                        {t('workoutFlow.buildDesc')}
                      </Text>
                    </View>
                    <View style={styles.actionArrowCircle}>
                      <Ionicons name="chevron-forward" size={16} color={dark.textMid} />
                    </View>
                  </Pressable>
                  <Text variant="bodyS">
                    {plan.tier === 'plus'
                      ? t(plan.rebuilds_used ? 'workoutFlow.plusUsed' : 'workoutFlow.plusAllowance')
                      : plan.next_rebuild_at && !plan.can_rebuild
                        ? t('workoutFlow.proNext', {
                            date: new Date(plan.next_rebuild_at).toLocaleDateString(getLocale()),
                          })
                        : t('workoutFlow.proAllowance')}
                  </Text>
                  {!day ? null : !day.exercises.length ? (
                    <Text testID="workout-rest-day">{t('workoutFlow.rest')}</Text>
                  ) : (
                    <View style={styles.card} testID="workout-paid-routine">
                      <Text variant="heading">{day.title}</Text>
                      {day.exercises.map((exercise) => (
                        <View key={exercise.id} style={styles.exercise}>
                          <Pressable
                            style={styles.flex}
                            accessibilityRole="button"
                            accessibilityLabel={t('workoutFlow.logExercise', {
                              name: exercise.name,
                            })}
                            disabled={busy}
                            onPress={() => setLogging(exercise)}
                            testID={`workout-plan-log-${exercise.id}`}
                          >
                            <Text variant="heading">{exercise.name}</Text>
                            {exercise.targetSets.map((set, index) => (
                              <Text key={index} variant="bodyS" tabular>
                                {t('workoutFlow.setSummary', {
                                  set: index + 1,
                                  reps: set.reps,
                                  weight: set.weightKg,
                                })}
                              </Text>
                            ))}
                          </Pressable>
                          <Pressable
                            style={styles.icon}
                            accessibilityRole="button"
                            accessibilityLabel={t('workoutFlow.edit', { name: exercise.name })}
                            disabled={busy}
                            onPress={() => setEditing(exercise)}
                            testID={`workout-plan-edit-${exercise.id}`}
                          >
                            <Ionicons
                              name="pencil"
                              size={homeLayout.editIconSize}
                              color={dark.textHi}
                            />
                          </Pressable>
                          <Pressable
                            style={styles.icon}
                            accessibilityRole="button"
                            accessibilityLabel={t('workoutFlow.remove', { name: exercise.name })}
                            disabled={busy}
                            onPress={() => void editExercise(exercise).catch(() => {})}
                            testID={`workout-plan-remove-${exercise.id}`}
                          >
                            <Ionicons
                              name="remove"
                              size={homeLayout.iconSize}
                              color={dark.textHi}
                            />
                          </Pressable>
                        </View>
                      ))}
                      <Button
                        label={t('workoutFlow.saveWorkout')}
                        disabled={busy || allLogged}
                        onPress={() =>
                          void save(
                            day.exercises.map((exercise) => ({
                              exerciseName: exercise.name,
                              sets: exercise.targetSets,
                            })),
                          )
                            .then(() => setAllLogged(true))
                            .catch(() => {})
                        }
                        testID="workout-save-routine"
                      />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.card} testID="workout-free-sample">
                  <Text variant="heading">{t('workoutFlow.sample')}</Text>
                  <Text>
                    {t(`workoutFlow.${FREE_WORKOUT_SAMPLES[weeklyPlanDayIndex(today)]!}`)}
                  </Text>
                  <Text variant="bodyS">{t('workoutFlow.sampleHint')}</Text>
                  <Pressable
                    style={styles.unlock}
                    accessibilityRole="button"
                    accessibilityLabel={t('workoutFlow.unlock')}
                    onPress={() => router.push('/paywall')}
                    testID="workout-plan-upgrade"
                  >
                    <Ionicons name="arrow-forward" size={homeLayout.iconSize} color={dark.textHi} />
                    <Text>{t('workoutFlow.unlock')}</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerBadge}>
                  <Ionicons name="flash" size={14} color={dark.copper} />
                  <Text variant="micro" color={dark.textMid}>
                    {t('workoutFlow.badgeTagline')}
                  </Text>
                </View>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                style={[styles.actionCard, busy && styles.actionCardDisabled]}
                onPress={() => setPicker(true)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t(plan?.full_access ? 'workoutFlow.custom' : 'workoutFlow.add')}
                testID={`${testID}-btn-add-exercise`}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="barbell-outline" size={24} color={dark.copper} />
                </View>
                <View style={styles.actionContent}>
                  <Text variant="heading" color={dark.textHi}>
                    {t(plan?.full_access ? 'workoutFlow.custom' : 'workoutFlow.add')}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid}>
                    {t('workoutFlow.customDesc')}
                  </Text>
                </View>
                <View style={styles.actionArrowCircle}>
                  <Ionicons name="chevron-forward" size={16} color={dark.textMid} />
                </View>
              </Pressable>
              {!!history.workouts.length && (
                <>
                  <Text variant="heading">{t('workoutFlow.logged')}</Text>
                  {renderLogs()}
                </>
              )}
            </>
          )}
        </ScrollView>
        <ExercisePickerModal
          visible={picker}
          onClose={() => setPicker(false)}
          onSelectExercise={custom}
          submitLabel={t('workoutFlow.saveExercise')}
        />
        {targetForm && (
          <Modal
            visible
            onRequestClose={() => {
              if (!busy) {
                setEditing(null);
                setLogging(null);
              }
            }}
            animationType="none"
            testID="workout-target-editor"
          >
            <SafeAreaView style={styles.screen}>
              <ScrollView contentContainerStyle={styles.content}>
                <ExerciseSetsForm
                  key={targetForm.id}
                  name={targetForm.name}
                  initialSets={targetForm.targetSets}
                  submitLabel={t(editing ? 'workoutFlow.savePlan' : 'workoutFlow.saveExercise')}
                  onCancel={() => {
                    setEditing(null);
                    setLogging(null);
                  }}
                  onAdd={(sets) =>
                    editing
                      ? editExercise(editing, sets)
                      : save([{ exerciseName: targetForm.name, sets }])
                  }
                />
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}
        {form && (
          <Modal
            visible
            onRequestClose={() => {
              if (!building) setForm(false);
            }}
            animationType="none"
            testID="workout-build-form"
          >
            <SafeAreaView style={styles.screen}>
              <ScrollView contentContainerStyle={styles.content}>
                {building ? (
                  <WeeklyPlanPreparing
                    workoutOnly
                    preferences={buildDraft ?? plan?.preferences ?? undefined}
                  />
                ) : (
                  <>
                    <WeeklyPlanForm
                      workoutOnly
                      initial={buildDraft ?? plan?.preferences ?? undefined}
                      onLater={() => setForm(false)}
                      onBuild={(preferences) => {
                        if (building) return;
                        setBuildDraft(preferences);
                        setBuilding(true);
                        setError(null);
                        void routine
                          .rebuild(preferences)
                          .then(() => {
                            setForm(false);
                            setAllLogged(false);
                            setNotice(t('workoutFlow.planSaved'));
                          })
                          .catch((failure) => setError(message(failure)))
                          .finally(() => setBuilding(false));
                      }}
                    />
                    {error && (
                      <Text accessibilityRole="alert" color={dark.danger}>
                        {error}
                      </Text>
                    )}
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: dark.bg0 },
    header: {
      padding: space[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    content: { padding: space[4], gap: space[4], paddingBottom: space[8] },
    stack: { gap: space[2] },
    card: {
      padding: space[3],
      gap: space[3],
      backgroundColor: dark.s1,
      borderColor: dark.hairlineLit,
      borderWidth: 1,
      borderRadius: radius.card,
    },
    date: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    datePill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: dark.s1,
      borderWidth: 1,
      borderColor: dark.hairlineLit,
      borderRadius: radius.full,
      paddingHorizontal: space[3],
      paddingVertical: space[1],
      minHeight: homeLayout.touchSize,
    },
    dateCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[2],
      flex: 1,
    },
    dateText: {
      textAlign: 'center',
    },
    dateIcon: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      backgroundColor: dark.s1,
      borderWidth: 1,
      borderColor: dark.hairlineLit,
      borderRadius: radius.card,
      padding: space[4],
    },
    actionCardDisabled: {
      opacity: 0.5,
    },
    actionIconBox: {
      width: 48,
      height: 48,
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionContent: {
      flex: 1,
      minWidth: 0,
      gap: space[1],
    },
    actionArrowCircle: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      marginVertical: space[2],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: dark.hairline,
    },
    dividerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingVertical: space[1],
      paddingHorizontal: space[3],
      backgroundColor: dark.s2,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: dark.hairline,
    },
    flex: { flex: 1, minWidth: 0 },
    icon: {
      minWidth: homeLayout.touchSize,
      minHeight: homeLayout.touchSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exercise: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
    unlock: {
      minHeight: homeLayout.touchSize,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      flexWrap: 'wrap',
    },
  });
