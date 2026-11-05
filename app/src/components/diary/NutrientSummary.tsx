import React from 'react';
import { Text, type TextProps } from '@calipartner/ui';
import type { NutrientSnapshot } from '@calipartner/core';
import { getLocale, t } from '@/i18n';
export function NutrientSummary({
  values,
  variant = 'bodyS',
  testID,
}: {
  values: Partial<Pick<NutrientSnapshot, 'calories' | 'protein' | 'carbs' | 'fat'>>;
  variant?: TextProps['variant'];
  testID?: string;
}) {
  const metrics = (['calories', 'protein', 'carbs', 'fat'] as const).filter(
    (key) => values[key] != null,
  );
  return (
    <Text variant={variant} tabular testID={testID}>
      {metrics.map((metric, index) => (
        <React.Fragment key={metric}>
          {index > 0 ? ' · ' : ''}
          <Text variant={variant} nutrient={metric} tabular>
            {metric === 'calories' ? '' : t(`squadDesign.${metric}`) + ' '}
            {values[metric]!.toLocaleString(getLocale(), { maximumFractionDigits: 1 })}{' '}
            {t(metric === 'calories' ? 'squadDesign.kcal' : 'squadDesign.grams')}
          </Text>
        </React.Fragment>
      ))}
    </Text>
  );
}
