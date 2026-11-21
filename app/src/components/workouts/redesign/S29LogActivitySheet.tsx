import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton, DangerButton, StepperRow, WorkoutChip } from '../s_common';
import type { ActivityLogItem } from '@/services/workoutRedesignService';

interface S29LogActivitySheetProps {
  visible: boolean;
  activityToEdit?: ActivityLogItem | null;
  onSave: (name: string, minutes: number, calories?: number, notes?: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function S29LogActivitySheet({
  visible,
  activityToEdit,
  onSave,
  onDelete,
  onClose,
}: S29LogActivitySheetProps) {
  const isEditing = !!activityToEdit;

  const [name, setName] = useState(activityToEdit?.activity_name || 'Yoga');
  const [duration, setDuration] = useState<number>(activityToEdit?.duration_minutes || 30);
  const [calories, setCalories] = useState(
    activityToEdit?.calories_burned ? String(activityToEdit.calories_burned) : '',
  );
  const [notes, setNotes] = useState(activityToEdit?.notes || '');

  const quickActivities = [
    'Yoga',
    'HIIT',
    'Stretching',
    'Pilates',
    'Calisthenics',
    'Core Workout',
    'Mobility',
  ];

  const handleSave = () => {
    if (!name.trim()) return;
    const calNum = calories ? parseInt(calories, 10) : undefined;
    onSave(name.trim(), duration, isNaN(calNum as number) ? undefined : calNum, notes.trim());
  };

  return (
    <WorkoutSheet
      visible={visible}
      onClose={onClose}
      title={isEditing ? 'Edit activity' : 'Log activity'}
      testID="s29-log-activity-sheet"
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Quick pickers if not editing */}
        {!isEditing ? (
          <View style={styles.quickActivitiesRow}>
            {quickActivities.map((act) => (
              <WorkoutChip
                key={act}
                label={act}
                selected={name === act}
                onPress={() => setName(act)}
                testID={`quick-act-${act}`}
              />
            ))}
          </View>
        ) : null}

        {/* Name input */}
        <Text style={styles.fieldLabel}>ACTIVITY NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Activity name"
          placeholderTextColor={workoutTokens.dim}
          style={styles.textInput}
          testID="activity-name-input"
        />

        {/* Duration stepper */}
        <StepperRow
          label="Duration"
          value={duration}
          unit="min"
          onIncrement={() => setDuration((prev) => Math.min(240, prev + 5))}
          onDecrement={() => setDuration((prev) => Math.max(5, prev - 5))}
          testID="activity-duration-stepper"
        />

        {/* Calories */}
        <Text style={styles.fieldLabel}>ESTIMATED CALORIES (OPTIONAL)</Text>
        <TextInput
          value={calories}
          onChangeText={setCalories}
          placeholder="e.g. 250"
          placeholderTextColor={workoutTokens.dim}
          keyboardType="number-pad"
          style={styles.textInput}
          testID="activity-calories-input"
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How was the session?"
          placeholderTextColor={workoutTokens.dim}
          multiline
          style={[styles.textInput, styles.textArea]}
          testID="activity-notes-input"
        />

        {/* Buttons */}
        <PrimaryButton
          label={isEditing ? 'Save changes' : 'Log activity'}
          onPress={handleSave}
          disabled={!name.trim()}
          style={styles.saveBtn}
          testID="save-activity-btn"
        />

        {isEditing && onDelete ? (
          <DangerButton
            label="Delete log"
            onPress={() => onDelete(activityToEdit.id)}
            style={styles.deleteBtn}
            testID="delete-activity-btn"
          />
        ) : null}
      </ScrollView>
    </WorkoutSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingBottom: 24,
  },
  quickActivitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  fieldLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 14,
    height: 48,
    color: workoutTokens.text,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 20,
    width: '100%',
  },
  deleteBtn: {
    marginTop: 10,
    width: '100%',
  },
});
