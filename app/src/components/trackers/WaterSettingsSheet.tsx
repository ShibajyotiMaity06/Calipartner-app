import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface WaterSettingsSheetProps {
  visible: boolean;
  currentGoalMl: number;
  userWeightKg?: number;
  initialUnit?: 'ml' | 'fl_oz';
  onClose: () => void;
  onSaveGoal?: (goalMl: number) => Promise<void> | void;
  onLogCustom?: (amountMl: number) => Promise<void> | void;
  testID?: string;
}

const MIN_GOAL_ML = 1500;
const MAX_GOAL_ML = 4000;
const STEP_ML = 250;
const PRESET_CONTAINERS = [
  { label: 'Glass', ml: 250, icon: 'pint-outline' as const },
  { label: 'Bottle', ml: 500, icon: 'water-outline' as const },
  { label: 'Large', ml: 1000, icon: 'flask-outline' as const },
];

export function WaterSettingsSheet({
  visible,
  currentGoalMl,
  userWeightKg = 70,
  initialUnit = 'ml',
  onClose,
  onSaveGoal,
  onLogCustom,
  testID = 'water-settings-sheet',
}: WaterSettingsSheetProps) {
  const [unit, setUnit] = useState<'ml' | 'fl_oz'>(initialUnit);
  // Default formula: 35 ml per kg of body weight rounded to 250 ml, clamped [1500, 4000]
  const defaultRecommendedGoal = Math.min(
    MAX_GOAL_ML,
    Math.max(MIN_GOAL_ML, Math.round((userWeightKg * 35) / STEP_ML) * STEP_ML),
  );

  const [goalMl, setGoalMl] = useState<number>(
    currentGoalMl > 0 ? currentGoalMl : defaultRecommendedGoal,
  );
  const [customAmountText, setCustomAmountText] = useState('250');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mlToFloz = (ml: number) => Math.round(ml / 29.5735);
  const flozToMl = (oz: number) => Math.round(oz * 29.5735);

  const handleGoalStep = (direction: 'up' | 'down') => {
    setGoalMl((prev) => {
      const next = direction === 'up' ? prev + STEP_ML : prev - STEP_ML;
      return Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, next));
    });
  };

  const handleSelectPreset = (amountMl: number) => {
    if (unit === 'fl_oz') {
      setCustomAmountText(String(mlToFloz(amountMl)));
    } else {
      setCustomAmountText(String(amountMl));
    }
    setError(null);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save goal if changed
      if (onSaveGoal) {
        await onSaveGoal(goalMl);
      }

      // If user typed a custom amount and wants to log it
      const parsed = parseFloat(customAmountText.trim());
      if (!isNaN(parsed) && parsed > 0 && onLogCustom) {
        const amountMl = unit === 'fl_oz' ? flozToMl(parsed) : Math.round(parsed);
        if (amountMl < 10 || amountMl > 5000) {
          setError(t('trackers.water.invalidAmount'));
          return;
        }
        await onLogCustom(amountMl);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const displayGoal = unit === 'fl_oz' ? `${mlToFloz(goalMl)} fl oz` : `${goalMl} ml`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />

        <View style={styles.sheet} testID="water-settings-container">
          {/* Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="water" size={20} color={dark.apricot} />
              <Text style={styles.title}>{t('trackers.water.title')}</Text>
            </View>

            {/* Unit Toggle ml / fl oz */}
            <View style={styles.unitToggleWrap} testID="water-unit-toggle">
              <Pressable
                testID="btn-water-unit-ml"
                style={[styles.unitBtn, unit === 'ml' && styles.unitBtnActive]}
                onPress={() => {
                  if (unit !== 'ml') {
                    const oz = parseFloat(customAmountText);
                    if (!isNaN(oz)) setCustomAmountText(String(flozToMl(oz)));
                    setUnit('ml');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Milliliters"
              >
                <Text style={[styles.unitBtnText, unit === 'ml' && styles.unitBtnTextActive]}>
                  {t('trackers.water.unitMl')}
                </Text>
              </Pressable>

              <Pressable
                testID="btn-water-unit-floz"
                style={[styles.unitBtn, unit === 'fl_oz' && styles.unitBtnActive]}
                onPress={() => {
                  if (unit !== 'fl_oz') {
                    const ml = parseFloat(customAmountText);
                    if (!isNaN(ml)) setCustomAmountText(String(mlToFloz(ml)));
                    setUnit('fl_oz');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Fluid ounces"
              >
                <Text style={[styles.unitBtnText, unit === 'fl_oz' && styles.unitBtnTextActive]}>
                  {t('trackers.water.unitFloz')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Section 1: Daily Goal Stepper (WAT-2: min 1500, max 4000, 250ml steps) */}
          <View style={styles.sectionCard} testID="water-goal-stepper-section">
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>{t('trackers.water.dailyGoal')}</Text>
              <Text style={styles.sectionSubtitle}>
                {`Default is 35 ml/kg (${defaultRecommendedGoal} ml)`}
              </Text>
            </View>

            <View style={styles.stepperRow}>
              <Pressable
                testID="btn-water-goal-minus"
                style={[styles.stepperBtn, goalMl <= MIN_GOAL_ML && styles.stepperBtnDisabled]}
                onPress={() => handleGoalStep('down')}
                disabled={goalMl <= MIN_GOAL_ML}
                accessibilityRole="button"
                accessibilityLabel="Decrease water goal"
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={goalMl <= MIN_GOAL_ML ? dark.textOff : dark.textHi}
                />
              </Pressable>

              <View style={styles.goalDisplayBox} testID="water-goal-value-display">
                <Text style={styles.goalNumber}>{displayGoal}</Text>
              </View>

              <Pressable
                testID="btn-water-goal-plus"
                style={[styles.stepperBtn, goalMl >= MAX_GOAL_ML && styles.stepperBtnDisabled]}
                onPress={() => handleGoalStep('up')}
                disabled={goalMl >= MAX_GOAL_ML}
                accessibilityRole="button"
                accessibilityLabel="Increase water goal"
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={goalMl >= MAX_GOAL_ML ? dark.textOff : dark.textHi}
                />
              </Pressable>
            </View>
          </View>

          {/* Section 2: Custom Amount & Container Presets */}
          <View style={styles.sectionCard} testID="water-custom-amount-section">
            <Text style={styles.sectionLabel}>{t('trackers.water.customAmount')}</Text>

            {/* Container Presets Chips */}
            <View style={styles.presetChipsRow}>
              {PRESET_CONTAINERS.map((c) => (
                <Pressable
                  key={c.ml}
                  testID={`btn-water-preset-${c.ml}`}
                  style={[
                    styles.presetChip,
                    customAmountText === String(unit === 'fl_oz' ? mlToFloz(c.ml) : c.ml) &&
                      styles.presetChipActive,
                  ]}
                  onPress={() => handleSelectPreset(c.ml)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} ${unit === 'fl_oz' ? mlToFloz(c.ml) : c.ml} ${unit}`}
                >
                  <Ionicons name={c.icon} size={15} color={dark.textMid} />
                  <Text style={styles.presetChipText}>
                    {`${c.label} (${unit === 'fl_oz' ? mlToFloz(c.ml) : c.ml} ${unit})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount Input */}
            <View style={styles.inputWrap}>
              <TextInput
                testID="input-custom-water-amount"
                style={styles.input}
                value={customAmountText}
                onChangeText={(val) => {
                  setCustomAmountText(val);
                  setError(null);
                }}
                keyboardType="numeric"
                placeholder={unit === 'fl_oz' ? 'e.g. 12' : 'e.g. 350'}
                placeholderTextColor={dark.textLo}
                accessibilityLabel={t('trackers.water.amountLabel')}
              />
              <Text style={styles.inputSuffix}>{unit}</Text>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <Text style={styles.errorText} testID="water-settings-error">
              {error}
            </Text>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-water-settings-cancel"
              style={styles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-water-settings-save"
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={() => void handleSaveAll()}
              disabled={saving}
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
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  unitToggleWrap: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: 2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  unitBtn: {
    minHeight: 36,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.control - 2,
  },
  unitBtnActive: {
    backgroundColor: dark.s3,
  },
  unitBtnText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: dark.textHi,
  },
  sectionCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[3],
    gap: space[2],
  },
  sectionHeaderRow: {
    flexDirection: 'column',
    gap: 2,
  },
  sectionLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    marginTop: space[1],
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  goalDisplayBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  goalNumber: {
    fontSize: typeTokens.numeralL.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    color: dark.textHi,
    fontWeight: '800',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginVertical: space[1],
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    minHeight: 44,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  presetChipActive: {
    borderColor: dark.apricot,
  },
  presetChipText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s3,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    minHeight: 44,
  },
  inputSuffix: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    fontWeight: '600',
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
    color: dark.onBrand, // #1C1109 - rule U2
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
