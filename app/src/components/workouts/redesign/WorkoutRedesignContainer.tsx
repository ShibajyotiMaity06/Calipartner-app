import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Modal, SafeAreaView } from 'react-native';
import { workoutTokens } from '@calipartner/ui';
import { type WorkoutTabId, InProgressMiniBar } from '../s_common';
import {
  workoutRedesignService,
  type WorkoutEligibilityResponse,
  type WorkoutSettings,
  type ActiveWorkoutSession,
  type SessionExercise,
  type ActivityLogItem,
  type PersonalBestItem,
} from '@/services/workoutRedesignService';
import type {
  GeneratedWorkoutPlan,
  GeneratedPlanDay,
  GeneratedPlanExercise,
  AiWorkoutInputs,
  CatalogExercise,
} from '@calipartner/core';

// Screens
import { S01TodayScreen } from './S01TodayScreen';
import { S03PlanScreen } from './S03PlanScreen';
import { S04HistoryScreen } from './S04HistoryScreen';
import { S05ActiveSessionScreen } from './S05ActiveSessionScreen';
import { S06WorkoutSummaryScreen } from './S06WorkoutSummaryScreen';
import { S07DayEditorScreen } from './S07DayEditorScreen';
import { S08ExercisePickerScreen } from './S08ExercisePickerScreen';
import { S09SetTargetsSheet } from './S09SetTargetsSheet';
import { S10NoPlanScreen } from './S10NoPlanScreen';
import { S11LocationScreen } from './S11LocationScreen';
import { S12PreviewScreen } from './S12PreviewScreen';
import { S13ScheduleScreen } from './S13ScheduleScreen';
import { S14SplitScreen } from './S14SplitScreen';
import { S15ExperienceScreen } from './S15ExperienceScreen';
import { S16InjuriesNotesScreen } from './S16InjuriesNotesScreen';
import { S17ReviewScreen } from './S17ReviewScreen';
import { S18GeneratingScreen } from './S18GeneratingScreen';
import { S19HealthBlockedScreen } from './S19HealthBlockedScreen';
import { S20AgeBlockedScreen } from './S20AgeBlockedScreen';
import { S21LockedScreen } from './S21LockedScreen';
import { S23ReplacePlanSheet } from './S23ReplacePlanSheet';
import { S24CustomPlanSetupScreen } from './S24CustomPlanSetupScreen';
import { S25WorkoutSettingsScreen } from './S25WorkoutSettingsScreen';
import { S26SwapExerciseSheet } from './S26SwapExerciseSheet';
import { S27FinishEarlySheet } from './S27FinishEarlySheet';
import { S29LogActivitySheet } from './S29LogActivitySheet';
import { S31FinalWarningSheet } from './S31FinalWarningSheet';
import { S32FinalAppliedScreen } from './S32FinalAppliedScreen';
import { PaywallModal } from '@/components/rooms/PaywallModal';

export type ScreenId =
  | 'main'
  | 's05_active_session'
  | 's06_summary'
  | 's07_day_editor'
  | 's08_exercise_picker'
  | 's11_location'
  | 's12_preview'
  | 's13_schedule'
  | 's14_split'
  | 's15_experience'
  | 's16_injuries'
  | 's17_review'
  | 's18_generating'
  | 's19_health_blocked'
  | 's20_age_blocked'
  | 's21_locked'
  | 's24_custom_plan'
  | 's25_settings'
  | 's32_final_applied';

interface WorkoutRedesignContainerProps {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string;
  testID?: string;
}

