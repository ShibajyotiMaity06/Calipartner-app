import { NavigationIcon } from '@calipartner/ui';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';

const options = [
  { flow: 'cycling', icon: 'bicycle-outline' },
  { flow: 'running', icon: 'walk-outline' },
  { flow: 'steps', icon: 'footsteps-outline' },
] as const;

export function CardioHub({
  onSelect,
  onBack,
}: {
  onSelect: (flow: 'cycling' | 'running' | 'steps') => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} testID="cardio-hub">
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('repairs.back')}
          style={styles.back}
          testID="cardio-back"
        >
          <NavigationIcon action="back" />
        </Pressable>
        <Text variant="title1">{t('homeRefresh.cardio')}</Text>
      </View>
      {options.map(({ flow, icon }) => (
        <Pressable
          key={flow}
          onPress={() => onSelect(flow)}
          accessibilityRole="button"
          accessibilityLabel={t(`homeRefresh.${flow}`)}
          style={({ pressed }) => [styles.option, pressed && { backgroundColor: dark.s3 }]}
          testID={`cardio-${flow}`}
        >
          <Ionicons name={icon} size={homeLayout.iconSize} color={dark.sky} />
          <Text variant="label">{t(`homeRefresh.${flow}`)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3], paddingBottom: space[7] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  back: {
    minHeight: homeLayout.touchSize,
    minWidth: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: homeLayout.touchSize,
    padding: space[3],
    gap: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairlineLit,
  },
});
