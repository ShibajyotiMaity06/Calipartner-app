import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value, absoluteFillObject: {} },
  Alert: { alert: vi.fn() },
}));

vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../../packages/ui/src/tokens')),
}));

const createMockQuery = () => {
  const query: any = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    single: vi.fn().mockResolvedValue({ data: { id: 'plan_1' } }),
    then: (resolve: any, reject?: any) => Promise.resolve({ data: [] }).then(resolve, reject),
  };
  return query;
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test_user', email: 'shibajyoti.maity06@gmail.com' } },
    }),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => createMockQuery()),
    insert: vi.fn().mockReturnValue({
      select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'plan_1' } }) }),
    }),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnValue(createMockQuery()),
    delete: vi.fn().mockReturnValue(createMockQuery()),
  })),
  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: {
        eligible: true,
        reason: null,
        state: 'ready',
        next_available_at: null,
        previews_used: 0,
      },
    }),
  },
};

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => mockSupabase,
}));

import { S01TodayScreen } from './S01TodayScreen';
import { S03PlanScreen } from './S03PlanScreen';
import { S04HistoryScreen } from './S04HistoryScreen';
import { S05ActiveSessionScreen } from './S05ActiveSessionScreen';
import { S06WorkoutSummaryScreen } from './S06WorkoutSummaryScreen';
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
import { S31FinalWarningSheet } from './S31FinalWarningSheet';
import { S32FinalAppliedScreen } from './S32FinalAppliedScreen';
import { workoutRedesignService } from '@/services/workoutRedesignService';
import type { GeneratedWorkoutPlan } from '@calipartner/core';

