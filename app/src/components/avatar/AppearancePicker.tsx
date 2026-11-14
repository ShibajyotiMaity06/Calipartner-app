import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, useTheme, space, radius, avatarLayout, type ColorScheme } from '@calipartner/ui';
import { t } from '@/i18n';
const choices: ColorScheme[] = ['light', 'dark', 'yellow'];
export function AppearancePicker() {
  const { theme, setTheme, colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={t('avatar.theme')}>
      {choices.map((choice) => (
        <Pressable
          key={choice}
          onPress={() => setTheme(choice)}
          accessibilityRole="button"
          accessibilityLabel={t(`avatar.${choice}`)}
          accessibilityState={{ selected: theme === choice }}
          testID={`theme-${choice}`}
          style={({ pressed }) => [
            styles.choice,
            {
              backgroundColor: theme === choice ? colors.apricot : colors.s1,
              borderColor: colors.hairline,
              opacity: pressed ? avatarLayout.opacityPressed : 1,
            },
          ]}
        >
          <Text variant="label" color={theme === choice ? colors.onBrand : colors.textMid}>
            {t(`avatar.${choice}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'flex-end' },
  choice: {
    minHeight: avatarLayout.tapSize,
    minWidth: avatarLayout.tapSize,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
    borderWidth: avatarLayout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
