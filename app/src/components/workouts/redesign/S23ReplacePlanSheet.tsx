import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { workoutTokens } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton, SecondaryButton } from '../s_common';

interface S23ReplacePlanSheetProps {
  visible: boolean;
  onConfirmReplace: () => void;
  onCancel: () => void;
}

export function S23ReplacePlanSheet({
  visible,
  onConfirmReplace,
  onCancel,
}: S23ReplacePlanSheetProps) {
  return (
    <WorkoutSheet
      visible={visible}
      onClose={onCancel}
      title="Replace current plan?"
      testID="s23-replace-plan-sheet"
    >
      <View style={styles.container}>
        <Text style={styles.bodyText}>
          You already have an active routine. Saving this plan will replace your current schedule
          and start fresh.
        </Text>

        <PrimaryButton
          label="Replace plan"
          onPress={onConfirmReplace}
          style={styles.actionBtn}
          testID="confirm-replace-plan-btn"
        />

        <SecondaryButton
          label="Cancel"
          onPress={onCancel}
          style={styles.actionBtn}
          testID="cancel-replace-plan-btn"
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
  bodyText: {
    color: workoutTokens.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  actionBtn: {
    width: '100%',
  },
});
