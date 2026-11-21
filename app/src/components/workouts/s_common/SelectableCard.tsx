import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface SelectableCardProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SelectableCard({
  selected,
  onPress,
  title,
  subtitle,
  badge,
  disabled,
  style,
  testID = 'selectable-card',
}: SelectableCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View
        style={[
          styles.checkCircle,
          selected ? styles.checkCircleSelected : styles.checkCircleUnselected,
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={workoutTokens.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: workoutRadius.card,
    borderWidth: 1.5,
    minHeight: 64,
    marginBottom: 10,
  },
  cardUnselected: {
    backgroundColor: workoutTokens.card,
    borderColor: workoutTokens.border,
  },
  cardSelected: {
    backgroundColor: workoutTokens.accentSoft,
    borderColor: workoutTokens.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
  badgeContainer: {
    backgroundColor: workoutTokens.selected,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: workoutRadius.chip,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  badgeText: {
    color: workoutTokens.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: workoutRadius.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleUnselected: {
    borderColor: workoutTokens.borderStrong,
    backgroundColor: 'transparent',
  },
  checkCircleSelected: {
    borderColor: workoutTokens.accent,
    backgroundColor: workoutTokens.accent,
  },
});
