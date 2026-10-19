import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getMealSectionForTime,
  type Food,
  type FoodEntry,
  type MealSection,
  type UserStreak,
} from '@calipartner/core';
import { Text, CalorieRing, MacroBar, Avatar, dark, space, radius } from '@calipartner/ui';
import { CaloriesDetailSheet } from '@/components/diary/CaloriesDetailSheet';
import { CopyMealModal } from '@/components/diary/CopyMealModal';
import { DatePickerSheet } from '@/components/diary/DatePickerSheet';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { MealDetailSheet } from '@/components/diary/MealDetailSheet';
import { MealSectionCard } from '@/components/diary/MealSectionCard';
import { QuantityModal } from '@/components/diary/QuantityModal';
import { StreakDetailSheet } from '@/components/diary/StreakDetailSheet';
import { SyncStatusBanner } from '@/components/diary/SyncStatusBanner';
import { WaterCard, StepsCard, WeightCard } from '@/components/trackers';
import { TodayWorkoutCard } from '@/components/workouts';
import { FocusCard } from '@/components/focus';
import { FastingCard } from '@/components/fasting';
import { useAuth } from '@/contexts/AuthContext';
import { useDiary } from '@/hooks/useDiary';
import { useAddEntry, useDeleteEntry, useEditEntry } from '@/hooks/useFoodEntries';
import { useRooms } from '@/hooks/useRooms';
import type { SectionSuggestion } from '@/hooks/useSectionSuggestions';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import { fetchUserStreaks } from '@/services/progressService';

const MEAL_SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

