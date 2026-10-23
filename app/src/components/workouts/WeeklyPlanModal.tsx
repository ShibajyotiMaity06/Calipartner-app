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
import { Button, ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import {
  ALL_DAYS,
  getWeeklyPlan,
  saveWeeklyPlan,
  type WeeklyPlan,
} from '@/services/workoutPlanService';

export interface WeeklyPlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSavePlan?: (plan: WeeklyPlan) => void;
  testID?: string;
}

export function WeeklyPlanModal({
  visible,
  onClose,
  onSavePlan,
  testID = 'weekly-plan-modal',
}: WeeklyPlanModalProps) {
  const initialPlan = getWeeklyPlan();
  const [daysPerWeek, setDaysPerWeek] = useState<number>(initialPlan.daysPerWeek);
  const [selectedWorkoutDays, setSelectedWorkoutDays] = useState<string[]>(initialPlan.workoutDays);

  // Compute rest days dynamically
  const restDays = ALL_DAYS.filter((d) => !selectedWorkoutDays.includes(d));

  const handleSelectDaysCount = (count: number) => {
    playClickSound();
    setDaysPerWeek(count);

    // Auto-adjust default days if needed to match count
    if (count === 4) {
      setSelectedWorkoutDays(['Mon', 'Wed', 'Fri', 'Sat']);
    } else if (count === 3) {
      setSelectedWorkoutDays(['Mon', 'Wed', 'Fri']);
    } else if (count === 5) {
      setSelectedWorkoutDays(['Mon', 'Tue', 'Wed', 'Fri', 'Sat']);
    } else if (count === 6) {
      setSelectedWorkoutDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    } else if (count === 7) {
      setSelectedWorkoutDays([...ALL_DAYS]);
    } else if (count === 2) {
      setSelectedWorkoutDays(['Tue', 'Sat']);
    } else if (count === 1) {
      setSelectedWorkoutDays(['Mon']);
    }
  };

  const handleToggleDay = (day: string) => {
    playClickSound();
    if (selectedWorkoutDays.includes(day)) {
      if (selectedWorkoutDays.length > 1) {
        const next = selectedWorkoutDays.filter((d) => d !== day);
        setSelectedWorkoutDays(next);
        setDaysPerWeek(next.length);
      }
    } else {
      if (selectedWorkoutDays.length < 7) {
        const next = [...selectedWorkoutDays, day];
        setSelectedWorkoutDays(next);
        setDaysPerWeek(next.length);
      }
    }
  };

  const handleSaveAndNext = () => {
    playSuccessSound();
    const updated = saveWeeklyPlan(daysPerWeek, selectedWorkoutDays);
    onSavePlan?.(updated);
    onClose();
  };

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
          {/* Top Bar with Back Arrow */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-weekly-plan-back"
            >
              <ChevronLeftIcon size={22} color={dark.textHi} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header Titles */}
            <View style={styles.titleSection}>
              <Text variant="title1" color={dark.textHi} style={styles.screenTitle}>
                Weekly Plan
              </Text>
              <Text variant="body" color={dark.textMid} style={styles.screenSubtitle}>
                Select how many days you want to workout and your rest days
              </Text>
            </View>

            {/* 1. Workout Days Per Week (Circles 1 to 7) */}
            <View style={styles.cardSection}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                Workout days per week
              </Text>
              <View style={styles.daysCountRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                  const isSelected = daysPerWeek === num;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() => handleSelectDaysCount(num)}
                      style={[
                        styles.countCircle,
                        isSelected && styles.countCircleSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${num} workout days per week`}
                      accessibilityState={{ selected: isSelected }}
                      testID={`btn-days-count-${num}`}
                    >
                      <Text
                        variant="body"
                        color={isSelected ? dark.onBrand : dark.textHi}
                        style={{ fontWeight: '700' }}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Select Workout Days */}
            <View style={styles.cardSection}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                Select workout days
              </Text>
              <View style={styles.daysChipsRow}>
                {ALL_DAYS.map((day) => {
                  const isSelected = selectedWorkoutDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => handleToggleDay(day)}
                      style={[
                        styles.dayChip,
                        isSelected && styles.dayChipSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${day} workout day`}
                      accessibilityState={{ selected: isSelected }}
                      testID={`chip-workout-day-${day}`}
                    >
                      <Text
                        variant="label"
                        color={isSelected ? dark.onBrand : dark.textHi}
                        style={{ fontWeight: '700' }}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Rest Days (Auto-selected) */}
            <View style={styles.cardSection}>
              <Text variant="label" color={dark.textMid} style={styles.sectionLabel}>
                Rest days (auto-selected)
              </Text>
              <View style={styles.daysChipsRow}>
                {restDays.length > 0 ? (
                  restDays.map((day) => (
                    <View key={day} style={styles.restDayChip} testID={`chip-rest-day-${day}`}>
                      <Text variant="label" color={dark.textMid}>
                        {day}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodyS" color={dark.textLo}>
                    No rest days selected (Daily workout plan)
                  </Text>
                )}
              </View>
            </View>

            {/* 4. Rest Days Info Card (Streak Protection) */}
            <View style={styles.infoCalloutCard}>
              <View style={styles.infoIconCol}>
                <Ionicons name="information-circle" size={24} color={dark.apricot} />
              </View>
              <View style={styles.infoTextCol}>
                <Text variant="bodyS" color={dark.textHi} style={{ fontWeight: '700', marginBottom: 2 }}>
                  Rest days are included in your plan and will not break your streak.
                </Text>
                <Text variant="micro" color={dark.textMid} style={{ lineHeight: 16 }}>
                  Your streak counts only for planned workout days.
                </Text>
              </View>
            </View>

            {/* 5. Weekly Schedule Preview */}
            <View style={styles.previewSection}>
              <Text variant="heading" color={dark.textHi} style={styles.previewTitle}>
                Weekly Schedule Preview
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewRow}
              >
                {ALL_DAYS.map((day) => {
                  const isWorkout = selectedWorkoutDays.includes(day);
                  return (
                    <View
                      key={day}
                      style={[
                        styles.previewDayCard,
                        isWorkout && styles.previewDayCardWorkout,
                      ]}
                      testID={`preview-card-${day}`}
                    >
                      <Text
                        variant="micro"
                        color={isWorkout ? dark.apricot : dark.textMid}
                        style={{ fontWeight: '700', marginBottom: space[2] }}
                      >
                        {day}
                      </Text>
                      <View style={styles.previewIconBox}>
                        <Ionicons
                          name={isWorkout ? 'barbell' : 'bed'}
                          size={24}
                          color={isWorkout ? dark.apricot : dark.textLo}
                        />
                      </View>
                      <Text
                        variant="micro"
                        color={isWorkout ? dark.textHi : dark.textLo}
                        style={{ marginTop: space[2], fontWeight: '600' }}
                      >
                        {isWorkout ? 'Workout' : 'Rest'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Bottom Next Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleSaveAndNext}
              style={styles.nextButton}
              accessibilityRole="button"
              accessibilityLabel="Next"
              testID="btn-weekly-plan-next"
            >
              <Text variant="heading" color={dark.onBrand} style={styles.nextButtonText}>
                Next →
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[1],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingBottom: 120,
    gap: space[4],
  },
  titleSection: {
    gap: 4,
    marginBottom: space[1],
  },
  screenTitle: {
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    lineHeight: 20,
  },
  cardSection: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  sectionLabel: {
    fontWeight: '700',
  },
  daysCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countCircleSelected: {
    backgroundColor: dark.apricot,
  },
  daysChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  dayChipSelected: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  restDayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  infoCalloutCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244, 182, 125, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 182, 125, 0.25)',
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  infoIconCol: {
    paddingTop: 2,
  },
  infoTextCol: {
    flex: 1,
  },
  previewSection: {
    gap: space[3],
    marginTop: space[1],
  },
  previewTitle: {
    fontWeight: '700',
  },
  previewRow: {
    gap: space[2],
    paddingVertical: space[1],
  },
  previewDayCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    alignItems: 'center',
    width: 76,
  },
  previewDayCardWorkout: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  previewIconBox: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: space[4],
    right: space[4],
  },
  nextButton: {
    backgroundColor: dark.apricot,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontWeight: '800',
    fontSize: 16,
  },
});
