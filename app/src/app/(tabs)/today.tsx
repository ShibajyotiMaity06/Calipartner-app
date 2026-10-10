import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Food, FoodEntry, MealSection } from '@calipartner/core';
import { CalorieMacroRing } from '@/components/diary/CalorieMacroRing';
import { CopyMealModal } from '@/components/diary/CopyMealModal';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { MealSectionCard } from '@/components/diary/MealSectionCard';
import { QuantityModal } from '@/components/diary/QuantityModal';
import { SyncStatusBanner } from '@/components/diary/SyncStatusBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useDiary } from '@/hooks/useDiary';
import { useAddEntry, useDeleteEntry, useEditEntry } from '@/hooks/useFoodEntries';
import type { SectionSuggestion } from '@/hooks/useSectionSuggestions';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentGoalProfile, loading: targetsLoading } = useTargets();

  // Current selected date in ISO format YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Diary hook for selected date
  const { daySummary, loading: diaryLoading, refresh } = useDiary(selectedDate);
  const { addEntry } = useAddEntry();
  const { editEntry } = useEditEntry();
  const { deleteEntry } = useDeleteEntry();

  // Modals state
  const [activeLogSection, setActiveLogSection] = useState<MealSection | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [copyModalState, setCopyModalState] = useState<{
    visible: boolean;
    mode: 'meal' | 'day';
    section?: MealSection;
  }>({ visible: false, mode: 'day' });

  // Date Navigation Handlers
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  const targetCalories = currentGoalProfile?.daily_calorie_target ?? 2000;
  const targetProtein = currentGoalProfile?.protein_grams ?? 140;
  const targetCarbs = currentGoalProfile?.carb_grams ?? 240;
  const targetFat = currentGoalProfile?.fat_grams ?? 55;

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
    }
  };

  const handleSuggestionClick = async (suggestion: SectionSuggestion, section: MealSection) => {
    // Quick log suggestion directly!
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
  };

  return (
    <ScrollView
      testID="screen-today"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: 54,
        paddingHorizontal: spacing.md,
        paddingBottom: 90,
        gap: spacing.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Date Navigation Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          testID="btn-prev-day"
          onPress={() => handleShiftDate(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
          accessibilityLabel={t('diary.previousDay')}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <Pressable
          testID="btn-jump-today"
          onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
          <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.text }}>
            {isToday ? `${t('diary.today')} (${selectedDate})` : selectedDate}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable
            testID="btn-copy-day"
            onPress={() => setCopyModalState({ visible: true, mode: 'day' })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
            accessibilityLabel={t('diary.copyDay')}
          >
            <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            testID="btn-next-day"
            onPress={() => handleShiftDate(1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
            accessibilityLabel={t('diary.nextDay')}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Offline and Sync Status Banner */}
      <SyncStatusBanner />

      {/* Onboarding goals prompt if user hasn't set targets */}
      {!targetsLoading && !currentGoalProfile && (
        <View
          testID="banner-onboarding-prompt"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.accent,
            borderWidth: 1.5,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.xs,
          }}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '700' }}>
            {t('onboarding.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {t('onboarding.goal.subtitle')}
          </Text>
          <Pressable
            testID="btn-prompt-setup-goals"
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.sm,
              paddingVertical: 10,
              alignItems: 'center',
              marginTop: spacing.xs,
            }}
            onPress={() => router.push('/onboarding' as Href)}
          >
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: fontSize.sm }}>
              {t('onboarding.steps.goal')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Calorie Ring and Macro Bars Hero Card */}
      <CalorieMacroRing
        eatenCalories={daySummary.totals.calories}
        targetCalories={targetCalories}
        proteinGrams={daySummary.totals.protein}
        targetProtein={targetProtein}
        carbGrams={daySummary.totals.carbs}
        targetCarbs={targetCarbs}
        fatGrams={daySummary.totals.fat}
        targetFat={targetFat}
      />

      {/* Five Meal Sections */}
      {diaryLoading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 8 }}>
            {t('common.loading')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <MealSectionCard
            section="breakfast"
            summary={daySummary.sections.breakfast}
            onAddFood={(sec) => setActiveLogSection(sec)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={(id) => void deleteEntry(id)}
            onCopyMeal={(sec) =>
              setCopyModalState({ visible: true, mode: 'meal', section: sec })
            }
            onSelectSuggestion={handleSuggestionClick}
          />

          <MealSectionCard
            section="lunch"
            summary={daySummary.sections.lunch}
            onAddFood={(sec) => setActiveLogSection(sec)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={(id) => void deleteEntry(id)}
            onCopyMeal={(sec) =>
              setCopyModalState({ visible: true, mode: 'meal', section: sec })
            }
            onSelectSuggestion={handleSuggestionClick}
          />

          <MealSectionCard
            section="dinner"
            summary={daySummary.sections.dinner}
            onAddFood={(sec) => setActiveLogSection(sec)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={(id) => void deleteEntry(id)}
            onCopyMeal={(sec) =>
              setCopyModalState({ visible: true, mode: 'meal', section: sec })
            }
            onSelectSuggestion={handleSuggestionClick}
          />

          <MealSectionCard
            section="snacks"
            summary={daySummary.sections.snacks}
            onAddFood={(sec) => setActiveLogSection(sec)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={(id) => void deleteEntry(id)}
            onCopyMeal={(sec) =>
              setCopyModalState({ visible: true, mode: 'meal', section: sec })
            }
            onSelectSuggestion={handleSuggestionClick}
          />

          <MealSectionCard
            section="extra"
            summary={daySummary.sections.extra}
            onAddFood={(sec) => setActiveLogSection(sec)}
            onEditEntry={(entry) => setEditingEntry(entry)}
            onDeleteEntry={(id) => void deleteEntry(id)}
            onCopyMeal={(sec) =>
              setCopyModalState({ visible: true, mode: 'meal', section: sec })
            }
            onSelectSuggestion={handleSuggestionClick}
          />
        </View>
      )}

      {/* Log Food Bottom Sheet / Modal */}
      {activeLogSection && (
        <FoodLogModal
          visible={Boolean(activeLogSection)}
          defaultSection={activeLogSection}
          localDate={selectedDate}
          onClose={() => setActiveLogSection(null)}
          onLogged={() => void refresh()}
        />
      )}

      {/* Edit Entry Quantity Modal */}
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
          onDelete={(id) => void deleteEntry(id)}
        />
      )}

      {/* Copy Meal or Day Modal */}
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
