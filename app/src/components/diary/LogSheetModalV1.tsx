import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  getMealSectionForTime,
  weightChange,
  type MealSection,
  type WeightLog,
} from '@calipartner/core';
import {
  Badge,
  BarcodeIcon,
  BookmarkIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  DropletIcon,
  DumbbellIcon,
  EditIcon,
  FeedImageIcon,
  HistoryClockIcon,
  IconButton,
  LinkButton,
  PulseIcon,
  ScaleIcon,
  SearchIcon,
  Sheet,
  Text,
  TimerIcon,
  borders,
  colors,
  elevation,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { CardioTrackerModal } from '@/components/cardio/CardioTrackerModal';
import { DescribeMealModal } from '@/components/diary/DescribeMealModal';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { QuickAddCaloriesModal } from '@/components/diary/QuickAddCaloriesModal';
import { FastingTimerModal } from '@/components/fasting';
import { RecipeBrowseView } from '@/components/recipes';
import { TrackingPreferencesSheet } from '@/components/rooms/TrackingPreferencesSheet';
import { CustomWaterModal, WeightEntryModal, WeightHistoryModal } from '@/components/trackers';
import { CardioHub } from '@/components/workouts/CardioHub';
import { WorkoutHubModal } from '@/components/workouts/WorkoutHubModal';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserModalBack, closeBrowserModalsThen } from '@/hooks/useBrowserModalBack';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useAddEntry } from '@/hooks/useFoodEntries';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { useWater } from '@/hooks/useWater';
import { useWeight } from '@/hooks/useWeight';
import { t } from '@/i18n';
import { diaryEvents } from '@/services/diaryEvents';

export type LogFlowState =
  | 'picker'
  | 'food'
  | 'describe'
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

export interface LogSheetModalV1Props {
  visible: boolean;
  initialFlow?: LogFlowState;
  preserveStackWhileHidden?: boolean;
  onClose: () => void;
}

