import React from 'react';
import type { SegmentedControlProps } from '@calipartner/ui';
export function SegmentedControlStub({
  options,
  value,
  onChange,
  testID,
  disabled,
}: SegmentedControlProps) {
  return React.createElement(
    'View',
    { testID },
    options.map((option) =>
      React.createElement(
        'Pressable',
        {
          key: option.value,
          testID: option.testID ?? `${testID}-${option.value}`,
          disabled,
          accessibilityRole: 'tab',
          accessibilityState: { selected: option.value === value, disabled },
          onPress: () => onChange(option.value),
        },
        option.label,
      ),
    ),
  );
}