describe('Workout Redesign (S00 - S32)', () => {
  let tree: ReactTestRenderer;

  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
  });

  const mockPlan: GeneratedWorkoutPlan = {
    name: 'Push / Pull / Legs Weekly Plan',
    source: 'ai',
    days: [
      {
        weekday: 1,
        is_rest: false,
        name: 'Push Day',
        about_minutes: 60,
        exercises: [
          {
            id: 'bench',
            name: 'Barbell Bench Press',
            primary_muscle: 'chest',
            equipment: 'advanced_gym',
            target_sets: 3,
            target_reps: 10,
            target_weight_kg: null,
            rest_seconds: 90,
            is_compound: true,
          },
        ],
      },
      {
        weekday: 2,
        is_rest: true,
        name: 'Rest Day',
        about_minutes: 0,
        exercises: [],
      },
      {
        weekday: 3,
        is_rest: false,
        name: 'Pull Day',
        about_minutes: 60,
        exercises: [
          {
            id: 'pulldown',
            name: 'Lat Pulldown',
            primary_muscle: 'back',
            equipment: 'advanced_gym',
            target_sets: 3,
            target_reps: 10,
            target_weight_kg: null,
            rest_seconds: 60,
            is_compound: false,
          },
        ],
      },
    ],
    excluded: [],
    unmatched_limitations: [],
  };

  it('S01 Today screen renders training day with Start workout action', async () => {
    await act(async () => {
      tree = create(
        <S01TodayScreen
          currentTab="today"
          onChangeTab={vi.fn()}
          selectedDate="2026-11-21"
          todayDate="2026-11-21"
          activePlan={mockPlan}
          todayPlanDay={mockPlan.days[0] ?? null}
          upNextPlanDay={mockPlan.days[2] ?? null}
          inProgressSession={null}
          completedTodaySession={null}
          activityLogs={[]}
          personalBests={[]}
          loading={false}
          error={null}
          onRetry={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenCalendar={vi.fn()}
          onStartWorkout={vi.fn()}
          onResumeWorkout={vi.fn()}
          onTrainAnyway={vi.fn()}
          onEditToday={vi.fn()}
          onOpenUpNextDay={vi.fn()}
          onLogActivity={vi.fn()}
          onEditActivity={vi.fn()}
          onDeleteActivity={vi.fn()}
          onViewInHistory={vi.fn()}
          weekDays={[
            {
              weekday: 1,
              date: '2026-11-21',
              isToday: true,
              isDone: false,
              isRest: false,
              dayNumber: 21,
            },
          ]}
          trainingDaysCount={2}
          completedDaysCount={0}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Barbell Bench Press');
    expect(json).toContain('Start workout');
  });

  it('S02 Rest day renders recovery copy and Train anyway button', async () => {
    await act(async () => {
      tree = create(
        <S01TodayScreen
          currentTab="today"
          onChangeTab={vi.fn()}
          selectedDate="2026-11-21"
          todayDate="2026-11-21"
          activePlan={mockPlan}
          todayPlanDay={mockPlan.days[1] ?? null} // rest day
          upNextPlanDay={mockPlan.days[2] ?? null}
          inProgressSession={null}
          completedTodaySession={null}
          activityLogs={[]}
          personalBests={[]}
          loading={false}
          error={null}
          onRetry={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenCalendar={vi.fn()}
          onStartWorkout={vi.fn()}
          onResumeWorkout={vi.fn()}
          onTrainAnyway={vi.fn()}
          onEditToday={vi.fn()}
          onOpenUpNextDay={vi.fn()}
          onLogActivity={vi.fn()}
          onEditActivity={vi.fn()}
          onDeleteActivity={vi.fn()}
          onViewInHistory={vi.fn()}
          weekDays={[]}
          trainingDaysCount={2}
          completedDaysCount={0}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Rest day');
    expect(json).toContain('Recovery is part of the plan');
    expect(json).toContain('Train anyway');
  });

  it('S03 Plan screen renders weekly days and Rebuild with AI', async () => {
    await act(async () => {
      tree = create(
        <S03PlanScreen
          currentTab="plan"
          onChangeTab={vi.fn()}
          activePlan={mockPlan}
          eligibility={{
            eligible: true,
            reason: null,
            state: 'ready',
            next_available_at: null,
            previews_used: 0,
            projected_next_available_at: null,
          }}
          todayWeekday={1}
          onOpenSettings={vi.fn()}
          onEditDay={vi.fn()}
          onAddRestDayWorkout={vi.fn()}
          onBuildWithAi={vi.fn()}
          onOpenLockedScreen={vi.fn()}
          onStartBlankCustomPlan={vi.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Your AI rebuild is ready');
    expect(json).toContain('Start a blank custom plan');
  });

  it('S04 History screen renders statistics and filter chips', async () => {
    await act(async () => {
      tree = create(
        <S04HistoryScreen
          currentTab="history"
          onChangeTab={vi.fn()}
          filterDate={null}
          workouts={[]}
          activities={[]}
          onOpenSettings={vi.fn()}
          onClearDateFilter={vi.fn()}
          onEditActivity={vi.fn()}
          onDeleteActivity={vi.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Workouts');
    expect(json).toContain('Activities');
    expect(json).toContain('Nothing logged on this day');
  });

  it('S05 Active Session screen renders sets, ticking and rest timer controls', async () => {
    await act(async () => {
      tree = create(
        <S05ActiveSessionScreen
          session={{
            id: 'sess_1',
            name: 'Push Workout',
            local_date: '2026-11-21',
            status: 'in_progress',
            started_at: new Date().toISOString(),
            exercises: [
              {
                id: 'we_1',
                workout_id: 'sess_1',
                exercise_id: 'bench',
                exercise_name: 'Barbell Bench Press',
                position: 1,
                target_sets: 3,
                target_reps: 10,
                target_weight_kg: 60,
                rest_seconds: 90,
                sets: [
                  {
                    id: 'set_1',
                    workout_exercise_id: 'we_1',
                    set_number: 1,
                    reps: 10,
                    weight_kg: 60,
                    completed: false,
                  },
                ],
              },
            ],
          }}
          weightUnit="kg"
          autoRestTimer={true}
          onMinimize={vi.fn()}
          onFinish={vi.fn()}
          onSwapExercise={vi.fn()}
          onAddExercise={vi.fn()}
          onTickSet={vi.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Barbell Bench Press');
    expect(json).toContain('Finish');
  });

  it('S06 Workout Summary screen renders volume, sets, and effort chips', async () => {
    await act(async () => {
      tree = create(
        <S06WorkoutSummaryScreen
          session={{
            id: 'sess_1',
            name: 'Push Workout',
            local_date: '2026-11-21',
            status: 'in_progress',
            started_at: new Date().toISOString(),
            exercises: [],
          }}
          weightUnit="kg"
          personalBestsCount={1}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('How did it feel?');
    expect(json).toContain('Use these weights next time');
    expect(json).toContain('Save workout');
  });

  it('S10 No Plan screen renders Build with AI and Build my own options', async () => {
    await act(async () => {
      tree = create(
        <S10NoPlanScreen onBuildWithAi={vi.fn()} onBuildMyOwn={vi.fn()} onLogOneOff={vi.fn()} />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Let's set up your week");
    expect(json).toContain('Build with AI');
    expect(json).toContain('Build my own');
  });

  it('S13 to S17 AI builder screens render and validate correctly', async () => {
    // S13 Schedule
    await act(async () => {
      tree = create(
        <S13ScheduleScreen
          inputs={{ days_per_week: 3, training_days: [1, 3, 5], session_minutes: 60 }}
          onUpdate={vi.fn()}
          onContinue={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 1 of 6');

    // S14 Split
    await act(async () => {
      tree = create(
        <S14SplitScreen
          split="auto"
          onSelectSplit={vi.fn()}
          onContinue={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 2 of 6');

    // S15 Experience
    await act(async () => {
      tree = create(
        <S15ExperienceScreen
          experience="beginner"
          onSelectExperience={vi.fn()}
          onContinue={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 3 of 6');

    // S11 Location
    await act(async () => {
      tree = create(
        <S11LocationScreen
          location="advanced_gym"
          onSelectLocation={vi.fn()}
          onContinue={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 4 of 6');

    // S16 Injuries
    await act(async () => {
      tree = create(
        <S16InjuriesNotesScreen
          limitations="No lower back pain"
          workoutNotes=""
          onUpdateLimitations={vi.fn()}
          onUpdateWorkoutNotes={vi.fn()}
          onContinue={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 5 of 6');

    // S17 Review
    await act(async () => {
      tree = create(
        <S17ReviewScreen
          inputs={{
            days_per_week: 3,
            training_days: [1, 3, 5],
            session_minutes: 60,
            split: 'auto',
            experience: 'beginner',
            location: 'advanced_gym',
          }}
          onEditStep={vi.fn()}
          onGenerate={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Step 6 of 6');
    expect(JSON.stringify(tree.toJSON())).toContain('Generate weekly plan');
  });

  it('S18 Generating, S12 Preview, S31 Warning, S32 Applied render correctly', async () => {
    // S18 Generating
    await act(async () => {
      tree = create(<S18GeneratingScreen onGenerationComplete={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Building your plan...');

    // S12 Preview
    await act(async () => {
      tree = create(
        <S12PreviewScreen
          plan={mockPlan}
          previewIndex={1}
          onTryAgain={vi.fn()}
          onUseThisPlan={vi.fn()}
          onEditAnswers={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Preview 1 of 3');
    expect(JSON.stringify(tree.toJSON())).toContain('Try again (2 left)');
    expect(JSON.stringify(tree.toJSON())).toContain('Use this plan');

    // S31 Final Warning Sheet
    await act(async () => {
      tree = create(<S31FinalWarningSheet visible={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Final generation warning');

    // S32 Final Applied Screen
    await act(async () => {
      tree = create(<S32FinalAppliedScreen plan={mockPlan} onDone={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Plan applied!');
  });

  it('Safety block screens S19, S20 and S21 locked render as specified', async () => {
    // S19 Health Blocked
    await act(async () => {
      tree = create(<S19HealthBlockedScreen onAcknowledge={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Safety notice');

    // S20 Age Blocked
    await act(async () => {
      tree = create(<S20AgeBlockedScreen onAcknowledge={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Age requirement');

    // S21 Locked
    await act(async () => {
      tree = create(<S21LockedScreen nextAvailableAt="2027-02-21T00:00:00Z" onBack={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('AI Plan Rebuild');
    expect(JSON.stringify(tree.toJSON())).toContain('Why is there a cooldown?');
  });

  it('Owner shibajyoti.maity06@gmail.com bypasses cooldown check in service fallback', async () => {
    const res = await workoutRedesignService.fallbackEligibilityCheck();
    // User email in mock is shibajyoti.maity06@gmail.com, so eligible is true with state ready
    expect(res.eligible).toBe(true);
    expect(res.state).toBe('ready');
  });

  it('Non-owner free user receives pro_required and cannot generate AI plan', async () => {
    const supabase = (await import('@/lib/supabase')).getSupabase();
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'free_user_1', email: 'freeuser@example.com' } as any },
      error: null,
    } as any);
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: null,
      error: { message: 'pro_required' } as any,
    });

    const res = await workoutRedesignService.fallbackEligibilityCheck();
    expect(res.eligible).toBe(false);
    expect(res.reason).toBe('pro_required');

    await expect(
      workoutRedesignService.generateAiPlan({
        days_per_week: 3,
        training_days: [1, 3, 5],
        session_minutes: 60,
        split: 'auto',
        experience: 'beginner',
        location: 'advanced_gym',
      }),
    ).rejects.toThrow('AI workout plans require CaliPartner Pro.');
  });

  it('Logs completed strength exercise and updates history immediately', async () => {
    await workoutRedesignService.logCompletedStrengthExercise(
      'Bench Press',
      3,
      10,
      60,
      '2026-11-22',
    );

    const history = await workoutRedesignService.fetchHistory('all');
    const logged = history.workouts.find((w) => w.name === 'Bench Press');
    expect(logged).toBeDefined();
    expect(logged?.status).toBe('completed');
    expect(logged?.exercises?.[0]?.target_sets).toBe(3);
    expect(logged?.exercises?.[0]?.target_reps).toBe(10);
    expect(logged?.exercises?.[0]?.target_weight_kg).toBe(60);
  });

  it('S08 Exercise Picker screen renders muscle filter chips and section header', async () => {
    await act(async () => {
      tree = create(<S08ExercisePickerScreen mode="log" onSelect={vi.fn()} onBack={vi.fn()} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('FILTER BY MUSCLE');
    expect(json).toContain('All');
    expect(json).toContain('Chest');
    expect(json).toContain('Back');
  });

  it('S09 Set Targets sheet retains entered weight on re-render', async () => {
    const testExercise = {
      id: 'ex_bench',
      name: 'Bench Press',
      primary_muscle: 'chest',
      equipment: 'barbell',
      is_compound: true,
      target_sets: 3,
      target_reps: 10,
      target_weight_kg: 50,
      rest_seconds: 60,
    };
    await act(async () => {
      tree = create(
        <S09SetTargetsSheet
          visible={true}
          exercise={testExercise}
          mode="log_exercise"
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('50');

    // Re-render with same exercise identity (like AppState background-to-foreground)
    await act(async () => {
      tree.update(
        <S09SetTargetsSheet
          visible={true}
          exercise={{ ...testExercise }}
          mode="log_exercise"
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain('50');
  });
});
