import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import {
  addExerciseToDate,
  getPlannedExercisesForDate,
  getWeeklyPlan,
  toggleExerciseCompletion,
  type PlannedExercise,
} from '@/services/workoutPlanService';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { AddExercisePickerModal } from './AddExercisePickerModal';

export interface WorkoutLogModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenProgress?: () => void;
  testID?: string;
}

export function WorkoutLogModal({
  visible,
  onClose,
  onOpenProgress,
  testID = 'workout-log-modal',
}: WorkoutLogModalProps) {
  const currentDateStr = 'Wed, 15 Oct 2025';
  const plan = getWeeklyPlan();

  const [exercises, setExercises] = useState<PlannedExercise[]>(() =>
    getPlannedExercisesForDate(currentDateStr),
  );
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState<PlannedExercise | null>(null);
  const [showAddExercisePicker, setShowAddExercisePicker] = useState<boolean>(false);

  const completedCount = exercises.filter((e) => e.completed).length;
  const progressRatio = exercises.length > 0 ? completedCount / exercises.length : 0;

  const handleToggleCheck = (id: string) => {
    playClickSound();
    const updated = toggleExerciseCompletion(currentDateStr, id);
    setExercises([...updated]);
  };

  const handleOpenDetail = (ex: PlannedExercise) => {
    playClickSound();
    setSelectedExerciseForDetail(ex);
  };

  const handleAddQuickExercise = () => {
    playClickSound();
    setShowAddExercisePicker(true);
  };

  const handleConfirmAddExercise = (chosen: {
    name: string;
    muscleGroup: string;
    plannedSets: number;
  }) => {
    const newEx = addExerciseToDate(currentDateStr, {
      name: chosen.name,
      muscleGroup: chosen.muscleGroup,
      plannedSets: chosen.plannedSets,
    });
    setExercises((prev) => [...prev, newEx]);
  };

  const weekDays = [
    { name: 'Mon', dateNum: 13, isRest: !plan.workoutDays.includes('Mon'), isToday: false },
    { name: 'Tue', dateNum: 14, isRest: !plan.workoutDays.includes('Tue'), isToday: false },
    { name: 'Wed', dateNum: 15, isRest: !plan.workoutDays.includes('Wed'), isToday: true },
    { name: 'Thu', dateNum: 16, isRest: !plan.workoutDays.includes('Thu'), isToday: false },
    { name: 'Fri', dateNum: 17, isRest: !plan.workoutDays.includes('Fri'), isToday: false },
    { name: 'Sat', dateNum: 18, isRest: !plan.workoutDays.includes('Sat'), isToday: false },
    { name: 'Sun', dateNum: 19, isRest: !plan.workoutDays.includes('Sun'), isToday: false },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-workout-log-back"
            >
              <ChevronLeftIcon size={22} color={dark.textHi} />
            </TouchableOpacity>

            <Text variant="title2" color={dark.textHi} style={styles.topTitle}>
              Workout Log
            </Text>

            <TouchableOpacity
              onPress={onOpenProgress}
              accessibilityRole="button"
              accessibilityLabel="Open workout progress"
              style={styles.calendarIconBtn}
              testID="btn-open-progress-from-log"
            >
              <Ionicons name="bar-chart-outline" size={22} color={dark.apricot} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Date Navigator Header */}
            <View style={styles.dateNavigatorRow}>
              <TouchableOpacity onPress={playClickSound} style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={18} color={dark.textMid} />
              </TouchableOpacity>

              <View style={styles.dateBadgeBox}>
                <Ionicons name="calendar-outline" size={16} color={dark.apricot} />
                <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                  {currentDateStr}
                </Text>
                <Ionicons name="chevron-down" size={14} color={dark.textLo} />
              </View>

              <TouchableOpacity onPress={playClickSound} style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={18} color={dark.textMid} />
              </TouchableOpacity>
            </View>

            {/* Weekday Strip */}
            <View style={styles.weekStripRow}>
              {weekDays.map((item) => (
                <View
                  key={item.name}
                  style={[
                    styles.dayStripCell,
                    item.isToday && styles.dayStripCellToday,
                  ]}
                  testID={`strip-day-${item.name}`}
                >
                  <Text
                    variant="micro"
                    color={item.isToday ? dark.apricot : dark.textLo}
                    style={{ fontWeight: item.isToday ? '700' : '500' }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    variant="body"
                    color={item.isToday ? dark.apricot : dark.textHi}
                    style={{ fontWeight: '700', marginVertical: 2 }}
                  >
                    {item.dateNum}
                  </Text>
                  <Text
                    variant="micro"
                    color={item.isToday ? dark.apricot : dark.textOff}
                    style={{ fontSize: 9 }}
                  >
                    {item.isToday ? 'Today' : item.isRest ? 'Rest' : '•'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Status Banner Card */}
            <View style={styles.statusBannerCard}>
              <View style={styles.statusBannerTop}>
                <View style={styles.dumbbellIconCircle}>
                  <Ionicons name="barbell" size={20} color={dark.mint} />
                </View>
                <View style={styles.statusBannerTextCol}>
                  <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                    Workout Day
                  </Text>
                  <Text variant="micro" color={dark.textMid}>
                    Complete your planned exercises
                  </Text>
                </View>
                <Text variant="micro" color={dark.apricot} style={{ fontWeight: '700' }}>
                  {completedCount}/{exercises.length} exercises
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(progressRatio * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Planned Exercises List */}
            <View style={styles.exercisesList}>
              {exercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleOpenDetail(ex)}
                  style={[styles.exerciseRowCard, ex.completed && styles.exerciseRowCardCompleted]}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, ${ex.muscleGroup}, ${ex.plannedSets} sets`}
                  testID={`exercise-item-${ex.id}`}
                >
                  <View style={styles.exerciseIconCircle}>
                    <Ionicons name="barbell-outline" size={22} color={dark.apricot} />
                  </View>

                  <View style={styles.exerciseNameCol}>
                    <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                      {ex.name}
                    </Text>
                    <Text variant="micro" color={dark.textLo}>
                      {ex.muscleGroup}
                    </Text>
                  </View>

                  <Text variant="bodyS" color={dark.textMid} style={styles.setsCountText}>
                    {ex.plannedSets} sets
                  </Text>

                  {/* Completion Checkmark */}
                  <TouchableOpacity
                    onPress={() => handleToggleCheck(ex.id)}
                    style={[
                      styles.checkCircle,
                      ex.completed && styles.checkCircleActive,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ex.completed }}
                    testID={`checkbox-${ex.id}`}
                  >
                    {ex.completed ? (
                      <Ionicons name="checkmark" size={16} color={dark.onBrand} />
                    ) : null}
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Add Exercise Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleAddQuickExercise}
              style={styles.addExerciseBtn}
              accessibilityRole="button"
              accessibilityLabel="Add Exercise"
              testID="btn-add-exercise-log"
            >
              <Ionicons name="add" size={20} color={dark.onBrand} />
              <Text variant="heading" color={dark.onBrand} style={styles.addExerciseBtnText}>
                Add Exercise
              </Text>
            </TouchableOpacity>
          </View>

          {/* Exercise Detail Modal */}
          {selectedExerciseForDetail && (
            <ExerciseDetailModal
              visible={Boolean(selectedExerciseForDetail)}
              exercise={selectedExerciseForDetail}
              dateStr={currentDateStr}
              onClose={() => setSelectedExerciseForDetail(null)}
              onSaved={(updated) => {
                setExercises((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
              }}
            />
          )}

          {/* Exercise Selection Picker Modal */}
          {showAddExercisePicker && (
            <AddExercisePickerModal
              visible={showAddExercisePicker}
              onClose={() => setShowAddExercisePicker(false)}
              onSelectExercise={handleConfirmAddExercise}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontWeight: '700',
  },
  calendarIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingBottom: 120,
    gap: space[4],
  },
  dateNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: 8,
  },
  weekStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayStripCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: dark.s1,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  dayStripCellToday: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  statusBannerCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  statusBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  dumbbellIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(46, 192, 131, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerTextCol: {
    flex: 1,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
  },
  exercisesList: {
    gap: space[3],
  },
  exerciseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[3] + 2,
    gap: space[3],
  },
  exerciseRowCardCompleted: {
    borderColor: dark.hairlineLit,
    backgroundColor: dark.s2,
  },
  exerciseIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNameCol: {
    flex: 1,
  },
  setsCountText: {
    fontWeight: '600',
    marginRight: space[2],
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: space[4],
    right: space[4],
  },
  addExerciseBtn: {
    flexDirection: 'row',
    backgroundColor: dark.apricot,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addExerciseBtnText: {
    fontWeight: '800',
    fontSize: 16,
  },
});
