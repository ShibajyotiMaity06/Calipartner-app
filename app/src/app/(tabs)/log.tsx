import { WeightHistoryModal } from '@/components/trackers/WeightHistoryModal';
import { weightChange, type WeightLog } from '@calipartner/core';
import { LogSomethingView } from '@/components/diary/LogSomethingView';
import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import { Sheet, Button, space } from '@calipartner/ui';
import { t } from '@/i18n';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { WorkoutHubModal } from '@/components/workouts/WorkoutHubModal';
import { CardioHub } from '@/components/workouts/CardioHub';
import { WorkoutLoggerModal } from '@/components/workouts/WorkoutLoggerModal';
import { StepsCard } from '@/components/trackers/StepsCard';
import { CustomWaterModal, ManualStepsModal, WeightEntryModal } from '@/components/trackers';

import { RecipeBrowseView } from '@/components/recipes';
import { QuickAddCaloriesModal } from '@/components/diary/QuickAddCaloriesModal';
import { FastingTimerModal } from '@/components/fasting';
import { useAuth } from '@/contexts/AuthContext';
import { useAddEntry } from '@/hooks/useFoodEntries';

import { useWater } from '@/hooks/useWater';
import { useWeight } from '@/hooks/useWeight';
import { useSteps } from '@/hooks/useSteps';
import { useTheme } from '@/theme/useTheme';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { closeBrowserModalsThen, useBrowserModalBack } from '@/hooks/useBrowserModalBack';

type ActiveFlowState =
  | 'picker'
  | 'food'
  | 'workout'
  | 'water'
  | 'steps'
  | 'cardio'
  | 'cycling'
  | 'running'
  | 'weight'
  | 'fast'
  | 'scan'
  | 'photo'
  | 'recipe'
  | 'quick_calories';