export default function TodayScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { currentGoalProfile } = useTargets();
  const { rooms } = useRooms();

  // Current selected date in ISO format YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // User streak state
  const [streakData, setStreakData] = useState<UserStreak | null>(null);

  // Diary hook for selected date
  const { daySummary, loading: diaryLoading, refresh } = useDiary(selectedDate);
  const { addEntry } = useAddEntry();
  const { editEntry } = useEditEntry();
  const { deleteEntry } = useDeleteEntry();

  // Sheet & modal states
  const [activeLogSection, setActiveLogSection] = useState<MealSection | null>(null);
  const [inspectingSection, setInspectingSection] = useState<MealSection | null>(null);
  const [showCaloriesDetail, setShowCaloriesDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [copyModalState, setCopyModalState] = useState<{
    visible: boolean;
    mode: 'meal' | 'day';
    section?: MealSection;
  }>({ visible: false, mode: 'day' });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch streak
  const loadStreak = useCallback(async () => {
    try {
      const data = await fetchUserStreaks(getSupabase());
      setStreakData(data);
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // Date navigation handlers
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const currentSuggestedMeal = getMealSectionForTime(new Date());

  const targetCalories = currentGoalProfile?.daily_calorie_target ?? 2000;
  const targetProtein = currentGoalProfile?.protein_grams ?? 140;
  const targetCarbs = currentGoalProfile?.carb_grams ?? 240;
  const targetFat = currentGoalProfile?.fat_grams ?? 55;

  const eatenCalories = daySummary.totals.calories;
  const remainingCalories = Math.max(0, targetCalories - eatenCalories);
  const isOver = eatenCalories > targetCalories && targetCalories > 0;
  const overAmount = isOver ? eatenCalories - targetCalories : 0;

  // PRD 7.4 Logged Day rule: >= 50% calories AND >= 2 entries
  const totalEntriesCount =
    daySummary.sections.breakfast.entries.length +
    daySummary.sections.lunch.entries.length +
    daySummary.sections.dinner.entries.length +
    daySummary.sections.snacks.entries.length +
    daySummary.sections.extra.entries.length;

  const isLoggedDay = eatenCalories >= targetCalories * 0.5 && totalEntriesCount >= 2;
  const currentStreak = streakData?.current_streak ?? 1;

  // All entries flattened for C02 top contributors
  const allDayEntries = [
    ...daySummary.sections.breakfast.entries,
    ...daySummary.sections.lunch.entries,
    ...daySummary.sections.dinner.entries,
    ...daySummary.sections.snacks.entries,
    ...daySummary.sections.extra.entries,
  ];

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = profile?.nickname || profile?.username || 'Partner';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  const handleEditEntrySave = async (data: {
    food: Food;
    quantity: number;
    unit: string;
    mealSection: MealSection;
  }) => {
    if (editingEntry) {
      await editEntry(
        editingEntry.id,
        {
          quantity: data.quantity,
          unit: data.unit,
          meal_section: data.mealSection,
        },
        data.food,
      );
      setEditingEntry(null);
      void refresh();
    }
  };

  const handleSuggestionClick = async (suggestion: SectionSuggestion, section: MealSection) => {
    const mockFood: Food = {
      id: suggestion.food_id,
      source: 'user',
      name: suggestion.food_name,
      brand: suggestion.brand_name ?? null,
      barcode: null,
      serving_units: [{ unit: suggestion.last_unit, grams: 100 }],
      calories_per_100g: 200,
      protein_per_100g: 10,
      carbs_per_100g: 25,
      fat_per_100g: 5,
      fiber_per_100g: 0,
      sugar_per_100g: 0,
      sodium_mg_per_100g: 0,
      owner_id: null,
      attribution: null,
    };

    await addEntry({
      food: mockFood,
      quantity: suggestion.last_quantity,
      unit: suggestion.last_unit,
      mealSection: section,
      localDate: selectedDate,
      source: 'history',
    });

    setToastMessage(`Added to ${section}`);
    setTimeout(() => setToastMessage(null), 3500);
    void refresh();
  };

  const currentRoom = rooms[0];

  return (
    <ScrollView
      testID="screen-today"
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={diaryLoading} onRefresh={refresh} tintColor={dark.apricot} />
      }
    >
      {/* 1. Header (64): Greeting + Date Chip + Streak Pill */}
      <View style={styles.headerBar} testID="today-header">
        <View style={styles.headerLeft}>
          <Text variant="heading" color={dark.textHi} numberOfLines={1}>
            {getGreeting()}
          </Text>

          {/* Date Chip (tap -> C05) */}
          <View style={styles.dateChipRow}>
            <Pressable
              testID="btn-prev-day"
              onPress={() => handleShiftDate(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('diary.previousDay')}
            >
              <Ionicons name="chevron-back" size={16} color={dark.textMid} />
            </Pressable>

            <Pressable
              testID="btn-open-date-picker"
              onPress={() => setShowDatePicker(true)}
              style={styles.dateChip}
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
              <Ionicons name="chevron-forward" size={16} color={dark.textMid} />
            </Pressable>
          </View>
        </View>

        {/* Streak Pill (28 high, tap -> C07) */}
        <Pressable
          testID="btn-streak-pill"
          onPress={() => setShowStreakDetail(true)}
          style={styles.streakPill}
          accessibilityLabel={`${currentStreak} day streak`}
        >
          <Ionicons name="flame" size={16} color={dark.apricot} />
          <Text variant="numeralM" color={dark.textHi}>
            {currentStreak}
          </Text>
        </Pressable>
      </View>

      {/* Offline and Sync Status Banner */}
      <SyncStatusBanner />

      {/* 2. Room Strip (44): Avatars of room members or Dashed Card "Find a partner" */}
      {currentRoom ? (
        <Pressable
          testID="strip-room-members"
          onPress={() => router.push('/(tabs)/room' as Href)}
          style={styles.roomStrip}
          accessibilityRole="button"
          accessibilityLabel={`Room ${currentRoom.name}, ${currentRoom.member_count} members`}
        >
          <View style={styles.roomStripLeft}>
            <Avatar size="sm" name={currentRoom.name} identityHue="iris" />
            <View>
              <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '600' }}>
                {currentRoom.name}
              </Text>
              <Text variant="micro" color={dark.textLo}>
                {currentRoom.member_count} members · Tap for room feed
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
        </Pressable>
      ) : (
        <Pressable
          testID="strip-no-room-partner-card"
          onPress={() => router.push('/(tabs)/room' as Href)}
          style={styles.emptyRoomStrip}
          accessibilityRole="button"
          accessibilityLabel="Find a partner or invite a friend"
        >
          <View style={styles.emptyRoomLeft}>
            <Ionicons name="people-outline" size={20} color={dark.apricot} />
            <Text variant="bodyS" color={dark.textMid}>
              Find a partner or invite a friend
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={dark.apricot} />
        </Pressable>
      )}

      {/* 3. Hero Card (s1): CalorieRing 120 on left + MacroBar on right (tap -> C02) */}
      <Pressable
        testID="hero-card-calories"
        onPress={() => setShowCaloriesDetail(true)}
        style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('diary.calorieRingA11y', {
          eaten: eatenCalories,
          target: targetCalories,
          remaining: isOver ? overAmount : remainingCalories,
        })}
      >
        <View style={styles.heroRow}>
          {/* CalorieRing 120 */}
          <CalorieRing
            eaten={eatenCalories}
            target={targetCalories}
            identityHue="iris"
            size={120}
            strokeWidth={11}
            testID="today-hero-calorie-ring"
          />

          {/* Macro bar & gram values */}
          <View style={styles.heroRightStats}>
            <View style={styles.heroNumbersRow}>
              <View>
                <Text variant="label" color={dark.textLo}>
                  {t('diary.caloriesEaten')}
                </Text>
                <Text variant="numeralM" color={dark.textHi}>
                  {eatenCalories}
                </Text>
              </View>

              <View>
                <Text variant="label" color={dark.textLo}>
                  {isOver ? t('diary.caloriesOver') : t('diary.caloriesRemaining')}
                </Text>
                <Text variant="numeralM" color={isOver ? dark.cream : dark.textHi}>
                  {isOver ? `${overAmount} over` : remainingCalories}
                </Text>
              </View>
            </View>

            <MacroBar
              proteinGrams={daySummary.totals.protein}
              carbsGrams={daySummary.totals.carbs}
              fatGrams={daySummary.totals.fat}
              proteinTargetGrams={targetProtein}
              carbsTargetGrams={targetCarbs}
              fatTargetGrams={targetFat}
              identityHue="iris"
              height={8}
            />
          </View>
        </View>

        {/* Under Hero: Logged-day status sentence (C06 moment) */}
        <View style={styles.heroStatusLine} testID="status-hero-logged-day">
          <Ionicons
            name={isLoggedDay ? 'checkmark-circle' : 'time-outline'}
            size={14}
            color={isLoggedDay ? dark.teal : dark.textLo}
          />
          <Text
            variant="label"
            color={isLoggedDay ? dark.teal : dark.textMid}
            style={{ fontWeight: isLoggedDay ? '700' : '500' }}
          >
            {isLoggedDay ? `Logged. Day ${currentStreak}.` : 'Day counts at 50% of your target.'}
          </Text>
        </View>
      </Pressable>

      {/* 4. Five Meal Cards: Breakfast, Lunch, Dinner, Snacks, Extra */}
      {diaryLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={dark.apricot} size="large" />
          <Text variant="label" color={dark.textLo} style={{ marginTop: 8 }}>
            {t('common.loading')}
          </Text>
        </View>
      ) : (
        <View style={styles.mealsContainer} testID="meals-section">
          {MEAL_SECTIONS.map((sec) => (
            <MealSectionCard
              key={sec}
              section={sec}
              summary={daySummary.sections[sec]}
              isCurrentMealSuggestion={currentSuggestedMeal === sec}
              onAddFood={(s) => setActiveLogSection(s)}
              onOpenDetail={(s) => setInspectingSection(s)}
              onEditEntry={(entry) => setEditingEntry(entry)}
              onDeleteEntry={(id) => void deleteEntry(id)}
              onCopyMeal={(s) => setCopyModalState({ visible: true, mode: 'meal', section: s })}
              onSelectSuggestion={handleSuggestionClick}
            />
          ))}
        </View>
      )}

      {/* 5. Two Half Cards: Water & Steps (reflows to single column at 200%) */}
      <View style={styles.halfCardsRow} testID="today-trackers-half-cards">
        <View style={styles.halfCardCol}>
          <WaterCard selectedDate={selectedDate} />
        </View>
        <View style={styles.halfCardCol}>
          <StepsCard selectedDate={selectedDate} />
        </View>
      </View>

      {/* 6. Optional Cards in Specified Order: Workouts, Weight, Focus, Fasting, Recipes, Coach */}
      <View style={styles.optionalCardsContainer} testID="today-optional-cards">
        <TodayWorkoutCard selectedDate={selectedDate} />
        <WeightCard selectedDate={selectedDate} />
        <FocusCard selectedDate={selectedDate} />
        <FastingCard />

        {/* Recipes Banner */}
        <Pressable
          testID="card-today-recipes"
          onPress={() => router.push('/recipes' as Href)}
          style={styles.bannerCard}
          accessibilityRole="button"
          accessibilityLabel={t('today.recipesCard.title')}
        >
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconBox}>
              <Ionicons name="restaurant-outline" size={20} color={dark.apricot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                {t('today.recipesCard.title')}
              </Text>
              <Text variant="bodyS" color={dark.textLo}>
                {t('today.recipesCard.subtitle')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={dark.apricot} />
        </Pressable>

        {/* AI Coach Entry Card */}
        <Pressable
          testID="card-today-ai-coach"
          onPress={() => router.push('/coach' as Href)}
          style={styles.bannerCard}
          accessibilityRole="button"
          accessibilityLabel={t('coach.title')}
        >
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconBox}>
              <Ionicons name="sparkles" size={20} color={dark.apricot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                {t('coach.title')}
              </Text>
              <Text variant="bodyS" color={dark.textLo}>
                {t('coach.subtitle')}
              </Text>
            </View>
          </View>
          <View style={styles.coachCta}>
            <Text variant="label" color={dark.apricot} style={{ fontWeight: '700' }}>
              Ask Coach
            </Text>
            <Ionicons name="chevron-forward" size={14} color={dark.apricot} />
          </View>
        </Pressable>
      </View>

      {/* Floating / Toast Action Message */}
      {toastMessage && (
        <View style={styles.toastContainer} testID="today-toast-banner">
          <Ionicons name="checkmark-circle" size={18} color={dark.teal} />
          <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '600' }}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* C02: Calories & Macros Detail Sheet */}
      {showCaloriesDetail && (
        <CaloriesDetailSheet
          visible={showCaloriesDetail}
          onClose={() => setShowCaloriesDetail(false)}
          eatenCalories={eatenCalories}
          targetCalories={targetCalories}
          proteinGrams={daySummary.totals.protein}
          targetProtein={targetProtein}
          carbGrams={daySummary.totals.carbs}
          targetCarbs={targetCarbs}
          fatGrams={daySummary.totals.fat}
          targetFat={targetFat}
          entries={allDayEntries}
        />
      )}

      {/* C03: Meal Section Detail Sheet */}
      {inspectingSection && (
        <MealDetailSheet
          visible={Boolean(inspectingSection)}
          section={inspectingSection}
          summary={daySummary.sections[inspectingSection]}
          onClose={() => setInspectingSection(null)}
          onAddFood={(sec) => {
            setInspectingSection(null);
            setActiveLogSection(sec);
          }}
          onEditEntry={(entry) => setEditingEntry(entry)}
          onDeleteEntry={(id) => {
            void deleteEntry(id);
            void refresh();
          }}
          onCopyMeal={(sec) => setCopyModalState({ visible: true, mode: 'meal', section: sec })}
        />
      )}

      {/* C05: Date Picker / Calendar Sheet */}
      {showDatePicker && (
        <DatePickerSheet
          visible={showDatePicker}
          selectedDate={selectedDate}
          onSelectDate={(newDate) => setSelectedDate(newDate)}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* C07: Streak Detail Sheet */}
      {showStreakDetail && (
        <StreakDetailSheet
          visible={showStreakDetail}
          currentStreak={currentStreak}
          longestStreak={streakData?.longest_streak ?? currentStreak}
          onClose={() => setShowStreakDetail(false)}
        />
      )}

      {/* D02: Food Log Modal (opens on Recent by default) */}
      {activeLogSection && (
        <FoodLogModal
          visible={Boolean(activeLogSection)}
          defaultSection={activeLogSection}
          localDate={selectedDate}
          onClose={() => setActiveLogSection(null)}
          onLogged={() => {
            void refresh();
            loadStreak();
          }}
        />
      )}

      {/* C04 / D03: Edit Entry Quantity Modal */}
      {editingEntry && (
        <QuantityModal
          visible={Boolean(editingEntry)}
          food={{
            id: editingEntry.food_id ?? '',
            source: 'user',
            name: editingEntry.food_name,
            brand: editingEntry.brand_name ?? null,
            barcode: null,
            serving_units: [{ unit: editingEntry.unit, grams: 100 }],
            calories_per_100g: editingEntry.calories,
            protein_per_100g: editingEntry.protein,
            carbs_per_100g: editingEntry.carbs,
            fat_per_100g: editingEntry.fat,
            fiber_per_100g: editingEntry.fiber,
            sugar_per_100g: editingEntry.sugar,
            sodium_mg_per_100g: editingEntry.sodium_mg,
            owner_id: user?.id ?? null,
            attribution: null,
          }}
          initialEntry={editingEntry}
          defaultSection={editingEntry.meal_section}
          onClose={() => setEditingEntry(null)}
          onSave={handleEditEntrySave}
          onDelete={(id) => {
            void deleteEntry(id);
            void refresh();
          }}
        />
      )}

      {/* D12: Copy Meal or Day Modal */}
      {copyModalState.visible && (
        <CopyMealModal
          visible={copyModalState.visible}
          mode={copyModalState.mode}
          sourceDate={selectedDate}
          sourceSection={copyModalState.section}
          onClose={() => setCopyModalState({ visible: false, mode: 'day' })}
          onSuccess={() => void refresh()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  scrollContent: {
    paddingTop: 54,
    paddingHorizontal: space[4],
    paddingBottom: 110,
    gap: space[4],
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  headerLeft: {
    flex: 1,
    gap: space[1],
  },
  dateChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: 28,
    paddingHorizontal: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  roomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    paddingHorizontal: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  roomStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  emptyRoomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    paddingHorizontal: space[3],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: dark.hairlineLit,
  },
  emptyRoomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  heroCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[3],
  },
  heroCardPressed: {
    backgroundColor: dark.s2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  heroRightStats: {
    flex: 1,
    gap: space[3],
  },
  heroNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  heroStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    paddingTop: space[2],
  },
  mealsContainer: {
    gap: space[3],
  },
  loadingBox: {
    paddingVertical: space[8],
    alignItems: 'center',
  },
  halfCardsRow: {
    flexDirection: 'row',
    gap: space[3],
    flexWrap: 'wrap',
  },
  halfCardCol: {
    flex: 1,
    minWidth: 160,
  },
  optionalCardsContainer: {
    gap: space[3],
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  toastContainer: {
    position: 'absolute',
    bottom: 120,
    left: space[4],
    right: space[4],
    backgroundColor: dark.s3,
    borderRadius: radius.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
});
