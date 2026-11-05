import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, homeLayout, space, Text, SegmentedControl } from '@calipartner/ui';
import { PersonalDiaryView } from '@/components/progress/PersonalDiaryView';
import { ProgressOverview } from '@/components/progress/ProgressOverview';
import { ChallengesView } from '@/components/progress/ChallengesView';
import { WorkoutHistoryCalendarModal } from '@/components/workouts/WorkoutHistoryCalendarModal';
import { PersonalSquads } from '@/components/rooms/PersonalSquads';
import { WeeklyPlanEntry } from '@/components/workouts/WeeklyPlanEntry';
import { DayDetailModal, RangeSelector, type DayDetailData } from '@/components/progress';
import { LoadingState } from '@/components/LoadingState';
import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { useTheme } from '@/theme/useTheme';
import { t } from '@/i18n';
import type { ProgressDateRange } from '@calipartner/core';

const ranges: ProgressDateRange[] = ['30d', '90d'];
export default function ProgressScreen() {
  const { colors } = useTheme();
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('30d');
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const [tab, setTab] = useState<'diary' | 'progress' | 'challenges'>('diary');
  const params = useLocalSearchParams<{ challenge?: string; trophies?: string; tab?: string }>();
  useEffect(() => {
    if (params.challenge || params.trophies) setTab('challenges');
    else if (params.tab === 'progress') setTab('progress');
  }, [params.challenge, params.trophies, params.tab]);
  const diaryRefresh = useRef<(() => Promise<void>) | null>(null);
  const challengeRefresh = useRef<(() => Promise<void>) | null>(null);
  const registerChallengeRefresh = useCallback((refreshChallenges: () => Promise<void>) => {
    challengeRefresh.current = refreshChallenges;
  }, []);
  const registerDiaryRefresh = useCallback((refreshDiary: () => Promise<void>) => {
    diaryRefresh.current = refreshDiary;
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const refreshVisible = async () => {
    setRefreshing(true);
    try {
      if (tab === 'diary') await diaryRefresh.current?.();
      else if (tab === 'challenges') await challengeRefresh.current?.();
      else await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID="screen-progress"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (tab === 'progress' && loading)}
            onRefresh={() => void refreshVisible()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.heading}>
          <Text variant="title1">{t('tabs.progress')}</Text>
          <Text>{t(tab === 'diary' ? 'homeRefresh.diaryHint' : 'squadDesign.personal')}</Text>
        </View>
        <SegmentedControl
          options={[
            { value: 'diary', label: t('homeRefresh.diary') },
            { value: 'progress', label: t('homeRefresh.progress') },
            { value: 'challenges', label: t('foodPolish.challenges') },
          ]}
          value={tab}
          onChange={setTab}
          testID="you-tabs"
        />
        {tab === 'diary' ? (
          <>
            <PersonalDiaryView onRefreshReady={registerDiaryRefresh} />
            <WeeklyPlanEntry />
            <PersonalSquads />
          </>
        ) : tab === 'challenges' ? (
          <ChallengesView embedded onRefreshReady={registerChallengeRefresh} />
        ) : (
          <>
            <RangeSelector
              options={ranges}
              selected={range}
              onSelect={setRange}
              testID="progress-range-selector"
            />
            {error ? (
              <View style={styles.heading}>
                <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void refresh()}
                  testID="personal-progress-retry"
                />
              </View>
            ) : loading && !data ? (
              <LoadingState />
            ) : (
              <ProgressOverview
                data={data}
                range={range}
                loading={loading}
                onSelectDay={setSelectedDay}
              />
            )}
            <Button
              variant="secondary"
              label={t('homeRefresh.workoutHistory')}
              onPress={() => setShowWorkouts(true)}
              testID="personal-workout-history"
            />
          </>
        )}
      </ScrollView>
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
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: space[4],
    paddingBottom: homeLayout.touchSize * 3,
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
    gap: space[4],
  },
  heading: { gap: space[2] },
});
