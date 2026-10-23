import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface TargetWeightEditorModalProps {
  visible: boolean;
  currentWeightKg: number;
  initialTargetKg?: number;
  initialPaceKg?: number;
  onClose: () => void;
  onSave?: (targetKg: number, weeklyPaceKg: number) => Promise<void> | void;
  testID?: string;
}

export function TargetWeightEditorModal({
  visible,
  currentWeightKg,
  initialTargetKg = 70,
  initialPaceKg = 0.5,
  onClose,
  onSave,
  testID = 'target-weight-editor-modal',
}: TargetWeightEditorModalProps) {
  const [targetKg, setTargetKg] = useState<number>(initialTargetKg);
  const [weeklyPace, setWeeklyPace] = useState<number>(initialPaceKg);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  // Calculate projected weeks and approximate date
  const differenceKg = Math.abs(currentWeightKg - targetKg);
  const weeksNeeded = weeklyPace > 0 ? Math.ceil(differenceKg / weeklyPace) : 0;
  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + weeksNeeded * 7);

  const formattedDate = projectedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleStepTarget = (delta: number) => {
    setTargetKg((prev) => Math.max(30, Math.min(250, Math.round((prev + delta) * 10) / 10)));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave?.(targetKg, weeklyPace);
      onClose();
    } finally {
      setSaving(false);
    }
  };

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

        <View style={styles.sheet} testID="target-weight-sheet-container">
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="flag-outline" size={20} color={dark.apricot} />
              </View>
              <View>
                <Text style={styles.title}>{t('trackers.weight.targetWeightTitle')}</Text>
                <Text style={styles.subtitle}>{t('trackers.weight.targetWeightSubtitle')}</Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          {/* Target Weight Stepper Card */}
          <View style={styles.sectionCard} testID="target-weight-stepper-card">
            <Text style={styles.sectionLabel}>
              {t('trackers.weight.targetWeightGoalLabel', { unit: 'kg' })}
            </Text>
            <View style={styles.stepperRow}>
              <Pressable
                testID="btn-target-minus"
                style={styles.stepperBtn}
                onPress={() => handleStepTarget(-0.5)}
                accessibilityRole="button"
                accessibilityLabel="Decrease target weight"
              >
                <Ionicons name="remove" size={20} color={dark.textHi} />
              </Pressable>

              <View style={styles.numeralBox}>
                <Text style={styles.numeralText} testID="text-target-weight-val">
                  {`${targetKg.toFixed(1)} kg`}
                </Text>
                <Text style={styles.currentDiff}>
                  {currentWeightKg > targetKg
                    ? `-${(currentWeightKg - targetKg).toFixed(1)} kg to lose`
                    : `+${(targetKg - currentWeightKg).toFixed(1)} kg to gain`}
                </Text>
              </View>

              <Pressable
                testID="btn-target-plus"
                style={styles.stepperBtn}
                onPress={() => handleStepTarget(0.5)}
                accessibilityRole="button"
                accessibilityLabel="Increase target weight"
              >
                <Ionicons name="add" size={20} color={dark.textHi} />
              </Pressable>
            </View>
          </View>

          {/* Weekly Pace Selector (capped at safe rate 1.0 kg/week) */}
          <View style={styles.sectionCard} testID="weekly-pace-selector-card">
            <Text style={styles.sectionLabel}>{t('trackers.weight.weeklyPaceLabel')}</Text>
            <View style={styles.paceChipsRow}>
              {[0.25, 0.5, 0.75, 1.0].map((rate) => (
                <Pressable
                  key={rate}
                  testID={`btn-pace-${rate}`}
                  style={[styles.paceChip, weeklyPace === rate && styles.paceChipActive]}
                  onPress={() => setWeeklyPace(rate)}
                  accessibilityRole="button"
                  accessibilityLabel={`${rate} kg per week`}
                >
                  <Text
                    style={[styles.paceChipText, weeklyPace === rate && styles.paceChipTextActive]}
                  >
                    {`${rate} kg/wk`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Projection Result */}
          <View style={styles.projectionCard} testID="timeline-projection-box">
            <Ionicons name="calendar-outline" size={18} color={dark.teal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.projTitle}>Estimated timeline</Text>
              <Text style={styles.projSubtitle}>
                {t('trackers.weight.projectedReach', { date: formattedDate })}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-target-cancel"
              style={styles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              testID="btn-target-save"
              style={styles.saveBtn}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.saveTargetWeightBtn')}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t('common.saving') : t('trackers.weight.saveTargetWeightBtn')}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
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
  subtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  sectionLabel: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    marginTop: space[1],
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeralBox: {
    alignItems: 'center',
    gap: 2,
  },
  numeralText: {
    fontSize: typeTokens.numeralL.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
  },
  currentDiff: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  paceChipsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  paceChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paceChipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  paceChipText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  paceChipTextActive: {
    color: dark.onBrand, // #1C1109
  },
  projectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  projTitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  projSubtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
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
});
