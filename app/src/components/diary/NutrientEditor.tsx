import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  Text,
  nutritionColors,
  homeLayout,
  radius,
  space,
  type as typography,
  type NutritionMetric,
} from '@calipartner/ui';
import { t } from '@/i18n';
export type NutrientDraft = Record<NutritionMetric, string>;
export function NutrientEditor({
  draft,
  onChange,
  disabled = false,
}: {
  draft: NutrientDraft;
  onChange: (metric: NutritionMetric, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fields} testID="nutrient-editor">
      {(['calories', 'protein', 'carbs', 'fat'] as const).map((metric) => (
        <View key={metric} style={styles.field}>
          <Text variant="label" nutrient={metric}>
            {t(`squadDesign.${metric}`)}{' '}
            {t(metric === 'calories' ? 'squadDesign.kcal' : 'squadDesign.grams')}
          </Text>
          <TextInput
            value={draft[metric]}
            onChangeText={(value) => onChange(metric, value)}
            keyboardType="decimal-pad"
            editable={!disabled}
            accessibilityLabel={t(`squadDesign.${metric}`)}
            testID={`edit-nutrient-${metric}`}
            style={[styles.input, { color: nutritionColors[metric] }]}
          />
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  field: { flexGrow: 1, flexBasis: '40%', gap: space[1] },
  input: {
    ...typography.body,
    minHeight: homeLayout.touchSize,
    borderWidth: 1,
    borderColor: nutritionColors.carbs,
    borderRadius: radius.control,
    padding: space[3],
  },
});
