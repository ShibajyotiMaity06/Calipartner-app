import React, { useEffect, useState } from 'react';
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
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

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
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [weightText, setWeightText] = useState('');
  const [dateText, setDateText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
  const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;

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

  const handleUnitToggle = (newUnit: 'kg' | 'lb') => {
    if (newUnit === unit) return;
    const parsed = parseFloat(weightText.trim());
    if (!isNaN(parsed) && parsed > 0) {
      if (newUnit === 'lb') {
        setWeightText(String(kgToLb(parsed)));
      } else {
        setWeightText(String(lbToKg(parsed)));
      }
    }
    setUnit(newUnit);
  };

  const handleSubmit = async () => {
    const rawVal = parseFloat(weightText.trim());
    if (isNaN(rawVal)) {
      setError(t('trackers.weight.invalidWeight'));
      return;
    }

    const weightKg = unit === 'lb' ? lbToKg(rawVal) : rawVal;
    if (weightKg < 20 || weightKg > 500) {
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
      await onSave(weightKg, notesText.trim() || undefined, trimmedDate);
      onClose();
    } catch {
      setError(t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialEntry);

  // E05: Change vs last entry in plain words
  const parsedCurrentInput = parseFloat(weightText.trim());
  const normalizedInputKg = !isNaN(parsedCurrentInput)
    ? unit === 'lb'
      ? lbToKg(parsedCurrentInput)
      : parsedCurrentInput
    : null;

  let plainWordsChange: string | null = null;
  if (normalizedInputKg !== null && currentWeight !== null) {
    const diff = Math.round((normalizedInputKg - currentWeight) * 10) / 10;
    if (Math.abs(diff) < 0.05) {
      plainWordsChange = t('trackers.weight.changeSinceLastSame');
    } else if (diff < 0) {
      plainWordsChange = t('trackers.weight.changeSinceLastDown', {
        amount: `${Math.abs(diff)} kg`,
      });
    } else {
      plainWordsChange = t('trackers.weight.changeSinceLastUp', {
        amount: `${diff} kg`,
      });
    }
  }

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
        <View style={styles.sheet} testID="weight-entry-sheet">
          <View style={styles.grabHandle} />

          {/* Header with Title and Unit Chip */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBox}>
                <Ionicons name="scale-outline" size={20} color={dark.apricot} />
              </View>
              <Text style={styles.title}>
                {isEditing
                  ? t('trackers.weight.editModalTitle')
                  : t('trackers.weight.entryModalTitle')}
              </Text>
            </View>

            {/* Unit Chip (kg / lb) */}
            <View style={styles.unitChipWrap} testID="weight-unit-chips">
              <Pressable
                testID="btn-weight-unit-kg"
                style={[styles.unitChip, unit === 'kg' && styles.unitChipActive]}
                onPress={() => handleUnitToggle('kg')}
                accessibilityRole="button"
                accessibilityLabel="Kilograms"
              >
                <Text style={[styles.unitChipText, unit === 'kg' && styles.unitChipTextActive]}>
                  kg
                </Text>
              </Pressable>
              <Pressable
                testID="btn-weight-unit-lb"
                style={[styles.unitChip, unit === 'lb' && styles.unitChipActive]}
                onPress={() => handleUnitToggle('lb')}
                accessibilityRole="button"
                accessibilityLabel="Pounds"
              >
                <Text style={[styles.unitChipText, unit === 'lb' && styles.unitChipTextActive]}>
                  lb
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
          >
            {/* E05 Big Numeric Field */}
            <View style={styles.bigNumericCard} testID="big-numeric-field-card">
              <Text style={styles.fieldLabel}>{t('trackers.weight.weightLabel')}</Text>
              <View style={styles.bigInputWrap}>
                <TextInput
                  testID="input-weight-value"
                  value={weightText}
                  onChangeText={(text) => {
                    setWeightText(text);
                    if (error) setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={unit === 'lb' ? '165.0' : '75.0'}
                  placeholderTextColor={dark.textLo}
                  style={styles.bigInput}
                  accessibilityLabel={t('trackers.weight.weightLabel')}
                />
                <Text style={styles.bigUnitSuffix}>{unit}</Text>
              </View>

              {/* Plain words change vs last entry */}
              {plainWordsChange && (
                <View style={styles.plainWordsPill} testID="plain-words-change">
                  <Ionicons name="sparkles-outline" size={14} color={dark.teal} />
                  <Text style={styles.plainWordsText}>{plainWordsChange}</Text>
                </View>
              )}
            </View>

            {/* Date Input (defaults today, back-datable) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>{t('trackers.weight.dateLabel')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar-outline" size={16} color={dark.textLo} />
                <TextInput
                  testID="input-weight-date"
                  value={dateText}
                  onChangeText={(text) => {
                    setDateText(text);
                    if (error) setError(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={dark.textLo}
                  style={styles.input}
                  accessibilityLabel={t('trackers.weight.dateLabel')}
                />
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>{t('trackers.weight.notesLabel')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  testID="input-weight-notes"
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder={t('trackers.weight.notesPlaceholder')}
                  placeholderTextColor={dark.textLo}
                  style={styles.input}
                  accessibilityLabel={t('trackers.weight.notesLabel')}
                />
              </View>
            </View>

            {/* Trend Summary Card */}
            <View testID="weight-sheet-trend-summary" style={styles.trendSummaryCard}>
              <Text style={styles.summaryTitle}>{t('trackers.weight.summaryTitle')}</Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Start</Text>
                  <Text style={styles.summaryItemVal}>
                    {startWeight !== null ? `${startWeight.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Current</Text>
                  <Text style={styles.summaryItemVal}>
                    {currentWeight !== null ? `${currentWeight.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Change</Text>
                  <Text style={styles.summaryItemVal}>
                    {totalChangeKg !== null
                      ? `${totalChangeKg > 0 ? '+' : ''}${totalChangeKg.toFixed(1)} kg (${changePercent}%)`
                      : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.paceRow}>
                {hasEnoughTrend && weeklyPace !== null ? (
                  <View style={styles.paceInfo}>
                    <Text style={styles.paceText}>
                      {t('trackers.weight.weeklyPace', { pace: weeklyPace.toFixed(2) })}
                    </Text>
                    {projectedDate ? (
                      <Text style={styles.projectionText}>
                        {t('trackers.weight.projectedDate', { date: projectedDate })}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.trendPendingText}>
                    {t('trackers.weight.notEnoughTrend')}
                  </Text>
                )}
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <Text testID="weight-entry-error" style={styles.errorText}>
                {error}
              </Text>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-weight-cancel"
              onPress={onClose}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-weight-save"
              onPress={() => void handleSubmit()}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={styles.saveBtnText}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
    maxHeight: '90%',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  unitChipWrap: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: 2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  unitChip: {
    minHeight: 32,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.control - 2,
  },
  unitChipActive: {
    backgroundColor: dark.s3,
  },
  unitChipText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    fontWeight: '700',
  },
  unitChipTextActive: {
    color: dark.textHi,
  },
  formScroll: {
    maxHeight: 440,
  },
  formContent: {
    gap: space[3],
  },
  bigNumericCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  fieldLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    fontWeight: '600',
  },
  bigInputWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  bigInput: {
    fontSize: 40,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
    minWidth: 120,
    padding: 0,
  },
  bigUnitSuffix: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textLo,
    fontWeight: '700',
  },
  plainWordsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: dark.s3,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  plainWordsText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.teal,
    fontWeight: '600',
  },
  inputGroup: {
    gap: space[1],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: dark.textHi,
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    minHeight: 44,
  },
  trendSummaryCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  summaryTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: space[1],
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  summaryItemVal: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '600',
  },
  paceRow: {
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  paceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  paceText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  projectionText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.teal,
    fontWeight: '600',
  },
  trendPendingText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  errorText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.danger,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
