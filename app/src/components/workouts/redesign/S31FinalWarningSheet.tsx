import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { workoutTokens } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton, SecondaryButton } from '../s_common';

interface S31FinalWarningSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function S31FinalWarningSheet({ visible, onConfirm, onCancel }: S31FinalWarningSheetProps) {
  return (
    <WorkoutSheet
      visible={visible}
      onClose={onCancel}
      title="Final generation warning"
      testID="s31-final-warning-sheet"
    >
      <View style={styles.container}>
        <Text style={styles.warningText}>
          This is your 3rd and final preview. Generating it will immediately apply the new routine
          as your active plan and start your 3-month cooldown.
        </Text>

        <PrimaryButton
          label="Generate and replace plan"
          onPress={onConfirm}
          style={styles.actionBtn}
          testID="final-warning-confirm-btn"
        />

        <SecondaryButton
          label="Cancel"
          onPress={onCancel}
          style={styles.actionBtn}
          testID="final-warning-cancel-btn"
        />
      </View>
    </WorkoutSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    gap: 12,
  },
  warningText: {
    color: workoutTokens.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  actionBtn: {
    width: '100%',
  },
});
