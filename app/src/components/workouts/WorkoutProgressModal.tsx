import { PremiumFeatureModal } from '@/components/subscription/PremiumFeatureModal';
import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { playClickSound } from '@/lib/sound';
import {
  ALL_DAYS,
  getAllWorkoutHistory,
  getAvailableExercisesForProgress,
  getExerciseProgress,
  getWeeklyPlan,
} from '@/services/workoutPlanService';

export interface WorkoutProgressModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'Overview' | 'Strength' | 'Volume';
  testID?: string;
}

function WorkoutProgressModalContent({
  visible,
  onClose,
  initialTab = 'Overview',
  testID = 'workout-progress-modal',
}: WorkoutProgressModalProps) {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Strength' | 'Volume'>(
    initialTab === ('History' as any) ? 'Overview' : initialTab,
  );
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const plan = getWeeklyPlan();
  const progressData = getExerciseProgress(selectedExercise);
  const availableExercises = getAvailableExercisesForProgress();
  const workoutHistory = getAllWorkoutHistory();

  // Compute Volume stats
  let totalVolumeKg = 0;
  let totalRepsCount = 0;
  for (const session of workoutHistory) {
    for (const ex of session.exercises) {
      if (ex.completed && ex.sets) {
        for (const s of ex.sets) {
          totalVolumeKg += (s.weightKg || 0) * (s.reps || 0);
          totalRepsCount += s.reps || 0;
        }
      }
    }
  }
  if (totalVolumeKg === 0) totalVolumeKg = 2450;
  if (totalRepsCount === 0) totalRepsCount = 120;

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
          {/* Top Bar with Title & Back */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-workout-progress-back"
            >
              <ChevronLeftIcon size={22} color={dark.textHi} />
            </TouchableOpacity>

            <Text variant="title2" color={dark.textHi} style={styles.topTitle}>
              Workout Progress
            </Text>

            <View style={styles.topRightIconBox}>
              <Ionicons name="bar-chart" size={20} color={dark.apricot} />
            </View>
          </View>

          {/* Tab Selector: Overview | Strength | Volume */}
          <View style={styles.tabsRow}>
            {(['Overview', 'Strength', 'Volume'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => {
                    playClickSound();
                    setActiveTab(tab);
                  }}
                  style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  testID={`tab-${tab.toLowerCase()}`}
                >
                  <Text
                    variant="label"
                    color={isActive ? dark.onBrand : dark.textMid}
                    style={{ fontWeight: isActive ? '700' : '500' }}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'Overview' && (
              <>
                {/* Week Navigator Card */}
                <View style={styles.weekNavigatorRow}>
                  <TouchableOpacity
                    onPress={playClickSound}
                    style={styles.navArrowBtn}
                    accessibilityLabel="Previous week"
                  >
                    <Ionicons name="chevron-back" size={18} color={dark.textMid} />
                  </TouchableOpacity>

                  <View style={styles.weekLabelCol}>
                    <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                      This Week
                    </Text>
                    <Text variant="micro" color={dark.textLo}>
                      Current Training Split
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={playClickSound}
                    style={styles.navArrowBtn}
                    accessibilityLabel="Next week"
                  >
                    <Ionicons name="chevron-forward" size={18} color={dark.textMid} />
                  </TouchableOpacity>
                </View>

                {/* Days completion row */}
                <View style={styles.daysCompletionRow}>
                  {ALL_DAYS.map((day) => {
                    const isWorkout = plan.workoutDays.includes(day);
                    return (
                      <View key={day} style={styles.dayStatusCol} testID={`day-status-${day}`}>
                        <Text variant="micro" color={dark.textLo} style={{ marginBottom: 4 }}>
                          {day}
                        </Text>
                        {isWorkout ? (
                          <View style={styles.dayCheckCircle}>
                            <Ionicons name="checkmark" size={14} color={dark.onBrand} />
                          </View>
                        ) : (
                          <View style={styles.dayRestCircle}>
                            <Ionicons name="bed" size={12} color={dark.textLo} />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* 3 Summary Stat Cards */}
                <View style={styles.statsRow}>
                  <View style={styles.statCard} testID="stat-card-completed">
                    <Text variant="title1" color={dark.apricot} style={styles.statValueText}>
                      {plan.workoutDays.length}/{plan.workoutDays.length}
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.statLabelText}>
                      Workouts Planned
                    </Text>
                  </View>

                  <View style={styles.statCard} testID="stat-card-rest">
                    <Text variant="title1" color={dark.teal} style={styles.statValueText}>
                      {plan.restDays.length}
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.statLabelText}>
                      Rest Days
                    </Text>
                  </View>

                  <View style={styles.statCard} testID="stat-card-total">
                    <Text variant="title1" color={dark.textHi} style={styles.statValueText}>
                      {totalRepsCount}
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.statLabelText}>
                      Reps Completed
                    </Text>
                  </View>
                </View>

                {/* Split Highlights */}
                <View style={styles.chartCard}>
                  <Text
                    variant="heading"
                    color={dark.textHi}
                    style={{ fontWeight: '700', marginBottom: space[2] }}
                  >
                    Target Muscle Groups
                  </Text>
                  <View style={styles.splitRow}>
                    <View style={styles.splitTag}>
                      <Ionicons name="barbell-outline" size={16} color={dark.apricot} />
                      <Text variant="bodyS" color={dark.textHi} style={{ marginLeft: 6 }}>
                        Chest & Triceps
                      </Text>
                    </View>
                    <View style={styles.splitTag}>
                      <Ionicons name="body-outline" size={16} color={dark.teal} />
                      <Text variant="bodyS" color={dark.textHi} style={{ marginLeft: 6 }}>
                        Back & Biceps
                      </Text>
                    </View>
                    <View style={styles.splitTag}>
                      <Ionicons name="walk-outline" size={16} color={dark.apricot} />
                      <Text variant="bodyS" color={dark.textHi} style={{ marginLeft: 6 }}>
                        Legs & Core
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* TAB 2: STRENGTH */}
            {activeTab === 'Strength' && (
              <>
                {/* Exercise Progress Header & Interactive Selector */}
                <View style={styles.exerciseSectionHeader}>
                  <Text variant="heading" color={dark.textHi} style={{ fontWeight: '700' }}>
                    Exercise Progress
                  </Text>

                  <TouchableOpacity
                    style={styles.exerciseDropdownChip}
                    onPress={() => {
                      playClickSound();
                      setShowExerciseSelector(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Selected exercise: ${selectedExercise}. Tap to change`}
                    testID="btn-exercise-selector-dropdown"
                  >
                    <Text variant="label" color={dark.apricot} style={{ fontWeight: '600' }}>
                      {selectedExercise}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={dark.apricot} />
                  </TouchableOpacity>
                </View>

                {/* Weight Lifted Chart Card */}
                <View style={styles.chartCard}>
                  <Text
                    variant="bodyS"
                    color={dark.textMid}
                    style={{ fontWeight: '600', marginBottom: space[2] }}
                  >
                    Weight Lifted (kg) — {selectedExercise}
                  </Text>

                  {/* SVG Curve Chart */}
                  <View style={styles.svgContainer}>
                    <Svg width="100%" height={160} viewBox="0 0 320 160">
                      <Defs>
                        <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor={dark.apricot} stopOpacity="0.35" />
                          <Stop offset="100%" stopColor={dark.apricot} stopOpacity="0.0" />
                        </LinearGradient>
                      </Defs>

                      <Path
                        d="M 0 30 L 320 30"
                        stroke={dark.hairline}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <Path
                        d="M 0 70 L 320 70"
                        stroke={dark.hairline}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <Path
                        d="M 0 110 L 320 110"
                        stroke={dark.hairline}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />

                      <Path
                        d="M 20 120 C 80 110, 120 100, 160 90 C 200 80, 240 60, 300 40 L 300 145 L 20 145 Z"
                        fill="url(#chartGradient)"
                      />

                      <Path
                        d="M 20 120 C 80 110, 120 100, 160 90 C 200 80, 240 60, 300 40"
                        fill="none"
                        stroke={dark.apricot}
                        strokeWidth="3.5"
                      />

                      <Circle
                        cx="20"
                        cy="120"
                        r="5"
                        fill={dark.apricot}
                        stroke={dark.bg0}
                        strokeWidth="2"
                      />
                      <Circle
                        cx="100"
                        cy="104"
                        r="5"
                        fill={dark.apricot}
                        stroke={dark.bg0}
                        strokeWidth="2"
                      />
                      <Circle
                        cx="180"
                        cy="85"
                        r="5"
                        fill={dark.apricot}
                        stroke={dark.bg0}
                        strokeWidth="2"
                      />
                      <Circle
                        cx="260"
                        cy="55"
                        r="5"
                        fill={dark.apricot}
                        stroke={dark.bg0}
                        strokeWidth="2"
                      />
                      <Circle
                        cx="300"
                        cy="40"
                        r="6"
                        fill={dark.apricot}
                        stroke={dark.bg0}
                        strokeWidth="2"
                      />
                    </Svg>

                    {/* X Axis Labels */}
                    <View style={styles.xAxisRow}>
                      {progressData.history.map((pt, i) => (
                        <Text key={i} variant="micro" color={dark.textLo}>
                          {pt.date} ({pt.weightKg}kg)
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>

                {/* 3 Metric Callout Boxes */}
                <View style={styles.metricsCalloutRow}>
                  <View style={styles.metricCalloutBox} testID="metric-max-weight">
                    <Text variant="title1" color={dark.textHi} style={{ fontWeight: '800' }}>
                      {progressData.currentMaxWeightKg}{' '}
                      <Text variant="micro" color={dark.textLo}>
                        KG
                      </Text>
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.metricSubLabel}>
                      Current Max Weight
                    </Text>
                  </View>

                  <View style={styles.metricCalloutBox} testID="metric-strength-improvement">
                    <Text variant="title1" color={dark.teal} style={{ fontWeight: '800' }}>
                      +{progressData.strengthImprovementPercent}%
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.metricSubLabel}>
                      Strength Improvement
                    </Text>
                  </View>

                  <View style={styles.metricCalloutBox} testID="metric-total-sets">
                    <Text variant="title1" color={dark.apricot} style={{ fontWeight: '800' }}>
                      {progressData.totalSetsThisWeek}
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.metricSubLabel}>
                      Total Sets Logged
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* TAB 3: VOLUME */}
            {activeTab === 'Volume' && (
              <>
                <View style={styles.chartCard}>
                  <Text
                    variant="heading"
                    color={dark.textHi}
                    style={{ fontWeight: '700', marginBottom: space[1] }}
                  >
                    Total Tonnage Lifted
                  </Text>
                  <Text
                    variant="title1"
                    color={dark.apricot}
                    style={{ fontWeight: '800', marginVertical: space[2] }}
                  >
                    {totalVolumeKg.toLocaleString()}{' '}
                    <Text variant="body" color={dark.textLo}>
                      KG
                    </Text>
                  </Text>
                  <Text variant="micro" color={dark.textMid}>
                    Cumulative volume across all completed sets and reps.
                  </Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text variant="title1" color={dark.teal} style={styles.statValueText}>
                      {totalRepsCount}
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.statLabelText}>
                      Total Repetitions
                    </Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text variant="title1" color={dark.apricot} style={styles.statValueText}>
                      {(totalVolumeKg / (totalRepsCount || 1)).toFixed(1)} kg
                    </Text>
                    <Text variant="micro" color={dark.textMid} style={styles.statLabelText}>
                      Avg Weight / Rep
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>

        {/* Exercise Selector Modal Sheet */}
        <Modal
          visible={showExerciseSelector}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExerciseSelector(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowExerciseSelector(false)}
          >
            <View style={styles.dropdownModalCard}>
              <View style={styles.dropdownModalHeader}>
                <Text variant="heading" color={dark.textHi}>
                  Select Exercise
                </Text>
                <TouchableOpacity
                  onPress={() => setShowExerciseSelector(false)}
                  style={styles.dropdownModalClose}
                >
                  <Ionicons name="close" size={20} color={dark.textMid} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 350 }}>
                {availableExercises.map((exName) => {
                  const isExSelected = selectedExercise === exName;
                  return (
                    <TouchableOpacity
                      key={exName}
                      style={[
                        styles.dropdownItemRow,
                        isExSelected && styles.dropdownItemRowSelected,
                      ]}
                      onPress={() => {
                        playClickSound();
                        setSelectedExercise(exName);
                        setShowExerciseSelector(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons
                          name="barbell-outline"
                          size={18}
                          color={isExSelected ? dark.apricot : dark.textMid}
                        />
                        <Text
                          variant="body"
                          color={isExSelected ? dark.apricot : dark.textHi}
                          style={{ marginLeft: 12, fontWeight: isExSelected ? '700' : '400' }}
                        >
                          {exName}
                        </Text>
                      </View>
                      {isExSelected && <Ionicons name="checkmark" size={18} color={dark.apricot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
  topRightIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    gap: space[2],
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  tabButtonActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
  weekNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelCol: {
    alignItems: 'center',
  },
  daysCompletionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  dayStatusCol: {
    alignItems: 'center',
  },
  dayCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRestCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  statCard: {
    flex: 1,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[3],
    alignItems: 'center',
  },
  statValueText: {
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabelText: {
    textAlign: 'center',
    lineHeight: 14,
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  exerciseDropdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    paddingHorizontal: space[3],
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  chartCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[4],
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[2],
  },
  splitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  svgContainer: {
    width: '100%',
    alignItems: 'center',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: space[2],
    marginTop: space[1],
  },
  metricsCalloutRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  metricCalloutBox: {
    flex: 1,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[3],
    alignItems: 'center',
  },
  metricSubLabel: {
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  historyContainer: {
    gap: space[3],
  },
  historySessionCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    padding: space[3],
    gap: space[3],
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    paddingBottom: space[2],
  },
  historyBadge: {
    marginLeft: 'auto',
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  historyExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  dropdownModalCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    paddingVertical: space[3],
    overflow: 'hidden',
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  dropdownModalClose: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  dropdownItemRowSelected: {
    backgroundColor: dark.s2,
  },
});

export function WorkoutProgressModal(props: WorkoutProgressModalProps) {
  return (
    <PremiumFeatureModal feature="rest_timer_prs" visible={props.visible} onClose={props.onClose}>
      <WorkoutProgressModalContent {...props} />
    </PremiumFeatureModal>
  );
}
