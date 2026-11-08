import { NutrientSummary } from '../diary/NutrientSummary';
import React, { useRef, useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, useTheme } from '@calipartner/ui';
import type { GoalProfile, Sex } from '@calipartner/core';
import { applyOnboardingTargetOverrides } from '@calipartner/core';
import { macroErrorMessage } from '@/i18n/macroErrors';
import { useTargets } from '@/hooks/useTargets';
import { useSubscription } from '@/hooks/useSubscription';
import { NumberField, planStyles } from '@/components/onboarding/PlanPrimitives';
import { LoadingState } from '@/components/LoadingState';
import { t } from '@/i18n';

export function CustomMacrosModal({
  goal,
  sex,
  onClose,
}: {
  goal: GoalProfile;
  sex: Sex;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { updateCustomMacros } = useTargets();
  const subscription = useSubscription();
  const [protein, setProtein] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [calories, setCalories] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const allowed = subscription.hasPlan && ['plus', 'pro'].includes(subscription.currentTier);
  let preview: GoalProfile | null = null;
  let validationError: string | null = null;
  try {
    preview = applyOnboardingTargetOverrides(goal, sex, { calories, protein, carbs, fat });
  } catch (error) {
    validationError = macroErrorMessage(error);
  }
  const save = async () => {
    if (!allowed || !preview || lock.current) return;
    if ([calories, protein, carbs, fat].every((value) => value == null)) {
      onClose();
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(false);
    try {
      const result = await updateCustomMacros(
        { protein: preview.protein_grams, carbs: preview.carb_grams, fat: preview.fat_grams },
        sex,
      );
      if (result.success) onClose();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          contentContainerStyle={planStyles.reviewContent}
          keyboardShouldPersistTaps="handled"
          testID="custom-macros-modal"
        >
          <Text variant="title2">{t('customMacros.title')}</Text>
          {subscription.loading ? (
            <LoadingState />
          ) : subscription.error ? (
            <>
              <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
              <Button
                label={t('setup.retry')}
                onPress={() => void subscription.refresh()}
                testID="custom-macros-retry"
              />
            </>
          ) : !allowed ? (
            <Text>{t('customMacros.locked')}</Text>
          ) : (
            <>
              <Text>{t('personalDay.blankDefaults')}</Text>
              <NutrientSummary
                values={{
                  calories: goal.daily_calorie_target,
                  protein: goal.protein_grams,
                  carbs: goal.carb_grams,
                  fat: goal.fat_grams,
                }}
              />
              <NumberField
                optional
                label={t('personalDay.caloriesInput')}
                value={calories}
                onChange={setCalories}
                testID="custom-macros-calories"
              />
              <NumberField
                optional
                nutrient="protein"
                label={t('customMacros.protein')}
                value={protein}
                onChange={setProtein}
                testID="custom-macros-protein"
              />
              <NumberField
                optional
                nutrient="carbs"
                label={t('customMacros.carbs')}
                value={carbs}
                onChange={setCarbs}
                testID="custom-macros-carbs"
              />
              <NumberField
                optional
                nutrient="fat"
                label={t('customMacros.fat')}
                value={fat}
                onChange={setFat}
                testID="custom-macros-fat"
              />
              {preview ? (
                <Text nutrient="calories" tabular testID="custom-macros-preview">
                  {t('customMacros.total', { calories: preview.daily_calorie_target })}
                </Text>
              ) : (
                <Text accessibilityRole="alert">{validationError}</Text>
              )}
              {error ? (
                <Text accessibilityRole="alert" color={colors.danger}>
                  {t('customMacros.error')}
                </Text>
              ) : null}
              <Button
                label={t(saving ? 'customMacros.saving' : 'customMacros.override')}
                onPress={() => void save()}
                disabled={saving || !preview}
                testID="custom-macros-override"
              />
            </>
          )}
          <Button
            variant="secondary"
            label={t('customMacros.keep')}
            onPress={onClose}
            disabled={saving}
            testID="custom-macros-keep"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
