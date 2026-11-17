import React from 'react';
import { View } from 'react-native';
import { SegmentedControl } from '@calipartner/ui';
import { t } from '@/i18n';
export function RangeSelector<T extends string>({
  options,
  selected,
  onSelect,
  testID = 'range-selector',
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <SegmentedControl
        options={options.map((option) => {
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
          return { value: option, label };
        })}
        value={selected}
        onChange={onSelect}
        testID={`${testID}-option`}
      />
    </View>
  );
}
