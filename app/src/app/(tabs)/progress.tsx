import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  SegmentedControl,
  Text,
  space,
  homeLayout,
  getTabBarHeight,
  useTheme,
} from '@calipartner/ui';
import { getPreviousDateString, type ProgressDateRange, type WeightLog } from '@calipartner/core';
import { HeaderActions } from '@/components/HeaderActions';
import { WeightGoalHeroCard } from '@/components/progress/WeightGoalHeroCard';
import { ProgressOverview, type ProgressCategory } from '@/components/progress/ProgressOverview';
import { ProgressPhotosView } from '@/components/progress/ProgressPhotosView';
import { DayDetailModal, RangeSelector, type DayDetailData } from '@/components/progress';
import { WeightEntryModal } from '@/components/trackers/WeightEntryModal';
import { WeightHistoryModal } from '@/components/trackers/WeightHistoryModal';
import { WorkoutHistoryCalendarModal } from '@/components/workouts/WorkoutHistoryCalendarModal';
import { LoadingState } from '@/components/LoadingState';
import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { useWeight } from '@/hooks/useWeight';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
const ranges: ProgressDateRange[] = ['7d', '30d', '90d', 'all'];
const categories: ProgressCategory[] = ['weight', 'nutrition', 'workouts', 'photos', 'habits'];
export default function ProgressScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('30d');
  const weight = useWeight();
  const { localDate } = useCurrentLocalDate();
  const photoStart =
    range === 'all' ? undefined : getPreviousDateString(localDate, Number.parseInt(range) - 1);
  const { currentGoalProfile } = useTargets();
  const [category, setCategory] = useState<ProgressCategory>('weight');
  const [showWeight, setShowWeight] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState<WeightLog | null>(null);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const refreshAll = async () => {
    await Promise.all([refresh(), weight.refresh()]);
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }} testID="screen-progress">
      <ScrollView
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: getTabBarHeight(fontScale) + insets.bottom + space[6],
          width: '100%',
          maxWidth: homeLayout.maxContentWidth,
          alignSelf: 'center',
          gap: space[4],
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refreshAll()}
            tintColor={colors.textHi}
          />
        }
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[2],
          }}
        >
          <Text variant="title1" accessibilityRole="header">
            {t('progressRefresh.title')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <HeaderActions />
            <Button
              variant="tertiary"
              fullWidth={false}
              iconOnly
              label={t('compactProfile.account')}
              icon={
                <Ionicons
                  name="settings-outline"
                  size={homeLayout.iconSize}
                  color={colors.textHi}
                />
              }
              onPress={() => router.push('/me')}
              testID="you-open-settings"
            />
          </View>
        </View>
        {weight.loading ? (
          <LoadingState />
        ) : (
          <WeightGoalHeroCard
            starting={weight.startingWeightKg}
            current={weight.latestLog?.weight_kg ?? null}
            target={currentGoalProfile?.target_weight_kg ?? null}
            pace={weight.weeklyPaceKg}
            onGoals={() => router.push('/me')}
          />
        )}
        <RangeSelector
          options={ranges}
          selected={range}
          onSelect={setRange}
          testID="progress-range-selector"
        />
        <SegmentedControl
          fullWidth={false}
          options={categories.map((value) => ({ value, label: t(`progressRefresh.${value}`) }))}
          value={category}
          onChange={setCategory}
          testID="progress-category"
        />
        {category === 'photos' ? (
          <ProgressPhotosView startDate={photoStart} endDate={localDate} />
        ) : error ? (
          <View style={{ gap: space[2] }}>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void refreshAll()}
              testID="personal-progress-retry"
            />
          </View>
        ) : loading ? (
          <LoadingState />
        ) : (
          <ProgressOverview
            data={data}
            range={range}
            category={category}
            loading={loading}
            onSelectDay={setSelectedDay}
          />
        )}
        {category === 'weight' && (
          <>
            {weight.error && <Text accessibilityRole="alert">{t('common.errorBody')}</Text>}
            <Button
              variant="secondary"
              label={t('progressRefresh.addWeight')}
              icon={<Ionicons name="add" size={homeLayout.iconSize} color={colors.textHi} />}
              onPress={() => {
                setEditing(null);
                setShowWeight(true);
              }}
              testID="progress-log-weight"
            />
            <Button
              variant="tertiary"
              label={t('progressRefresh.history')}
              onPress={() => setShowHistory(true)}
              testID="progress-weight-history"
            />
          </>
        )}
        {category === 'workouts' && (
          <Button
            variant="secondary"
            label={t('homeRefresh.workoutHistory')}
            onPress={() => setShowWorkouts(true)}
            testID="personal-workout-history"
          />
        )}
      </ScrollView>
      {showWeight && (
        <WeightEntryModal
          visible
          initialEntry={editing}
          startWeight={weight.startingWeightKg}
          currentWeight={weight.latestLog?.weight_kg ?? null}
          totalChangeKg={data?.weight.total_change_kg ?? null}
          weeklyPace={weight.weeklyPaceKg}
          projectedDate={weight.projectedDate}
          hasEnoughTrend={weight.weeklyPaceKg !== null}
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
      )}
      {showHistory && (
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
      )}
      {showWorkouts && (
        <WorkoutHistoryCalendarModal visible onClose={() => setShowWorkouts(false)} />
      )}
      <DayDetailModal
        visible={!!selectedDay}
        data={selectedDay}
        onClose={() => setSelectedDay(null)}
        testID="progress-day-detail-modal"
      />
    </SafeAreaView>
  );
}
