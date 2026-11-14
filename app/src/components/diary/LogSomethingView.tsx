import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, radius, space, Text } from '@calipartner/ui';
import { t, type TranslationKey } from '@/i18n';
import type { homeRefresh } from '@/i18n/homeRefresh';

export type LogFlow =
  | 'food'
  | 'scan'
  | 'workout'
  | 'water'
  | 'cardio'
  | 'steps'
  | 'weight'
  | 'fast'
  | 'photo'
  | 'recipe';
const entries: {
  flow: LogFlow;
  label: keyof typeof homeRefresh;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { flow: 'food', label: 'food', icon: 'restaurant-outline' },
  { flow: 'workout', label: 'workout', icon: 'barbell-outline' },
  { flow: 'water', label: 'water', icon: 'water-outline' },
  { flow: 'cardio', label: 'cardio', icon: 'bicycle-outline' },
  { flow: 'weight', label: 'weight', icon: 'scale-outline' },
];
export function LogSomethingView({
  onFlow,
  onClose,
}: {
  onFlow: (flow: LogFlow) => void;
  onClose: () => void;
}) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="log-hub-view">
      <View style={styles.header}>
        <Text variant="title1">{t('homeRefresh.activity')}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.close')}
          style={styles.iconButton}
          testID="log-hub-close"
        >
          <Ionicons name="close" size={homeLayout.iconSize} color={dark.textHi} />
        </Pressable>
      </View>
      <Text variant="bodyS">{t('homeRefresh.activityHint')}</Text>
      <View style={styles.grid}>
        {entries.map(({ flow, label, icon }) => (
          <Pressable
            key={flow}
            onPress={() => onFlow(flow)}
            style={({ pressed }) => [styles.tile, pressed && { backgroundColor: dark.s3 }]}
            accessibilityRole="button"
            accessibilityLabel={t(('homeRefresh.' + label) as TranslationKey)}
            testID={'log-tile-' + flow}
          >
            <Ionicons
              name={icon}
              size={homeLayout.iconSize}
              color={
                {
                  food: dark.mint,
                  workout: dark.iris,
                  water: dark.teal,
                  cardio: dark.sky,
                  weight: dark.orchid,
                }[flow as 'food' | 'workout' | 'water' | 'cardio' | 'weight']
              }
            />
            <Text variant="label">{t(('homeRefresh.' + label) as TranslationKey)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    content: { gap: space[3], padding: space[3], paddingBottom: space[7] },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[2],
    },
    iconButton: {
      minWidth: homeLayout.touchSize,
      minHeight: homeLayout.touchSize,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark.s2,
      borderRadius: radius.control,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
    tile: {
      flexGrow: 0,
      flexBasis: '48%',
      minHeight: homeLayout.touchSize,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[3],
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark.hairlineLit,
      backgroundColor: dark.s2,
    },
  });
