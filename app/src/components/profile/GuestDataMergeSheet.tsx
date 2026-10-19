import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Sheet, space, dark, radius } from '@calipartner/ui';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface GuestDataMergeSheetProps {
  visible: boolean;
  mealsCount?: number;
  daysCount?: number;
  onKeepData: () => void;
  onStartFresh: () => void;
  onClose: () => void;
  testID?: string;
}

export function GuestDataMergeSheet({
  visible,
  mealsCount = 6,
  daysCount = 2,
  onKeepData,
  onStartFresh,
  onClose,
  testID = 'guest-data-merge-sheet',
}: GuestDataMergeSheetProps) {
  const handleKeep = () => {
    playSuccessSound();
    onKeepData();
  };

  const handleFresh = () => {
    playClickSound();
    onStartFresh();
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID={testID}>
      <View style={styles.content}>
        <Text variant="heading" color={dark.textHi}>
          Keep your local logs?
        </Text>
        {/* Summary Card (Spec B06) */}
        <View style={styles.summaryCard} testID="guest-merge-summary-card">
          <Text variant="body" color={dark.textHi} style={styles.summaryTitle}>
            We found {mealsCount} meals and {daysCount} days on this phone.
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.summaryBody}>
            You logged these as a guest. Would you like to merge them into your new account or start
            with a fresh slate?
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            label="Keep it"
            onPress={handleKeep}
            testID="btn-merge-keep-data"
          />

          <Button
            variant="secondary"
            size="md"
            label="Start fresh"
            onPress={handleFresh}
            testID="btn-merge-start-fresh"
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space[4],
    gap: space[4],
  },
  summaryCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
  },
  summaryTitle: {
    fontWeight: '600',
  },
  summaryBody: {
    lineHeight: 20,
  },
  actions: {
    gap: space[3],
    marginTop: space[2],
  },
});
