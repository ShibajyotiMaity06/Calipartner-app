import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import {
  CloseIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  ProgressBar,
  Segmented,
  Sheet,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import type { WaterLog } from '@calipartner/core';
import { t } from '@/i18n';

export interface CustomWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (amountMl: number) => Promise<void>;
  totalMl?: number;
  goalMl?: number;
  logs?: WaterLog[];
  onUndo?: () => Promise<unknown>;
  onOpenReminders?: () => void;
}

type WaterUnit = 'ml' | 'fl_oz';

const PRESET_CARDS = [
  { id: 'glass', ml: 250, labelKey: 'waterV1.glassLabel' as const },
  { id: 'bottle', ml: 500, labelKey: 'waterV1.bottleLabel' as const },
  { id: 'large', ml: 750, labelKey: 'waterV1.largeLabel' as const },
];

const ML_PER_FL_OZ = 29.5735;

function toDisplayUnit(ml: number, unit: WaterUnit): number {
  if (unit === 'fl_oz') return Math.round(ml / ML_PER_FL_OZ);
  return Math.round(ml);
}

function formatWaterTime(iso: string): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function WaterBottleGraphic({ fillRatio }: { fillRatio: number }) {
  const clamped = Math.max(0.04, Math.min(1, fillRatio));
  const bodyTop = 26;
  const bodyBottom = 104;
  const fillHeight = Math.round((bodyBottom - bodyTop) * clamped);
  const fillTop = bodyBottom - fillHeight;

  return (
    <Svg width={66} height={112} viewBox="0 0 66 112" fill="none">
      <Defs>
        <ClipPath id="bottleClip">
          <Rect x={12} y={24} width={42} height={80} rx={12} />
        </ClipPath>
      </Defs>
      {/* Bottle Cap */}
      <Rect
        x={23}
        y={6}
        width={20}
        height={10}
        rx={3}
        stroke={colors.hairlineLit}
        strokeWidth={1.6}
        fill={colors.s2}
      />
      {/* Bottle Neck */}
      <Path
        d="M25 16v5c0 2.5-11 4.5-13 9v66a10 10 0 0 0 10 10h22a10 10 0 0 0 10-10V30c-2-4.5-13-6.5-13-9v-5"
        stroke={colors.hairlineLit}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={colors.s1}
      />
      {/* Wavy Apricot Fill */}
      {fillRatio > 0 ? (
        <Path
          d={`M12 ${fillTop + 3} Q22 ${fillTop - 3} 33 ${fillTop + 2} T54 ${fillTop + 1} L54 106 L12 106 Z`}
          fill={colors.apricot}
          clipPath="url(#bottleClip)"
        />
      ) : null}
    </Svg>
  );
}

