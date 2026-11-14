import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { AvatarHero } from '@/components/avatar/AvatarHero';
import { AppearancePicker } from '@/components/avatar/AppearancePicker';
import { TrackingPreferencesSheet } from '@/components/rooms/TrackingPreferencesSheet';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getMealSectionForTime,
  getLocalDateString,
  foodFromEntrySnapshot,
  personalTrackingCompletion,
  type TrackingMetric,
  type FoodEntry,
  type MealSection,
} from '@calipartner/core';
import { radius, space, Text, homeLayout } from '@calipartner/ui';
import { PersonalDayCard } from '@/components/rooms/PersonalDayCard';
import { HomeSquads } from '@/components/rooms/HomeSquads';
import { FastingCard } from '@/components/fasting/FastingCard';
import { TodayScheduledWorkout } from '@/components/workouts/TodayScheduledWorkout';
import { TodayChallengeCard } from '@/components/progress/TodayChallengeCard';
import { useFocusEffect } from 'expo-router';
import { LoadingState } from '@/components/LoadingState';
import { MonthlyPlanCheckIn } from '@/components/profile/MonthlyPlanCheckIn';
import { CaloriesDetailSheet } from '@/components/diary/CaloriesDetailSheet';
import { CopyMealModal } from '@/components/diary/CopyMealModal';
import { DatePickerSheet } from '@/components/diary/DatePickerSheet';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { MealDetailSheet } from '@/components/diary/MealDetailSheet';
import { MealSectionCard } from '@/components/diary/MealSectionCard';
import { RepeatYesterdayMeals } from '@/components/diary/RepeatYesterdayMeals';
import { QuantityModal } from '@/components/diary/QuantityModal';
import { WaterAlarmModal } from '@/components/trackers/WaterAlarmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useDiary } from '@/hooks/useDiary';
import { useDeleteEntry, useEditEntry } from '@/hooks/useFoodEntries';
import { useRooms } from '@/hooks/useRooms';
import { useSteps } from '@/hooks/useSteps';
import { useWater } from '@/hooks/useWater';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { getDb } from '@/db';