const MEAL_SECTIONS: readonly MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function LogSheetModalV1({
  visible,
  initialFlow = 'picker',
  preserveStackWhileHidden = false,
  onClose,
}: LogSheetModalV1Props): React.JSX.Element {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { localDate: todayDate } = useCurrentLocalDate();
  const tracking = useTrackingPreferences();

  const [currentSection, setCurrentSection] = useState<MealSection>(() =>
    getMealSectionForTime(new Date(), profile?.timezone),
  );
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [flows, setFlows] = useState<LogFlowState[]>([initialFlow]);
  const [weightHistoryOpen, setWeightHistoryOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightLog | null>(null);
  const activeFlow = flows[flows.length - 1]!;
  const closing = useRef(false);
  const lastInitialFlow = useRef(initialFlow);

  useEffect(() => {
    if (lastInitialFlow.current !== initialFlow) {
      lastInitialFlow.current = initialFlow;
      setFlows([initialFlow]);
      setWeightHistoryOpen(false);
      setEditingWeight(null);
    }
  }, [initialFlow]);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      if (!preserveStackWhileHidden) {
        setFlows([initialFlow]);
        setMealMenuOpen(false);
        setWeightHistoryOpen(false);
        setEditingWeight(null);
        setCurrentSection(getMealSectionForTime(new Date(), profile?.timezone));
      }
    }
  }, [visible, initialFlow, preserveStackWhileHidden, profile?.timezone]);

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

  const openFlow = (flow: LogFlowState) => {
    if (closing.current) return;
    setFlows((current) => (current.at(-1) === flow ? current : [...current, flow]));
  };

  const handleCloseAll = () => {
    if (closing.current) return;
    closing.current = true;
    setFlows(['picker']);
    setWeightHistoryOpen(false);
    setEditingWeight(null);
    setMealMenuOpen(false);
    setCustomizeOpen(false);
    onClose();
  };

  const closeFlow = () => {
    if (closing.current) return;
    if (flows.length <= 1) {
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
    visible &&
      ['cardio', 'water', 'weight', 'fast', 'recipe', 'quick_calories', 'describe'].includes(
        activeFlow,
      ),
    closeFlow,
  );

  const closeWeightHistory = () => {
    setEditingWeight(null);
    setWeightHistoryOpen(false);
  };

  useBrowserModalBack(visible && weightHistoryOpen, closeWeightHistory, {
    depth: Number(Boolean(editingWeight)),
    onDepthChange: () => setEditingWeight(null),
  });

  const currentSectionLabel = t(`diary.sections.${currentSection}` as Parameters<typeof t>[0]);

  return (
    <>
      <Sheet
        visible={visible && activeFlow === 'picker'}
        onClose={handleCloseAll}
        accessibilityLabel={t('homeV1.logTitle')}
        testID="log-sheet-modal"
      >
        <View style={styles.sheetInner} testID="log-hub-view">
          <View style={styles.headerRow}>
            <Text variant="titleM" color="textHi">
              {t('homeV1.logTitle')}
            </Text>
            <IconButton
              icon={<CloseIcon size={16} color={colors.textHi} />}
              size={36}
              inSheet
              onPress={handleCloseAll}
              accessibilityLabel={t('homeRefresh.close')}
              testID="log-hub-close"
            />
          </View>

          <Pressable
            onPress={() => openFlow('food')}
            accessibilityRole="button"
            accessibilityLabel={t('homeV1.searchFoods')}
            style={({ pressed }) => [styles.searchBar, pressed ? styles.pressedSurface : null]}
            testID="log-search-foods"
          >
            <SearchIcon size={18} color={colors.textLo} />
            <Text variant="body" color="textLo" style={styles.flexOne}>
              {t('homeV1.searchFoods')}
            </Text>
          </Pressable>

          {/* FOOD SECTION */}
          <View style={styles.foodSectionAnchor}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="eyebrow" color="textLo">
                {t('homeV1.foodEyebrow')}
              </Text>
              <Pressable
                onPress={() => setMealMenuOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={currentSectionLabel}
                accessibilityState={{ expanded: mealMenuOpen }}
                style={styles.mealDropdown}
                testID="log-meal-section-picker"
              >
                <Text variant="label" color="textHi">
                  {`${currentSectionLabel} ▾`}
                </Text>
              </Pressable>
            </View>

            {mealMenuOpen ? (
              <View style={styles.mealDropdownMenu} testID="log-meal-options">
                {MEAL_SECTIONS.map((sec, idx) => {
                  const selected = sec === currentSection;
                  return (
                    <Pressable
                      key={sec}
                      onPress={() => {
                        setCurrentSection(sec);
                        setMealMenuOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.mealDropdownOption,
                        idx < MEAL_SECTIONS.length - 1 ? styles.mealDropdownDivider : null,
                        pressed ? styles.pressedSurface : null,
                      ]}
                      testID={`log-meal-option-${sec}`}
                    >
                      <Text variant="label" color={selected ? 'apricot' : 'textHi'}>
                        {t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                      </Text>
                      {selected ? <CheckIcon size={14} color={colors.apricot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.bentoGrid}>
            {/* Left tall Scan meal tile */}
            <Pressable
              onPress={() => openFlow('photo')}
              accessibilityRole="button"
              accessibilityLabel={t('homeV1.scanMeal')}
              style={({ pressed }) => [
                styles.heroScanTile,
                pressed ? styles.heroScanTilePressed : null,
              ]}
              testID="log-tile-photo"
            >
              <View style={styles.tileTopRow}>
                <CameraIcon size={22} color={colors.onBrand} strokeWidth={2} />
                <Badge variant="invertedPro" label={t('onboardingV1.paywallColPro')} mini />
              </View>
              <View style={styles.heroScanBottom}>
                <Text variant="titleS" color="onBrand" style={styles.heroScanTitle}>
                  {t('homeV1.scanMeal')}
                </Text>
                <Text variant="meta" color="onBrand" style={styles.heroScanSubtitle}>
                  {t('homeV1.scanMealDesc')}
                </Text>
              </View>
            </Pressable>

            {/* Right 2x2 Food grid */}
            <View style={styles.rightBentoCol}>
              <View style={styles.rightBentoRow}>
                <Pressable
                  onPress={() => openFlow('describe')}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeV1.describe')}
                  style={({ pressed }) => [
                    styles.compactTile,
                    pressed ? styles.pressedSurface : null,
                  ]}
                  testID="log-tile-describe"
                >
                  <View style={styles.tileTopRow}>
                    <EditIcon size={16} color={colors.textHi} />
                    <Badge variant="pro" label={t('onboardingV1.paywallColPro')} mini />
                  </View>
                  <Text
                    variant="label"
                    color="textHi"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.compactTileLabel}
                  >
                    {t('homeV1.describe')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openFlow('scan')}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeV1.barcode')}
                  style={({ pressed }) => [
                    styles.compactTile,
                    pressed ? styles.pressedSurface : null,
                  ]}
                  testID="log-tile-scan"
                >
                  <BarcodeIcon size={17} color={colors.textMid} />
                  <Text
                    variant="label"
                    color="textHi"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.compactTileLabel}
                  >
                    {t('homeV1.barcode')}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.rightBentoRow}>
                <Pressable
                  onPress={() => openFlow('recipe')}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeV1.saved')}
                  style={({ pressed }) => [
                    styles.compactTile,
                    pressed ? styles.pressedSurface : null,
                  ]}
                  testID="log-tile-saved"
                >
                  <BookmarkIcon size={16} color={colors.textMid} />
                  <Text
                    variant="label"
                    color="textHi"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.compactTileLabel}
                  >
                    {t('homeV1.saved')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openFlow('food')}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeV1.recent')}
                  style={({ pressed }) => [
                    styles.compactTile,
                    pressed ? styles.pressedSurface : null,
                  ]}
                  testID="log-tile-recent"
                >
                  <HistoryClockIcon size={16} color={colors.textMid} />
                  <Text
                    variant="label"
                    color="textHi"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.compactTileLabel}
                  >
                    {t('homeV1.recent')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* TRACK SECTION */}
          <View style={styles.sectionHeaderRow}>
            <Text variant="eyebrow" color="textLo">
              {t('homeV1.trackEyebrow')}
            </Text>
            <LinkButton
              title={t('homeV1.customize')}
              variant="accent"
              onPress={() => setCustomizeOpen(true)}
              testID="log-track-customize"
            />
          </View>

          <View style={styles.trackStrip}>
            {(
              [
                {
                  id: 'workout' as const,
                  label: t('homeV1.trackWorkout'),
                  icon: <DumbbellIcon size={18} color={colors.textHi} />,
                },
                {
                  id: 'cardio' as const,
                  label: t('homeV1.trackCardio'),
                  icon: <PulseIcon size={18} color={colors.textHi} />,
                },
                {
                  id: 'water' as const,
                  label: t('homeV1.trackWater'),
                  icon: <DropletIcon size={18} color={colors.textHi} />,
                },
                {
                  id: 'weight' as const,
                  label: t('homeV1.trackWeight'),
                  icon: <ScaleIcon size={18} color={colors.textHi} />,
                },
                {
                  id: 'fast' as const,
                  label: t('homeV1.trackFasting'),
                  icon: <TimerIcon size={18} color={colors.textHi} />,
                },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => openFlow(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.trackTile, pressed ? styles.pressedSurface : null]}
                testID={`log-tile-${item.id}`}
              >
                {item.icon}
                <Text
                  variant="micro"
                  color="textMid"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* SHARE SECTION */}
          <Text variant="eyebrow" color="textLo" style={styles.shareLabel}>
            {t('homeV1.shareEyebrow')}
          </Text>
          <Pressable
            onPress={() => {
              handleCloseAll();
              closeBrowserModalsThen(() => router.push('/feed/create' as Href));
            }}
            accessibilityRole="button"
            accessibilityLabel={t('homeV1.postToFeed')}
            style={({ pressed }) => [styles.shareCard, pressed ? styles.pressedSurface : null]}
            testID="log-tile-post"
          >
            <View style={styles.shareIconTile}>
              <FeedImageIcon size={18} color={colors.textMid} />
            </View>
            <View style={styles.flexOne}>
              <Text variant="rowTitle" color="textHi" style={styles.shareTitle}>
                {t('homeV1.postToFeed')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('homeV1.postToFeedDesc')}
              </Text>
            </View>
            <ChevronRightIcon size={18} color={colors.textLo} />
          </Pressable>
        </View>
      </Sheet>

      {customizeOpen ? (
        <TrackingPreferencesSheet
          enabled={tracking.enabled}
          onClose={() => setCustomizeOpen(false)}
          onSave={tracking.save}
        />
      ) : null}

      {activeFlow === 'cardio' ? (
        <Sheet visible={visible} onClose={closeFlow} accessibilityLabel={t('homeRefresh.cardio')}>
          <CardioHub onSelect={(mode) => openFlow(mode)} onBack={closeFlow} />
        </Sheet>
      ) : null}

      {isCardioActivity && visible ? (
        <CardioTrackerModal
          key={(user?.id ?? 'guest') + activeFlow}
          visible
          initialMode={activeFlow}
          selectedDate={todayDate}
          onClose={() => {
            diaryEvents.emitChange();
            closeFlow();
          }}
        />
      ) : null}

      {activeFlow === 'food' ? (
        <FoodLogModal
          visible={visible}
          defaultSection={currentSection}
          localDate={todayDate}
          onClose={closeFlow}
          onLogged={() => diaryEvents.emitChange()}
        />
      ) : null}

      {activeFlow === 'describe' ? (
        <DescribeMealModal
          visible={visible}
          section={currentSection}
          localDate={todayDate}
          onClose={closeFlow}
          onLogged={() => {
            diaryEvents.emitChange();
            handleCloseAll();
          }}
        />
      ) : null}

      {activeFlow === 'workout' ? (
        <WorkoutHubModal
          visible={visible}
          defaultDate={todayDate}
          onClose={() => {
            diaryEvents.emitChange();
            closeFlow();
          }}
        />
      ) : null}

      {activeFlow === 'water' ? (
        <CustomWaterModal
          visible={visible}
          onClose={closeFlow}
          onSave={async (amountMl) => {
            await addWater(amountMl);
            diaryEvents.emitChange();
            handleCloseAll();
          }}
        />
      ) : null}

      {activeFlow === 'weight' ? (
        <>
          <WeightEntryModal
            visible={visible && (!weightHistoryOpen || Boolean(editingWeight))}
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
              diaryEvents.emitChange();
            }}
          />
          {weightHistoryOpen && !editingWeight ? (
            <WeightHistoryModal
              visible={visible}
              weekly
              entries={weightLogs}
              loading={weightLoading}
              error={weightError}
              onRetry={() => void refreshWeight()}
              onClose={closeWeightHistory}
              onDeleteEntry={deleteWeight}
              onEditEntry={setEditingWeight}
            />
          ) : null}
        </>
      ) : null}

      {activeFlow === 'fast' ? (
        <FastingTimerModal
          visible={visible}
          onClose={() => {
            diaryEvents.emitChange();
            closeFlow();
          }}
          userId={user?.id}
        />
      ) : null}

      {activeFlow === 'scan' ? (
        <FoodLogModal
          visible={visible}
          defaultSection={currentSection}
          localDate={todayDate}
          initialTab="scan"
          onClose={closeFlow}
          onLogged={() => {
            diaryEvents.emitChange();
            handleCloseAll();
          }}
        />
      ) : null}

      {activeFlow === 'photo' ? (
        <FoodLogModal
          visible={visible}
          defaultSection={currentSection}
          localDate={todayDate}
          initialTab="photo"
          onClose={closeFlow}
          onLogged={() => {
            diaryEvents.emitChange();
            handleCloseAll();
          }}
        />
      ) : null}

      {activeFlow === 'recipe' ? (
        <Modal
          visible={visible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeFlow}
        >
          <View style={styles.recipeContainer}>
            <RecipeBrowseView
              showBackOrClose
              onBackOrClose={closeFlow}
              initialMealSection={currentSection}
              localDate={todayDate}
              onRecipeLogged={() => {
                diaryEvents.emitChange();
                handleCloseAll();
              }}
            />
          </View>
        </Modal>
      ) : null}

      {activeFlow === 'quick_calories' ? (
        <QuickAddCaloriesModal
          visible
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
            diaryEvents.emitChange();
            handleCloseAll();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  sheetInner: {
    gap: space.optical10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBar: {
    minHeight: 48,
    borderRadius: radius.input,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  foodSectionAnchor: {
    position: 'relative',
    zIndex: 30,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  mealDropdown: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    minHeight: 34,
    justifyContent: 'center',
  },
  mealDropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: space.xs,
    minWidth: 164,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    borderRadius: radius.chip,
    overflow: 'hidden',
    zIndex: 40,
    ...elevation.notificationPreview,
  },
  mealDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.optical10,
    minHeight: 40,
  },
  mealDropdownDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: space.sm,
  },
  heroScanTile: {
    flex: 0.86,
    backgroundColor: colors.apricot,
    borderRadius: radius.bento,
    padding: space.md,
    justifyContent: 'space-between',
    minHeight: 152,
  },
  heroScanTilePressed: {
    backgroundColor: colors.apricotPressed,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  heroScanBottom: {
    gap: 2,
  },
  heroScanTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 23,
  },
  heroScanSubtitle: {
    color: colors.onBrand,
    opacity: 0.82,
    fontSize: 12,
  },
  rightBentoCol: {
    flex: 1.2,
    gap: space.sm,
  },
  rightBentoRow: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
  },
  compactTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.optical10,
    justifyContent: 'space-between',
    minHeight: 72,
  },
  compactTileLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  trackStrip: {
    flexDirection: 'row',
    gap: space.sm,
  },
  trackTile: {
    flex: 1,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
    minHeight: 68,
  },
  shareLabel: {
    marginTop: space.xs,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  shareIconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    backgroundColor: colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: {
    fontSize: 15,
  },
  pressedSurface: {
    backgroundColor: colors.s3,
  },
  recipeContainer: {
    flex: 1,
    backgroundColor: colors.bg0,
    paddingTop: layout.ctaBottomMin,
  },
});
