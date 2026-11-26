import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  CameraIcon,
  ChevronLeftIcon,
  HistoryClockIcon,
  IconButton,
  LinkButton,
  PrimaryButton,
  ProgressBar,
  RulerPicker,
  Segmented,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useReducedMotion } from '@calipartner/ui';
import { isValidWeightDate, type WeightLog } from '@calipartner/core';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { t } from '@/i18n';

export interface WeightEntryModalProps {
  visible: boolean;
  initialEntry?: WeightLog | null;
  defaultDate?: string;
  startWeight: number | null;
  currentWeight: number | null;
  goalWeight?: number | null;
  previousWeight?: number | null;
  recentLogs?: WeightLog[];
  totalChangeKg: number | null;
  weeklyPace: number | null;
  projectedDate: string | null;
  hasEnoughTrend: boolean;
  onOpenHistory?: () => void;
  onOpenPhotos?: () => void;
  onClose: () => void;
  onSave: (weightKg: number, notes?: string, date?: string) => Promise<unknown>;
}

const LB_PER_KG = 2.20462;
const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG * 10) / 10;
const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 10) / 10;

function formatLogDayLabel(dateStr: string): string {
  try {
    const dt = new Date(`${dateStr}T12:00:00Z`);
    if (Number.isNaN(dt.getTime())) return dateStr;
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

export function WeightEntryModal({
  visible,
  initialEntry,
  defaultDate,
  startWeight,
  currentWeight,
  goalWeight,
  previousWeight,
  recentLogs = [],
  totalChangeKg,
  weeklyPace,
  projectedDate,
  hasEnoughTrend,
  onOpenHistory,
  onOpenPhotos,
  onClose,
  onSave,
}: WeightEntryModalProps) {
  const insets = useSafeAreaInsets();
  const { localDate: today } = useCurrentLocalDate();
  const reduceMotion = useReducedMotion();

  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [weightText, setWeightText] = useState('');
  const [dateText, setDateText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [showDateNotes, setShowDateNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const openedEntry = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      openedEntry.current = null;
      return;
    }
    const entryKey = initialEntry?.id ?? 'new';
    if (openedEntry.current === entryKey && dirtyRef.current) return;
    openedEntry.current = entryKey;
    dirtyRef.current = false;
    if (initialEntry) {
      setWeightText(String(initialEntry.weight_kg));
      setDateText(initialEntry.local_date);
      setNotesText(initialEntry.notes ?? '');
    } else {
      setWeightText(currentWeight != null ? String(currentWeight) : '73.5');
      setDateText(defaultDate ?? today);
      setNotesText('');
    }
    setError(null);
    setUnit('kg');
    setShowDateNotes(false);
  }, [initialEntry, defaultDate, currentWeight, visible, today]);

  const handleUnitToggle = (newUnit: 'kg' | 'lb') => {
    if (newUnit === unit) return;
    dirtyRef.current = true;
    const parsed = parseFloat(weightText.trim());
    if (!isNaN(parsed) && parsed > 0) {
      setWeightText(String(newUnit === 'lb' ? kgToLb(parsed) : lbToKg(parsed)));
    }
    setUnit(newUnit);
  };

  const handleSubmit = async () => {
    if (savingRef.current) return;
    const rawVal = parseFloat(weightText.trim());
    if (!Number.isFinite(rawVal)) {
      setError(t('trackers.weight.invalidWeight'));
      return;
    }

    const weightKg = unit === 'lb' ? lbToKg(rawVal) : rawVal;
    if (weightKg < 20 || weightKg > 500) {
      setError(t('trackers.weight.invalidWeight'));
      return;
    }

    const trimmedDate = dateText.trim();
    if (!isValidWeightDate(trimmedDate, today)) {
      setError(t('trackers.weight.invalidDate'));
      return;
    }

    try {
      savingRef.current = true;
      setSaving(true);
      setError(null);
      await onSave(weightKg, notesText.trim() || undefined, trimmedDate);
      onClose();
    } catch {
      setError(t('weightUpdate.saveError'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!visible) return null;

  const isEditing = Boolean(initialEntry);
  const parsedCurrentInput = parseFloat(weightText.trim());
  const normalizedInputKg = !isNaN(parsedCurrentInput)
    ? unit === 'lb'
      ? lbToKg(parsedCurrentInput)
      : parsedCurrentInput
    : null;

  const comparisonWeight = isEditing ? previousWeight : currentWeight;
  let deltaValueText: string | null = null;
  let plainWordsSuffix: string | null = null;
  if (normalizedInputKg !== null && comparisonWeight != null) {
    const diffKg = Math.round((normalizedInputKg - comparisonWeight) * 10) / 10;
    const diffUnit = unit === 'lb' ? Math.round(diffKg * LB_PER_KG * 10) / 10 : diffKg;
    if (Math.abs(diffKg) < 0.05) {
      deltaValueText = null;
      plainWordsSuffix = t('trackers.weight.changeSinceLastSame');
    } else {
      deltaValueText = `${diffUnit > 0 ? '+' : ''}${diffUnit.toFixed(1)} ${unit}`;
      plainWordsSuffix = ' since last weigh-in';
    }
  }

  const rulerValue = Number.isFinite(parsedCurrentInput)
    ? parsedCurrentInput
    : unit === 'lb'
      ? 162
      : 73.5;

  const startDisp =
    startWeight != null ? (unit === 'lb' ? kgToLb(startWeight) : startWeight).toFixed(1) : '—';
  const goalDisp =
    goalWeight != null ? (unit === 'lb' ? kgToLb(goalWeight) : goalWeight).toFixed(1) : '—';

  const progressRatio =
    startWeight != null && goalWeight != null && currentWeight != null && startWeight !== goalWeight
      ? Math.max(
          0.04,
          Math.min(1, Math.abs(currentWeight - startWeight) / Math.abs(goalWeight - startWeight)),
        )
      : totalChangeKg !== null
        ? 0.25
        : 0;

  const remainingGoalKg =
    goalWeight != null && (normalizedInputKg ?? currentWeight) != null
      ? Math.round(Math.abs(goalWeight - (normalizedInputKg ?? currentWeight)!) * 10) / 10
      : null;

  const displayHistory = recentLogs.slice(0, 2);

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
      testID="modal-weight-entry"
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + layout.topContentOffset,
            paddingBottom: Math.max(layout.ctaBottomMin, insets.bottom + space.sm),
          },
        ]}
      >
        {/* Top Bar: < | Log weight | History */}
        <View style={styles.topNav}>
          <IconButton
            icon={<ChevronLeftIcon size={20} color={colors.textHi} />}
            onPress={onClose}
            accessibilityLabel={t('common.back')}
            testID="btn-weight-cancel"
          />
          <Text variant="rowTitle" color="textHi">
            {isEditing ? t('trackers.weight.editModalTitle') : t('weightV1.title')}
          </Text>
          {onOpenHistory ? (
            <LinkButton
              title={t('weightV1.history')}
              variant="default"
              onPress={onOpenHistory}
              testID="btn-weight-progress"
            />
          ) : (
            <View style={styles.navSpacer} />
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Controls Row: Today Pill | kg / lb */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => setShowDateNotes((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.dateLabel')}
              style={styles.datePill}
            >
              <HistoryClockIcon size={15} color={colors.textLo} />
              <Text variant="meta" color="textHi" tabular>
                {dateText === today ? t('weightV1.todayLabel') : dateText}
              </Text>
            </Pressable>

            <View testID="weight-unit-chips">
              <Segmented
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'lb', label: 'lb' },
                ]}
                value={unit}
                onChange={(val) => handleUnitToggle(val as 'kg' | 'lb')}
                compact
                testID="btn-weight-unit-segmented"
              />
            </View>
          </View>

          {/* Compact Date & Notes inputs always accessible for editing & tests */}
          <View style={[styles.dateNotesRow, !showDateNotes ? styles.compactDateBar : null]}>
            <TextInput
              testID="input-weight-date"
              value={dateText}
              onChangeText={(text) => {
                dirtyRef.current = true;
                setDateText(text);
                if (error) setError(null);
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLo}
              accessibilityLabel={t('trackers.weight.dateLabel')}
              style={styles.dateTextInput}
            />
            {showDateNotes ? (
              <TextInput
                testID="input-weight-notes"
                value={notesText}
                onChangeText={(text) => {
                  dirtyRef.current = true;
                  setNotesText(text);
                }}
                placeholder={t('trackers.weight.notesPlaceholder')}
                placeholderTextColor={colors.textLo}
                accessibilityLabel={t('trackers.weight.notesLabel')}
                style={styles.notesInput}
              />
            ) : null}
          </View>

          {/* Hero Numeric Input + Delta Pill */}
          <View style={styles.heroDisplayBlock} testID="big-numeric-field-card">
            <View style={styles.heroWeightRow}>
              <TextInput
                testID="input-weight-value"
                value={weightText}
                onChangeText={(text) => {
                  dirtyRef.current = true;
                  setWeightText(text);
                  if (error) setError(null);
                }}
                keyboardType="decimal-pad"
                placeholder={unit === 'lb' ? '162.0' : '73.5'}
                placeholderTextColor={colors.textLo}
                style={styles.heroNumericInput}
                accessibilityLabel={t('trackers.weight.weightLabel')}
              />
              <Text variant="bodyL" color="textLo" style={styles.heroUnit}>
                {unit}
              </Text>
            </View>

            {plainWordsSuffix ? (
              <View style={styles.deltaPill} testID="plain-words-change">
                {deltaValueText ? (
                  <Text variant="label" tabular color="apricot">
                    {deltaValueText}
                  </Text>
                ) : null}
                <Text variant="meta" color="textMid">
                  {plainWordsSuffix}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Horizontal Weight Ruler */}
          <View style={styles.rulerWrap}>
            <RulerPicker
              min={unit === 'kg' ? 30 : 66}
              max={unit === 'kg' ? 250 : 550}
              step={0.5}
              majorStep={5}
              midStep={1}
              value={rulerValue}
              unit={unit}
              onChange={(val) => {
                dirtyRef.current = true;
                setWeightText(val.toFixed(1));
                if (error) setError(null);
              }}
              accessibilityLabel={t('trackers.weight.weightLabel')}
              testID="weight-ruler-picker"
            />
          </View>

          {/* Weight Progress & Recent Check-ins Card */}
          <View style={styles.progressCard} testID="weight-sheet-trend-summary">
            <View style={styles.cardHeaderRow}>
              <Text variant="rowTitle" color="textHi">
                {t('weightV1.weightProgress')}
              </Text>
              {onOpenHistory ? (
                <LinkButton
                  title={t('weightV1.seeAllWeeks')}
                  variant="accent"
                  onPress={onOpenHistory}
                />
              ) : null}
            </View>

            <View style={styles.progressGoalsRow}>
              <Text variant="meta" color="textLo" tabular>
                {t('weightV1.startLabel', { val: startDisp })}
              </Text>
              <Text variant="meta" color="textLo" tabular>
                {t('weightV1.goalLabel', { val: goalDisp })}
              </Text>
            </View>

            <ProgressBar progress={progressRatio} />

            <Text variant="meta" color="textLo" tabular>
              {totalChangeKg !== null
                ? `${totalChangeKg > 0 ? '+' : ''}${totalChangeKg.toFixed(1)} kg so far${
                    remainingGoalKg !== null ? ` · ${remainingGoalKg.toFixed(1)} kg to go` : ''
                  }`
                : hasEnoughTrend && weeklyPace !== null
                  ? t('trackers.weight.weeklyPace', { pace: weeklyPace.toFixed(2) })
                  : projectedDate
                    ? t('trackers.weight.projectedDate', { date: projectedDate })
                    : t('trackers.weight.notEnoughTrend')}
            </Text>

            {displayHistory.length > 0 ? (
              <View style={styles.checkInsWrap}>
                <Text variant="eyebrow" color="textLo">
                  {t('weightV1.checkInsEyebrow')}
                </Text>
                {displayHistory.map((item, idx) => {
                  const prevItem = recentLogs[idx + 1];
                  const delta =
                    prevItem != null
                      ? Math.round((item.weight_kg - prevItem.weight_kg) * 10) / 10
                      : null;
                  const dispWeight = unit === 'lb' ? kgToLb(item.weight_kg) : item.weight_kg;
                  return (
                    <View key={item.id} style={styles.checkInRow}>
                      <Text variant="label" color="textHi" style={styles.checkInDate}>
                        {formatLogDayLabel(item.local_date)}
                      </Text>
                      <Text variant="label" tabular color="textHi">
                        {`${dispWeight.toFixed(1)} ${unit}`}
                      </Text>
                      {delta !== null ? (
                        <Text variant="label" tabular color="apricot" style={styles.checkInDelta}>
                          {`${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* Add a Progress Photo Row Card */}
          <Pressable
            onPress={() => onOpenPhotos?.()}
            disabled={!onOpenPhotos}
            accessibilityRole="button"
            accessibilityLabel={t('weightV1.addProgressPhoto')}
            style={({ pressed }) => [styles.photoCard, pressed ? styles.photoCardPressed : null]}
            testID="weight-add-progress-photo"
          >
            <View style={styles.photoIconTile}>
              <CameraIcon size={18} color={colors.textMid} />
            </View>
            <View style={styles.photoCopy}>
              <Text variant="rowTitle" color="textHi">
                {t('weightV1.addProgressPhoto')}
              </Text>
              <Text variant="meta" color="textLo">
                {t('weightV1.compareBeforeAfter')}
              </Text>
            </View>
            <Badge variant="pro" label="PRO" mini />
          </Pressable>

          {error ? (
            <Text
              variant="meta"
              color="danger"
              accessibilityRole="alert"
              testID="weight-entry-error"
              style={styles.errorText}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.ctaFooter}>
          <PrimaryButton
            title={saving ? t('common.saving') : t('weightV1.saveWeighIn')}
            showArrow
            disabled={saving}
            loading={saving}
            onPress={() => void handleSubmit()}
            testID="btn-weight-save"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg0,
    paddingHorizontal: layout.screenPaddingX,
  },
  topNav: {
    height: layout.navRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  navSpacer: {
    width: 44,
  },
  scrollContent: {
    gap: space.lg,
    paddingBottom: space.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    minHeight: 36,
  },
  dateNotesRow: {
    gap: space.sm,
  },
  compactDateBar: {
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  dateTextInput: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    minHeight: 42,
    color: colors.textHi,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    minHeight: 42,
    color: colors.textHi,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  heroDisplayBlock: {
    alignItems: 'center',
    gap: space.sm,
  },
  heroWeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  heroNumericInput: {
    fontFamily: fonts.display,
    fontSize: 68,
    lineHeight: 74,
    letterSpacing: -2.4,
    color: colors.textHi,
    textAlign: 'center',
    minWidth: 132,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    marginLeft: space.xs,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  rulerWrap: {
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: space.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressGoalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInsWrap: {
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: borders.width,
    borderTopColor: colors.s2,
    gap: space.xs,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  checkInDate: {
    flex: 1,
  },
  checkInDelta: {
    minWidth: 48,
    textAlign: 'right',
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: layout.cardPadding,
  },
  photoCardPressed: {
    backgroundColor: colors.s2,
  },
  photoIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCopy: {
    flex: 1,
    gap: 2,
  },
  errorText: {
    textAlign: 'center',
  },
  ctaFooter: {
    paddingTop: space.sm,
  },
});
