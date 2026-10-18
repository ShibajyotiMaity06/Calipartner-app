import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { reportRecipe } from '@/services/recipeService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeReportModalProps {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

const REASONS = [
  { key: 'incorrect_ingredient', labelKey: 'recipes.report.reasonOptions.incorrect_ingredient' },
  { key: 'wrong_nutrition', labelKey: 'recipes.report.reasonOptions.wrong_nutrition' },
  { key: 'step_error', labelKey: 'recipes.report.reasonOptions.step_error' },
  { key: 'offensive_content', labelKey: 'recipes.report.reasonOptions.offensive_content' },
  { key: 'other', labelKey: 'recipes.report.reasonOptions.other' },
] as const;

export function RecipeReportModal({
  visible,
  recipe,
  onClose,
  onReportSubmitted,
}: RecipeReportModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [selectedReason, setSelectedReason] = useState<string>('incorrect_ingredient');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!recipe) return null;

  const handleSubmit = async () => {
    if (!user?.id) {
      setErrorMsg('Please sign in to submit a recipe report.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const db = await getDb();

      await reportRecipe(
        db,
        {
          userId: user.id,
          recipeId: recipe.id,
          reason: selectedReason,
          details: details.trim() || null,
        },
      );

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        onReportSubmitted?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      testID="modal-recipe-report"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('recipes.report.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {recipe.title}
              </Text>
            </View>
            <Pressable
              testID="btn-close-recipe-report"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.report.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {submitted ? (
            <View style={styles.successWrap}>
              <Ionicons name="checkmark-circle" size={48} color={colors.syncSynced} />
              <Text style={[styles.successText, { color: colors.text }]}>
                {t('recipes.report.success')}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {errorMsg && (
                <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: colors.danger }]}>
                  <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                {t('recipes.report.reasonLabel')}
              </Text>

              {/* Reasons Selection */}
              <View style={styles.reasonsList}>
                {REASONS.map(({ key, labelKey }) => {
                  const isSelected = selectedReason === key;
                  return (
                    <Pressable
                      key={key}
                      testID={`report-reason-${key}`}
                      onPress={() => setSelectedReason(key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      style={[
                        styles.reasonRow,
                        {
                          backgroundColor: isSelected ? colors.cardHighlight : colors.surfaceAlt,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? colors.accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.reasonText,
                          {
                            color: isSelected ? colors.accent : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {t(labelKey as Parameters<typeof t>[0])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Details Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
                  {t('recipes.report.detailsLabel')}
                </Text>
                <TextInput
                  testID="input-recipe-report-details"
                  value={details}
                  onChangeText={setDetails}
                  placeholder={t('recipes.report.detailsPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <Pressable
                  testID="btn-cancel-recipe-report"
                  onPress={onClose}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={t('recipes.report.cancel')}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                    {t('recipes.report.cancel')}
                  </Text>
                </Pressable>

                <Pressable
                  testID="btn-submit-recipe-report"
                  onPress={handleSubmit}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={t('recipes.report.submit')}
                  style={[styles.submitBtn, { backgroundColor: colors.accent }]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <Text style={[styles.submitBtnText, { color: colors.onAccent }]}>
                      {t('recipes.report.submit')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.md,
    borderWidth: 1,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  reasonsList: {
    gap: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
  inputGroup: {
    gap: 6,
    marginTop: 4,
  },
  textArea: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 10,
    fontSize: fontSize.xs,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  successWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  successText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBox: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
