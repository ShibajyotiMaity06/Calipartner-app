import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeightLog } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface WeightEntryModalProps {
  visible: boolean;
  initialEntry?: WeightLog | null;
  defaultDate?: string;
  startWeight: number | null;
  currentWeight: number | null;
  totalChangeKg: number | null;
  weeklyPace: number | null;
  projectedDate: string | null;
  hasEnoughTrend: boolean;
  onClose: () => void;
  onSave: (weightKg: number, notes?: string, date?: string) => Promise<unknown>;
}

export function WeightEntryModal({
  visible,
  initialEntry,
  defaultDate,
  startWeight,
  currentWeight,
  totalChangeKg,
  weeklyPace,
  projectedDate,
  hasEnoughTrend,
  onClose,
  onSave,
}: WeightEntryModalProps) {
  const { colors } = useTheme();

  const [weightText, setWeightText] = useState('');
  const [dateText, setDateText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setWeightText(String(initialEntry.weight_kg));
      setDateText(initialEntry.local_date);
      setNotesText(initialEntry.notes ?? '');
    } else {
      setWeightText(currentWeight ? String(currentWeight) : '');
      setDateText(defaultDate ?? new Date().toISOString().slice(0, 10));
      setNotesText('');
    }
    setError(null);
  }, [initialEntry, defaultDate, currentWeight, visible]);

  const handleSubmit = async () => {
    const parsedWeight = parseFloat(weightText.trim());
    if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 500) {
      setError(t('trackers.weight.invalidWeight'));
      return;
    }

    const trimmedDate = dateText.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setError(t('trackers.weight.invalidDate'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(parsedWeight, notesText.trim() || undefined, trimmedDate);
      onClose();
    } catch {
      setError(t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialEntry);
  const changePercent =
    startWeight && startWeight > 0 && totalChangeKg !== null
      ? ((totalChangeKg / startWeight) * 100).toFixed(1)
      : null;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="modal-weight-entry"
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="scale-outline" size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>
                {isEditing
                  ? t('trackers.weight.editModalTitle')
                  : t('trackers.weight.entryModalTitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Simple Trend Summary Card */}
            <View
              testID="weight-sheet-trend-summary"
              style={[
                styles.trendSummaryCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: colors.text }]}>
                {t('trackers.weight.summaryTitle')}
              </Text>

              <View style={styles.summaryGrid}>
                {/* Start Weight */}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>
                    Start
                  </Text>
                  <Text style={[styles.summaryItemVal, { color: colors.text }]}>
                    {startWeight !== null ? `${startWeight.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                {/* Current Weight */}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>
                    Current
                  </Text>
                  <Text style={[styles.summaryItemVal, { color: colors.text }]}>
                    {currentWeight !== null ? `${currentWeight.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                {/* Change */}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>
                    Change
                  </Text>
                  <Text style={[styles.summaryItemVal, { color: colors.text }]}>
                    {totalChangeKg !== null
                      ? `${totalChangeKg > 0 ? '+' : ''}${totalChangeKg.toFixed(1)} kg (${changePercent}%)`
                      : '—'}
                  </Text>
                </View>
              </View>

              {/* Weekly Pace & Projected Date or Not Enough Trend */}
              <View style={[styles.paceRow, { borderTopColor: colors.border }]}>
                {hasEnoughTrend && weeklyPace !== null ? (
                  <View style={styles.paceInfo}>
                    <Text style={[styles.paceText, { color: colors.accent }]}>
                      {t('trackers.weight.weeklyPace', { pace: weeklyPace.toFixed(2) })}
                    </Text>
                    {projectedDate ? (
                      <Text style={[styles.projectionText, { color: colors.syncSynced }]}>
                        {t('trackers.weight.projectedDate', { date: projectedDate })}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.trendPendingText, { color: colors.textMuted }]}>
                    {t('trackers.weight.notEnoughTrend')}
                  </Text>
                )}
              </View>
            </View>

            {/* Weight Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('trackers.weight.weightLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <TextInput
                  testID="input-weight-value"
                  value={weightText}
                  onChangeText={(text) => {
                    setWeightText(text);
                    if (error) setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={t('trackers.weight.weightPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                  accessibilityLabel={t('trackers.weight.weightLabel')}
                />
                <Text style={[styles.unitBadge, { color: colors.textMuted }]}>kg</Text>
              </View>
            </View>

            {/* Date Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('trackers.weight.dateLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <TextInput
                  testID="input-weight-date"
                  value={dateText}
                  onChangeText={(text) => {
                    setDateText(text);
                    if (error) setError(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                  accessibilityLabel={t('trackers.weight.dateLabel')}
                />
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('trackers.weight.notesLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <TextInput
                  testID="input-weight-notes"
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder={t('trackers.weight.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                  accessibilityLabel={t('trackers.weight.notesLabel')}
                />
              </View>
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : null}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-cancel-weight"
              onPress={onClose}
              disabled={saving}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-save-weight"
              onPress={handleSubmit}
              disabled={saving}
              style={[styles.btn, styles.submitBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={[styles.btnText, { color: colors.onAccent, fontWeight: '700' }]}>
                {saving ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  formScroll: {
    maxHeight: 460,
  },
  formContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  trendSummaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: fontSize.xs,
  },
  summaryItemVal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  paceRow: {
    borderTopWidth: 1,
    paddingTop: spacing.xs,
  },
  paceInfo: {
    gap: 2,
  },
  paceText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  projectionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  trendPendingText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  unitBadge: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    paddingLeft: 4,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  submitBtn: {},
  btnText: {
    fontSize: fontSize.sm,
  },
});
