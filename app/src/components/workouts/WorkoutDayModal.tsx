import { LoggedWorkoutCard } from './LoggedWorkoutCard';
import { LoggedWorkoutEditModal } from './LoggedWorkoutEditModal';
import { LoggedWorkoutDeleteModal } from './LoggedWorkoutDeleteModal';
import { WorkoutLoggerModal } from './WorkoutLoggerModal';
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
  type WorkoutWithDetails,
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
  const [windowEnd, setWindowEnd] = useState(today);
  const strip = useRef<ScrollView>(null);
  const dates = Array.from({ length: 7 }, (_, index) => addDaysToDateString(windowEnd, index - 6));
  const present = date === today;
  const routine = useWorkoutPlan(visible && present),
    history = useWorkouts(date);
  const plan = routine.plan,
    day = plan?.days.find((day) => day.day === weeklyPlanDayIndex(date));
  const [editLog, setEditLog] = useState<WorkoutWithDetails | null>(null);
  const [deleteLog, setDeleteLog] = useState<WorkoutWithDetails | null>(null);
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
      const initial = defaultDate && defaultDate <= today ? defaultDate : today;
      setDate(initial);
      setWindowEnd(initial < addDaysToDateString(today, -6) ? initial : today);
      setError(null);
      setNotice(null);
      setAllLogged(false);
      setEditLog(null);
      setDeleteLog(null);
      session.current = newWorkoutSessionRequest();
    }
  }, [visible, defaultDate, today, user?.id]);
  const dateLabel = (day: string) =>
    new Date(day + 'T12:00:00Z').toLocaleDateString(getLocale(), {
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
          <LoggedWorkoutCard
            key={workout.id}
            workout={workout}
            onEdit={() => setEditLog(workout)}
            onDelete={() => setDeleteLog(workout)}
          />
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
          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('squadDesign.close')}
            iconOnly
            icon={<Ionicons name="close" size={homeLayout.iconSize} color={dark.textHi} />}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.close')}
            onPress={close}
            disabled={busy || building}
            testID="workout-day-close"
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.stack} testID="workout-day-date">
            <ScrollView
              ref={strip}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
              onContentSizeChange={() => strip.current?.scrollToEnd({ animated: false })}
            >
              {dates.map((day, index) => {
                const calendarDay = new Date(day + 'T12:00:00Z');
                const selected = date === day;
                return (
                  <Pressable
                    key={day}
                    testID={`workout-date-${day}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      index === 0
                        ? dateLabel(day) + '. ' + t('ownerPolish.olderDates')
                        : dateLabel(day)
                    }
                    accessibilityState={{ selected }}
                    disabled={busy || building}
                    onPress={() => {
                      if (index === 0) {
                        const older = addDaysToDateString(day, -1);
                        setWindowEnd(older);
                        setDate(older);
                      } else {
                        setDate(day);
                      }
                      setNotice(null);
                      setError(null);
                    }}
                    style={({ pressed }) => [
                      styles.dateBox,
                      selected && styles.dateSelected,
                      pressed && { opacity: homeLayout.disabledOpacity },
                    ]}
                  >
                    <Text variant="micro" color={selected ? dark.onBrand : dark.textMid}>
                      {calendarDay.toLocaleDateString(getLocale(), {
                        weekday: 'short',
                        timeZone: 'UTC',
                      })}
                    </Text>
                    <Text variant="label" tabular color={selected ? dark.onBrand : dark.textHi}>
                      {calendarDay.toLocaleDateString(getLocale(), {
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text variant="bodyS" tabular>
              {dateLabel(date)}
            </Text>
            {windowEnd !== today && (
              <Button
                variant="tertiary"
                fullWidth={false}
                label={t('ownerPolish.newerDates')}
                disabled={busy || building}
                onPress={() => {
                  const next = addDaysToDateString(windowEnd, 7);
                  const end = next < today ? next : today;
                  setWindowEnd(end);
                  setDate(end);
                  setError(null);
                  setNotice(null);
                }}
                testID="workout-day-next"
              />
            )}
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
                                })}
                              </Text>
                            ))}
                          </Pressable>
                          <Button
                            variant="tertiary"
                            fullWidth={false}
                            label={t('workoutFlow.edit', { name: exercise.name })}
                            iconOnly
                            icon={
                              <Ionicons
                                name="pencil"
                                size={homeLayout.editIconSize}
                                color={dark.textHi}
                              />
                            }
                            style={styles.icon}
                            accessibilityRole="button"
                            accessibilityLabel={t('workoutFlow.edit', { name: exercise.name })}
                            disabled={busy}
                            onPress={() => setEditing(exercise)}
                            testID={`workout-plan-edit-${exercise.id}`}
                          />
                          <Button
                            variant="tertiary"
                            fullWidth={false}
                            label={t('workoutFlow.remove', { name: exercise.name })}
                            iconOnly
                            icon={
                              <Ionicons
                                name="remove"
                                size={homeLayout.iconSize}
                                color={dark.textHi}
                              />
                            }
                            style={styles.icon}
                            accessibilityRole="button"
                            accessibilityLabel={t('workoutFlow.remove', { name: exercise.name })}
                            disabled={busy}
                            onPress={() => void editExercise(exercise).catch(() => {})}
                            testID={`workout-plan-remove-${exercise.id}`}
                          />
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
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    label={t('workoutFlow.unlock')}
                    icon={
                      <Ionicons
                        name="arrow-forward"
                        size={homeLayout.iconSize}
                        color={dark.textHi}
                      />
                    }
                    style={styles.unlock}
                    accessibilityRole="button"
                    accessibilityLabel={t('workoutFlow.unlock')}
                    onPress={() => router.push('/paywall')}
                    testID="workout-plan-upgrade"
                  />
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
        {editLog &&
          (editLog.type === 'strength' ? (
            <LoggedWorkoutEditModal
              key={editLog.id}
              workout={editLog}
              onClose={() => setEditLog(null)}
              onSaved={history.refresh}
            />
          ) : (
            <WorkoutLoggerModal
              visible
              initialWorkout={editLog}
              defaultDate={editLog.local_date}
              onClose={() => setEditLog(null)}
              onSaved={() => {
                setEditLog(null);
                void history.refresh();
              }}
            />
          ))}
        {deleteLog && (
          <LoggedWorkoutDeleteModal
            name={deleteLog.name || t(`workouts.types.${deleteLog.type}`)}
            onClose={() => setDeleteLog(null)}
            onDelete={async () => {
              await history.remove(deleteLog.id);
              setAllLogged(false);
            }}
          />
        )}
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
                  planOnly={!!editing}
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
    dateStrip: { flexGrow: 1, gap: space[1] },
    dateBox: {
      flexGrow: 1,
      minWidth: homeLayout.compactTouchSize,
      minHeight: homeLayout.compactTouchSize,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark.hairlineLit,
      backgroundColor: dark.s1,
    },
    dateSelected: { backgroundColor: dark.apricot, borderColor: dark.apricot },
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
