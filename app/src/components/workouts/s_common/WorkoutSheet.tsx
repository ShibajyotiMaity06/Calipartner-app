import React from 'react';
import { View, StyleSheet, Modal, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface WorkoutSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

export function WorkoutSheet({
  visible,
  onClose,
  title,
  children,
  testID = 'workout-sheet',
}: WorkoutSheetProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.scrim}>
        <Pressable
          style={styles.scrimBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />
        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            {title ? (
              <Text style={styles.sheetTitle}>{title}</Text>
            ) : (
              <View style={styles.spacer} />
            )}
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={workoutTokens.dim} />
            </Pressable>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: workoutTokens.scrim,
    justifyContent: 'flex-end',
  },
  scrimBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: workoutTokens.card,
    borderTopLeftRadius: workoutRadius.sheet,
    borderTopRightRadius: workoutRadius.sheet,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: workoutTokens.border,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: workoutRadius.dot,
    backgroundColor: workoutTokens.borderStrong,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 10,
  },
  sheetTitle: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 8,
  },
});
