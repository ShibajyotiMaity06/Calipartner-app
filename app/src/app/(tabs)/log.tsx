import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import {
  Sheet,
  LogHubView,
  type LogTileId,
  type QuickAddId,
  type MealSectionType,
} from '@calipartner/ui';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { WorkoutLoggerModal } from '@/components/workouts/WorkoutLoggerModal';
import { CustomWaterModal, WeightEntryModal } from '@/components/trackers';

import { RecipeBrowseView } from '@/components/recipes';
import { QuickAddCaloriesModal } from '@/components/diary/QuickAddCaloriesModal';
import { FastingTimerModal } from '@/components/fasting';
import { useAuth } from '@/contexts/AuthContext';
import { useAddEntry } from '@/hooks/useFoodEntries';

import { useWater } from '@/hooks/useWater';
import { useWeight } from '@/hooks/useWeight';
import { useTheme } from '@/theme/useTheme';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';

type ActiveFlowState =
  | 'picker'
  | 'food'
  | 'workout'
  | 'water'
  | 'weight'
  | 'fast'
  | 'scan'
  | 'photo'
  | 'recipe'
  | 'quick_calories';

export default function LogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const { localDate: todayDate } = useCurrentLocalDate();
  const initialSection: MealSection = getMealSectionForTime(new Date());

  const [currentSection, setCurrentSection] = useState<MealSection>(initialSection);
  const [sheetVisible, setSheetVisible] = useState(true);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowState>('picker');
  useFocusEffect(
    useCallback(() => {
      setCurrentSection(getMealSectionForTime(new Date()));
      setActiveFlow('picker');
      setSheetVisible(true);
      return () => setSheetVisible(false);
    }, []),
  );

  // Tracker hooks for Water and Weight
  const { addWater } = useWater(todayDate);
  const { logWeight, latestLog } = useWeight();
  const { addEntry } = useAddEntry();

  const handleCloseAll = () => {
    setSheetVisible(false);
    router.replace('/today');
  };

  const handleCycleMealSection = () => {
    const cycle: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const idx = cycle.indexOf(currentSection);
    const nextIdx = (idx + 1) % cycle.length;
    setCurrentSection(cycle[nextIdx] ?? 'lunch');
  };

  const handleTileSelect = (tile: LogTileId) => {
    switch (tile) {
      case 'food':
        setActiveFlow('food');
        break;
      case 'workout':
        setActiveFlow('workout');
        break;
      case 'water':
        setActiveFlow('water');
        break;
      case 'weight':
        setActiveFlow('weight');
        break;
      case 'fast':
        setActiveFlow('fast');
        break;
    }
  };

  const handleQuickAddSelect = (action: QuickAddId) => {
    switch (action) {
      case 'scan':
        setActiveFlow('scan');
        break;
      case 'photo':
        setActiveFlow('photo');
        break;
      case 'recipes':
        setActiveFlow('recipe');
        break;
    }
  };

  // Map meal section to MealSectionType for UI
  const uiMealSection: MealSectionType =
    currentSection === 'breakfast'
      ? 'breakfast'
      : currentSection === 'dinner'
        ? 'dinner'
        : currentSection === 'snacks'
          ? 'snack'
          : 'lunch';

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background }]}>
      {/* 1. D01: Log Hub Tall Glass Sheet */}
      {activeFlow === 'picker' && (
        <Sheet
          testID="log-sheet-modal"
          visible={sheetVisible}
          onClose={handleCloseAll}
          snapPoint="tall"
          isGlass={true}
          accessibilityLabel="Log Hub"
        >
          <LogHubView
            mealSection={uiMealSection}
            onCycleMealSection={handleCycleMealSection}
            onSelectTile={handleTileSelect}
            onSelectQuickAdd={handleQuickAddSelect}
            onClose={handleCloseAll}
            showFastTile={true}
          />
        </Sheet>
      )}

      {/* 2. Food Log Modal */}
      {activeFlow === 'food' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          onClose={handleCloseAll}
          onLogged={handleCloseAll}
        />
      )}

      {/* 3. Workout Logger Modal */}
      {activeFlow === 'workout' && (
        <WorkoutLoggerModal
          visible={sheetVisible}
          defaultDate={todayDate}
          onClose={handleCloseAll}
          onSaved={handleCloseAll}
        />
      )}

      {/* 4. Water Quick Add Modal */}
      {activeFlow === 'water' && (
        <CustomWaterModal
          visible={sheetVisible}
          onClose={handleCloseAll}
          onSave={async (amountMl) => {
            await addWater(amountMl);
            handleCloseAll();
          }}
        />
      )}

      {/* 5. Weight Entry Modal */}
      {activeFlow === 'weight' && (
        <WeightEntryModal
          visible={sheetVisible}
          defaultDate={todayDate}
          startWeight={latestLog?.weight_kg ?? null}
          currentWeight={latestLog?.weight_kg ?? null}
          totalChangeKg={null}
          weeklyPace={null}
          projectedDate={null}
          hasEnoughTrend={false}
          onClose={handleCloseAll}
          onSave={async (weightKg, notes, date) => {
            await logWeight(weightKg, notes, date);
            handleCloseAll();
          }}
        />
      )}

      {/* 5.5 Fasting Timer Modal */}
      {activeFlow === 'fast' && (
        <FastingTimerModal visible={sheetVisible} onClose={handleCloseAll} userId={user?.id} />
      )}

      {/* 7. Quick Scan: Barcode Scanner */}
      {activeFlow === 'scan' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          initialTab="scan"
          onClose={handleCloseAll}
          onLogged={handleCloseAll}
        />
      )}

      {/* 8. Quick Photo: Food Photo Camera & AI Scanner */}
      {activeFlow === 'photo' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          initialTab="photo"
          onClose={handleCloseAll}
          onLogged={handleCloseAll}
        />
      )}

      {/* 9. Quick Recipes: Recipe Library Flow */}
      {activeFlow === 'recipe' && (
        <Modal
          visible={sheetVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseAll}
        >
          <View style={[styles.recipeContainer, { backgroundColor: colors.background }]}>
            <RecipeBrowseView
              showBackOrClose={true}
              onBackOrClose={handleCloseAll}
              initialMealSection={currentSection}
              localDate={todayDate}
              onRecipeLogged={handleCloseAll}
            />
          </View>
        </Modal>
      )}

      {/* 10. Quick Calories Add Modal (D10/D11) */}
      {activeFlow === 'quick_calories' && (
        <QuickAddCaloriesModal
          visible={sheetVisible}
          defaultSection={currentSection}
          onClose={handleCloseAll}
          onSave={async (food, qty, unit, sec) => {
            await addEntry({
              food,
              quantity: qty,
              unit,
              mealSection: sec,
              localDate: todayDate,
              source: 'history',
            });
            handleCloseAll();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  recipeContainer: {
    flex: 1,
    paddingTop: 40,
  },
});
