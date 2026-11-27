import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Button, getTabBarHeight, homeLayout } from '@calipartner/ui';
import {
  Chip,
  Segmented,
  SettingsIcon,
  ShareUploadIcon,
  Text as V1Text,
  borders as v1Borders,
  colors as v1Colors,
  layout as v1Layout,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import {
  getPreviousDateString,
  isFeatureAllowed,
  type ProgressDateRange,
  type WeightLog,
} from '@calipartner/core';
import { LoadingState } from '@/components/LoadingState';
import { DayDetailModal, type DayDetailData } from '@/components/progress/DayDetailModal';
import { ProgressOverview, type ProgressCategory } from '@/components/progress/ProgressOverview';
import { ProgressPhotosView } from '@/components/progress/ProgressPhotosView';
import { WeeklySummaryModal } from '@/components/progress/WeeklySummaryModal';
import { WeightEntryModal } from '@/components/trackers/WeightEntryModal';
import { WeightHistoryModal } from '@/components/trackers/WeightHistoryModal';
import { WorkoutHistoryCalendarModal } from '@/components/workouts/WorkoutHistoryCalendarModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { useSubscription } from '@/hooks/useSubscription';
import { useTargets } from '@/hooks/useTargets';
import { useWeight } from '@/hooks/useWeight';
import { t } from '@/i18n';

const RANGES: ProgressDateRange[] = ['7d', '30d', '90d', 'all'];

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { profile } = useAuth();
  const { currentTier, hasActiveAccess } = useSubscription();
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('30d');
  const weight = useWeight();
  const { localDate } = useCurrentLocalDate();
  const { currentGoalProfile } = useTargets();

  const [category, setCategory] = useState<ProgressCategory>('weight');
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editing, setEditing] = useState<WeightLog | null>(null);

  const photosUnlocked = isFeatureAllowed(
    'progress_photos',
    hasActiveAccess ? currentTier : 'free',
  );
  const useLb = profile?.units === 'imperial';

  const photoStart =
    range === 'all'
      ? undefined
      : getPreviousDateString(localDate, range === '7d' ? 6 : range === '30d' ? 29 : 89);

  const refreshWeight = weight.refresh;
  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshWeight()]);
  }, [refresh, refreshWeight]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  const categoryOptions = useMemo(
    () => [
      { id: 'weight' as const, label: t('progressV1.catWeight'), locked: false },
      { id: 'nutrition' as const, label: t('progressV1.catNutrition'), locked: false },
      { id: 'workouts' as const, label: t('progressV1.catWorkouts'), locked: false },
      { id: 'photos' as const, label: t('progressV1.catPhotos'), locked: !photosUnlocked },
      { id: 'habits' as const, label: t('progressV1.catHabits'), locked: false },
    ],
    [photosUnlocked],
  );

  const rangeOptions = useMemo(
    () =>
      RANGES.map((value) => ({
        value,
        label:
          value === '7d'
            ? t('progressV1.range7d')
            : value === '30d'
              ? t('progressV1.range30d')
              : value === '90d'
                ? t('progressV1.range90d')
                : t('progressV1.rangeAll'),
      })),
    [],
  );

  const latestConsistencyScore = data?.consistency.weekly_scores.at(-1)?.consistency_score ?? 0;

  return (
    <View style={styles.rootContainer} testID="screen-progress">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(v1Space.lg, insets.top + v1Space.sm),
            paddingBottom: getTabBarHeight(fontScale) + insets.bottom + v1Space.xxl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refreshAll()}
            tintColor={v1Colors.apricot}
          />
        }
      >
        <View style={styles.innerWrap}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <V1Text variant="title" color="textHi" accessibilityRole="header">
              {t('progressV1.title')}
            </V1Text>

            <View style={styles.headerActionGroup}>
              <Pressable
                onPress={() => router.push('/settings' as Href)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={t('settingsV1.openSettings')}
                style={({ pressed }) => [styles.shareBtn, pressed ? styles.pressedBg : null]}
                testID="btn-progress-settings"
              >
                <SettingsIcon size={18} color={v1Colors.textHi} />
              </Pressable>

              <Pressable
                onPress={() => setShowSummary(true)}
                accessibilityRole="button"
                accessibilityLabel={t('progressV1.shareLabel')}
                style={({ pressed }) => [styles.shareBtn, pressed ? styles.pressedBg : null]}
                testID="btn-progress-share"
              >
                <ShareUploadIcon size={18} color={v1Colors.textHi} />
              </Pressable>
            </View>
          </View>

          {/* Category Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryStrip}
            testID="progress-category"
          >
            {categoryOptions.map((item) => (
              <Chip
                key={item.id}
                small
                label={item.label}
                selected={category === item.id}
                locked={item.locked}
                onPress={() => setCategory(item.id)}
                testID={`progress-cat-${item.id}`}
              />
            ))}
          </ScrollView>

          {/* Period Segmented Selector (hidden on Photos screen) */}
          {category !== 'photos' ? (
            <Segmented
              compact
              options={rangeOptions}
              value={range}
              onChange={setRange}
              testID="progress-range-selector"
            />
          ) : null}

          {/* Active Category Content */}
          {category === 'photos' ? (
            <ProgressPhotosView startDate={photoStart} endDate={localDate} />
          ) : error && !data ? (
            <View style={styles.errorBox}>
              <V1Text variant="body" color="textMid" accessibilityRole="alert">
                {t('common.errorBody')}
              </V1Text>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void refreshAll()}
                testID="personal-progress-retry"
              />
            </View>
          ) : (loading || (category === 'weight' && weight.loading)) && !data ? (
            <LoadingState />
          ) : (
            <ProgressOverview
              data={data}
              range={range}
              category={category}
              loading={loading}
              weight={weight}
              targetWeightKg={currentGoalProfile?.target_weight_kg ?? null}
              useLb={useLb}
              onSelectDay={setSelectedDay}
              onLogWeight={() => {
                setEditing(null);
                setShowWeight(true);
              }}
              onOpenHistory={() => setShowHistory(true)}
              onOpenWorkoutCalendar={() => setShowWorkouts(true)}
            />
          )}
        </View>
      </ScrollView>

      {showWeight ? (
        <WeightEntryModal
          visible
          initialEntry={editing}
          startWeight={weight.startingWeightKg}
          currentWeight={weight.latestLog?.weight_kg ?? null}
          goalWeight={currentGoalProfile?.target_weight_kg ?? null}
          previousWeight={weight.logs[1]?.weight_kg ?? null}
          recentLogs={weight.logs.slice(0, 7)}
          totalChangeKg={data?.weight.total_change_kg ?? null}
          weeklyPace={weight.weeklyPaceKg}
          projectedDate={weight.projectedDate}
          hasEnoughTrend={weight.weeklyPaceKg !== null}
          onOpenHistory={() => {
            setShowWeight(false);
            setShowHistory(true);
          }}
          onClose={() => setShowWeight(false)}
          onSave={async (kg, notes, date) => {
            const saved = editing
              ? await weight.editWeight(editing.id, kg, notes, date)
              : await weight.logWeight(kg, date, notes);
            if (!saved) throw new Error('WEIGHT_SAVE_FAILED');
            setShowWeight(false);
            await refresh();
            return saved;
          }}
        />
      ) : null}

      {showHistory ? (
        <WeightHistoryModal
          visible
          entries={weight.logs}
          loading={weight.loading}
          error={weight.error}
          onRetry={() => void weight.refresh()}
          onClose={() => setShowHistory(false)}
          onEditEntry={(entry) => {
            setShowHistory(false);
            setEditing(entry);
            setShowWeight(true);
          }}
          onDeleteEntry={async (id) => {
            const result = await weight.deleteWeight(id);
            await refresh();
            return result;
          }}
        />
      ) : null}

      {showWorkouts ? (
        <WorkoutHistoryCalendarModal visible onClose={() => setShowWorkouts(false)} />
      ) : null}

      <DayDetailModal
        visible={!!selectedDay}
        data={selectedDay}
        onClose={() => setSelectedDay(null)}
        testID="progress-day-detail-modal"
      />

      <WeeklySummaryModal
        visible={showSummary}
        onClose={() => setShowSummary(false)}
        loggedDays={data?.calories.logged_days_count ?? 0}
        goalDays={data?.calories.goal_days_count ?? 0}
        totalDays={data?.calories.total_days_in_range ?? 0}
        weightChangeKg={data?.weight.total_change_kg ?? null}
        workoutCount={data?.workouts.total_workouts ?? 0}
        avgSteps={data?.steps.average_steps ?? 0}
        consistencyScore={latestConsistencyScore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  scrollContent: {
    paddingHorizontal: v1Layout.screenPaddingX,
  },
  innerWrap: {
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
    gap: v1Space.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: v1Space.md,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedBg: {
    backgroundColor: v1Colors.s2,
  },
  categoryStrip: {
    gap: v1Space.sm,
    paddingRight: v1Space.sm,
  },
  errorBox: {
    gap: v1Space.sm,
    paddingVertical: v1Space.md,
  },
});
