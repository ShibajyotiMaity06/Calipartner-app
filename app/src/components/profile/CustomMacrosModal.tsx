import React, { useRef, useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, useTheme } from '@calipartner/ui';
import type { GoalProfile, Sex } from '@calipartner/core';
import { customMacroTargets } from '@calipartner/core';
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
  const [protein, setProtein] = useState<number | null>(goal.protein_grams);
  const [carbs, setCarbs] = useState<number | null>(goal.carb_grams);
  const [fat, setFat] = useState<number | null>(goal.fat_grams);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const allowed = subscription.hasPlan && ['plus', 'pro'].includes(subscription.currentTier);
  const macros = { protein: protein ?? NaN, carbs: carbs ?? NaN, fat: fat ?? NaN };
  let preview: ReturnType<typeof customMacroTargets> | null = null;
  try {
    preview = customMacroTargets(macros, goal, sex);
  } catch {
    /* Invalid drafts remain editable. */
  }
  const save = async () => {
    if (!allowed || !preview || lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(false);
    try {
      const result = await updateCustomMacros(macros, sex);
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
              <Text>{t('customMacros.description')}</Text>
              <Text tabular>
                {t('customMacros.current', {
                  calories: goal.daily_calorie_target,
                  protein: goal.protein_grams,
                  carbs: goal.carb_grams,
                  fat: goal.fat_grams,
                })}
              </Text>
              <NumberField
                label={t('customMacros.protein')}
                value={protein}
                onChange={setProtein}
                testID="custom-macros-protein"
              />
              <NumberField
                label={t('customMacros.carbs')}
                value={carbs}
                onChange={setCarbs}
                testID="custom-macros-carbs"
              />
              <NumberField
                label={t('customMacros.fat')}
                value={fat}
                onChange={setFat}
                testID="custom-macros-fat"
              />
              {preview ? (
                <Text tabular testID="custom-macros-preview">
                  {t('customMacros.total', { calories: preview.daily_calorie_target })}
                </Text>
              ) : (
                <Text accessibilityRole="alert">{t('customMacros.invalid')}</Text>
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
