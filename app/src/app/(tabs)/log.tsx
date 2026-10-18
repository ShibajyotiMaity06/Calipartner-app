import React, { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import {
  Sheet,
  LogHubView,
  type LogTileId,
  type QuickAddId,
  type MealSectionType,
} from '@calipartner/ui';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { BarcodeScannerModal } from '@/components/diary/BarcodeScannerModal';
import { WorkoutLoggerModal } from '@/components/workouts/WorkoutLoggerModal';
import { CustomWaterModal, WeightEntryModal } from '@/components/trackers';
import { FocusStartModal } from '@/components/focus';
import { FoodPhotoCameraModal } from '@/components/food_photo';
import { RecipeBrowseView } from '@/components/recipes';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonalFocus } from '@/hooks/usePersonalFocus';
import { useWater } from '@/hooks/useWater';
import { useWeight } from '@/hooks/useWeight';
import { useTheme } from '@/theme/useTheme';

type ActiveFlowState =
  | 'picker'
  | 'food'
  | 'workout'
  | 'water'
  | 'weight'
  | 'fast'
  | 'focus'
  | 'scan'
  | 'photo'
  | 'recipe';

export default function LogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { start: startPersonalFocus } = usePersonalFocus({ userId: user?.id ?? '' });

  const todayDate = new Date().toISOString().slice(0, 10);
  const initialSection: MealSection = getMealSectionForTime(new Date());

  const [currentSection, setCurrentSection] = useState<MealSection>(initialSection);
  const [sheetVisible, setSheetVisible] = useState(true);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowState>('picker');

  // Tracker hooks for Water and Weight
  const { addWater } = useWater(todayDate);
  const { logWeight, latestLog } = useWeight();

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
        // Fast tile opens fasting or routes back to today
        handleCloseAll();
        break;
      case 'focus':
        setActiveFlow('focus');
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

      {/* 6. Focus Start Modal */}
      {activeFlow === 'focus' && (
        <FocusStartModal
          visible={sheetVisible}
          onClose={handleCloseAll}
          onStartPersonal={async (mode, label, plannedSeconds) => {
            await startPersonalFocus(mode, label, plannedSeconds);
            handleCloseAll();
          }}
        />
      )}

      {/* 7. Quick Scan: Barcode Scanner */}
      {activeFlow === 'scan' && (
        <BarcodeScannerModal
          visible={sheetVisible}
          onClose={handleCloseAll}
          onFoodFound={() => handleCloseAll()}
          onCreateCustomFood={() => handleCloseAll()}
        />
      )}

      {/* 8. Quick Photo: Food Photo Camera */}
      {activeFlow === 'photo' && (
        <FoodPhotoCameraModal
          visible={sheetVisible}
          onClose={handleCloseAll}
          onPhotoCaptured={() => handleCloseAll()}
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
