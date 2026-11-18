import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  addDaysToDateString,
  calculateDistanceFromStepsKm,
  calculateStrideLengthCm,
  deduplicateActivitySources,
  calculateWalkingCalories,
  cardioGoalReached,
  estimateOutdoorCardioCalories,
  haversineKm,
  paceForSpeed,
  speedKmh,
  type CardioMode,
  type CardioSessionMetrics,
  type RoutePoint,
  type ActivitySource,
} from '@calipartner/core';
import {
  Button,
  Chip,
  NavigationIcon,
  SegmentedControl,
  Text,
  controls,
  radius,
  space,
  useTheme,
} from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useSteps } from '@/hooks/useSteps';
import { useTargets } from '@/hooks/useTargets';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { ManualStepsModal } from '@/components/trackers';
import { getLocale, t, type TranslationKey } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import { readDeviceSteps, watchWalkingSteps } from '@/services/stepIntegrationService';
import { watchCardioLocation } from '@/services/cardioLocation';
import { newWorkoutSessionRequest, saveNewWorkoutSession } from '@/services/workoutSessionService';
import { RouteMap } from './RouteMap';
import { useCardioGoalSound } from './useCardioGoalSound';

export interface CardioTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate?: string;
  initialMode?: CardioMode;
  testID?: string;
}

const modes = ['running', 'cycling', 'steps'] as const;
const goals = {
  running: [1, 3, 5, 10],
  cycling: [5, 10, 20, 50],
  steps: [3000, 5000, 8000, 10000],
};
const startLabels = { running: 'startRun', cycling: 'startRide', steps: 'startWalk' } as const;
const historyLabels = {
  running: 'recentRunning',
  cycling: 'recentCycling',
  steps: 'recentSteps',
} as const;
const emptyLabels = {
  running: 'emptyRunning',
  cycling: 'emptyCycling',
  steps: 'emptySteps',
} as const;
const workoutNames = {
  running: 'Running (Outdoor GPS)',
  cycling: 'Cycling (Outdoor GPS)',
  steps: 'Walking Session',
};
const initialMetrics = {
  seconds: 0,
  steps: 0,
  distance: 0,
  speed: null as number | null,
  segments: [] as RoutePoint[][],
};
type Phase = 'idle' | 'starting' | 'active' | 'paused' | 'saving' | 'retry' | 'saved';
type HistoryItem = Omit<CardioSessionMetrics, 'target'> & {
  workout_id: string;
  local_date: string;
  target: number | null;
};
type DailyReading = {
  steps: number;
  distance_m: number;
  source: Exclude<ActivitySource, 'manual'>;
};

const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');

const number = (value: number, digits = 0) =>
  value.toLocaleString(getLocale(), { maximumFractionDigits: digits });
const stepsLabel = (steps: number) => t('ownerPolish.steps', { value: number(steps) });
const distanceLabel = (km: number) => t('ownerPolish.distance', { value: number(km, 2) });
const speedLabel = (mode: CardioMode, speed: number | null) => {
  if (speed === null) return '—';
  if (mode === 'cycling') return t('ownerPolish.speedValue', { value: number(speed, 1) });
  const pace = paceForSpeed(speed);
  return pace
    ? t('ownerPolish.paceValue', {
        minutes: pace.minutes,
        seconds: String(pace.seconds).padStart(2, '0'),
      })
    : '—';
};

