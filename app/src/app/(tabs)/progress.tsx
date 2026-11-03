import React, { useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, homeLayout, space, Text } from '@calipartner/ui';
import { ProgressOverview } from '@/components/progress/ProgressOverview';
import { DayDetailModal, RangeSelector, type DayDetailData } from '@/components/progress';
import { LoadingState } from '@/components/LoadingState';
import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { useTheme } from '@/theme/useTheme';
import { t } from '@/i18n';
import type { ProgressDateRange } from '@calipartner/core';

const ranges: ProgressDateRange[] = ['7d', '30d', '90d'];
export default function ProgressScreen() {
  const { colors } = useTheme();
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('7d');
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID="screen-progress"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.heading}>
          <Text variant="title1">{t('tabs.progress')}</Text>
          <Text>{t('squadDesign.personal')}</Text>
        </View>
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
      </ScrollView>
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
