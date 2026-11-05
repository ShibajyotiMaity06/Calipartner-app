import { NutrientSummary } from '../diary/NutrientSummary';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, dark, radius, space, Text } from '@calipartner/ui';
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
      <Text variant="heading">{draft.description}</Text>
      <Text variant="label">
        {t(('diary.sections.' + draft.mealSection) as Parameters<typeof t>[0])} · {draft.localDate}
      </Text>
      {draft.items.map((item, index) => (
        <Text key={index} variant="bodyS" tabular>
          {item.quantity} {item.unit} · {item.name}
        </Text>
      ))}
      <NutrientSummary values={totals} testID="coach-meal-macros" />
      <Text variant="micro">{t('coach.meal.estimate')}</Text>
      {error && (
        <Text color={dark.danger} accessibilityRole="alert">
          {error}
        </Text>
      )}
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
    backgroundColor: dark.s2,
    borderColor: dark.hairlineLit,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[2],
  },
});