export function CardioTrackerModal({
  visible,
  onClose,
  selectedDate,
  initialMode = 'steps',
  testID = 'modal-cardio-tracker',
}: CardioTrackerModalProps) {
  const { colors, reduceMotion } = useTheme();
  const playSuccessSound = useCardioGoalSound();
  const { user, profile } = useAuth();
  const { localDate } = useCurrentLocalDate();
  const day = selectedDate ?? localDate;
  const [mode, setMode] = useState(initialMode);
  const [phase, setPhase] = useState<Phase>('idle');
  const [metric, setMetric] = useState(initialMetrics);
  const [targets, setTargets] = useState<Partial<Record<CardioMode, number>>>({ steps: 3000 });
  const [customGoal, setCustomGoal] = useState(false);
  const [targetDraft, setTargetDraft] = useState<number | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualSteps, setManualSteps] = useState(false);
  const [sessionDay, setSessionDay] = useState(day);
  const daily = useSteps(phase === 'idle' ? day : sessionDay);
  const { currentGoalProfile } = useTargets();
  const weight = currentGoalProfile?.current_weight_kg ?? 0;
  const stride = profile?.height_cm ? calculateStrideLengthCm(profile.height_cm, profile.sex) : 0;
  const walking = mode === 'steps';
  const target = customGoal ? targetDraft : targets[mode];
  const validTarget =
    target != null && Number.isFinite(target) && target >= 1 && target <= (walking ? 100000 : 1000);
  const storedTarget = validTarget ? Math.round(target * (walking ? 1 : 1000)) : 0;
  const metres = walking
    ? stride
      ? Math.floor(calculateDistanceFromStepsKm(metric.steps, stride) * 1000)
      : null
    : Math.floor(metric.distance * 1000);
  const calories = walking
    ? weight > 0 && metres != null
      ? Math.round(calculateWalkingCalories(weight, metres / 1000))
      : null
    : estimateOutdoorCardioCalories(mode, weight, metric.distance, metric.seconds);
  const data: CardioSessionMetrics = {
    mode,
    duration_seconds: metric.seconds,
    distance_m: metres,
    step_count: walking ? metric.steps : null,
    target: storedTarget,
    estimated_calories: calories,
  };
  const reached = storedTarget > 0 && cardioGoalReached(data);
  const badgeOpacity = useRef(new Animated.Value(1)).current;
  const startedAt = useRef('');
  const activeAt = useRef<number | null>(null);
  const priorMs = useRef(0);
  const stepsAtStart = useRef(0);
  const dailyReading = useRef<DailyReading | undefined>(undefined);
  const celebrated = useRef(false);
  const request = useRef(newWorkoutSessionRequest());
  const generation = useRef(0);
  const watcher = useRef<{ remove: () => void } | null>(null);
  const pending = useRef(false);
  const frozen = useRef<(CardioSessionMetrics & { started_at: string }) | null>(null);

  const [history, setHistory] = useState<{ scope: string; rows: HistoryItem[]; failed: boolean }>();
  const scope = JSON.stringify([user?.id, mode]);
  const historyRequest = useRef(0);
  const invalidateHistory = useCallback(() => {
    historyRequest.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (!user?.id || !visible) return;
    const version = ++historyRequest.current;
    setHistory(undefined);
    try {
      const { data: rows, error: failure } = await getSupabase()
        .from('cardio_history')
        .select(
          'workout_id, mode, local_date, duration_seconds, distance_m, step_count, target, estimated_calories',
        )
        .eq('user_id', user.id)
        .eq('mode', mode)
        .order('started_at', { ascending: false })
        .limit(20);
      if (failure) throw failure;
      if (version === historyRequest.current)
        setHistory({ scope, rows: rows ?? [], failed: false });
    } catch {
      if (version === historyRequest.current) setHistory({ scope, rows: [], failed: true });
    }
  }, [mode, scope, user?.id, visible]);
  useEffect(() => {
    void refresh();
    return invalidateHistory;
  }, [refresh, invalidateHistory]);

  const stopTracking = useCallback(() => {
    generation.current++;
    watcher.current?.remove();
    watcher.current = null;
    if (activeAt.current !== null) {
      priorMs.current += Date.now() - activeAt.current;
      activeAt.current = null;
    }
  }, []);
  useEffect(() => {
    if (visible) return stopTracking;
    stopTracking();
  }, [visible, stopTracking]);
  useEffect(() => {
    if (phase !== 'active' || !visible) return;
    const interval = setInterval(() => {
      if (activeAt.current === null) return;
      const seconds = Math.floor((priorMs.current + Date.now() - activeAt.current) / 1000);
      setMetric((value) => ({ ...value, seconds }));
    }, 250);
    return () => clearInterval(interval);
  }, [phase, visible]);
  useEffect(() => {
    if (phase !== 'active' || !reached || celebrated.current) return;
    celebrated.current = true;
    playSuccessSound();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reduceMotion) {
      badgeOpacity.setValue(0);
      Animated.timing(badgeOpacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    }
  }, [badgeOpacity, phase, playSuccessSound, reached, reduceMotion]);

  const pause = () => {
    stopTracking();
    setMetric((value) => ({ ...value, seconds: Math.floor(priorMs.current / 1000), speed: null }));
    setPhase('paused');
  };

  const start = async (resume: boolean) => {
    if (!user?.id || !validTarget || pending.current) return;
    const version = ++generation.current;
    pending.current = true;
    setPhase('starting');
    setError(null);
    if (!resume) {
      setMetric(initialMetrics);
      setSessionDay(day);
      dailyReading.current = undefined;
      frozen.current = null;
      celebrated.current = false;
      priorMs.current = 0;
      stepsAtStart.current = daily.steps;
      request.current = newWorkoutSessionRequest();
    }
    try {
      if (walking) {
        const offset = resume ? metric.steps : 0;
        const stepWatcher = await watchWalkingSteps((count) => {
          if (version !== generation.current || activeAt.current === null) return;
          setMetric((value) => ({ ...value, steps: Math.max(value.steps, offset + count) }));
        });
        if (version !== generation.current || stepWatcher.status !== 'granted') {
          stepWatcher.remove();
          if (version === generation.current) throw new Error('STEP_SENSOR');
          return;
        }
        watcher.current = stepWatcher;
      } else {
        let last: { point: RoutePoint; timestamp: number } | null = null;
        const positionWatcher = await watchCardioLocation(
          ({ coords, timestamp }) => {
            if (version !== generation.current || (coords.accuracy != null && coords.accuracy > 50))
              return;
            const point = { lat: coords.latitude, lng: coords.longitude };
            if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
            setError(null);
            const previous = last;
            const delta = previous ? haversineKm(previous.point, point) : 0;
            const speed = previous
              ? speedKmh(delta, (timestamp - previous.timestamp) / 1000)
              : null;
            if (previous && (timestamp <= previous.timestamp || (speed ?? 0) > 120)) return;
            if (previous && delta < 0.005) {
              if (timestamp - previous.timestamp > 5000)
                setMetric((value) => ({ ...value, speed: 0 }));
              return;
            }
            last = { point, timestamp };
            setMetric((value) => {
              const segments = previous
                ? [...value.segments.slice(0, -1), [...(value.segments.at(-1) ?? []), point]]
                : [...value.segments, [point]];
              return { ...value, distance: value.distance + delta, speed, segments };
            });
          },
          (denied) => {
            if (version !== generation.current) return;
            last = null;
            setMetric((value) => ({ ...value, speed: null }));
            setError(denied ? 'ownerPolish.locationDenied' : 'ownerPolish.gpsUnavailable');
            if (denied) {
              pending.current = false;
              pause();
            }
          },
        );
        if (version !== generation.current) {
          positionWatcher.remove();
          return;
        }
        watcher.current = positionWatcher;
      }
      if (!resume) startedAt.current = new Date().toISOString();
      activeAt.current = Date.now();
      setPhase('active');
    } catch (failure) {
      if (version !== generation.current) return;
      setError(
        walking
          ? 'ownerPolish.walkingUnavailable'
          : failure instanceof Error && failure.message === 'LOCATION_PERMISSION'
            ? 'ownerPolish.locationDenied'
            : 'ownerPolish.gpsUnavailable',
      );
      setPhase(resume ? 'paused' : 'idle');
    } finally {
      if (version === generation.current) pending.current = false;
    }
  };

  const reset = () => {
    stopTracking();
    pending.current = false;
    setConfirmDiscard(false);
    setError(null);
    setPhase('idle');
    setMetric(initialMetrics);
  };
  const close = () => {
    if (phase === 'saving') return;
    if (phase === 'active') pause();
    if (phase === 'active' || phase === 'paused' || phase === 'retry') setConfirmDiscard(true);
    else {
      reset();
      onClose();
    }
  };
  useBrowserModalBack(visible, close);

  const finish = async () => {
    if (
      pending.current ||
      !user?.id ||
      (!frozen.current && (walking ? !data.step_count : !data.distance_m))
    )
      return;
    stopTracking();
    frozen.current ??= {
      ...data,
      duration_seconds: Math.max(1, Math.floor(priorMs.current / 1000)),
      started_at: startedAt.current,
    };
    const session = frozen.current;
    pending.current = true;
    setError(null);
    setPhase('saving');
    const version = generation.current;
    try {
      if (session.mode === 'steps' && !dailyReading.current) {
        const reading = await readDeviceSteps(sessionDay, profile?.timezone ?? undefined);
        const source = reading?.source === 'health_platform' ? 'health_platform' : 'pedometer';
        const totals = deduplicateActivitySources(null, {
          steps: reading?.steps ?? stepsAtStart.current + session.step_count!,
          distance_m: reading?.distance_m,
          source,
          strideLengthCm: stride,
        });
        dailyReading.current = { ...totals, source };
      }
      if (version !== generation.current) return;
      await saveNewWorkoutSession(request.current, {
        userId: user.id,
        localDate: sessionDay,
        type: session.mode === 'cycling' ? 'cardio' : 'walk_run',
        name: workoutNames[session.mode],
        durationMinutes: Math.max(1, Math.round(session.duration_seconds / 60)),
        distanceKm: (session.distance_m ?? 0) / 1000,
        notes: null,
        effortRating: null,
        exercises: [],
        cardioSession: session,
        dailySteps: dailyReading.current,
      });
      if (version !== generation.current) return;
      setPhase('saved');
      void refresh();
      if (session.mode === 'steps') void daily.refresh();
    } catch {
      if (version !== generation.current) return;
      setError('ownerPolish.savingError');
      setPhase('retry');
    } finally {
      pending.current = false;
    }
  };

  const card = [styles.card, { backgroundColor: colors.s1, borderColor: colors.hairlineLit }];
  const goalLabel = walking ? stepsLabel(target ?? 0) : distanceLabel(target ?? 0);
  const progress = (value: number, goal: number, label: string) => {
    const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((value / goal) * 100))) : 0;
    const width: DimensionValue = (String(percent) + '%') as DimensionValue;
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={[styles.track, { backgroundColor: colors.s3 }]}
      >
        <View style={[styles.fill, { width, backgroundColor: colors.apricot }]} />
      </View>
    );
  };

  const dateLabel = (date: string) => {
    if (date === day) return t('ownerPolish.activityToday');
    if (date === addDaysToDateString(day, -1)) return t('ownerPolish.activityYesterday');
    return new Date(date + 'T12:00:00Z').toLocaleDateString(getLocale(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  };
  const resultStats = (item: HistoryItem | CardioSessionMetrics) => (
    <View style={styles.row}>
      {item.step_count != null && <Text tabular>{stepsLabel(item.step_count)}</Text>}
      {item.distance_m != null && <Text tabular>{distanceLabel(item.distance_m / 1000)}</Text>}
      <Text tabular>{clock(item.duration_seconds)}</Text>
      {item.estimated_calories != null && (
        <Text tabular>{t('ownerPolish.calories', { value: number(item.estimated_calories) })}</Text>
      )}
    </View>
  );
  const active = phase === 'active';
  const displayed = frozen.current ?? data;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg0 }]} testID={testID}>
        <View style={styles.header}>
          <Button
            variant="tertiary"
            fullWidth={false}
            iconOnly
            label={t('repairs.back')}
            icon={<NavigationIcon action="back" />}
            testID="btn-close-cardio"
            onPress={close}
            disabled={phase === 'saving'}
          />
          <Text variant="title2" style={styles.headerTitle}>
            {t(`homeRefresh.${mode}`)}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {phase === 'idle' && (
            <SegmentedControl
              value={mode}
              options={modes.map((value) => ({
                value,
                label: t(`homeRefresh.${value}`),
                testID: `tab-cardio-${value}`,
              }))}
              onChange={(next) => {
                setMode(next);
                setCustomGoal(false);
                setTargetDraft(null);
                setError(null);
              }}
            />
          )}
          {phase === 'idle' && walking && (
            <View style={card}>
              <Text variant="heading">{t('ownerPolish.todaySteps')}</Text>
              {daily.loading ? (
                <Text>{t('common.loading')}</Text>
              ) : daily.error ? (
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void daily.refresh()}
                />
              ) : (
                <>
                  <Text variant="title1" tabular>
                    {stepsLabel(daily.steps)}
                  </Text>
                  {progress(daily.steps, daily.goalSteps, t('ownerPolish.todaySteps'))}
                  <Text tabular>
                    {t('ownerPolish.dailyGoal', { value: number(daily.goalSteps) })}
                  </Text>
                </>
              )}
              {Platform.OS === 'web' ? (
                <Button
                  variant="tertiary"
                  label={t('trackers.steps.manualModalTitle')}
                  onPress={() => setManualSteps(true)}
                  testID="cardio-manual-steps"
                />
              ) : (
                <Button
                  variant="tertiary"
                  label={t('trackers.steps.syncButton')}
                  onPress={() => {
                    void (
                      daily.permissionStatus === 'granted'
                        ? daily.syncFromPlatform()
                        : daily.requestPermission()
                    ).catch(() => setError('ownerPolish.walkingUnavailable'));
                  }}
                  testID="cardio-sync-steps"
                />
              )}
            </View>
          )}
          {error && (
            <Text accessibilityRole="alert" color={colors.danger} testID="cardio-error">
              {t(error)}
            </Text>
          )}
          {phase === 'idle' && (
            <>
              <View style={card}>
                <Text variant="heading">
                  {t(walking ? 'ownerPolish.stepGoal' : 'ownerPolish.distanceGoal')}
                </Text>
                <View style={styles.row}>
                  {goals[mode].map((value) => (
                    <Chip
                      key={value}
                      label={walking ? stepsLabel(value) : distanceLabel(value)}
                      selected={!customGoal && target === value}
                      onPress={() => {
                        setCustomGoal(false);
                        setTargets((previous) => ({ ...previous, [mode]: value }));
                      }}
                      testID={`cardio-goal-${value}`}
                    />
                  ))}
                  {!walking && (
                    <Chip
                      label={t('ownerPolish.custom')}
                      selected={customGoal}
                      onPress={() => setCustomGoal(true)}
                      testID="cardio-custom-goal"
                    />
                  )}
                </View>
                {customGoal && (
                  <NumberField
                    label={t('ownerPolish.distanceInput')}
                    value={targetDraft}
                    onChange={setTargetDraft}
                    optional
                    testID="cardio-distance-input"
                  />
                )}
                {!walking && !validTarget && <Text>{t('ownerPolish.distanceMinimum')}</Text>}
                {!user && <Text>{t('ownerPolish.signInToTrack')}</Text>}
                {walking && Platform.OS === 'web' && (
                  <Text>{t('ownerPolish.walkingUnavailable')}</Text>
                )}
                <Button
                  label={t(`ownerPolish.${startLabels[mode]}`)}
                  disabled={!validTarget || !user || (walking && Platform.OS === 'web')}
                  onPress={() => void start(false)}
                  testID="btn-start-cardio"
                />
              </View>
              {walking && (
                <View style={card}>
                  <Text variant="heading">{t('ownerPolish.dailyHistory')}</Text>
                  {daily.loading ? (
                    <Text>{t('common.loading')}</Text>
                  ) : (daily.week ?? []).some((item) => item.steps != null) ? (
                    (daily.week ?? [])
                      .filter((item) => item.steps != null)
                      .slice()
                      .reverse()
                      .map((item) => (
                        <View key={item.localDate} style={styles.dailyRow}>
                          <Text>{dateLabel(item.localDate)}</Text>
                          <Text tabular>{stepsLabel(item.steps!)}</Text>
                        </View>
                      ))
                  ) : (
                    <Text>{t('ownerPolish.emptyDaily')}</Text>
                  )}
                </View>
              )}
              <Text variant="heading">{t(`ownerPolish.${historyLabels[mode]}`)}</Text>
              {!user ? (
                <Text>{t(`ownerPolish.${emptyLabels[mode]}`)}</Text>
              ) : history?.scope !== scope ? (
                <Text>{t('common.loading')}</Text>
              ) : history.failed ? (
                <View style={card}>
                  <Text accessibilityRole="alert">{t('ownerPolish.historyError')}</Text>
                  <Button
                    variant="secondary"
                    label={t('common.retry')}
                    onPress={() => void refresh()}
                    testID="cardio-retry-history"
                  />
                </View>
              ) : history.rows.length ? (
                history.rows.map((item) => (
                  <View
                    key={item.workout_id}
                    style={card}
                    testID={`cardio-history-${item.workout_id}`}
                  >
                    <View style={styles.dailyRow}>
                      <Text variant="label">{dateLabel(item.local_date)}</Text>
                      {item.target != null &&
                        cardioGoalReached({ ...item, target: item.target }) && (
                          <Text color={colors.copper}>{t('ownerPolish.goalReached')}</Text>
                        )}
                    </View>
                    {resultStats(item)}
                  </View>
                ))
              ) : (
                <Text>{t(`ownerPolish.${emptyLabels[mode]}`)}</Text>
              )}
            </>
          )}
          {phase === 'starting' && (
            <Text accessibilityLiveRegion="polite">{t('ownerPolish.starting')}</Text>
          )}
          {phase !== 'idle' && phase !== 'starting' && (
            <>
              {phase === 'saved' && (
                <Text variant="title2" accessibilityLiveRegion="polite">
                  {t('ownerPolish.saved')}
                </Text>
              )}
              {!walking && (
                <View style={card}>
                  <Text>
                    {t(metric.segments.length > 0 ? 'ownerPolish.gpsReady' : 'ownerPolish.fix')}
                  </Text>
                  {metric.segments.length > 0 && (
                    <RouteMap points={metric.segments.flat()} segments={metric.segments} />
                  )}
                </View>
              )}
              <View style={card}>
                <Text variant="title1" tabular>
                  {walking
                    ? stepsLabel(displayed.step_count ?? 0)
                    : distanceLabel((displayed.distance_m ?? 0) / 1000)}
                </Text>
                <Text tabular>
                  {t('ownerPolish.time')} · {clock(displayed.duration_seconds)}
                </Text>
                {walking && displayed.distance_m != null && (
                  <Text tabular>{distanceLabel(displayed.distance_m / 1000)}</Text>
                )}
                {!walking && (
                  <View style={styles.row}>
                    {phase !== 'saved' && (
                      <Text tabular>
                        {t(
                          mode === 'cycling'
                            ? 'ownerPolish.currentSpeed'
                            : 'ownerPolish.currentPace',
                        )}{' '}
                        · {speedLabel(mode, metric.speed)}
                      </Text>
                    )}
                    <Text tabular>
                      {t(
                        mode === 'cycling' ? 'ownerPolish.averageSpeed' : 'ownerPolish.averagePace',
                      )}{' '}
                      ·{' '}
                      {speedLabel(
                        mode,
                        speedKmh((displayed.distance_m ?? 0) / 1000, displayed.duration_seconds),
                      )}
                    </Text>
                  </View>
                )}
                {displayed.estimated_calories != null && (
                  <Text tabular>
                    {t('ownerPolish.calories', { value: number(displayed.estimated_calories) })}
                  </Text>
                )}
                {progress(walking ? metric.steps : (metres ?? 0), storedTarget, goalLabel)}
                <Text tabular>
                  {t('ownerPolish.goalProgress', {
                    current: walking
                      ? stepsLabel(metric.steps)
                      : distanceLabel((metres ?? 0) / 1000),
                    target: goalLabel,
                  })}
                </Text>
              </View>
              {reached && (
                <Animated.View
                  accessibilityLiveRegion="polite"
                  style={[card, { opacity: badgeOpacity }]}
                  testID="cardio-goal-reached"
                >
                  <View style={styles.row}>
                    <Ionicons name="star-outline" size={controls.icon} color={colors.apricot} />
                    <Text variant="heading">{t('ownerPolish.goalReached')}</Text>
                  </View>
                  {phase === 'active' && (
                    <Text>{t('ownerPolish.goalMessage', { goal: goalLabel })}</Text>
                  )}
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>
        {phase !== 'idle' && phase !== 'starting' && (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.bg0, borderColor: colors.hairlineLit },
            ]}
          >
            {confirmDiscard ? (
              <View style={card}>
                <Text>{t('ownerPolish.discardQuestion')}</Text>
                <Button
                  variant={phase === 'retry' ? 'cancel' : 'secondary'}
                  label={t(phase === 'retry' ? 'common.cancel' : 'ownerPolish.keepSession')}
                  onPress={() => setConfirmDiscard(false)}
                />
                <Button
                  variant="destructiveFill"
                  label={t('ownerPolish.discard')}
                  onPress={() => {
                    reset();
                    onClose();
                  }}
                  testID="cardio-discard"
                />
              </View>
            ) : phase === 'saved' ? (
              <Button
                label={t('ownerPolish.viewHistory')}
                onPress={reset}
                testID="cardio-view-history"
              />
            ) : (
              <>
                {(active || phase === 'paused') && (
                  <Button
                    variant="secondary"
                    label={t(active ? 'ownerPolish.pause' : 'ownerPolish.resume')}
                    onPress={() => (active ? pause() : void start(true))}
                    testID="cardio-pause-resume"
                  />
                )}
                <Button
                  label={t(
                    phase === 'saving'
                      ? 'common.saving'
                      : phase === 'retry'
                        ? 'common.retry'
                        : 'ownerPolish.finish',
                  )}
                  onPress={() => void finish()}
                  disabled={
                    phase === 'saving' ||
                    (!frozen.current && !(walking ? data.step_count : data.distance_m))
                  }
                  testID="cardio-finish"
                />
              </>
            )}
          </View>
        )}
        {manualSteps && (
          <ManualStepsModal
            visible
            onClose={() => setManualSteps(false)}
            onSave={daily.logManualSteps}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
  },
  headerTitle: { flex: 1 },
  content: { gap: space[4], padding: space[4] },
  footer: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space[2],
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    padding: space[3],
    gap: space[2],
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  dailyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space[2],
  },
  track: { height: space[2], borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%' },
});
