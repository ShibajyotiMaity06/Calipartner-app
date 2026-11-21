import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

export type WorkoutTabId = 'today' | 'plan' | 'history';

interface SegmentedTabsProps {
  activeTab: WorkoutTabId;
  onChangeTab: (tab: WorkoutTabId) => void;
  testID?: string;
}

export function SegmentedTabs({
  activeTab,
  onChangeTab,
  testID = 'workout-segmented-tabs',
}: SegmentedTabsProps) {
  const tabs: { id: WorkoutTabId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'plan', label: 'Plan' },
    { id: 'history', label: 'History' },
  ];

  return (
    <View style={styles.container} testID={testID} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            testID={`${testID}-${tab.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            onPress={() => onChangeTab(tab.id)}
            style={[styles.segment, isActive && styles.activeSegment]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.control,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  segment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: workoutRadius.control,
  },
  activeSegment: {
    backgroundColor: workoutTokens.selected,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  label: {
    color: workoutTokens.dim,
    fontSize: 14,
    fontWeight: '700',
  },
  activeLabel: {
    color: workoutTokens.text,
  },
});
