import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { SegmentedTabs, WorkoutChip, type WorkoutTabId } from '../s_common';
import type { ActiveWorkoutSession, ActivityLogItem } from '@/services/workoutRedesignService';

interface S04HistoryScreenProps {
  currentTab: WorkoutTabId;
  onChangeTab: (tab: WorkoutTabId) => void;
  filterDate?: string | null;
  workouts: ActiveWorkoutSession[];
  activities: ActivityLogItem[];
  onOpenSettings: () => void;
  onClearDateFilter: () => void;
  onEditActivity: (item: ActivityLogItem) => void;
  onDeleteActivity: (id: string) => void;
}

export function S04HistoryScreen({
  currentTab,
  onChangeTab,
  filterDate,
  workouts,
  activities,
  onOpenSettings,
  onClearDateFilter,
  onEditActivity,
  onDeleteActivity,
}: S04HistoryScreenProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'workouts' | 'activities'>('all');
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  const totalWorkouts = workouts.length;
  const totalMinutes =
    workouts.reduce((acc, w) => {
      if (w.started_at && w.ended_at) {
        return (
          acc +
          Math.max(0, (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000)
        );
      }
      return acc + 45;
    }, 0) + activities.reduce((acc, a) => acc + a.duration_minutes, 0);

  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleDeleteActivity = (item: ActivityLogItem) => {
    Alert.alert(
      'Delete this log?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteActivity(item.id) },
      ],
      { cancelable: true },
    );
  };

  const filteredItems: Array<
    | { type: 'workout'; data: ActiveWorkoutSession; date: string }
    | { type: 'activity'; data: ActivityLogItem; date: string }
  > = [];

  if (activeFilter === 'all' || activeFilter === 'workouts') {
    workouts.forEach((w) => filteredItems.push({ type: 'workout', data: w, date: w.local_date }));
  }
  if (activeFilter === 'all' || activeFilter === 'activities') {
    activities.forEach((a) =>
      filteredItems.push({ type: 'activity', data: a, date: a.local_date }),
    );
  }

  // Sort descending by date
  filteredItems.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.screenContainer} testID="s04-history-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Workout</Text>
          <Text style={styles.headerSubtitle}>
            {filterDate ? `Filtered to ${filterDate}` : 'History'}
          </Text>
        </View>
        <Pressable
          testID="history-header-settings"
          accessibilityRole="button"
          accessibilityLabel="Workout settings"
          onPress={onOpenSettings}
          style={styles.headerIconBtn}
        >
          <Ionicons name="settings-outline" size={22} color={workoutTokens.text} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <SegmentedTabs activeTab={currentTab} onChangeTab={onChangeTab} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date Filter Badge if present */}
        {filterDate ? (
          <View style={styles.filterBanner}>
            <Text style={styles.filterBannerText}>Showing {filterDate}</Text>
            <Pressable
              onPress={onClearDateFilter}
              style={styles.clearFilterBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear date filter"
            >
              <Text style={styles.clearFilterText}>Show all</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Monthly Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{totalHours}h</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{activities.length}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.chipsRow}>
          <WorkoutChip
            label="All"
            selected={activeFilter === 'all'}
            onPress={() => setActiveFilter('all')}
            testID="filter-all-chip"
          />
          <WorkoutChip
            label="Workouts"
            selected={activeFilter === 'workouts'}
            onPress={() => setActiveFilter('workouts')}
            testID="filter-workouts-chip"
          />
          <WorkoutChip
            label="Activities"
            selected={activeFilter === 'activities'}
            onPress={() => setActiveFilter('activities')}
            testID="filter-activities-chip"
          />
        </View>

        {/* History List */}
        <View style={styles.listSection}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyCard} testID="history-empty-state">
              <Text style={styles.emptyText}>Nothing logged on this day</Text>
            </View>
          ) : (
            filteredItems.map((item, index) => {
              if (item.type === 'workout') {
                const w = item.data;
                const isExpanded = expandedWorkoutId === w.id;
                return (
                  <View key={`wrk-${w.id}-${index}`} style={styles.historyCard}>
                    <Pressable
                      testID={`history-workout-row-${w.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${w.name}, date ${w.local_date}`}
                      onPress={() => setExpandedWorkoutId(isExpanded ? null : w.id)}
                      style={styles.cardHeaderPressable}
                    >
                      <View style={styles.iconCircle}>
                        <Ionicons name="barbell" size={20} color={workoutTokens.accent} />
                      </View>
                      <View style={styles.cardInfoCol}>
                        <Text style={styles.itemTitle}>{w.name}</Text>
                        <Text style={styles.itemDate}>{w.local_date}</Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={workoutTokens.dim}
                      />
                    </Pressable>

                    {/* Expanded details */}
                    {isExpanded && w.exercises && w.exercises.length > 0 ? (
                      <View style={styles.expandedSection}>
                        {w.exercises.map((ex, exIdx) => (
                          <View key={ex.id || exIdx} style={styles.exerciseDetailRow}>
                            <Text style={styles.exerciseDetailName}>{ex.exercise_name}</Text>
                            <Text style={styles.exerciseDetailSets}>
                              {ex.sets.filter((s) => s.completed).length} of {ex.sets.length} sets
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              }

              const a = item.data;
              return (
                <View key={`act-${a.id}-${index}`} style={styles.historyCard}>
                  <View style={styles.cardHeaderPressable}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="fitness" size={20} color={workoutTokens.accent} />
                    </View>
                    <View style={styles.cardInfoCol}>
                      <Text style={styles.itemTitle}>{a.activity_name}</Text>
                      <Text style={styles.itemDate}>
                        {a.local_date} · {a.duration_minutes} min
                        {a.calories_burned ? ` · ${a.calories_burned} kcal` : ''}
                      </Text>
                    </View>
                    <Pressable
                      testID={`activity-history-menu-${a.id}`}
                      accessibilityRole="button"
                      accessibilityLabel="Activity options"
                      onPress={() => {
                        Alert.alert(a.activity_name, 'Choose an action', [
                          { text: 'Edit', onPress: () => onEditActivity(a) },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => handleDeleteActivity(a),
                          },
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                      }}
                      style={styles.menuBtn}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={workoutTokens.dim} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.circleMedium,
    backgroundColor: workoutTokens.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  filterBannerText: {
    color: workoutTokens.text,
    fontSize: 13,
    fontWeight: '700',
  },
  clearFilterBtn: {
    minHeight: 32,
    justifyContent: 'center',
  },
  clearFilterText: {
    color: workoutTokens.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    color: workoutTokens.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: workoutTokens.border,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  listSection: {
    gap: 10,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.card,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyText: {
    color: workoutTokens.dim,
    fontSize: 15,
  },
  historyCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 14,
  },
  cardHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfoCol: {
    flex: 1,
  },
  itemTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  itemDate: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: workoutTokens.border,
    gap: 6,
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  exerciseDetailName: {
    color: workoutTokens.muted,
    fontSize: 13,
  },
  exerciseDetailSets: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  scrollSpacer: {
    height: 40,
  },
});
