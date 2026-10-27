import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NutrientSnapshot } from '@calipartner/core';
import { Text, dark, space, captureLayout } from '@calipartner/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';

export function AdvancedNutrition({ nutrients }: { nutrients: NutrientSnapshot }) {
  const { hasActiveAccess, loading } = useSubscription();
  const visible = hasActiveAccess && !nutrients.nutrition_details?.locked && !loading;
  const values = [
    [t('repairs.fiber'), nutrients.fiber, 'g'],
    [t('repairs.sugar'), nutrients.sugar, 'g'],
    [t('repairs.sodium'), nutrients.sodium_mg, 'mg'],
    [t('repairs.saturatedFat'), nutrients.nutrition_details?.saturated_fat, 'g'],
    [t('repairs.cholesterol'), nutrients.nutrition_details?.cholesterol_mg, 'mg'],
  ] as const;
  return (
    <View style={styles.container} testID="advanced-nutrition">
      <Text variant="body" color={dark.textHi}>
        {t('repairs.advanced')}
      </Text>
      <View style={styles.grid}>
        {values.map(([label, value, unit]) => (
          <View key={label} style={styles.tile}>
            <Text variant="bodyS" color={dark.textMid}>
              {label}
            </Text>
            {visible ? (
              <Text variant="body" color={dark.textHi} style={styles.value}>
                {value == null ? t('repairs.unavailable') : `${value} ${unit}`}
              </Text>
            ) : (
              <View
                accessible
                style={styles.locked}
                accessibilityLabel={`${label}, ${t('repairs.locked')}`}
              >
                <Text variant="body" color={dark.textLo} style={styles.blur} accessible={false}>
                  •••
                </Text>
                <Ionicons
                  name="lock-closed-outline"
                  size={space[4]}
                  color={dark.textMid}
                  accessible={false}
                />
              </View>
            )}
          </View>
        ))}
      </View>
      {!visible && (
        <Text variant="bodyS" color={dark.textMid}>
          {hasActiveAccess ? t('repairs.refreshNutrition') : t('repairs.unlock')}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { flexGrow: 1, flexBasis: captureLayout.nutrientMinWidth, minWidth: 0, gap: space[1] },
  value: { fontVariant: ['tabular-nums'] },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  blur: {
    textShadowColor: dark.textLo,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: captureLayout.blurRadius,
  },
});
