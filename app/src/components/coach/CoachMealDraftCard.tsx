import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@calipartner/ui';
import { Text, borders, colors, radius, space } from '@calipartner/ui/v1';
import { sumNutrientSnapshots, type CoachMealDraft } from '@calipartner/core';
import {
  prepareCoachMealSave,
  saveCoachMeal,
  type CoachMealSave,
} from '@/services/coachMealService';
import { t } from '@/i18n';

export function CoachMealDraftCard({
  draft,
  onLogged,
  disabled = false,
}: {
  draft: CoachMealDraft;
  onLogged?: () => void;
  disabled?: boolean;
}) {
  const request = useRef<CoachMealSave | null>(null);
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = sumNutrientSnapshots(draft.items);

  const save = async () => {
    if (disabled || inFlight.current || saved) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      request.current ??= prepareCoachMealSave(draft);
      await saveCoachMeal(request.current);
      setSaved(true);
      onLogged?.();
    } catch (reason) {
      const code = String((reason as { message?: string })?.message ?? '');
      setError(
        t(
          code.includes('UPGRADE_REQUIRED')
            ? 'coach.meal.proRequired'
            : code.includes('CONSENT_REQUIRED')
              ? 'coach.meal.consentRequired'
              : 'coach.meal.saveError',
        ),
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.card} testID="coach-meal-draft">
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text variant="eyebrow" color="textLo">
            {t('captureV1.aiEstimateEyebrow')}
          </Text>
          <Text variant="titleS" color="textHi" numberOfLines={2}>
            {draft.description}
          </Text>
          <Text variant="meta" color="textLo">
            {`${t(`diary.sections.${draft.mealSection}` as Parameters<typeof t>[0])} · ${draft.localDate}`}
          </Text>
        </View>
        <View style={styles.kcalCol}>
          <Text variant="numM" tabular color="textHi">
            {String(Math.round(totals.calories))}
          </Text>
          <Text variant="meta" color="textLo">
            kcal
          </Text>
        </View>
      </View>

      <View style={styles.macroRow} testID="coach-meal-macros">
        <View style={styles.macroPill}>
          <Text variant="meta" color="textMid" tabular>
            {t('captureV1.proteinShort', { g: Math.round(totals.protein) })}
          </Text>
        </View>
        <View style={styles.macroPill}>
          <Text variant="meta" color="textMid" tabular>
            {t('captureV1.carbsShort', { g: Math.round(totals.carbs) })}
          </Text>
        </View>
        <View style={styles.macroPill}>
          <Text variant="meta" color="textMid" tabular>
            {t('captureV1.fatShort', { g: Math.round(totals.fat) })}
          </Text>
        </View>
      </View>

      <View style={styles.itemsWrap}>
        {draft.items.map((item, index) => (
          <View key={`${item.name}-${index}`}>
            <View style={styles.itemRow}>
              <Text variant="rowTitle" color="textHi" style={styles.itemName} numberOfLines={1}>
                {item.name}
                <Text variant="meta" color="textLo">
                  {` · ${item.quantity} ${item.unit}`}
                </Text>
              </Text>
              <Text variant="label" tabular color="textHi">
                {Math.round(item.calories)}
                <Text variant="meta" color="textLo">
                  {' kcal'}
                </Text>
              </Text>
            </View>
            {index < draft.items.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>

      {error ? (
        <Text variant="meta" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button
        label={t(saved ? 'coach.meal.logged' : 'coach.meal.log')}
        onPress={() => void save()}
        loading={saving}
        disabled={disabled || saved}
        testID="coach-meal-log"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.s1,
    borderColor: colors.hairlineLit,
    borderWidth: borders.width,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  titleCol: {
    flex: 1,
    gap: space.xs,
  },
  kcalCol: {
    alignItems: 'flex-end',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  macroPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  itemsWrap: {
    borderTopWidth: borders.width,
    borderTopColor: colors.s2,
    paddingTop: space.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  itemName: {
    flex: 1,
  },
  divider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
});