const MEAL_SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function TodayScreen() {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const router = useRouter();
  const tracking = useTrackingPreferences();
  const [editingTracking, setEditingTracking] = useState(false);
  const { profile } = useAuth();
  const {
    currentGoalProfile,
    loading: targetsLoading,
    error: targetsError,
    refresh: refreshTargets,
  } = useTargets();
  const { rooms, loading: roomsLoading, error: roomsError, refresh: refreshRooms } = useRooms();

  // Current selected date in ISO format YYYY-MM-DD
  const todayDate = getLocalDateString(
    new Date(),
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [selectedDate, setSelectedDate] = useState(todayDate);

  // Diary hook for selected date
  const { daySummary, loading: diaryLoading, error: diaryError, refresh } = useDiary(selectedDate);
  const [loadedDiaryDate, setLoadedDiaryDate] = useState<string | null>(null);
  useEffect(() => {
    if (!diaryLoading && !diaryError) setLoadedDiaryDate(selectedDate);
  }, [diaryLoading, diaryError, selectedDate]);
  const { editEntry } = useEditEntry();
  const { deleteEntry } = useDeleteEntry();

  // Steps & Water hooks
  const {
    steps,
    goalSteps,
    loading: stepsLoading,
    error: stepsError,
    refresh: refreshSteps,
  } = useSteps(selectedDate);
  const water = useWater(selectedDate);
  const workouts = useWorkouts(selectedDate);
  const refreshWater = water.refresh;
  const refreshWorkouts = workouts.refresh;

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshSteps(),
      refreshRooms(),
      refreshWater(),
      refreshWorkouts(),
    ]);
  }, [refresh, refreshSteps, refreshRooms, refreshWater, refreshWorkouts]);

  // Sheet & modal states
  const [activeLogSection, setActiveLogSection] = useState<MealSection | null>(null);
  const [inspectingSection, setInspectingSection] = useState<MealSection | null>(null);
  const [showCaloriesDetail, setShowCaloriesDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWaterAlarmModal, setShowWaterAlarmModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [copyModalState, setCopyModalState] = useState<{
    visible: boolean;
    mode: 'meal' | 'day';
    section?: MealSection;
  }>({ visible: false, mode: 'day' });

  // Date navigation handlers
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === todayDate;
  const [now, setNow] = useState(() => new Date());
  const currentSuggestedMeal = getMealSectionForTime(now, profile?.timezone);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    async function loadGuestName() {
      try {
        const db = await getDb();
        const row = await db.getFirstAsync<{ payload: string }>(
          `SELECT payload FROM guest_entries WHERE id = 'guest_profile' LIMIT 1`,
        );
        if (row?.payload) {
          const parsed = JSON.parse(row.payload);
          if (parsed.nickname) setGuestName(parsed.nickname);
        }
      } catch {
        // ignore
      }
    }
    if (!profile?.nickname) {
      loadGuestName();
    }
  }, [profile?.nickname]);

  const targetCalories = currentGoalProfile?.daily_calorie_target ?? null;
  const targetProtein = currentGoalProfile?.protein_grams ?? null;
  const effectiveGoalSteps = currentGoalProfile?.step_goal ?? goalSteps;

  const getContextualQuestion = () =>
    t('repairs.mealQuestion', { meal: t(`diary.sections.${currentSuggestedMeal}`) });

  const [homeVisible, setHomeVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setHomeVisible(true);
      setNow(new Date());
      void refreshRooms();
      return () => setHomeVisible(false);
    }, [refreshRooms]),
  );
  const userName = profile?.nickname || guestName || profile?.username || t('homeRefresh.friend');

  return (
    <View style={{ flex: 1, backgroundColor: dark.bg0 }}>
      {editingTracking && (
        <TrackingPreferencesSheet
          enabled={tracking.enabled}
          onClose={() => setEditingTracking(false)}
          onSave={tracking.save}
        />
      )}
      <ScrollView
        testID="screen-today"
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={diaryLoading}
            onRefresh={handlePullRefresh}
            tintColor={dark.apricot}
          />
        }
      >
        <MonthlyPlanCheckIn />
        <AppearancePicker />

        {/* 2. Greeting & Dynamic Timezone Question */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingRow}>
            <Text variant="heading" color={dark.textHi} style={styles.greetingTitle}>
              {t('homeRefresh.hello', { name: userName })}
            </Text>
            <Pressable
              onPress={() => router.push('/coach')}
              accessibilityRole="button"
              accessibilityLabel={t('homeRefresh.coach')}
              testID="home-coach-icon"
              style={({ pressed }) => [styles.coachButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="medkit-outline" size={homeLayout.iconSize} color={dark.textHi} />
              <Text variant="micro" color={dark.textMid}>
                {t('homeRefresh.ai')}
              </Text>
            </Pressable>
          </View>
          <Text variant="body" color={dark.textMid} style={styles.greetingQuestion}>
            {getContextualQuestion()}
          </Text>
        </View>

        <AvatarHero />
        <HomeSquads
          rooms={rooms}
          loading={roomsLoading}
          error={roomsError}
          onRetry={() => void refreshRooms()}
          visible={homeVisible}
        />
        <PersonalDayCard
          score={personalTrackingCompletion(
            {
              ...daySummary.totals,
              steps: stepsLoading || stepsError ? null : steps,
              water: water.error || water.loading ? null : water.totalMl,
            },
            {
              calories: targetCalories,
              protein: targetProtein,
              carbs: currentGoalProfile?.carb_grams ?? null,
              fat: currentGoalProfile?.fat_grams ?? null,
              steps: effectiveGoalSteps,
              water: currentGoalProfile?.water_ml_goal ?? null,
            },
            tracking.enabled,
          )}
          onEdit={tracking.loading || tracking.error ? undefined : () => setEditingTracking(true)}
          loading={diaryLoading || targetsLoading || tracking.loading}
          error={Boolean(diaryError || targetsError || tracking.error)}
          errorMessage={
            diaryError === 'FOOD_ENERGY_UNAVAILABLE' ? t('fixNovember.energyMissing') : undefined
          }
          onRetry={() => {
            void refresh();
            void refreshTargets();
            void tracking.refresh();
            void refreshSteps();
            void refreshWater();
            void refreshWorkouts();
          }}
          onPress={() => router.push('/(tabs)/progress' as Href)}
          metrics={[
            {
              nutrient: 'calories' as const,
              label: t('squadDesign.calories'),
              value: daySummary.totals.calories,
              target: targetCalories,
              unit: t('squadDesign.kcal'),
            },
            {
              nutrient: 'protein' as const,
              label: t('squadDesign.protein'),
              value: daySummary.totals.protein,
              target: targetProtein,
              unit: t('squadDesign.grams'),
            },
            {
              nutrient: 'carbs' as const,
              label: t('squadDesign.carbs'),
              value: daySummary.totals.carbs,
              target: currentGoalProfile?.carb_grams ?? null,
              unit: t('squadDesign.grams'),
            },
            {
              nutrient: 'fat' as const,
              label: t('squadDesign.fat'),
              value: daySummary.totals.fat,
              target: currentGoalProfile?.fat_grams ?? null,
              unit: t('squadDesign.grams'),
            },
            {
              id: 'steps',
              loading: stepsLoading,
              error: Boolean(stepsError),
              label: t('squadDesign.steps'),
              value: steps,
              target: effectiveGoalSteps,
              unit: t('squadDesign.stepUnit'),
            },
            {
              id: 'water',
              label: t('squadDesign.water'),
              value: water.totalMl,
              target: currentGoalProfile?.water_ml_goal ?? null,
              unit: t('squadDesign.ml'),
              loading: water.loading,
              error: water.error,
            },
          ].map((metric) => ({
            ...metric,
            enabled: tracking.enabled[(metric.nutrient ?? metric.id) as TrackingMetric],
          }))}
        />

        {/* 6. Date Selector & Meal Logging Diary Sections */}
        <FastingCard />
        <TodayChallengeCard />
        <View style={styles.sectionBlock}>
          <View style={styles.dateSelectorRow}>
            <Pressable
              testID="btn-prev-day"
              onPress={() => handleShiftDate(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('diary.previousDay')}
            >
              <Ionicons name="chevron-back" size={18} color={dark.textMid} />
            </Pressable>

            <Pressable
              testID="btn-open-date-picker"
              onPress={() => setShowDatePicker(true)}
              style={styles.datePickerChip}
              accessibilityLabel={`Selected date ${selectedDate}`}
            >
              <Ionicons name="calendar-outline" size={14} color={dark.apricot} />
              <Text variant="label" color={dark.textHi} style={{ fontWeight: '600' }}>
                {isToday ? `${t('diary.today')} (${selectedDate})` : selectedDate}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-next-day"
              onPress={() => handleShiftDate(1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('diary.nextDay')}
            >
              <Ionicons name="chevron-forward" size={18} color={dark.textMid} />
            </Pressable>
          </View>

          {diaryLoading && loadedDiaryDate !== selectedDate ? (
            <View style={styles.loadingBox}>
              <LoadingState />
            </View>
          ) : (
            <View style={styles.mealsContainer} testID="meals-section">
              {MEAL_SECTIONS.map((sec) => (
                <MealSectionCard
                  key={sec}
                  compact
                  section={sec}
                  summary={daySummary.sections[sec]}
                  isCurrentMealSuggestion={currentSuggestedMeal === sec}
                  onAddFood={(s) => setActiveLogSection(s)}
                  onOpenDetail={(s) => setInspectingSection(s)}
                  onEditEntry={(entry) => setEditingEntry(entry)}
                  onDeleteEntry={(id) => void deleteEntry(id)}
                  onCopyMeal={(s) => setCopyModalState({ visible: true, mode: 'meal', section: s })}
                />
              ))}
              <RepeatYesterdayMeals key={selectedDate} localDate={selectedDate} />
            </View>
          )}
        </View>

        {isToday && !workouts.loading && !workouts.error && (
          <TodayScheduledWorkout
            localDate={todayDate}
            hasWorkout={workouts.workouts.length > 0}
            onSaved={() => void refreshWorkouts()}
          />
        )}

        <View style={{ height: space[8] }} />

        {/* MODALS */}
        {/* 1. Food Log Modal */}
        {activeLogSection && (
          <FoodLogModal
            visible={Boolean(activeLogSection)}
            defaultSection={activeLogSection}
            localDate={selectedDate}
            onClose={() => setActiveLogSection(null)}
            onLogged={() => {
              setActiveLogSection(null);
              void refresh();
            }}
          />
        )}

        {/* 2. Water Alarm & Logging Modal */}
        <WaterAlarmModal
          visible={showWaterAlarmModal}
          onClose={() => {
            setShowWaterAlarmModal(false);
            void refresh();
          }}
          selectedDate={selectedDate}
        />

        {/* 4. Date Picker Sheet */}
        <DatePickerSheet
          visible={showDatePicker}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        {/* 6. Calories & Macros Detail Sheet */}
        <CaloriesDetailSheet
          visible={showCaloriesDetail}
          eatenCalories={daySummary.totals.calories}
          targetCalories={targetCalories}
          proteinGrams={daySummary.totals.protein}
          carbGrams={daySummary.totals.carbs}
          fatGrams={daySummary.totals.fat}
          fiberGrams={daySummary.totals.fiber}
          sugarGrams={daySummary.totals.sugar}
          sodiumMg={daySummary.totals.sodium_mg}
          entries={Object.values(daySummary.sections).flatMap((section) => section.entries)}
          targetProtein={targetProtein}
          targetCarbs={currentGoalProfile?.carb_grams ?? null}
          targetFat={currentGoalProfile?.fat_grams ?? null}
          onClose={() => setShowCaloriesDetail(false)}
        />

        {/* 7. Meal Detail Sheet */}
        {inspectingSection && (
          <MealDetailSheet
            visible={Boolean(inspectingSection)}
            section={inspectingSection}
            summary={daySummary.sections[inspectingSection]}
            onClose={() => setInspectingSection(null)}
            onAddFood={() => {
              const sec = inspectingSection;
              setInspectingSection(null);
              setActiveLogSection(sec);
            }}
            onEditEntry={(entry) => {
              setInspectingSection(null);
              setEditingEntry(entry);
            }}
            onDeleteEntry={async (id) => {
              await deleteEntry(id);
              void refresh();
            }}
            onCopyMeal={(s) => setCopyModalState({ visible: true, mode: 'meal', section: s })}
          />
        )}

        {/* 8. Quantity / Edit Entry Modal */}
        {editingEntry && (
          <QuantityModal
            visible={Boolean(editingEntry)}
            food={foodFromEntrySnapshot(editingEntry)}
            initialEntry={editingEntry}
            defaultSection={editingEntry.meal_section}
            onClose={() => setEditingEntry(null)}
            onSave={async (data) => {
              const saved = await editEntry(
                editingEntry.id,
                {
                  quantity: data.quantity,
                  unit: data.unit,
                  meal_section: data.mealSection,
                  ...data.nutrientOverrides,
                },
                data.food,
              );
              if (!saved) throw new Error(t('common.errorBody'));
              setEditingEntry(null);
              void refresh();
            }}
          />
        )}

        {/* 9. Copy Meal Modal */}
        <CopyMealModal
          visible={copyModalState.visible}
          mode={copyModalState.mode}
          sourceSection={copyModalState.section}
          sourceDate={selectedDate}
          onClose={() => setCopyModalState({ visible: false, mode: 'day' })}
          onSuccess={() => {
            setCopyModalState({ visible: false, mode: 'day' });
            void refresh();
          }}
        />
      </ScrollView>
    </View>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: dark.bg0,
    },
    scrollContent: {
      paddingHorizontal: space[4],
      paddingTop: space[5],
      paddingBottom: 80,
    },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    coachButton: {
      minWidth: homeLayout.touchSize,
      minHeight: homeLayout.touchSize,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[1],
    },
    greetingSection: {
      marginBottom: space[4],
    },
    greetingTitle: {
      flex: 1,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    greetingQuestion: {
      fontSize: 15,
    },
    sectionBlock: {
      marginBottom: space[5],
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space[3],
    },
    sectionHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginBottom: space[3],
    },
    progressRingsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[3],
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: dark.s1,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: dark.hairline,
      paddingVertical: space[3],
      paddingHorizontal: space[2],
    },
    ringTileContainer: {
      flexGrow: 1,
      minWidth: space[9],
      minHeight: homeLayout.touchSize,
      gap: space[1],
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space[3],
    },
    datePickerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: dark.s1,
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: dark.hairline,
    },
    loadingBox: {
      padding: space[4],
      alignItems: 'center',
    },
    mealsContainer: {
      gap: space[3],
    },
  });
