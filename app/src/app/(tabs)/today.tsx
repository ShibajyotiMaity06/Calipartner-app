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
import Svg, { Circle } from 'react-native-svg';
import {
  getMealSectionForTime,
  type Food,
  type FoodEntry,
  type MealSection,
  type UserStreak,
} from '@calipartner/core';
import { Avatar, dark, radius, space, Text } from '@calipartner/ui';
import { CaloriesDetailSheet } from '@/components/diary/CaloriesDetailSheet';
import { CopyMealModal } from '@/components/diary/CopyMealModal';
import { DatePickerSheet } from '@/components/diary/DatePickerSheet';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { MealDetailSheet } from '@/components/diary/MealDetailSheet';
import { MealSectionCard } from '@/components/diary/MealSectionCard';
import { QuantityModal } from '@/components/diary/QuantityModal';
import { StreakDetailSheet } from '@/components/diary/StreakDetailSheet';
import { SyncStatusBanner } from '@/components/diary/SyncStatusBanner';
import { WaterAlarmModal } from '@/components/trackers/WaterAlarmModal';
import { WorkoutHubModal } from '@/components/workouts';
import { CardioTrackerModal } from '@/components/cardio/CardioTrackerModal';
import { FloatingAiCoachButton } from '@/components/coach';
import { useAuth } from '@/contexts/AuthContext';
import { useDiary } from '@/hooks/useDiary';
import { useAddEntry, useDeleteEntry, useEditEntry } from '@/hooks/useFoodEntries';
import { useRooms } from '@/hooks/useRooms';
import { useSteps } from '@/hooks/useSteps';
import { useTargets } from '@/hooks/useTargets';
import { useWater } from '@/hooks/useWater';
import { t } from '@/i18n';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { fetchUserStreaks } from '@/services/progressService';

const MEAL_SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

interface MiniRingProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  target: string | number;
  label: string;
  progressRatio: number;
  color: string;
  testID?: string;
  onPress?: () => void;
}