export default function LogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string }>();
  const { colors } = useTheme();
  const { user, profile } = useAuth();

  const { localDate: todayDate } = useCurrentLocalDate();
  const initialSection: MealSection = getMealSectionForTime(new Date(), profile?.timezone);

  const [currentSection, setCurrentSection] = useState<MealSection>(initialSection);
  const [sheetVisible, setSheetVisible] = useState(true);
  const [weightHistoryOpen, setWeightHistoryOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightLog | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowState>('picker');
  useFocusEffect(
    useCallback(() => {
      setCurrentSection(getMealSectionForTime(new Date(), profile?.timezone));
      setActiveFlow(
        ['food', 'workout', 'water', 'steps', 'weight', 'cardio', 'cycling', 'running'].includes(
          params.flow ?? '',
        )
          ? (params.flow as ActiveFlowState)
          : 'picker',
      );
      setWeightHistoryOpen(false);
      setEditingWeight(null);
      setSheetVisible(true);
      return () => setSheetVisible(false);
    }, [params.flow, profile?.timezone]),
  );

  // Tracker hooks for Water and Weight
  const { addWater } = useWater(todayDate);
  const {
    logs: weightLogs,
    logWeight,
    editWeight,
    deleteWeight,
    latestLog,
    startingWeightKg,
    weeklyPaceKg,
    projectedDate,
    projectionReason,
    loading: weightLoading,
    error: weightError,
    refresh: refreshWeight,
  } = useWeight();
  const { logManualSteps } = useSteps(todayDate);
  const { addEntry } = useAddEntry();

  const handleCloseAll = () => {
    router.setParams({ flow: undefined });
    setSheetVisible(false);
    closeBrowserModalsThen(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/today');
    });
  };

  const closeFlow = () => {
    setWeightHistoryOpen(false);
    setEditingWeight(null);
    if (params.flow) handleCloseAll();
    else if (['cycling', 'running', 'steps'].includes(activeFlow)) setActiveFlow('cardio');
    else setActiveFlow('picker');
  };
  useBrowserModalBack(
    sheetVisible && activeFlow !== 'picker' && !params.flow && !weightHistoryOpen,
    closeFlow,
  );
  useBrowserModalBack(sheetVisible && weightHistoryOpen, () => setWeightHistoryOpen(false));

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
          <LogSomethingView onFlow={setActiveFlow} onClose={handleCloseAll} />
        </Sheet>
      )}

      {/* 2. Food Log Modal */}
      {activeFlow === 'cardio' && (
        <Sheet
          visible={sheetVisible}
          onClose={closeFlow}
          snapPoint="tall"
          accessibilityLabel={t('homeRefresh.cardio')}
        >
          <CardioHub onSelect={setActiveFlow} onBack={closeFlow} />
        </Sheet>
      )}
      {(activeFlow === 'cycling' || activeFlow === 'running') && (
        <WorkoutLoggerModal
          visible={sheetVisible}
          initialWorkoutType={activeFlow === 'cycling' ? 'cardio' : 'walk_run'}
          defaultDate={todayDate}
          onClose={closeFlow}
          onSaved={handleCloseAll}
        />
      )}
      {activeFlow === 'food' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          onClose={closeFlow}
          onLogged={handleCloseAll}
        />
      )}

      {/* 3. Workout Logger Modal */}
      {activeFlow === 'workout' && (
        <WorkoutHubModal
          visible={sheetVisible}
          defaultDate={todayDate}
          onClose={closeFlow}
          onSaved={handleCloseAll}
        />
      )}

      {/* 4. Water Quick Add Modal */}
      {activeFlow === 'water' && (
        <CustomWaterModal
          visible={sheetVisible}
          onClose={closeFlow}
          onSave={async (amountMl) => {
            await addWater(amountMl);
            handleCloseAll();
          }}
        />
      )}

      {/* 5. Weight Entry Modal */}
      {activeFlow === 'steps' && Platform.OS === 'web' && (
        <ManualStepsModal visible={sheetVisible} onClose={closeFlow} onSave={logManualSteps} />
      )}
      {activeFlow === 'steps' && Platform.OS !== 'web' && (
        <Sheet
          visible={sheetVisible}
          onClose={closeFlow}
          snapPoint="tall"
          accessibilityLabel={t('homeRefresh.steps')}
        >
          <ScrollView contentContainerStyle={{ padding: space[3], gap: space[3] }}>
            <Button
              variant="tertiary"
              label={t('repairs.back')}
              onPress={closeFlow}
              testID="cardio-steps-back"
            />
            <StepsCard selectedDate={todayDate} />
          </ScrollView>
        </Sheet>
      )}
      {activeFlow === 'weight' && (
        <>
          <WeightEntryModal
            visible={sheetVisible && !weightHistoryOpen}
            initialEntry={editingWeight}
            previousWeight={
              editingWeight
                ? (weightLogs.find((entry) => entry.local_date < editingWeight.local_date)
                    ?.weight_kg ?? startingWeightKg)
                : undefined
            }
            onOpenHistory={() => setWeightHistoryOpen(true)}
            defaultDate={todayDate}
            startWeight={startingWeightKg}
            currentWeight={latestLog?.weight_kg ?? null}
            totalChangeKg={
              latestLog && startingWeightKg !== null
                ? weightChange(latestLog.weight_kg, startingWeightKg)
                : null
            }
            weeklyPace={weeklyPaceKg}
            projectedDate={projectedDate}
            hasEnoughTrend={projectionReason !== 'not_enough_trend'}
            onClose={closeFlow}
            onSave={async (weightKg, notes, date) => {
              if (editingWeight) await editWeight(editingWeight.id, weightKg, notes, date);
              else await logWeight(weightKg, date, notes);
            }}
          />
          {weightHistoryOpen && (
            <WeightHistoryModal
              visible={sheetVisible}
              weekly
              entries={weightLogs}
              loading={weightLoading}
              error={weightError}
              onRetry={() => void refreshWeight()}
              onClose={() => setWeightHistoryOpen(false)}
              onDeleteEntry={deleteWeight}
              onEditEntry={(entry) => {
                setEditingWeight(entry);
                setWeightHistoryOpen(false);
              }}
            />
          )}
        </>
      )}

      {/* 5.5 Fasting Timer Modal */}
      {activeFlow === 'fast' && (
        <FastingTimerModal visible={sheetVisible} onClose={closeFlow} userId={user?.id} />
      )}

      {/* 7. Quick Scan: Barcode Scanner */}
      {activeFlow === 'scan' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          initialTab="scan"
          onClose={closeFlow}
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
          onClose={closeFlow}
          onLogged={handleCloseAll}
        />
      )}

      {/* 9. Quick Recipes: Recipe Library Flow */}
      {activeFlow === 'recipe' && (
        <Modal
          visible={sheetVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeFlow}
        >
          <View style={[styles.recipeContainer, { backgroundColor: colors.background }]}>
            <RecipeBrowseView
              showBackOrClose={true}
              onBackOrClose={closeFlow}
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
          onClose={closeFlow}
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
