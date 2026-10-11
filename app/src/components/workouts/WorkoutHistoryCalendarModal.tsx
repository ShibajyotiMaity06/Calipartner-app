import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Workout, WorkoutWithDetails } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import {
  getWorkoutById,
  getWorkoutsCalendarData,
  getWorkoutsForDate,
  getWorkoutsHistory,
} from '@/services/workoutService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { WorkoutDetailModal } from './WorkoutDetailModal';

interface WorkoutHistoryCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onWorkoutSelected?: (workout: WorkoutWithDetails) => void;
  testID?: string;
}

export function WorkoutHistoryCalendarModal({
  visible,
  onClose,
  onWorkoutSelected,
  testID = 'workout-history-modal',
}: WorkoutHistoryCalendarModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest-user';

  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  // History list state
  const [historyItems, setHistoryItems] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({});
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(
    null,
  );
  const [dateWorkouts, setDateWorkouts] = useState<WorkoutWithDetails[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  // Detail Modal state
  const [selectedWorkoutDetail, setSelectedWorkoutDetail] =
    useState<WorkoutWithDetails | null>(null);

  // Load history list
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const list = await getWorkoutsHistory(db, userId, 100, 0);
      setHistoryItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load calendar counts for current month
  const loadCalendarData = useCallback(async () => {
    try {
      const db = await getDb();
      const year = currentMonthDate.getFullYear();
      const month = currentMonthDate.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        endDay,
      ).padStart(2, '0')}`;

      const counts = await getWorkoutsCalendarData(db, userId, startStr, endStr);
      setCalendarCounts(counts);
    } catch {
      // Ignore
    }
  }, [currentMonthDate, userId]);

  // Load workouts for selected calendar date
  const loadDateWorkouts = useCallback(
    async (dateStr: string) => {
      try {
        setDateLoading(true);
        const db = await getDb();
        const items = await getWorkoutsForDate(db, userId, dateStr);
        setDateWorkouts(items);
      } catch {
        setDateWorkouts([]);
      } finally {
        setDateLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (visible) {
      void loadHistory();
      void loadCalendarData();
    }
  }, [visible, loadHistory, loadCalendarData]);

  useEffect(() => {
    if (selectedCalendarDate) {
      void loadDateWorkouts(selectedCalendarDate);
    }
  }, [selectedCalendarDate, loadDateWorkouts]);

  const handleOpenDetail = async (workoutId: string) => {
    const db = await getDb();
    const full = await getWorkoutById(db, workoutId);
    if (full) {
      setSelectedWorkoutDetail(full);
      if (onWorkoutSelected) onWorkoutSelected(full);
    }
  };

  const handleMonthShift = (delta: number) => {
    const next = new Date(currentMonthDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentMonthDate(next);
  };

  // Build calendar matrix
  const renderCalendar = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    // Shift so Mon = 0, Sun = 6
    const startOffset = (firstDayOfWeek + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dayNum?: number; dateStr?: string }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({});
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`;
      cells.push({ dayNum: day, dateStr });
    }

    const monthName = currentMonthDate.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });

    return (
      <View style={styles.calendarContainer}>
        {/* Month Selector */}
        <View style={styles.monthHeaderRow}>
          <TouchableOpacity
            testID={`${testID}-btn-prev-month`}
            onPress={() => handleMonthShift(-1)}
            style={styles.monthShiftBtn}
            accessibilityRole="button"
            accessibilityLabel="Previous Month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.monthHeaderText, { color: colors.text }]}>
            {monthName}
          </Text>
          <TouchableOpacity
            testID={`${testID}-btn-next-month`}
            onPress={() => handleMonthShift(1)}
            style={styles.monthShiftBtn}
            accessibilityRole="button"
            accessibilityLabel="Next Month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Days of Week Row */}
        <View style={styles.daysOfWeekRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dw) => (
            <Text
              key={dw}
              style={[styles.dayOfWeekText, { color: colors.textMuted }]}
            >
              {dw}
            </Text>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.gridWrap}>
          {cells.map((cell, idx) => {
            if (!cell.dayNum || !cell.dateStr) {
              return <View key={`blank-${idx}`} style={styles.gridCell} />;
            }

            const count = calendarCounts[cell.dateStr] ?? 0;
            const isSelected = selectedCalendarDate === cell.dateStr;

            return (
              <TouchableOpacity
                key={cell.dateStr}
                testID={`cal-day-${cell.dateStr}`}
                style={[
                  styles.gridCell,
                  isSelected && {
                    backgroundColor: colors.cardHighlight,
                    borderColor: colors.accent,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setSelectedCalendarDate(cell.dateStr!)}
                accessibilityRole="button"
                accessibilityLabel={`${cell.dateStr}, ${count} workouts`}
              >
                <Text
                  style={[
                    styles.cellDayNum,
                    { color: isSelected ? colors.accent : colors.text },
                  ]}
                >
                  {cell.dayNum}
                </Text>
                {count > 0 && (
                  <View
                    testID={`cal-dot-${cell.dateStr}`}
                    style={[
                      styles.workoutDot,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Workouts for selected day */}
        {selectedCalendarDate && (
          <View style={styles.dateWorkoutsSection}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              {selectedCalendarDate}
            </Text>

            {dateLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : dateWorkouts.length === 0 ? (
              <Text style={[styles.emptyDateText, { color: colors.textMuted }]}>
                {t('workouts.history.noWorkoutsOnDate', {
                  date: selectedCalendarDate,
                })}
              </Text>
            ) : (
              dateWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  testID={`date-workout-item-${w.id}`}
                  style={[
                    styles.historyItemCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => handleOpenDetail(w.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.name || w.type}, ${w.duration_minutes} minutes`}
                >
                  <View style={styles.itemMain}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {w.name || t(`workouts.types.${w.type}` as const)}
                    </Text>
                    <Text style={[styles.itemSub, { color: colors.textMuted }]}>
                      {w.duration_minutes} min • {w.exercises.length} exercises
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: Workout }) => {
    return (
      <TouchableOpacity
        testID={`history-workout-item-${item.id}`}
        style={[
          styles.historyItemCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => handleOpenDetail(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name || item.type}, ${item.local_date}`}
      >
        <View style={styles.itemMain}>
          <View style={styles.itemTopRow}>
            <Text style={[styles.itemName, { color: colors.text }]}>
              {item.name || t(`workouts.types.${item.type}` as const)}
            </Text>
            <View
              style={[
                styles.typeTag,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.typeTagText, { color: colors.textMuted }]}>
                {t(`workouts.types.${item.type}` as const)}
              </Text>
            </View>
          </View>

          <Text style={[styles.itemSub, { color: colors.textMuted }]}>
            {item.local_date} • {item.duration_minutes} min
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal
        testID={testID}
        visible={visible && !selectedWorkoutDetail}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              testID={`${testID}-btn-close`}
              onPress={onClose}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('workouts.history.title')}
            </Text>

            <View style={{ width: 36 }} />
          </View>

          {/* Tab Selector: List vs Calendar */}
          <View
            style={[
              styles.tabSelectorWrap,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              testID="tab-history-list"
              style={[
                styles.tabButton,
                activeTab === 'list' && {
                  borderBottomColor: colors.accent,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveTab('list')}
              accessibilityRole="tab"
              accessibilityLabel={t('workouts.history.tabList')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={activeTab === 'list' ? colors.accent : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === 'list' ? colors.accent : colors.textMuted,
                    fontWeight: activeTab === 'list' ? '700' : '500',
                  },
                ]}
              >
                {t('workouts.history.tabList')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="tab-calendar-view"
              style={[
                styles.tabButton,
                activeTab === 'calendar' && {
                  borderBottomColor: colors.accent,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveTab('calendar')}
              accessibilityRole="tab"
              accessibilityLabel={t('workouts.history.tabCalendar')}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={activeTab === 'calendar' ? colors.accent : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === 'calendar' ? colors.accent : colors.textMuted,
                    fontWeight: activeTab === 'calendar' ? '700' : '500',
                  },
                ]}
              >
                {t('workouts.history.tabCalendar')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Body */}
          {activeTab === 'calendar' ? (
            <FlatList
              data={['calendar']}
              keyExtractor={(i) => i}
              renderItem={() => renderCalendar()}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          ) : loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                {t('common.loading')}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
              <Text style={[styles.stateText, { color: colors.danger }]}>{error}</Text>
              <TouchableOpacity
                testID={`${testID}-btn-retry`}
                style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                onPress={loadHistory}
              >
                <Text style={{ color: colors.onAccent, fontWeight: '700' }}>
                  {t('common.retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : historyItems.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="calendar-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('workouts.history.noHistory')}
              </Text>
            </View>
          ) : (
            <FlatList
              testID={`${testID}-list`}
              data={historyItems}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>

      {/* Workout Detail Modal */}
      {selectedWorkoutDetail && (
        <WorkoutDetailModal
          visible={Boolean(selectedWorkoutDetail)}
          workout={selectedWorkoutDetail}
          onClose={() => {
            setSelectedWorkoutDetail(null);
            void loadHistory();
            void loadCalendarData();
          }}
          onDeleted={() => {
            setSelectedWorkoutDetail(null);
            void loadHistory();
            void loadCalendarData();
          }}
          onUpdated={(up) => {
            setSelectedWorkoutDetail(up);
            void loadHistory();
            void loadCalendarData();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  tabSelectorWrap: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabText: {
    fontSize: fontSize.sm,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
    paddingBottom: 40,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: fontSize.xs,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  calendarContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  monthShiftBtn: {
    padding: 6,
  },
  monthHeaderText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  dayOfWeekText: {
    width: 36,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  cellDayNum: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  workoutDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  dateWorkoutsSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyDateText: {
    fontSize: fontSize.xs,
    paddingVertical: spacing.sm,
  },
});
