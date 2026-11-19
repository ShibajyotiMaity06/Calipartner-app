import { WeightHistoryModal } from '@/components/trackers/WeightHistoryModal';
import { weightChange, type WeightLog } from '@calipartner/core';
import { LogSomethingView } from '@/components/diary/LogSomethingView';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { getMealSectionForTime, type MealSection } from '@calipartner/core';
import { Sheet } from '@calipartner/ui';
import { t } from '@/i18n';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { WorkoutHubModal } from '@/components/workouts/WorkoutHubModal';
import { CardioHub } from '@/components/workouts/CardioHub';
import { CardioTrackerModal } from '@/components/cardio/CardioTrackerModal';
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

  const requestedFlow = [
    'food',
    'workout',
    'water',
    'steps',
    'weight',
    'cardio',
    'cycling',
    'running',
  ].includes(params.flow ?? '')
    ? (params.flow as ActiveFlowState)
    : 'picker';
  const [currentSection, setCurrentSection] = useState<MealSection>(initialSection);
  const [sheetVisible, setSheetVisible] = useState(true);
  const [weightHistoryOpen, setWeightHistoryOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightLog | null>(null);
  const [flows, setFlows] = useState<ActiveFlowState[]>([requestedFlow]);
  const activeFlow = flows[flows.length - 1]!;
  const closing = useRef(false);
  useEffect(() => {
    if (!closing.current) {
      setFlows([requestedFlow]);
      setWeightHistoryOpen(false);
      setEditingWeight(null);
    }
  }, [requestedFlow]);
  useFocusEffect(
    useCallback(() => {
      closing.current = false;
      setSheetVisible(true);
      return () => setSheetVisible(false);
    }, []),
  );
  const openFlow = (flow: ActiveFlowState) => {
    if (closing.current) return;
    if (activeFlow === 'picker')
      setCurrentSection(getMealSectionForTime(new Date(), profile?.timezone));
    setFlows((current) => (current.at(-1) === flow ? current : [...current, flow]));
  };

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
  const { addEntry } = useAddEntry();

  const handleCloseAll = () => {
    if (closing.current) return;
    closing.current = true;
    setFlows(['picker']);
    setWeightHistoryOpen(false);
    setEditingWeight(null);
    setCurrentSection(getMealSectionForTime(new Date(), profile?.timezone));
    setSheetVisible(false);
    closeBrowserModalsThen(() => {
      if (params.flow) router.setParams({ flow: undefined });
      if (router.canGoBack()) router.back();
      else router.replace('/today');
    });
  };

  const closeFlow = () => {
    if (closing.current) return;
    if (flows.length === 1) {
      handleCloseAll();
      return;
    }
    setWeightHistoryOpen(false);
    setEditingWeight(null);
    setFlows((current) =>
      current.length > 1 && current.at(-1) === activeFlow ? current.slice(0, -1) : current,
    );
  };
  const isCardioActivity =
    activeFlow === 'running' || activeFlow === 'cycling' || activeFlow === 'steps';
  useBrowserModalBack(
    sheetVisible &&
      ['cardio', 'water', 'weight', 'fast', 'recipe', 'quick_calories'].includes(activeFlow),
    closeFlow,
  );
  const closeWeightHistory = () => {
    setEditingWeight(null);
    setWeightHistoryOpen(false);
  };
  useBrowserModalBack(sheetVisible && weightHistoryOpen, closeWeightHistory, {
    depth: Number(Boolean(editingWeight)),
    onDepthChange: () => setEditingWeight(null),
  });

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
          <LogSomethingView onFlow={openFlow} onClose={handleCloseAll} />
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
          <CardioHub onSelect={openFlow} onBack={closeFlow} />
        </Sheet>
      )}
      {isCardioActivity && sheetVisible && (
        <CardioTrackerModal
          key={(user?.id ?? 'guest') + activeFlow}
          visible={sheetVisible}
          initialMode={activeFlow}
          selectedDate={todayDate}
          onClose={closeFlow}
        />
      )}
      {activeFlow === 'food' && (
        <FoodLogModal
          visible={sheetVisible}
          defaultSection={currentSection}
          localDate={todayDate}
          onClose={closeFlow}
          onLogged={() => {}}
        />
      )}

      {/* 3. Workout Logger Modal */}
      {activeFlow === 'workout' && (
        <WorkoutHubModal visible={sheetVisible} defaultDate={todayDate} onClose={closeFlow} />
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
      {activeFlow === 'weight' && (
        <>
          <WeightEntryModal
            visible={sheetVisible && (!weightHistoryOpen || !!editingWeight)}
            initialEntry={editingWeight}
            previousWeight={
              editingWeight
                ? (weightLogs.find((entry) => entry.local_date < editingWeight.local_date)
                    ?.weight_kg ?? startingWeightKg)
                : undefined
            }
            onOpenHistory={editingWeight ? undefined : () => setWeightHistoryOpen(true)}
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
            onClose={editingWeight ? () => setEditingWeight(null) : closeFlow}
            onSave={async (weightKg, notes, date) => {
              if (editingWeight) await editWeight(editingWeight.id, weightKg, notes, date);
              else await logWeight(weightKg, date, notes);
            }}
          />
          {weightHistoryOpen && !editingWeight && (
            <WeightHistoryModal
              visible={sheetVisible}
              weekly
              entries={weightLogs}
              loading={weightLoading}
              error={weightError}
              onRetry={() => void refreshWeight()}
              onClose={closeWeightHistory}
              onDeleteEntry={deleteWeight}
              onEditEntry={setEditingWeight}
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