function MiniRing({
  icon,
  value,
  target,
  label,
  progressRatio,
  color,
  testID,
  onPress,
}: MiniRingProps) {
  const size = 70;
  const strokeWidth = 5;
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const clampedRatio = Math.min(1, Math.max(0, progressRatio));
  const strokeDashoffset = circumference * (1 - clampedRatio);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={styles.ringTileContainer}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} of ${target}`}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={ringRadius}
            stroke={dark.s2}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={ringRadius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
          />
        </Svg>
        <View style={styles.ringCenterContent}>
          <Ionicons name={icon} size={14} color={color} style={{ marginBottom: 1 }} />
          <Text
            variant="micro"
            color={dark.textHi}
            style={{ fontWeight: '700', fontSize: 11, lineHeight: 13 }}
            numberOfLines={1}
          >
            {value}
          </Text>
          <Text
            variant="micro"
            color={dark.textLo}
            style={{ fontSize: 9, lineHeight: 11 }}
            numberOfLines={1}
          >
            /{target}
          </Text>
        </View>
      </View>
      <Text variant="micro" color={dark.textMid} style={styles.ringLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

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

  // Steps & Water hooks
  const { steps, goalSteps, refresh: refreshSteps } = useSteps(selectedDate);
  const { totalMl, goalMl, refresh: refreshWater } = useWater(selectedDate);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshSteps(), refreshWater()]);
  }, [refresh, refreshSteps, refreshWater]);

  // Sheet & modal states
  const [activeLogSection, setActiveLogSection] = useState<MealSection | null>(null);
  const [inspectingSection, setInspectingSection] = useState<MealSection | null>(null);
  const [showCaloriesDetail, setShowCaloriesDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [showWaterAlarmModal, setShowWaterAlarmModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
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

  const targetCalories = currentGoalProfile?.daily_calorie_target ?? 2000;
  const targetProtein = currentGoalProfile?.protein_grams ?? 140;
  const effectiveGoalSteps = currentGoalProfile?.step_goal ?? goalSteps;
  const effectiveGoalMl = currentGoalProfile?.water_ml_goal ?? goalMl;

  const eatenCalories = daySummary.totals.calories;
  const eatenProtein = daySummary.totals.protein;
  const currentStreak = streakData?.current_streak ?? 1;

  // Dynamic question based on user local time
  const getContextualQuestion = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11.5) {
      return 'Did you log your breakfast?';
    } else if (hour >= 11.5 && hour < 16.5) {
      return 'Did you log your lunch?';
    } else if (hour >= 16.5 && hour < 21.5) {
      return 'Did you log your dinner?';
    } else {
      return 'Did you log your meals and water today?';
    }
  };

  const currentRoom = rooms[0];
  const userName = profile?.nickname || guestName || profile?.username || 'Friend';

  return (
    <View style={{ flex: 1, backgroundColor: dark.bg0 }}>
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
        {/* 1. Header (Brand: CaliPartner 🌿 - Centered) */}
        <View style={styles.topBrandBar} testID="today-brand-header">
          <View style={styles.brandTitleRow}>
            <Text variant="heading" color={dark.textHi} style={styles.brandName}>
              CaliPartner
            </Text>
            <Text style={styles.brandLeaf}>🌿</Text>
          </View>
        </View>

        {/* 2. Greeting & Dynamic Timezone Question */}
        <View style={styles.greetingSection}>
          <Text variant="heading" color={dark.textHi} style={styles.greetingTitle}>
            Hi, {userName} 👋
          </Text>
          <Text variant="body" color={dark.textMid} style={styles.greetingQuestion}>
            {getContextualQuestion()}
          </Text>
        </View>

        {/* 3. Choose Your Activity (2x2 Grid: Cardio, Workout, Water, Food Logging) */}
        <View style={styles.sectionBlock}>
          <Text variant="heading" color={dark.textHi} style={styles.sectionHeaderTitle}>
            Choose Your Activity
          </Text>

          <View style={styles.activityGrid}>
            {/* Cardio */}
            <Pressable
              testID="activity-card-cardio"
              style={({ pressed }) => [styles.activityTile, pressed && styles.tilePressed]}
              onPress={() => setShowCardioModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Cardio activity"
            >
              <View style={styles.activityTileTop}>
                <View
                  style={[
                    styles.activityIconCircle,
                    { backgroundColor: 'rgba(244, 182, 125, 0.15)' },
                  ]}
                >
                  <Ionicons name="walk" size={20} color={dark.apricot} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </View>
              <Text variant="body" color={dark.textHi} style={styles.activityLabel}>
                Cardio
              </Text>
            </Pressable>

            {/* Workout */}
            <Pressable
              testID="activity-card-workout"
              style={({ pressed }) => [styles.activityTile, pressed && styles.tilePressed]}
              onPress={() => setShowWorkoutModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Workout activity"
            >
              <View style={styles.activityTileTop}>
                <View
                  style={[
                    styles.activityIconCircle,
                    { backgroundColor: 'rgba(235, 122, 107, 0.15)' },
                  ]}
                >
                  <Ionicons name="barbell" size={20} color={dark.danger} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </View>
              <Text variant="body" color={dark.textHi} style={styles.activityLabel}>
                Workout
              </Text>
            </Pressable>

            {/* Water */}
            <Pressable
              testID="activity-card-water"
              style={({ pressed }) => [styles.activityTile, pressed && styles.tilePressed]}
              onPress={() => setShowWaterAlarmModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Water activity and phone alarms"
            >
              <View style={styles.activityTileTop}>
                <View
                  style={[
                    styles.activityIconCircle,
                    { backgroundColor: 'rgba(56, 178, 172, 0.15)' },
                  ]}
                >
                  <Ionicons name="water" size={20} color={dark.teal} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </View>
              <Text variant="body" color={dark.textHi} style={styles.activityLabel}>
                Water
              </Text>
            </Pressable>

            {/* Food Logging */}
            <Pressable
              testID="activity-card-food-logging"
              style={({ pressed }) => [styles.activityTile, pressed && styles.tilePressed]}
              onPress={() => setActiveLogSection(currentSuggestedMeal)}
              accessibilityRole="button"
              accessibilityLabel="Food logging"
            >
              <View style={styles.activityTileTop}>
                <View
                  style={[
                    styles.activityIconCircle,
                    { backgroundColor: 'rgba(244, 182, 125, 0.15)' },
                  ]}
                >
                  <Ionicons name="restaurant" size={20} color={dark.apricot} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
              </View>
              <Text variant="body" color={dark.textHi} style={styles.activityLabel}>
                Food Logging
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 4. Today's Progress (Steps, Calories, Water, Protein - with View Details >) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="heading" color={dark.textHi} style={styles.sectionHeaderTitle}>
              Today's Progress
            </Text>
            <Pressable
              onPress={() => setShowCaloriesDetail(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View progress details"
            >
              <Text variant="bodyS" color={dark.apricot} style={{ fontWeight: '600' }}>
                View Details ›
              </Text>
            </Pressable>
          </View>

          <View style={styles.progressRingsRow}>
            {/* Steps */}
            <MiniRing
              icon="footsteps"
              value={steps > 999 ? `${(steps / 1000).toFixed(1)}k` : steps}
              target={
                effectiveGoalSteps > 999
                  ? `${Math.round(effectiveGoalSteps / 1000)}k`
                  : effectiveGoalSteps
              }
              label="Steps"
              progressRatio={effectiveGoalSteps > 0 ? steps / effectiveGoalSteps : 0}
              color={dark.apricot}
              testID="ring-steps"
              onPress={() => router.push('/(tabs)/progress' as Href)}
            />

            {/* Calories */}
            <MiniRing
              icon="flame"
              value={eatenCalories}
              target={targetCalories}
              label="Calories"
              progressRatio={targetCalories > 0 ? eatenCalories / targetCalories : 0}
              color="#EB7A6B"
              testID="ring-calories"
              onPress={() => setShowCaloriesDetail(true)}
            />

            {/* Water */}
            <MiniRing
              icon="water"
              value={(totalMl / 1000).toFixed(1)}
              target={`${(effectiveGoalMl / 1000).toFixed(0)} L`}
              label="Water"
              progressRatio={effectiveGoalMl > 0 ? totalMl / effectiveGoalMl : 0}
              color={dark.teal}
              testID="ring-water"
              onPress={() => setShowWaterAlarmModal(true)}
            />

            {/* Protein (instead of workout session) */}
            <MiniRing
              icon="barbell"
              value={`${eatenProtein}g`}
              target={`${targetProtein}g`}
              label="Protein"
              progressRatio={targetProtein > 0 ? eatenProtein / targetProtein : 0}
              color="#48BB78"
              testID="ring-protein"
              onPress={() => setShowCaloriesDetail(true)}
            />
          </View>
        </View>

        {/* 5. Your Squad (replaces partner, shows 2-3 avatars, streak card, no bottom scenic image) */}
        <View style={styles.sectionBlock}>
          <Pressable
            testID="card-your-squad"
            style={styles.squadCard}
            onPress={() => router.push('/(tabs)/room' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Your squad"
          >
            <View style={styles.squadHeaderRow}>
              <View style={styles.squadTitleLeft}>
                <Ionicons name="people" size={16} color={dark.apricot} />
                <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '700' }}>
                  {currentRoom?.name ? currentRoom.name : 'Your Squad'}
                </Text>
                <Text style={{ fontSize: 13 }}>👑</Text>
              </View>
            </View>

            <View style={styles.squadContentRow}>
              {/* Overlapping member avatars */}
              <View style={styles.squadAvatarsRow}>
                <Avatar
                  size="sm"
                  uri={profile?.avatar_url}
                  name={userName}
                  identityHue="iris"
                  style={styles.avatarFirst}
                />
                <Avatar
                  size="sm"
                  name={currentRoom?.name ? 'Partner' : 'Squad'}
                  identityHue="teal"
                  style={styles.avatarSecond}
                />
                {currentRoom && currentRoom.member_count > 2 && (
                  <Avatar size="sm" name="Member" identityHue="peach" style={styles.avatarThird} />
                )}
              </View>

              {/* Motivational message & subtle progress line */}
              <View style={styles.squadMessageCol}>
                <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '600' }}>
                  You both are doing great! 💪
                </Text>
                <View style={styles.squadProgressTrack}>
                  <View
                    style={[
                      styles.squadProgressFill,
                      { width: `${Math.min(100, Math.max(30, currentStreak * 25))}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Streak Pill */}
              <Pressable
                testID="btn-squad-streak"
                onPress={() => setShowStreakDetail(true)}
                style={styles.squadStreakPill}
                accessibilityLabel={`${currentStreak} day streak`}
              >
                <Ionicons name="flame" size={16} color={dark.apricot} />
                <View>
                  <Text variant="micro" color={dark.textHi} style={{ fontWeight: '700' }}>
                    {currentStreak} Day
                  </Text>
                  <Text variant="micro" color={dark.textLo} style={{ fontSize: 9 }}>
                    Streak ›
                  </Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </View>

        {/* 6. Date Selector & Meal Logging Diary Sections */}
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

          {diaryLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={dark.apricot} size="small" />
              <Text variant="micro" color={dark.textLo} style={{ marginTop: 6 }}>
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
                />
              ))}
            </View>
          )}
        </View>

        {/* Floating Bottom Spacer for Navigation Bar */}
        <View style={{ height: 32 }} />

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

        {/* 3. Workout Suite Hub Modal */}
        <WorkoutHubModal
          visible={showWorkoutModal}
          onClose={() => {
            setShowWorkoutModal(false);
            void refresh();
          }}
        />

        {/* 3.5 Dedicated Cardio Tracker Modal (Walking & Running GPS) */}
        <CardioTrackerModal
          visible={showCardioModal}
          onClose={() => {
            setShowCardioModal(false);
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

        {/* 5. Streak Detail Sheet */}
        <StreakDetailSheet
          visible={showStreakDetail}
          currentStreak={currentStreak}
          longestStreak={streakData?.longest_streak ?? currentStreak}
          onClose={() => setShowStreakDetail(false)}
        />

        {/* 6. Calories & Macros Detail Sheet */}
        <CaloriesDetailSheet
          visible={showCaloriesDetail}
          eatenCalories={eatenCalories}
          targetCalories={targetCalories}
          proteinGrams={daySummary.totals.protein}
          carbGrams={daySummary.totals.carbs}
          fatGrams={daySummary.totals.fat}
          targetProtein={targetProtein}
          targetCarbs={currentGoalProfile?.carb_grams ?? 240}
          targetFat={currentGoalProfile?.fat_grams ?? 55}
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
            food={{
              id: editingEntry.food_id ?? editingEntry.id,
              source: 'user',
              name: editingEntry.food_name,
              brand: null,
              barcode: null,
              serving_units: [{ unit: editingEntry.unit, grams: 100 }],
              calories_per_100g: editingEntry.calories,
              protein_per_100g: editingEntry.protein,
              carbs_per_100g: editingEntry.carbs,
              fat_per_100g: editingEntry.fat,
              fiber_per_100g: 0,
              sugar_per_100g: 0,
              sodium_mg_per_100g: 0,
              owner_id: null,
              attribution: null,
            }}
            initialEntry={editingEntry}
            defaultSection={editingEntry.meal_section}
            onClose={() => setEditingEntry(null)}
            onSave={async (data) => {
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

        {/* 10. Water Alarm & Logging Modal */}
        <WaterAlarmModal
          visible={showWaterAlarmModal}
          onClose={() => {
            setShowWaterAlarmModal(false);
            void refreshWater();
          }}
          selectedDate={selectedDate}
        />

        {/* 11. Workout Hub Modal */}
        <WorkoutHubModal
          visible={showWorkoutModal}
          onClose={() => {
            setShowWorkoutModal(false);
            void refresh();
          }}
        />

        {/* 12. Cardio Tracker Modal */}
        <CardioTrackerModal
          visible={showCardioModal}
          onClose={() => {
            setShowCardioModal(false);
            void refreshSteps();
          }}
          selectedDate={selectedDate}
        />
      </ScrollView>
      <FloatingAiCoachButton />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingTop: space[5],
    paddingBottom: 80,
  },
  topBrandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandLeaf: {
    fontSize: 18,
  },
  greetingSection: {
    marginBottom: space[4],
  },
  greetingTitle: {
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
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  activityTile: {
    width: '48%',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[3],
    justifyContent: 'space-between',
    minHeight: 90,
  },
  tilePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  activityTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  activityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressRingsRow: {
    flexDirection: 'row',
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    marginTop: 6,
    fontWeight: '600',
    fontSize: 12,
  },
  squadCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
  },
  squadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  squadTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  squadContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squadAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  avatarFirst: {
    zIndex: 3,
  },
  avatarSecond: {
    marginLeft: -12,
    zIndex: 2,
  },
  avatarThird: {
    marginLeft: -12,
    zIndex: 1,
  },
  squadMessageCol: {
    flex: 1,
    marginHorizontal: space[2],
  },
  squadProgressTrack: {
    height: 6,
    backgroundColor: dark.s2,
    borderRadius: radius.full,
    marginTop: 6,
    overflow: 'hidden',
  },
  squadProgressFill: {
    height: '100%',
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
  },
  squadStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: dark.s2,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
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
