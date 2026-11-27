import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  foodFromEntrySnapshot,
  getLocalDateString,
  getMealSectionForTime,
  type FoodEntry,
  type MealSection,
} from '@calipartner/core';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Text as V1Text,
  borders as v1Borders,
  colors as v1Colors,
  layout as v1Layout,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import { LoadingState } from '@/components/LoadingState';
import { CaloriesDetailSheet } from '@/components/diary/CaloriesDetailSheet';
import { CopyMealModal } from '@/components/diary/CopyMealModal';
import { DatePickerSheet } from '@/components/diary/DatePickerSheet';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { MealDetailSheet } from '@/components/diary/MealDetailSheet';
import { QuantityModal } from '@/components/diary/QuantityModal';
import { RepeatYesterdayMeals } from '@/components/diary/RepeatYesterdayMeals';
import { CoachLockedSheetV1 } from '@/components/coach/CoachLockedSheetV1';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import {
  TodayCoachCardV1,
  TodayDayCardV1,
  TodayFastingCardV1,
  TodayHeaderV1,
  TodayMealRowV1,
  TodaySquadCardV1,
  TodayStickyBarV1,
  TodayWorkoutCardV1,
} from '@/components/home/TodayV1Components';
import { MonthlyPlanCheckIn } from '@/components/profile/MonthlyPlanCheckIn';
import { TrackingPreferencesSheet } from '@/components/rooms/TrackingPreferencesSheet';
import { CustomWaterModal } from '@/components/trackers/CustomWaterModal';
import { WaterAlarmModal } from '@/components/trackers/WaterAlarmModal';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useAvatar } from '@/hooks/useAvatar';
import { useDiary } from '@/hooks/useDiary';
import { useDeleteEntry, useEditEntry } from '@/hooks/useFoodEntries';
import { useRooms } from '@/hooks/useRooms';
import { useSteps } from '@/hooks/useSteps';
import { useSubscription } from '@/hooks/useSubscription';
import { useTargets } from '@/hooks/useTargets';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { useWater } from '@/hooks/useWater';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { diaryEvents } from '@/services/diaryEvents';

const MEAL_SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const STICKY_SCROLL_THRESHOLD = 200;

