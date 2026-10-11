import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface RangeSelectorProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (option: T) => void;
  testID?: string;
}

export function RangeSelector<T extends string>({
  options,
  selected,
  onSelect,
  testID = 'range-selector',
}: RangeSelectorProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt }]} testID={testID}>
      {options.map((option) => {
        const isSelected = option === selected;
        const label =
          option === '7d'
            ? t('progress.ranges.7d')
            : option === '30d'
              ? t('progress.ranges.30d')
              : option === '90d'
                ? t('progress.ranges.90d')
                : option === '6m'
                  ? t('progress.ranges.6m')
                  : option === '1y'
                    ? t('progress.ranges.1y')
                    : option === 'all'
                      ? t('progress.ranges.all')
                      : option === 'since_start'
                        ? t('progress.ranges.sinceStart')
                        : option;

        return (
          <Pressable
            key={option}
            style={[
              styles.tab,
              isSelected && [styles.selectedTab, { backgroundColor: colors.surface }],
            ]}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityLabel={`Select date range ${label}`}
            accessibilityState={{ selected: isSelected }}
            testID={`${testID}-option-${option}`}
          >
            <Text
              style={[
                styles.tabText,
                { color: isSelected ? colors.text : colors.textMuted },
                isSelected && styles.selectedTabText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  selectedTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  selectedTabText: {
    fontWeight: '700',
  },
});
