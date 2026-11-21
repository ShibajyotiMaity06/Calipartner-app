import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { workoutTokens } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton, SecondaryButton, DangerButton } from '../s_common';

interface S27FinishEarlySheetProps {
  visible: boolean;
  unfinishedCount: number;
  onSaveCompletedSets: () => void;
  onKeepGoing: () => void;
  onDiscardSession: () => void;
  onClose: () => void;
}

export function S27FinishEarlySheet({
  visible,
  unfinishedCount,
  onSaveCompletedSets,
  onKeepGoing,
  onDiscardSession,
  onClose,
}: S27FinishEarlySheetProps) {
  return (
    <WorkoutSheet
      visible={visible}
      onClose={onClose}
      title="Finish workout early?"
      testID="s27-finish-early-sheet"
    >
      <View style={styles.content}>
        <Text style={styles.bodyText}>
          You have {unfinishedCount} unfinished set{unfinishedCount === 1 ? '' : 's'}. You can save
          the sets you completed or keep going.
        </Text>

        <PrimaryButton
          label="Save completed sets"
          onPress={onSaveCompletedSets}
          style={styles.actionBtn}
          testID="finish-early-save-btn"
        />

        <SecondaryButton
          label="Keep going"
          onPress={onKeepGoing}
          style={styles.actionBtn}
          testID="finish-early-keep-going-btn"
        />

        <DangerButton
          label="Discard session"
          onPress={onDiscardSession}
          style={styles.actionBtn}
          testID="finish-early-discard-btn"
        />
      </View>
    </WorkoutSheet>
  );
}

const styles = StyleSheet.create({
  content: {
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
