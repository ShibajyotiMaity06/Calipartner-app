import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Button, Sheet, Text, homeLayout, space } from '@calipartner/ui';
import { weeklyGroceryItems, type WeeklyPlanView } from '@calipartner/core';
import { t } from '@/i18n';

export function WeeklyGroceryList({
  plan,
  onUpgrade,
}: {
  plan: WeeklyPlanView;
  onUpgrade: () => void;
}) {
  const { colors: dark } = useAppearance();

  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const items = weeklyGroceryItems(plan.days);
  return (
    <>
      <Button
        variant="secondary"
        label={t('homeRefresh.groceryList')}
        onPress={() => setVisible(true)}
        testID="weekly-grocery-open"
      />
      {visible && (
        <Sheet
          visible={visible}
          onClose={() => setVisible(false)}
          snapPoint="tall"
          accessibilityLabel={t('homeRefresh.groceryList')}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="title2">{t('homeRefresh.groceryList')}</Text>
            {!items.length && <Text>{t('homeRefresh.groceryEmpty')}</Text>}
            {items.map((item, index) => (
              <Pressable
                key={item}
                style={styles.row}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checked.has(item) }}
                aria-checked={checked.has(item)}
                accessibilityLabel={item}
                testID={`weekly-grocery-item-${index}`}
                onPress={() =>
                  setChecked((previous) => {
                    const next = new Set(previous);
                    if (next.has(item)) next.delete(item);
                    else next.add(item);
                    return next;
                  })
                }
              >
                <Text
                  color={checked.has(item) ? dark.textLo : dark.textHi}
                  style={checked.has(item) ? styles.checked : undefined}
                >
                  {t(
                    checked.has(item)
                      ? 'homeRefresh.groceryChecked'
                      : 'homeRefresh.groceryUnchecked',
                    { item },
                  )}
                </Text>
              </Pressable>
            ))}
            {!plan.full_access && (
              <>
                <Text>{t('homeRefresh.groceryPreview')}</Text>
                <Button
                  variant="secondary"
                  label={t('squadDesign.unlock')}
                  onPress={() => {
                    setVisible(false);
                    onUpgrade();
                  }}
                  testID="weekly-grocery-upgrade"
                />
              </>
            )}
            <Button
              variant="tertiary"
              label={t('homeRefresh.close')}
              onPress={() => setVisible(false)}
              testID="weekly-grocery-close"
            />
          </ScrollView>
        </Sheet>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3] },
  row: { minHeight: homeLayout.touchSize, justifyContent: 'center', paddingVertical: space[2] },
  checked: { textDecorationLine: 'line-through' },
});