function QuickPresetIcon({ kind }: { kind: string }) {
  if (kind === 'glass') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.5 4h11l-1.5 16h-8L6.5 4z"
          stroke={colors.apricot}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (kind === 'bottle') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Rect x={9.5} y={3} width={5} height={3} rx={1} stroke={colors.apricot} strokeWidth={1.8} />
        <Path
          d="M9 6h6l1.5 3.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20V9.5L9 6z"
          stroke={colors.apricot}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={2.5} width={6} height={3} rx={1} stroke={colors.apricot} strokeWidth={1.8} />
      <Path
        d="M8 5.5h8l2 4V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.5l2-4z"
        stroke={colors.apricot}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CustomWaterModal({
  visible,
  onClose,
  onSave,
  totalMl = 0,
  goalMl = 3000,
  logs = [],
  onUndo,
  onOpenReminders,
}: CustomWaterModalProps) {
  const [unit, setUnit] = useState<WaterUnit>('ml');
  const [amountText, setAmountText] = useState('350');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const safeGoal = Math.max(1, goalMl);
  const progressRatio = Math.min(1, Math.max(0, totalMl / safeGoal));
  const percent = Math.round(progressRatio * 100);
  const unitLabel = unit === 'fl_oz' ? 'fl oz' : 'ml';
  const currentDisplay = toDisplayUnit(totalMl, unit);
  const goalDisplay = toDisplayUnit(goalMl, unit);

  const statusPhrase =
    progressRatio >= 1
      ? t('waterV1.goalReached')
      : percent >= 45 && percent <= 55
        ? t('waterV1.halfwayThere')
        : t('waterV1.percentComplete', { pct: percent });

  const handleSaveAmount = async (amountMl: number, closeAfter = false) => {
    if (saving || amountMl < 10 || amountMl > 5000) {
      if (amountMl < 10 || amountMl > 5000) setError(t('trackers.water.invalidAmount'));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(amountMl);
      if (closeAfter) onClose();
    } catch {
      setError(t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const parsed = parseInt(amountText.trim(), 10);
    if (isNaN(parsed) || parsed < 10 || parsed > 5000) {
      setError(t('trackers.water.invalidAmount'));
      return;
    }
    const saveMl = unit === 'fl_oz' ? Math.round(parsed * ML_PER_FL_OZ) : parsed;
    await handleSaveAmount(saveMl, false);
  };

  const stepAmount = (delta: number) => {
    const cur = parseInt(amountText.trim(), 10);
    const base = Number.isFinite(cur) ? cur : 350;
    const step = unit === 'fl_oz' ? 2 : 50;
    const next = Math.max(step, Math.min(5000, base + delta * step));
    setAmountText(String(next));
    setError(null);
  };

  const handleUndoLast = async () => {
    if (!onUndo || saving || logs.length === 0) return;
    try {
      setSaving(true);
      setError(null);
      await onUndo();
    } catch {
      setError(t('common.errorBody'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('waterV1.title')}
      testID="modal-custom-water"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetScroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Row: Water title + ml/fl oz switch + X */}
        <View style={styles.headerRow}>
          <Text variant="titleM" color="textHi">
            {t('waterV1.title')}
          </Text>
          <View style={styles.headerRight}>
            <Segmented
              options={[
                { value: 'ml', label: 'ml' },
                { value: 'fl_oz', label: 'fl oz' },
              ]}
              value={unit}
              onChange={(next) => {
                if (next === unit) return;
                const val = parseInt(amountText.trim(), 10);
                if (Number.isFinite(val) && val > 0) {
                  setAmountText(
                    String(
                      next === 'fl_oz'
                        ? Math.max(1, Math.round(val / ML_PER_FL_OZ))
                        : Math.max(50, Math.round(val * ML_PER_FL_OZ)),
                    ),
                  );
                }
                setUnit(next as WaterUnit);
              }}
              compact
              testID="water-unit-segmented"
            />
            <IconButton
              icon={<CloseIcon size={16} color={colors.textHi} />}
              size={36}
              inSheet
              onPress={onClose}
              accessibilityLabel={t('common.cancel')}
              testID="btn-cancel-water"
            />
          </View>
        </View>

        {/* Hero Bottle Progress Card */}
        <View style={styles.heroCard}>
          <WaterBottleGraphic fillRatio={progressRatio} />
          <View style={styles.heroStatsCol}>
            <View style={styles.heroNumRow}>
              <Text variant="numL" tabular color="textHi">
                {currentDisplay.toLocaleString('en-US')}
              </Text>
              <Text variant="meta" color="textLo">
                {` ${unitLabel}`}
              </Text>
            </View>
            <Text variant="meta" color="textLo">
              {`${t('waterV1.ofGoal', {
                goal: `${goalDisplay.toLocaleString('en-US')} ${unitLabel}`,
              })} · ${statusPhrase}`}
            </Text>
            <ProgressBar progress={progressRatio} testID="water-hero-progress" />
          </View>
        </View>

        {/* Quick Add Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="eyebrow" color="textLo">
              {t('waterV1.quickAddEyebrow')}
            </Text>
            <Text variant="meta" color="textLo">
              {t('waterV1.tapToLog')}
            </Text>
          </View>

          <View style={styles.presetsGrid}>
            {PRESET_CARDS.map((preset) => {
              const displayAmt = toDisplayUnit(preset.ml, unit);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => void handleSaveAmount(preset.ml, false)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`+${displayAmt} ${unitLabel}`}
                  testID={`water-quick-add-${preset.ml}`}
                  style={({ pressed }) => [
                    styles.presetCard,
                    pressed ? styles.presetCardPressed : null,
                  ]}
                >
                  <QuickPresetIcon kind={preset.id} />
                  <Text variant="rowTitle" tabular color="textHi">
                    {`+${displayAmt} ${unitLabel}`}
                  </Text>
                  <Text variant="micro" color="textLo">
                    {t(preset.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom Stepper & Add CTA */}
        <View style={styles.customRowCard}>
          <View style={styles.stepperGroup}>
            <Pressable
              onPress={() => stepAmount(-1)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Decrease custom water amount"
              testID="water-stepper-minus"
              style={styles.circleStepBtn}
            >
              <Text variant="buttonM" color="textHi">
                −
              </Text>
            </Pressable>

            <View style={styles.amountInputWrap}>
              <TextInput
                testID="input-water-amount"
                value={amountText}
                onChangeText={(text) => {
                  setAmountText(text);
                  if (error) setError(null);
                }}
                keyboardType="numeric"
                style={styles.customInput}
                accessibilityLabel={t('trackers.water.amountLabel')}
              />
              <Text variant="meta" color="textLo">
                {unitLabel}
              </Text>
            </View>

            <Pressable
              onPress={() => stepAmount(1)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Increase custom water amount"
              testID="water-stepper-plus"
              style={styles.circleStepBtn}
            >
              <Text variant="buttonM" color="textHi">
                +
              </Text>
            </Pressable>
          </View>

          <PrimaryButton
            compact
            title={saving ? t('common.saving') : t('waterV1.addCustom')}
            onPress={() => void handleSubmit()}
            disabled={saving}
            loading={saving}
            testID="btn-submit-water"
          />
        </View>

        {error ? (
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {/* Today Log Pills */}
        {logs.length > 0 || onOpenReminders ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="eyebrow" color="textLo">
                {t('waterV1.todayEyebrow')}
              </Text>
              <View style={styles.todayRightLinks}>
                {onOpenReminders ? (
                  <LinkButton
                    title={t('waterV1.reminders')}
                    variant="accent"
                    onPress={onOpenReminders}
                    testID="water-open-reminders"
                  />
                ) : null}
                {onUndo && logs.length > 0 ? (
                  <LinkButton
                    title={t('waterV1.undoLast')}
                    variant="default"
                    disabled={saving}
                    onPress={() => void handleUndoLast()}
                    testID="water-undo-last"
                  />
                ) : null}
              </View>
            </View>

            {logs.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.todayLogsRow}
              >
                {logs.map((entry) => (
                  <View key={entry.id} style={styles.logPill} testID={`water-log-${entry.id}`}>
                    <Text variant="meta" color="textLo" tabular>
                      {`${formatWaterTime(entry.logged_at)} · `}
                    </Text>
                    <Text variant="label" color="textHi" tabular>
                      {String(toDisplayUnit(entry.amount_ml, unit))}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetScroll: {
    gap: space.lg,
    paddingBottom: space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
  },
  heroStatsCol: {
    flex: 1,
    gap: space.sm,
  },
  heroNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sectionBlock: {
    gap: space.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayRightLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: space.sm,
  },
  presetCard: {
    flex: 1,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.optionCard,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: space.xs,
  },
  presetCardPressed: {
    backgroundColor: colors.s3,
    borderColor: colors.apricot,
  },
  customRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.sm,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  circleStepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s3,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  customInput: {
    color: colors.textHi,
    fontFamily: fonts.bold,
    fontSize: 18,
    minWidth: 42,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  todayLogsRow: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  logPill: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
