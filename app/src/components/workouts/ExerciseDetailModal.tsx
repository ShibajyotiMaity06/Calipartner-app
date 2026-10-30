import { type as typography } from '@calipartner/ui';
import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeftIcon, dark, radius, space, Text } from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import {
  updateExerciseSets,
  type PlannedExercise,
  type PlannedSet,
} from '@/services/workoutPlanService';

export interface ExerciseDetailModalProps {
  visible: boolean;
  exercise: PlannedExercise | null;
  dateStr: string;
  onClose: () => void;
  onSaved?: (updated: PlannedExercise) => void;
  testID?: string;
}

export function ExerciseDetailModal({
  visible,
  exercise,
  dateStr,
  onClose,
  onSaved,
  testID = 'exercise-detail-modal',
}: ExerciseDetailModalProps) {
  const [sets, setSets] = useState<PlannedSet[]>(() =>
    exercise?.sets && exercise.sets.length > 0
      ? JSON.parse(JSON.stringify(exercise.sets))
      : [
          { setNumber: 1, weightKg: 20, reps: 12 },
          { setNumber: 2, weightKg: 25, reps: 10 },
          { setNumber: 3, weightKg: 25, reps: 8 },
        ],
  );
  const [notes, setNotes] = useState(exercise?.notes ?? '');

  if (!exercise) return null;

  const handleWeightChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setSets((prev) => {
      const copy = [...prev];
      if (copy[index]) copy[index] = { ...copy[index]!, weightKg: num };
      return copy;
    });
  };

  const handleRepsChange = (index: number, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSets((prev) => {
      const copy = [...prev];
      if (copy[index]) copy[index] = { ...copy[index]!, reps: num };
      return copy;
    });
  };

  const handleAddSet = () => {
    playClickSound();
    const lastSet = sets[sets.length - 1];
    const newSet: PlannedSet = {
      setNumber: sets.length + 1,
      weightKg: lastSet ? lastSet.weightKg : 20,
      reps: lastSet ? lastSet.reps : 10,
    };
    setSets((prev) => [...prev, newSet]);
  };

  const handleDeleteSet = (index: number) => {
    playClickSound();
    if (sets.length <= 1) return;
    setSets((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    });
  };

  const handleSave = () => {
    playSuccessSound();
    const updated = updateExerciseSets(dateStr, exercise.id, sets, notes);
    if (updated) {
      onSaved?.(updated);
    }
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
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-exercise-detail-back"
            >
              <ChevronLeftIcon size={22} color={dark.textHi} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Visual Icon Illustration Card */}
            <View style={styles.illustrationCard}>
              <View style={styles.exerciseIconCircle}>
                <Ionicons name="barbell" size={48} color={dark.apricot} />
              </View>
              <Text variant="title1" color={dark.textHi} style={styles.exerciseNameText}>
                {exercise.name}
              </Text>
              <Text variant="label" color={dark.textLo} style={styles.muscleGroupText}>
                {exercise.muscleGroup}
              </Text>
            </View>

            {/* Exercise Dropdown Row */}
            <View style={styles.inputGroup}>
              <Text variant="micro" color={dark.textLo} style={styles.fieldLabel}>
                Exercise
              </Text>
              <View style={styles.dropdownBox}>
                <Text variant="body" color={dark.textHi} style={{ fontWeight: '600' }}>
                  {exercise.name}
                </Text>
                <Ionicons name="chevron-down" size={18} color={dark.textLo} />
              </View>
            </View>

            {/* Date Display */}
            <View style={styles.inputGroup}>
              <Text variant="micro" color={dark.textLo} style={styles.fieldLabel}>
                Date
              </Text>
              <View style={styles.dateBox}>
                <Ionicons name="calendar-outline" size={18} color={dark.apricot} />
                <Text variant="body" color={dark.textHi} style={{ fontWeight: '600' }}>
                  {dateStr}
                </Text>
              </View>
            </View>

            {/* Sets Table */}
            <View style={styles.setsTableCard}>
              <View style={styles.tableHeaderRow}>
                <Text variant="micro" color={dark.textLo} style={[styles.colHeader, { flex: 0.8 }]}>
                  Set
                </Text>
                <Text variant="micro" color={dark.textLo} style={[styles.colHeader, { flex: 2 }]}>
                  Weight (kg)
                </Text>
                <Text variant="micro" color={dark.textLo} style={[styles.colHeader, { flex: 1.8 }]}>
                  Reps
                </Text>
                <View style={{ width: 36 }} />
              </View>

              {sets.map((s, idx) => (
                <View key={s.setNumber} style={styles.setRow} testID={`set-row-${idx}`}>
                  <Text
                    variant="body"
                    color={dark.textHi}
                    style={[styles.setNumCol, { flex: 0.8 }]}
                  >
                    {s.setNumber}
                  </Text>
                  <View style={[styles.inputCellWrapper, { flex: 2 }]}>
                    <TextInput
                      value={s.weightKg > 0 ? String(s.weightKg) : ''}
                      onChangeText={(val) => handleWeightChange(idx, val)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={dark.textOff}
                      style={styles.cellInput}
                      testID={`input-set-weight-${idx}`}
                    />
                  </View>
                  <View style={[styles.inputCellWrapper, { flex: 1.8 }]}>
                    <TextInput
                      value={s.reps > 0 ? String(s.reps) : ''}
                      onChangeText={(val) => handleRepsChange(idx, val)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={dark.textOff}
                      style={styles.cellInput}
                      testID={`input-set-reps-${idx}`}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteSet(idx)}
                    style={styles.trashBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete set ${s.setNumber}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={dark.textLo} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Set Button */}
              <TouchableOpacity
                onPress={handleAddSet}
                style={styles.addSetBtn}
                accessibilityRole="button"
                testID="btn-add-set"
              >
                <Ionicons name="add" size={18} color={dark.apricot} />
                <Text variant="bodyS" color={dark.apricot} style={{ fontWeight: '700' }}>
                  + Add Set
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notes Section */}
            <View style={styles.inputGroup}>
              <Text variant="micro" color={dark.textLo} style={styles.fieldLabel}>
                Notes (optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g., Felt stronger today, increase weight next time..."
                placeholderTextColor={dark.textOff}
                multiline
                numberOfLines={3}
                style={styles.notesInput}
                testID="input-exercise-notes"
              />
            </View>
          </ScrollView>

          {/* Save Exercise Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveButton}
              accessibilityRole="button"
              accessibilityLabel="Save Exercise"
              testID="btn-save-exercise"
            >
              <Text variant="heading" color={dark.onBrand} style={styles.saveButtonText}>
                Save Exercise
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
  illustrationCard: {
    alignItems: 'center',
    paddingVertical: space[2],
  },
  exerciseIconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.card,
    backgroundColor: dark.s2,
    borderWidth: 1.5,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  exerciseNameText: {
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  muscleGroupText: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputGroup: {
    gap: space[1],
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    paddingVertical: 14,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    paddingVertical: 14,
  },
  setsTableCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space[1],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  colHeader: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  setNumCol: {
    fontWeight: '700',
    textAlign: 'center',
  },
  inputCellWrapper: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  cellInput: {
    color: dark.textHi,
    paddingHorizontal: space[3],
    paddingVertical: 10,
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  trashBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingVertical: 12,
    marginTop: space[1],
  },
  notesInput: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    color: dark.textHi,
    paddingHorizontal: space[4],
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: space[4],
    right: space[4],
  },
  saveButton: {
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
  saveButtonText: {
    fontWeight: '800',
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
  },
});