function formatMealsDatePill(isoDate: string, isToday: boolean): string {
  if (isToday) return t('homeV1.todayLabel');
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
  return `${weekday}, ${day} ${month}`;
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracking = useTrackingPreferences();
  const [editingTracking, setEditingTracking] = useState(false);
  const { profile } = useAuth();
  const { state: avatarState } = useAvatar();
  const { currentTier, hasActiveAccess, isTrial } = useSubscription();
  const {
    currentGoalProfile,
    loading: targetsLoading,
    error: targetsError,
    refresh: refreshTargets,
  } = useTargets();
  const { rooms, loading: roomsLoading, error: roomsError, refresh: refreshRooms } = useRooms();

  const todayDate = getLocalDateString(
    new Date(),
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const { daySummary, loading: diaryLoading, error: diaryError, refresh } = useDiary(selectedDate);
  const [loadedDiaryDate, setLoadedDiaryDate] = useState<string | null>(null);
  useEffect(() => {
    if (!diaryLoading && !diaryError) setLoadedDiaryDate(selectedDate);
  }, [diaryLoading, diaryError, selectedDate]);
  const { editEntry } = useEditEntry();
  const { deleteEntry } = useDeleteEntry();

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

  useEffect(() => {
    return diaryEvents.subscribe(() => {
      void handlePullRefresh();
    });
  }, [handlePullRefresh]);

  const [activeLogSection, setActiveLogSection] = useState<MealSection | null>(null);
  const [inspectingSection, setInspectingSection] = useState<MealSection | null>(null);
  const [showCaloriesDetail, setShowCaloriesDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showWaterAlarmModal, setShowWaterAlarmModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [coachLockedOpen, setCoachLockedOpen] = useState(false);
  const [coachPaywallOpen, setCoachPaywallOpen] = useState(false);
  const [copyModalState, setCopyModalState] = useState<{
    visible: boolean;
    mode: 'meal' | 'day';
    section?: MealSection;
  }>({ visible: false, mode: 'day' });

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
      void loadGuestName();
    }
  }, [profile?.nickname]);

  const targetCalories = currentGoalProfile?.daily_calorie_target ?? null;
  const targetProtein = currentGoalProfile?.protein_grams ?? null;
  const effectiveGoalSteps = currentGoalProfile?.step_goal ?? goalSteps;

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
  const isPro = currentTier === 'pro' && hasActiveAccess && !isTrial;
  const coinBalance = avatarState?.enabled
    ? avatarState.balances.earned + avatarState.balances.purchased
    : null;
  const caloriesLeft = targetCalories != null ? targetCalories - daySummary.totals.calories : null;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y >= STICKY_SCROLL_THRESHOLD;
    setScrolledPastHero((prev) => (prev === next ? prev : next));
  };

  return (
    <View style={styles.rootContainer}>
      {editingTracking && (
        <TrackingPreferencesSheet
          enabled={tracking.enabled}
          onClose={() => setEditingTracking(false)}
          onSave={tracking.save}
        />
      )}

      {scrolledPastHero ? (
        <View style={[styles.stickyOverlay, { paddingTop: insets.top }]}>
          <TodayStickyBarV1
            selectedDate={selectedDate}
            isToday={isToday}
            caloriesLeft={caloriesLeft}
            onPrevDay={() => handleShiftDate(-1)}
            onNextDay={() => handleShiftDate(1)}
            onOpenDatePicker={() => setShowDatePicker(true)}
            onOpenCaloriesDetail={() => setShowCaloriesDetail(true)}
          />
        </View>
      ) : null}

      <ScrollView
        testID="screen-today"
        style={styles.rootScroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + v1Space.md,
            paddingBottom: v1Space.max * 3 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={diaryLoading}
            onRefresh={() => void handlePullRefresh()}
            tintColor={v1Colors.apricot}
          />
        }
      >
        <MonthlyPlanCheckIn />

        <TodayHeaderV1
          selectedDate={selectedDate}
          userName={userName}
          isPro={isPro}
          coinBalance={coinBalance}
          onUpgradePress={() => router.push('/paywall' as Href)}
          onCoinPress={() => router.push('/wallet' as Href)}
          onProfilePress={() => router.push('/(tabs)/me' as Href)}
          onSettingsPress={() => router.push('/settings' as Href)}
        />

        <TodayDayCardV1
          eatenCalories={daySummary.totals.calories}
          targetCalories={targetCalories}
          protein={{ value: daySummary.totals.protein, target: targetProtein }}
          carbs={{
            value: daySummary.totals.carbs,
            target: currentGoalProfile?.carb_grams ?? null,
          }}
          fat={{ value: daySummary.totals.fat, target: currentGoalProfile?.fat_grams ?? null }}
          steps={{
            value: steps,
            target: effectiveGoalSteps,
            loading: stepsLoading,
            error: Boolean(stepsError),
          }}
          water={{
            valueMl: water.totalMl,
            targetMl: currentGoalProfile?.water_ml_goal ?? null,
            loading: water.loading,
            error: water.error,
          }}
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
          onOpenDetail={() => setShowCaloriesDetail(true)}
          onEditTracking={
            tracking.loading || tracking.error ? undefined : () => setEditingTracking(true)
          }
          onQuickAddWater={() => void water.addWater(250)}
          onOpenWater={() => setShowWaterModal(true)}
        />

        <TodayCoachCardV1
          isPro={isPro}
          onPress={() => {
            if (isPro) {
              router.push('/coach' as Href);
            } else {
              setCoachLockedOpen(true);
            }
          }}
        />

        <TodaySquadCardV1
          rooms={rooms}
          loading={roomsLoading}
          error={roomsError}
          visible={homeVisible}
          onRetry={() => void refreshRooms()}
        />

        <View style={styles.mealsSectionBlock}>
          <View style={styles.mealsHeaderRow}>
            <V1Text variant="titleM" color="textHi">
              {t('homeV1.mealsHeading')}
            </V1Text>

            <View style={styles.mealsDateCluster}>
              <Pressable
                onPress={() => handleShiftDate(-1)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('diary.previousDay')}
                style={({ pressed }) => [
                  styles.dateArrowBtn,
                  pressed ? styles.pressedSurface : null,
                ]}
                testID="btn-prev-day"
              >
                <ChevronLeftIcon size={15} color={v1Colors.textMid} />
              </Pressable>

              <Pressable
                onPress={() => setShowDatePicker(true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Selected date ${selectedDate}`}
                style={({ pressed }) => [
                  styles.dateCenterBtn,
                  pressed ? styles.pressedSurface : null,
                ]}
                testID="btn-open-date-picker"
              >
                <V1Text variant="label" color="textHi">
                  {formatMealsDatePill(selectedDate, isToday)}
                </V1Text>
              </Pressable>

              <Pressable
                onPress={() => handleShiftDate(1)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('diary.nextDay')}
                style={({ pressed }) => [
                  styles.dateArrowBtn,
                  pressed ? styles.pressedSurface : null,
                ]}
                testID="btn-next-day"
              >
                <ChevronRightIcon size={15} color={v1Colors.textMid} />
              </Pressable>
            </View>
          </View>

          {diaryLoading && loadedDiaryDate !== selectedDate ? (
            <View style={styles.loadingBox}>
              <LoadingState />
            </View>
          ) : (
            <View style={styles.mealsContainer} testID="meals-section">
              {MEAL_SECTIONS.map((sec) => (
                <TodayMealRowV1
                  key={sec}
                  section={sec}
                  summary={daySummary.sections[sec]}
                  suggested={currentSuggestedMeal === sec}
                  onPress={() => setInspectingSection(sec)}
                  onAdd={() => setActiveLogSection(sec)}
                />
              ))}
              <RepeatYesterdayMeals
                key={selectedDate}
                localDate={selectedDate}
                variant="v1"
                remainingCalories={caloriesLeft}
              />
            </View>
          )}
        </View>

        <TodayFastingCardV1 />

        {isToday && !workouts.loading && !workouts.error ? (
          <TodayWorkoutCardV1
            localDate={todayDate}
            hasWorkout={workouts.workouts.length > 0}
            onSaved={() => void refreshWorkouts()}
          />
        ) : null}
      </ScrollView>

      {activeLogSection ? (
        <FoodLogModal
          visible={Boolean(activeLogSection)}
          defaultSection={activeLogSection}
          localDate={selectedDate}
          onClose={() => setActiveLogSection(null)}
          onLogged={() => {
            void refresh();
          }}
        />
      ) : null}

      <CustomWaterModal
        visible={showWaterModal}
        totalMl={water.totalMl}
        goalMl={currentGoalProfile?.water_ml_goal ?? water.goalMl}
        logs={water.logs}
        onClose={() => {
          setShowWaterModal(false);
          void refreshWater();
        }}
        onSave={async (amountMl) => {
          await water.addWater(amountMl);
          await refreshWater();
        }}
        onUndo={async () => {
          await water.undoLast();
          await refreshWater();
        }}
        onOpenReminders={() => {
          setShowWaterModal(false);
          setShowWaterAlarmModal(true);
        }}
      />

      <WaterAlarmModal
        visible={showWaterAlarmModal}
        onClose={() => {
          setShowWaterAlarmModal(false);
          void refreshWater();
        }}
        selectedDate={selectedDate}
      />

      <DatePickerSheet
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

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

      {inspectingSection ? (
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
      ) : null}

      {editingEntry ? (
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
      ) : null}

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

      <CoachLockedSheetV1
        visible={coachLockedOpen}
        onClose={() => setCoachLockedOpen(false)}
        onSeeAllPlans={() => setCoachPaywallOpen(true)}
        onUnlocked={() => {
          setCoachLockedOpen(false);
          router.push('/coach' as Href);
        }}
      />

      <PaywallModal
        visible={coachPaywallOpen}
        preselectedTier="pro"
        context="coach"
        onClose={() => setCoachPaywallOpen(false)}
        onSuccess={() => {
          setCoachPaywallOpen(false);
          router.push('/coach' as Href);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  rootScroll: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  scrollContent: {
    paddingHorizontal: v1Layout.screenPaddingX,
    gap: v1Space.lg,
  },
  stickyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: v1Colors.bg0,
  },
  mealsSectionBlock: {
    gap: v1Space.md,
  },
  mealsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: v1Space.md,
  },
  mealsDateCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.xs,
  },
  dateArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenterBtn: {
    minHeight: 34,
    paddingHorizontal: v1Space.sm,
    justifyContent: 'center',
  },
  pressedSurface: {
    backgroundColor: v1Colors.s2,
  },
  loadingBox: {
    padding: v1Space.lg,
    alignItems: 'center',
  },
  mealsContainer: {
    gap: v1Space.sm + 2,
  },
});
