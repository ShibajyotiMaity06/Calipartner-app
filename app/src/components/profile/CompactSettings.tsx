import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, dark, onboardingLayout as layout, radius, space, Text } from '@calipartner/ui';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

export function ProfileShortcut({
  title,
  icon,
  onPress,
  testID,
}: {
  title: string;
  icon: Icon;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={space[5]} color={dark.textMid} accessible={false} />
      <Text variant="bodyS" color={dark.textHi} style={{ flexShrink: 1 }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function ProfileRow({
  title,
  subtitle,
  icon,
  onPress,
  testID,
  danger = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon: Icon;
  onPress: () => void;
  testID: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={icon} size={layout.icon} color={danger ? dark.danger : dark.textMid} />
      </View>
      <View style={styles.copy}>
        <Text variant="bodyS" color={danger ? dark.danger : dark.textHi}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="micro" color={dark.textMid} tabular>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={space[4]} color={dark.textLo} accessible={false} />
    </Pressable>
  );
}

export function SettingsGroup({
  title,
  summary,
  icon,
  testID,
  children,
}: {
  title: string;
  summary: string;
  icon: Icon;
  testID: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card elevation="s1" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${summary}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        testID={testID}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name={icon} size={layout.icon} color={dark.textMid} />
        </View>
        <View style={styles.copy}>
          <Text variant="bodyS" color={dark.textHi}>
            {title}
          </Text>
          <Text variant="micro" color={dark.textMid}>
            {summary}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={space[4]}
          color={dark.textLo}
          accessible={false}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.contents} testID={`${testID}-content`}>
          {children}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[0], overflow: 'hidden', borderRadius: radius.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touch,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    gap: space[2],
  },
  icon: { padding: space[1], backgroundColor: dark.s2, borderRadius: radius.control },
  copy: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: dark.s2 },
  contents: { borderTopWidth: layout.border, borderTopColor: dark.hairline },
});