export function WorkoutRedesignContainer({
  visible,
  onClose,
  defaultDate,
  testID = 'workout-redesign-container',
}: WorkoutRedesignContainerProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<WorkoutTabId>('today');
  const [navStack, setNavStack] = useState<ScreenId[]>(['main']);

  // Active sheets
  const [finishEarlyVisible, setFinishEarlyVisible] = useState(false);
  const [swapExTarget, setSwapExTarget] = useState<SessionExercise | null>(null);
  const [activitySheetTarget, setActivitySheetTarget] = useState<ActivityLogItem | null | 'new'>(
    null,
  );
  const [setTargetsTarget, setSetTargetsTarget] = useState<{
    exercise: GeneratedPlanExercise;
    index: number;
  } | null>(null);
  const [finalWarningVisible, setFinalWarningVisible] = useState(false);
  const [replacePlanVisible, setReplacePlanVisible] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Dates & States
  const todayStr: string = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0] ?? '2026-11-21';
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate || (todayStr as string));
  const [activePlan, setActivePlan] = useState<GeneratedWorkoutPlan | null>(null);
  const [eligibility, setEligibility] = useState<WorkoutEligibilityResponse | null>(null);
  const [settings, setSettings] = useState<WorkoutSettings>({
    weight_unit: 'kg',
    rest_timer_sound: true,
    rest_timer_vibrate: true,
    auto_start_rest_timer: true,
    keep_screen_awake: true,
  });

  const [inProgressSession, setInProgressSession] = useState<ActiveWorkoutSession | null>(null);
  const [completedTodaySession, setCompletedTodaySession] = useState<ActiveWorkoutSession | null>(
    null,
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [historyWorkouts, setHistoryWorkouts] = useState<ActiveWorkoutSession[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBestItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Flow State
  const [aiInputs, setAiInputs] = useState<AiWorkoutInputs>({
    days_per_week: 3,
    training_days: [1, 3, 5],
    session_minutes: 60,
    split: 'auto',
    experience: 'beginner',
    location: 'advanced_gym',
    limitations: '',
    workout_notes: '',
  });

  const [generatedDraft, setGeneratedDraft] = useState<{
    draft_id: string;
    plan: GeneratedWorkoutPlan;
  } | null>(null);
  const [previewIndex, setPreviewIndex] = useState(1);

  // Day editor state
  const [dayEditorMode, setDayEditorMode] = useState<'plan' | 'today'>('plan');
  const [dayEditorInitialWeekday, setDayEditorInitialWeekday] = useState(1);
  const [pickerMode, setPickerMode] = useState<'plan' | 'session' | 'log'>('plan');

  // Custom plan draft state
  const [customPlanName, setCustomPlanName] = useState('My Custom Plan');
  const [customPlanDays, setCustomPlanDays] = useState<GeneratedPlanDay[]>([
    { weekday: 1, is_rest: false, name: 'Upper Body', exercises: [], about_minutes: 60 },
    { weekday: 2, is_rest: false, name: 'Lower Body', exercises: [], about_minutes: 60 },
    { weekday: 3, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
    { weekday: 4, is_rest: false, name: 'Push', exercises: [], about_minutes: 60 },
    { weekday: 5, is_rest: false, name: 'Pull', exercises: [], about_minutes: 60 },
    { weekday: 6, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
    { weekday: 7, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
  ]);
  const [editingCustomPlan, setEditingCustomPlan] = useState(false);
  const [logStrengthTarget, setLogStrengthTarget] = useState<CatalogExercise | null>(null);

  // Push / Pop stack
  const pushScreen = (screen: ScreenId) => {
    setNavStack((prev) => [...prev, screen]);
  };

  const popScreen = () => {
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, prev.length - 1) : prev));
  };

  const currentScreen = navStack[navStack.length - 1];

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plan, elig, sett, activeSess, hist, pbs] = await Promise.all([
        workoutRedesignService.fetchActivePlan(),
        workoutRedesignService.fetchEligibility(),
        workoutRedesignService.fetchWorkoutSettings(),
        workoutRedesignService.fetchActiveSession(),
        workoutRedesignService.fetchHistory('all'),
        workoutRedesignService.fetchPersonalBests(),
      ]);

      setActivePlan(plan);
      setEligibility(elig);
      setSettings(sett);
      setInProgressSession(activeSess);
      setHistoryWorkouts(hist.workouts);
      setActivityLogs(hist.activities.filter((a) => a.local_date === selectedDate));
      setPersonalBests(pbs);

      const todayDone = hist.workouts.find(
        (w) => w.local_date === selectedDate && w.status === 'completed',
      );
      setCompletedTodaySession(todayDone || null);
    } catch {
      setError('Could not load workout details.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  // Weekday calculations
  const todayWeekday = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getUTCDay();
    return day === 0 ? 7 : day;
  }, [selectedDate]);

  const todayPlanDay = useMemo(() => {
    if (!activePlan) return null;
    return activePlan.days.find((d) => d.weekday === todayWeekday) || null;
  }, [activePlan, todayWeekday]);

  const upNextPlanDay = useMemo(() => {
    if (!activePlan) return null;
    for (let i = 1; i <= 7; i++) {
      const target = ((todayWeekday - 1 + i) % 7) + 1;
      const d = activePlan.days.find((day) => day.weekday === target);
      if (d && !d.is_rest) return d;
    }
    return null;
  }, [activePlan, todayWeekday]);

  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    const currentDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - (currentDay - 1));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setUTCDate(monday.getUTCDate() + i);
      const iso: string = current.toISOString().split('T')[0] ?? '';
      const weekdayNum = i + 1;
      const isDone = historyWorkouts.some((w) => w.local_date === iso && w.status === 'completed');
      const planDay = activePlan?.days.find((pd) => pd.weekday === weekdayNum);
      const isRest = planDay ? planDay.is_rest : true;

      days.push({
        weekday: weekdayNum,
        date: iso,
        isToday: iso === todayStr,
        isDone,
        isRest,
        dayNumber: current.getUTCDate(),
      });
    }
    return days;
  }, [selectedDate, todayStr, historyWorkouts, activePlan]);

  // Eligibility check entry
  const startAiBuilder = async () => {
    try {
      const elig = await workoutRedesignService.fetchEligibility();
      setEligibility(elig);

      if (!elig.eligible) {
        if (elig.reason === 'pro_required') {
          setShowPaywall(true);
        } else if (elig.reason === 'age') {
          pushScreen('s20_age_blocked');
        } else if (elig.reason === 'health') {
          pushScreen('s19_health_blocked');
        } else if (elig.reason === 'cooldown') {
          pushScreen('s21_locked');
        } else {
          pushScreen('s13_schedule');
        }
        return;
      }
      pushScreen('s13_schedule');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Pro') || msg.includes('pro_required')) {
        setShowPaywall(true);
      } else {
        pushScreen('s13_schedule');
      }
    }
  };

  // AI Generation
  const handleExecuteGenerate = async (isFinal = false) => {
    pushScreen('s18_generating');
    try {
      const res = await workoutRedesignService.generateAiPlan(aiInputs, isFinal);
      setGeneratedDraft(res);
      if (isFinal) {
        setActivePlan(res.plan);
        pushScreen('s32_final_applied');
      } else {
        pushScreen('s12_preview');
      }
    } catch (err: unknown) {
      popScreen();
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  };

  const handleTryAgain = () => {
    if (previewIndex === 2) {
      setFinalWarningVisible(true);
    } else {
      setPreviewIndex((prev) => prev + 1);
      handleExecuteGenerate(false);
    }
  };

  const handleUseThisPlan = async () => {
    if (!generatedDraft) return;
    try {
      await workoutRedesignService.confirmAiPlan(generatedDraft.draft_id, generatedDraft.plan);
      setActivePlan(generatedDraft.plan);
      setNavStack(['main']);
      setActiveTab('today');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    }
  };

  // Session Handlers
  const handleStartWorkout = async () => {
    if (!todayPlanDay) return;
    try {
      const sess = await workoutRedesignService.startSession(todayPlanDay, selectedDate);
      setInProgressSession(sess);
      pushScreen('s05_active_session');
    } catch {
      setError('Could not start workout session');
    }
  };

  const handleTrainAnyway = async () => {
    if (!upNextPlanDay) return;
    try {
      const sess = await workoutRedesignService.startSession(upNextPlanDay, selectedDate);
      setInProgressSession(sess);
      pushScreen('s05_active_session');
    } catch {
      setError('Could not start workout session');
    }
  };

  const handleFinishWorkoutPress = () => {
    if (!inProgressSession) return;
    const unfinished = inProgressSession.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => !s.completed).length,
      0,
    );
    if (unfinished > 0) {
      setFinishEarlyVisible(true);
    } else {
      pushScreen('s06_summary');
    }
  };

  const handleSaveSummary = async (effort: number, useWeightsNextTime: boolean) => {
    if (!inProgressSession) return;
    await workoutRedesignService.finishSession(inProgressSession.id, effort, useWeightsNextTime);
    setCompletedTodaySession(inProgressSession);
    setInProgressSession(null);
    setNavStack(['main']);
    setActiveTab('today');
    loadData();
  };

  const handleDiscardSession = async () => {
    if (inProgressSession) {
      await workoutRedesignService.discardSession(inProgressSession.id);
      setInProgressSession(null);
    }
    setFinishEarlyVisible(false);
    setNavStack(['main']);
  };

  const handleSwapExercise = (catalogEx: CatalogExercise, scope: 'just_today' | 'update_plan') => {
    if (!inProgressSession || !swapExTarget) return;

    const updatedExercises = inProgressSession.exercises.map((ex) => {
      if (ex.id === swapExTarget.id) {
        return {
          ...ex,
          exercise_id: catalogEx.id,
          exercise_name: catalogEx.name,
        };
      }
      return ex;
    });

    setInProgressSession({ ...inProgressSession, exercises: updatedExercises });
    setSwapExTarget(null);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (navStack.length > 1) popScreen();
        else onClose();
      }}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Render Active Screen */}
        {currentScreen === 'main' ? (
          <View style={styles.tabContainer}>
            {activeTab === 'today' ? (
              activePlan || completedTodaySession || inProgressSession ? (
                <S01TodayScreen
                  currentTab={activeTab}
                  onChangeTab={setActiveTab}
                  selectedDate={selectedDate}
                  todayDate={todayStr}
                  activePlan={activePlan}
                  todayPlanDay={
                    todayPlanDay ||
                    (completedTodaySession
                      ? {
                          weekday: todayWeekday,
                          name: completedTodaySession.name,
                          is_rest: false,
                          about_minutes: 30,
                          exercises: [],
                        }
                      : inProgressSession
                        ? {
                            weekday: todayWeekday,
                            name: inProgressSession.name,
                            is_rest: false,
                            about_minutes: 30,
                            exercises: [],
                          }
                        : null)
                  }
                  upNextPlanDay={upNextPlanDay}
                  inProgressSession={inProgressSession}
                  completedTodaySession={completedTodaySession}
                  activityLogs={activityLogs}
                  personalBests={personalBests}
                  loading={loading}
                  error={error}
                  onRetry={loadData}
                  onOpenSettings={() => pushScreen('s25_settings')}
                  onOpenCalendar={() => {
                    setActiveTab('history');
                  }}
                  onStartWorkout={handleStartWorkout}
                  onResumeWorkout={() => pushScreen('s05_active_session')}
                  onTrainAnyway={handleTrainAnyway}
                  onEditToday={() => {
                    setEditingCustomPlan(false);
                    setDayEditorMode('today');
                    setDayEditorInitialWeekday(todayWeekday);
                    pushScreen('s07_day_editor');
                  }}
                  onOpenUpNextDay={(d) => {
                    setEditingCustomPlan(false);
                    setDayEditorMode('plan');
                    setDayEditorInitialWeekday(d.weekday);
                    pushScreen('s07_day_editor');
                  }}
                  onLogActivity={() => {
                    setPickerMode('log');
                    pushScreen('s08_exercise_picker');
                  }}
                  onEditActivity={(act) => setActivitySheetTarget(act)}
                  onDeleteActivity={async (id) => {
                    await workoutRedesignService.deleteActivity(id);
                    loadData();
                  }}
                  onViewInHistory={() => setActiveTab('history')}
                  weekDays={weekDays}
                  trainingDaysCount={
                    activePlan ? activePlan.days.filter((d) => !d.is_rest).length : 1
                  }
                  completedDaysCount={weekDays.filter((d) => d.isDone).length}
                />
              ) : (
                <S10NoPlanScreen
                  onBuildWithAi={startAiBuilder}
                  onBuildMyOwn={() => {
                    setEditingCustomPlan(true);
                    pushScreen('s24_custom_plan');
                  }}
                  onLogOneOff={() => {
                    setPickerMode('log');
                    pushScreen('s08_exercise_picker');
                  }}
                />
              )
            ) : activeTab === 'plan' ? (
              activePlan ? (
                <S03PlanScreen
                  currentTab={activeTab}
                  onChangeTab={setActiveTab}
                  activePlan={activePlan}
                  eligibility={eligibility}
                  todayWeekday={todayWeekday}
                  onOpenSettings={() => pushScreen('s25_settings')}
                  onEditDay={(d) => {
                    setEditingCustomPlan(false);
                    setDayEditorMode('plan');
                    setDayEditorInitialWeekday(d.weekday);
                    pushScreen('s07_day_editor');
                  }}
                  onAddRestDayWorkout={(d) => {
                    setEditingCustomPlan(false);
                    setDayEditorMode('plan');
                    setDayEditorInitialWeekday(d.weekday);
                    pushScreen('s07_day_editor');
                  }}
                  onBuildWithAi={startAiBuilder}
                  onOpenLockedScreen={() => pushScreen('s21_locked')}
                  onStartBlankCustomPlan={() => {
                    setEditingCustomPlan(true);
                    pushScreen('s24_custom_plan');
                  }}
                />
              ) : (
                <S10NoPlanScreen
                  onBuildWithAi={startAiBuilder}
                  onBuildMyOwn={() => {
                    setEditingCustomPlan(true);
                    pushScreen('s24_custom_plan');
                  }}
                  onLogOneOff={() => {
                    setPickerMode('log');
                    pushScreen('s08_exercise_picker');
                  }}
                />
              )
            ) : (
              <S04HistoryScreen
                currentTab={activeTab}
                onChangeTab={setActiveTab}
                filterDate={null}
                workouts={historyWorkouts}
                activities={activityLogs}
                onOpenSettings={() => pushScreen('s25_settings')}
                onClearDateFilter={() => setSelectedDate(todayStr)}
                onEditActivity={(act) => setActivitySheetTarget(act)}
                onDeleteActivity={async (id) => {
                  await workoutRedesignService.deleteActivity(id);
                  loadData();
                }}
              />
            )}

            {/* Persistent In-Progress Mini Bar */}
            {inProgressSession && (
              <InProgressMiniBar
                elapsedSeconds={
                  inProgressSession.started_at
                    ? Math.max(
                      0,
                      Math.floor(
                        (Date.now() - new Date(inProgressSession.started_at).getTime()) / 1000,
                      ),
                    )
                    : 0
                }
                completedSets={inProgressSession.exercises.reduce(
                  (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
                  0,
                )}
                totalSets={inProgressSession.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
                workoutName={inProgressSession.name}
                onResume={() => pushScreen('s05_active_session')}
              />
            )}
          </View>
        ) : null}

        {/* Pushed Screen Sub-views */}
        {currentScreen === 's05_active_session' && inProgressSession ? (
          <S05ActiveSessionScreen
            session={inProgressSession}
            weightUnit={settings.weight_unit}
            autoRestTimer={settings.auto_start_rest_timer}
            onMinimize={popScreen}
            onFinish={handleFinishWorkoutPress}
            onSwapExercise={(ex) => setSwapExTarget(ex)}
            onAddExercise={() => {
              setPickerMode('session');
              pushScreen('s08_exercise_picker');
            }}
            onTickSet={async (setId, completed, reps, weight) => {
              await workoutRedesignService.tickSet(setId, completed, reps, weight);
              loadData();
            }}
          />
        ) : null}

        {currentScreen === 's06_summary' && inProgressSession ? (
          <S06WorkoutSummaryScreen
            session={inProgressSession}
            weightUnit={settings.weight_unit}
            personalBestsCount={personalBests.length}
            onSave={handleSaveSummary}
            onDiscard={handleDiscardSession}
          />
        ) : null}

        {currentScreen === 's07_day_editor' && (activePlan || editingCustomPlan) ? (
          <S07DayEditorScreen
            mode={dayEditorMode}
            initialWeekday={dayEditorInitialWeekday}
            allDays={editingCustomPlan ? customPlanDays : (activePlan?.days || [])}
            onSavePlanMode={async (updatedDays) => {
              if (editingCustomPlan) {
                setCustomPlanDays(updatedDays);
                popScreen();
              } else if (activePlan) {
                await workoutRedesignService.saveCustomPlan(activePlan.name, updatedDays);
                loadData();
                popScreen();
              }
            }}
            onSaveTodayMode={(day, scope) => {
              popScreen();
            }}
            onAddExercise={() => {
              setPickerMode('plan');
              pushScreen('s08_exercise_picker');
            }}
            onEditExerciseTargets={(ex, idx) => setSetTargetsTarget({ exercise: ex, index: idx })}
            onBack={popScreen}
          />
        ) : null}

        {currentScreen === 's08_exercise_picker' ? (
          <S08ExercisePickerScreen
            mode={pickerMode}
            onSelect={(catEx) => {
              if (pickerMode === 'plan') {
                const newEx: GeneratedPlanExercise = {
                  id: 'draft_' + Math.random().toString(36).substring(2, 9),
                  name: catEx.name,
                  primary_muscle: catEx.primary_muscle,
                  equipment: catEx.equipment,
                  target_sets: 3,
                  target_reps: 10,
                  target_weight_kg: 0,
                  rest_seconds: 60,
                  is_compound: catEx.is_compound,
                };
                if (editingCustomPlan) {
                  setCustomPlanDays((prev) =>
                    prev.map((d) =>
                      d.weekday === dayEditorInitialWeekday
                        ? { ...d, exercises: [...d.exercises, newEx] }
                        : d,
                    ),
                  );
                } else if (activePlan) {
                  setActivePlan({
                    ...activePlan,
                    days: activePlan.days.map((d) =>
                      d.weekday === dayEditorInitialWeekday
                        ? { ...d, exercises: [...d.exercises, newEx] }
                        : d,
                    ),
                  });
                }
                popScreen();
              } else if (pickerMode === 'session' && inProgressSession) {
                popScreen();
              } else if (pickerMode === 'log') {
                popScreen();
                setLogStrengthTarget(catEx);
              } else {
                popScreen();
              }
            }}
            onBack={popScreen}
          />
        ) : null}

        {currentScreen === 's11_location' ? (
          <S11LocationScreen
            location={aiInputs.location}
            onSelectLocation={(loc) => setAiInputs({ ...aiInputs, location: loc })}
            onContinue={() => pushScreen('s16_injuries')}
            onBack={popScreen}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's12_preview' && generatedDraft ? (
          <S12PreviewScreen
            plan={generatedDraft.plan}
            previewIndex={previewIndex}
            onTryAgain={handleTryAgain}
            onUseThisPlan={handleUseThisPlan}
            onEditAnswers={() => pushScreen('s13_schedule')}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's13_schedule' ? (
          <S13ScheduleScreen
            inputs={aiInputs}
            onUpdate={(u) => setAiInputs({ ...aiInputs, ...u })}
            onContinue={() => pushScreen('s14_split')}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's14_split' ? (
          <S14SplitScreen
            split={aiInputs.split}
            onSelectSplit={(sp) => setAiInputs({ ...aiInputs, split: sp })}
            onContinue={() => pushScreen('s15_experience')}
            onBack={popScreen}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's15_experience' ? (
          <S15ExperienceScreen
            experience={aiInputs.experience}
            onSelectExperience={(exp) => setAiInputs({ ...aiInputs, experience: exp })}
            onContinue={() => pushScreen('s11_location')}
            onBack={popScreen}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's16_injuries' ? (
          <S16InjuriesNotesScreen
            limitations={aiInputs.limitations || ''}
            workoutNotes={aiInputs.workout_notes || ''}
            onUpdateLimitations={(l) => setAiInputs({ ...aiInputs, limitations: l })}
            onUpdateWorkoutNotes={(n) => setAiInputs({ ...aiInputs, workout_notes: n })}
            onContinue={() => pushScreen('s17_review')}
            onBack={popScreen}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's17_review' ? (
          <S17ReviewScreen
            inputs={aiInputs}
            onEditStep={(step) => {
              if (step === 1) pushScreen('s13_schedule');
              else if (step === 2) pushScreen('s14_split');
              else if (step === 3) pushScreen('s15_experience');
              else if (step === 5) pushScreen('s16_injuries');
            }}
            onGenerate={() => handleExecuteGenerate(false)}
            onBack={popScreen}
            onClose={() => setNavStack(['main'])}
          />
        ) : null}

        {currentScreen === 's18_generating' ? (
          <S18GeneratingScreen onGenerationComplete={() => { }} />
        ) : null}

        {currentScreen === 's19_health_blocked' ? (
          <S19HealthBlockedScreen onAcknowledge={() => setNavStack(['main'])} />
        ) : null}

        {currentScreen === 's20_age_blocked' ? (
          <S20AgeBlockedScreen onAcknowledge={() => setNavStack(['main'])} />
        ) : null}

        {currentScreen === 's21_locked' ? (
          <S21LockedScreen
            nextAvailableAt={eligibility?.next_available_at || null}
            onBack={popScreen}
          />
        ) : null}

        {currentScreen === 's24_custom_plan' ? (
          <S24CustomPlanSetupScreen
            planName={customPlanName}
            onChangePlanName={setCustomPlanName}
            days={customPlanDays}
            onChangeDays={setCustomPlanDays}
            onSavePlan={async (name, days) => {
              const saved = await workoutRedesignService.saveCustomPlan(name, days);
              setActivePlan(saved);
              setNavStack(['main']);
              setActiveTab('plan');
              loadData();
            }}
            onEditDayExercises={(day, idx) => {
              setDayEditorMode('plan');
              setEditingCustomPlan(true);
              setDayEditorInitialWeekday(day.weekday);
              pushScreen('s07_day_editor');
            }}
            onBack={popScreen}
          />
        ) : null}

        {currentScreen === 's25_settings' ? (
          <S25WorkoutSettingsScreen
            settings={settings}
            onUpdateSettings={async (u) => {
              const updated = await workoutRedesignService.updateWorkoutSettings(u);
              setSettings(updated);
            }}
            onBack={popScreen}
          />
        ) : null}

        {currentScreen === 's32_final_applied' && activePlan ? (
          <S32FinalAppliedScreen
            plan={activePlan}
            onDone={() => {
              setNavStack(['main']);
              setActiveTab('today');
              loadData();
            }}
          />
        ) : null}

        {/* Global Sheets */}
        <S27FinishEarlySheet
          visible={finishEarlyVisible}
          unfinishedCount={
            inProgressSession
              ? inProgressSession.exercises.reduce(
                (acc, ex) => acc + ex.sets.filter((s) => !s.completed).length,
                0,
              )
              : 0
          }
          onSaveCompletedSets={() => {
            setFinishEarlyVisible(false);
            pushScreen('s06_summary');
          }}
          onKeepGoing={() => setFinishEarlyVisible(false)}
          onDiscardSession={handleDiscardSession}
          onClose={() => setFinishEarlyVisible(false)}
        />

        <S26SwapExerciseSheet
          visible={!!swapExTarget}
          exercise={swapExTarget}
          onSwap={handleSwapExercise}
          onClose={() => setSwapExTarget(null)}
        />

        <S29LogActivitySheet
          visible={!!activitySheetTarget}
          activityToEdit={activitySheetTarget === 'new' ? null : activitySheetTarget}
          onSave={async (name, mins, cal, notes) => {
            if (activitySheetTarget && activitySheetTarget !== 'new') {
              // edit
            } else {
              await workoutRedesignService.logActivity(name, mins, selectedDate, cal, notes);
            }
            setActivitySheetTarget(null);
            loadData();
          }}
          onDelete={async (id) => {
            await workoutRedesignService.deleteActivity(id);
            setActivitySheetTarget(null);
            loadData();
          }}
          onClose={() => setActivitySheetTarget(null)}
        />

        <S09SetTargetsSheet
          visible={!!setTargetsTarget}
          exercise={setTargetsTarget?.exercise || null}
          mode="plan_targets"
          onSave={(sets, reps, weight, rest) => {
            if (setTargetsTarget) {
              const { index } = setTargetsTarget;
              if (editingCustomPlan) {
                setCustomPlanDays((prev) =>
                  prev.map((d) => {
                    if (d.weekday !== dayEditorInitialWeekday) return d;
                    const updatedEx = [...d.exercises];
                    const ex = updatedEx[index];
                    if (ex) {
                      updatedEx[index] = {
                        ...ex,
                        target_sets: sets,
                        target_reps: reps,
                        target_weight_kg: weight,
                        rest_seconds: rest,
                      };
                    }
                    return { ...d, exercises: updatedEx };
                  }),
                );
              } else if (activePlan) {
                setActivePlan({
                  ...activePlan,
                  days: activePlan.days.map((d) => {
                    if (d.weekday !== dayEditorInitialWeekday) return d;
                    const updatedEx = [...d.exercises];
                    const ex = updatedEx[index];
                    if (ex) {
                      updatedEx[index] = {
                        ...ex,
                        target_sets: sets,
                        target_reps: reps,
                        target_weight_kg: weight,
                        rest_seconds: rest,
                      };
                    }
                    return { ...d, exercises: updatedEx };
                  }),
                });
              }
            }
            setSetTargetsTarget(null);
          }}
          onClose={() => setSetTargetsTarget(null)}
        />

        <S09SetTargetsSheet
          visible={!!logStrengthTarget}
          exercise={
            logStrengthTarget
              ? {
                id: logStrengthTarget.id,
                name: logStrengthTarget.name,
                primary_muscle: logStrengthTarget.primary_muscle,
                equipment: logStrengthTarget.equipment,
                target_sets: 3,
                target_reps: 10,
                target_weight_kg: 0,
                rest_seconds: 60,
                is_compound: logStrengthTarget.is_compound,
              }
              : null
          }
          mode="log_exercise"
          onSave={async (sets, reps, weightKg) => {
            if (logStrengthTarget) {
              await workoutRedesignService.logCompletedStrengthExercise(
                logStrengthTarget.name,
                sets,
                reps,
                weightKg,
                selectedDate,
              );
              await loadData();
              setLogStrengthTarget(null);
            }
          }}
          onStartSession={async (sets, reps, weightKg, restSeconds) => {
            if (logStrengthTarget) {
              const oneDay: GeneratedPlanDay = {
                weekday: todayWeekday,
                name: logStrengthTarget.name,
                is_rest: false,
                about_minutes: 30,
                exercises: [
                  {
                    id: logStrengthTarget.id,
                    name: logStrengthTarget.name,
                    primary_muscle: logStrengthTarget.primary_muscle,
                    equipment: logStrengthTarget.equipment,
                    target_sets: sets,
                    target_reps: reps,
                    target_weight_kg: weightKg,
                    rest_seconds: restSeconds,
                    is_compound: logStrengthTarget.is_compound,
                  },
                ],
              };
              const sess = await workoutRedesignService.startSession(oneDay, selectedDate);
              setInProgressSession(sess);
              setLogStrengthTarget(null);
              pushScreen('s05_active_session');
            }
          }}
          onClose={() => setLogStrengthTarget(null)}
        />

        <S31FinalWarningSheet
          visible={finalWarningVisible}
          onConfirm={() => {
            setFinalWarningVisible(false);
            handleExecuteGenerate(true);
          }}
          onCancel={() => setFinalWarningVisible(false)}
        />

        <S23ReplacePlanSheet
          visible={replacePlanVisible}
          onConfirmReplace={() => {
            setReplacePlanVisible(false);
          }}
          onCancel={() => setReplacePlanVisible(false)}
        />

        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          context="general"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  tabContainer: {
    flex: 1,
  },
});
