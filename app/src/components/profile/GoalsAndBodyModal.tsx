import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calculateAge,
  calculateTargets,
  getWeeklyRateCap,
  kgToLb,
  lbToKg,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@calipartner/core';
import {
  ChevronLeftIcon,
  PrimaryButton,
  Segmented,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { TrackSlider } from './TrackSlider';

export interface GoalsAndBodyModalProps {
  visible: boolean;
  onClose: () => void;
  currentGoal?: 'cut' | 'maintain' | 'bulk';
  currentRate?: number;
  currentHeightCm?: number;
  currentWeightKg?: number;
  currentTargetWeightKg?: number;
  currentDateOfBirth?: string;
  currentActivityLevel?: ActivityLevel;
  currentSex?: 'male' | 'female' | 'other';
  units?: 'metric' | 'imperial';
  onSave?: (data: {
    goal: 'cut' | 'bulk';
    rate: number;
    heightCm: number;
    weightKg: number;
    targetWeightKg?: number | null;
    sex: Sex;
    dateOfBirth?: string;
  }) => Promise<void> | void;
  testID?: string;
}

function formatReadableDob(isoDob: string): string {
  const d = new Date(`${isoDob}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDob;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function formatProjectedShortDate(weeksRemaining: number): string {
  const days = Math.max(7, Math.round(weeksRemaining * 7));
  const future = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(future);
}

function roundOne(val: number): string {
  return String(Math.round(val * 10) / 10);
}

export function GoalsAndBodyModal({
  visible,
  onClose,
  currentGoal = 'cut',
  currentRate = 0.5,
  currentHeightCm = 175,
  currentWeightKg = 72,
  currentTargetWeightKg,
  currentDateOfBirth = '1999-03-12',
  currentActivityLevel = 'light',
  currentSex = 'male',
  units = 'metric',
  onSave,
  testID = 'modal-goals-and-body',
}: GoalsAndBodyModalProps) {
  const insets = useSafeAreaInsets();
  const isImperial = units === 'imperial';

  const [goal, setGoal] = useState<'cut' | 'bulk'>(currentGoal === 'bulk' ? 'bulk' : 'cut');
  const [rateKg, setRateKg] = useState<number>(currentRate > 0 ? currentRate : 0.5);
  const [weightDisplay, setWeightDisplay] = useState<string>(
    roundOne(isImperial ? kgToLb(currentWeightKg) : currentWeightKg),
  );
  const [targetDisplay, setTargetDisplay] = useState<string>(
    currentTargetWeightKg != null
      ? roundOne(isImperial ? kgToLb(currentTargetWeightKg) : currentTargetWeightKg)
      : roundOne(
          isImperial
            ? kgToLb(Math.max(40, currentWeightKg - 5))
            : Math.max(40, currentWeightKg - 5),
        ),
  );
  const [heightCmStr, setHeightCmStr] = useState<string>(String(Math.round(currentHeightCm)));
  const [sex, setSex] = useState<Sex>(currentSex);
  const [dobStr, setDobStr] = useState<string>(currentDateOfBirth || '1999-03-12');
  const [editingDob, setEditingDob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setGoal(currentGoal === 'bulk' ? 'bulk' : 'cut');
      setRateKg(currentRate > 0 ? currentRate : 0.5);
      setWeightDisplay(roundOne(isImperial ? kgToLb(currentWeightKg) : currentWeightKg));
      const defaultTarget =
        currentTargetWeightKg ??
        (currentGoal === 'bulk' ? currentWeightKg + 4 : Math.max(40, currentWeightKg - 5));
      setTargetDisplay(roundOne(isImperial ? kgToLb(defaultTarget) : defaultTarget));
      setHeightCmStr(String(Math.round(currentHeightCm)));
      setSex(currentSex);
      setDobStr(currentDateOfBirth || '1999-03-12');
      setEditingDob(false);
      setSaveError(null);
    }
  }, [
    visible,
    currentGoal,
    currentRate,
    currentWeightKg,
    currentTargetWeightKg,
    currentHeightCm,
    currentSex,
    currentDateOfBirth,
    isImperial,
  ]);

  const weightKg = useMemo(() => {
    const num = parseFloat(weightDisplay);
    if (!Number.isFinite(num) || num <= 0) return currentWeightKg;
    return Math.max(30, Math.min(350, isImperial ? lbToKg(num) : num));
  }, [weightDisplay, isImperial, currentWeightKg]);

  const targetWeightKg = useMemo(() => {
    const num = parseFloat(targetDisplay);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.max(30, Math.min(350, isImperial ? lbToKg(num) : num));
  }, [targetDisplay, isImperial]);

  const heightCm = useMemo(() => {
    const num = parseFloat(heightCmStr);
    if (!Number.isFinite(num) || num < 100 || num > 250) return currentHeightCm;
    return Math.round(num);
  }, [heightCmStr, currentHeightCm]);

  const ageYears = useMemo(() => {
    try {
      return calculateAge(dobStr);
    } catch {
      return 27;
    }
  }, [dobStr]);

  const maxPaceKg = useMemo(() => {
    const cap = getWeeklyRateCap(weightKg, goal);
    return goal === 'cut' ? Math.min(1.0, Math.max(0.4, cap)) : Math.min(0.75, Math.max(0.4, cap));
  }, [weightKg, goal]);

  const safeRateKg = Math.max(0.1, Math.min(maxPaceKg, rateKg));

  const previewResult = useMemo(() => {
    try {
      return calculateTargets({
        sex,
        age: ageYears,
        heightCm,
        weightKg,
        activityLevel: currentActivityLevel,
        goal: goal as Goal,
        weeklyRateKg: safeRateKg,
      });
    } catch {
      return null;
    }
  }, [sex, ageYears, heightCm, weightKg, currentActivityLevel, goal, safeRateKg]);

  const projectionLine = useMemo(() => {
    if (!previewResult) return '';
    const kcal = Math.round(previewResult.targetKcal).toLocaleString('en-US');
    if (
      targetWeightKg != null &&
      safeRateKg > 0 &&
      ((goal === 'cut' && targetWeightKg < weightKg) ||
        (goal === 'bulk' && targetWeightKg > weightKg))
    ) {
      const weeks = Math.abs(weightKg - targetWeightKg) / safeRateKg;
      const targetOut = isImperial
        ? Math.round(kgToLb(targetWeightKg))
        : Math.round(targetWeightKg);
      const unitLabel = isImperial ? 'lb' : 'kg';
      return t('settingsV1.goalsPreviewReach', {
        kcal,
        target: targetOut,
        unit: unitLabel,
        date: formatProjectedShortDate(weeks),
      });
    }
    return t('settingsV1.goalsPreviewKcal', { kcal });
  }, [previewResult, targetWeightKg, safeRateKg, goal, weightKg, isImperial]);

  const paceLabel =
    safeRateKg <= maxPaceKg * 0.38 ? 'gentle' : safeRateKg >= maxPaceKg * 0.72 ? 'fast' : 'steady';

  const paceDisplayValue = isImperial
    ? Math.round(kgToLb(safeRateKg) * 10) / 10
    : Math.round(safeRateKg * 10) / 10;
  const pacePrefix = goal === 'cut' ? '-' : '+';
  const weightUnit = isImperial ? 'lb' : 'kg';

  const handleSave = async () => {
    if (saving) return;
    playClickSound();
    setSaveError(null);
    const parsedW = parseFloat(weightDisplay);
    const parsedH = parseFloat(heightCmStr);
    if (!Number.isFinite(parsedW) || parsedW <= 0 || !Number.isFinite(parsedH) || parsedH < 100) {
      setSaveError(t('setup.detailsError'));
      return;
    }
    setSaving(true);
    try {
      if (onSave) {
        await onSave({
          goal,
          rate: Math.round(safeRateKg * 100) / 100,
          heightCm: Math.round(parsedH),
          weightKg: Math.round(weightKg * 10) / 10,
          targetWeightKg: targetWeightKg != null ? Math.round(targetWeightKg * 10) / 10 : null,
          sex,
          dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dobStr.trim()) ? dobStr.trim() : undefined,
        });
      }
      onClose();
    } catch {
      setSaveError(t('setup.detailsError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root} testID={testID}>
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={onClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.back')}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
            testID="btn-close-goals-body"
          >
            <ChevronLeftIcon size={18} color={colors.textHi} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('settingsV1.goalsTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: space.xl }]}
        >
          <View style={styles.innerWrap}>
            {/* GOAL */}
            <View style={styles.fieldGroup}>
              <Text variant="eyebrow" color="textLo" style={styles.eyebrow}>
                {t('settingsV1.goalsEyebrow')}
              </Text>
              <Segmented
                options={[
                  { value: 'cut', label: t('settingsV1.goalsLoseFat'), testID: 'goal-cut-tab' },
                  {
                    value: 'bulk',
                    label: t('settingsV1.goalsBuildMuscle'),
                    testID: 'goal-bulk-tab',
                  },
                ]}
                value={goal}
                onChange={(v) => setGoal(v as 'cut' | 'bulk')}
                testID="segment-goal-type"
              />
            </View>

            {/* Current weight + Target weight */}
            <View style={styles.twoColRow}>
              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.inputLabel}>
                  {t('settingsV1.goalsCurrentWeight')}
                </Text>
                <View style={styles.fieldBox}>
                  <TextInput
                    value={weightDisplay}
                    onChangeText={setWeightDisplay}
                    keyboardType="decimal-pad"
                    style={styles.numTextInput}
                    placeholder="73.5"
                    placeholderTextColor={colors.textOff}
                    testID="input-weight-kg"
                    accessibilityLabel={t('settingsV1.goalsCurrentWeight')}
                  />
                  <Text variant="meta" color="textLo">
                    {weightUnit}
                  </Text>
                </View>
              </View>

              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.inputLabel}>
                  {t('settingsV1.goalsTargetWeight')}
                </Text>
                <View style={styles.fieldBox}>
                  <TextInput
                    value={targetDisplay}
                    onChangeText={setTargetDisplay}
                    keyboardType="decimal-pad"
                    style={styles.numTextInput}
                    placeholder="68.0"
                    placeholderTextColor={colors.textOff}
                    testID="input-target-weight"
                    accessibilityLabel={t('settingsV1.goalsTargetWeight')}
                  />
                  <Text variant="meta" color="textLo">
                    {weightUnit}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly pace slider card */}
            <View style={styles.paceCard}>
              <View style={styles.paceTopRow}>
                <Text variant="label" color="textHi" style={styles.paceTitle}>
                  {t('settingsV1.goalsWeeklyPace')}
                </Text>
                <Text variant="numS" color="textHi" tabular testID="weekly-pace-display">
                  {`${pacePrefix}${paceDisplayValue} ${weightUnit}`}
                </Text>
              </View>

              <TrackSlider
                value={safeRateKg}
                min={0.1}
                max={maxPaceKg}
                step={0.05}
                onChange={setRateKg}
                accessibilityLabel={t('settingsV1.goalsWeeklyPace')}
                testID="slider-weekly-pace"
              />

              <View style={styles.paceLabelsRow}>
                <Text
                  variant="micro"
                  color={paceLabel === 'gentle' ? 'textHi' : 'textLo'}
                  style={paceLabel === 'gentle' ? styles.activePaceLabel : undefined}
                >
                  {t('settingsV1.goalsGentle')}
                </Text>
                <Text
                  variant="micro"
                  color={paceLabel === 'steady' ? 'textHi' : 'textLo'}
                  style={paceLabel === 'steady' ? styles.activePaceLabel : undefined}
                >
                  {t('settingsV1.goalsSteady')}
                </Text>
                <Text
                  variant="micro"
                  color={paceLabel === 'fast' ? 'textHi' : 'textLo'}
                  style={paceLabel === 'fast' ? styles.activePaceLabel : undefined}
                >
                  {t('settingsV1.goalsFast')}
                </Text>
              </View>

              {projectionLine ? (
                <Text variant="meta" color="textLo" tabular>
                  {projectionLine}
                </Text>
              ) : null}
            </View>

            {/* Height + Sex */}
            <View style={styles.twoColRow}>
              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.inputLabel}>
                  {t('settingsV1.goalsHeight')}
                </Text>
                <View style={styles.fieldBox}>
                  <TextInput
                    value={heightCmStr}
                    onChangeText={setHeightCmStr}
                    keyboardType="numeric"
                    style={styles.numTextInput}
                    placeholder="178"
                    placeholderTextColor={colors.textOff}
                    testID="input-height"
                    accessibilityLabel={t('settingsV1.goalsHeight')}
                  />
                  <Text variant="meta" color="textLo">
                    cm
                  </Text>
                </View>
              </View>

              <View style={styles.colItem}>
                <Text variant="meta" color="textLo" style={styles.inputLabel}>
                  {t('settingsV1.goalsSex')}
                </Text>
                <Segmented
                  options={[
                    { value: 'female', label: t('settingsV1.goalsFemale'), testID: 'sex-female' },
                    { value: 'male', label: t('settingsV1.goalsMale'), testID: 'sex-male' },
                  ]}
                  value={sex === 'female' ? 'female' : 'male'}
                  onChange={(v) => setSex(v as Sex)}
                  testID="segment-biological-sex"
                />
              </View>
            </View>

            {/* Birthday */}
            <View style={styles.fieldGroup}>
              <Text variant="meta" color="textLo" style={styles.inputLabel}>
                {t('settingsV1.goalsBirthday')}
              </Text>
              <Pressable
                onPress={() => setEditingDob((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`${t('settingsV1.goalsBirthday')}: ${formatReadableDob(dobStr)}`}
                style={styles.birthdayCard}
                testID="btn-edit-birthday"
              >
                {editingDob ? (
                  <TextInput
                    value={dobStr}
                    onChangeText={setDobStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textOff}
                    style={styles.dobInput}
                    autoFocus
                    onBlur={() => setEditingDob(false)}
                    testID="input-birthday"
                  />
                ) : (
                  <Text variant="label" color="textHi" style={styles.dobDisplay}>
                    {formatReadableDob(dobStr)}
                  </Text>
                )}
                <Text variant="meta" color="textLo" tabular>
                  {t('settingsV1.goalsYearsShort', { years: ageYears })}
                </Text>
              </Pressable>
            </View>

            <Text variant="micro" color="textLo" style={styles.historyNote}>
              {t('settingsV1.goalsHistoryNote')}
            </Text>

            {saveError ? (
              <Text variant="meta" color="danger" accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(space.lg, insets.bottom + space.md) },
          ]}
        >
          <View style={styles.innerWrap}>
            <PrimaryButton
              title={saving ? t('common.saving') : t('settingsV1.goalsSave')}
              loading={saving}
              disabled={saving}
              onPress={() => void handleSave()}
              testID="btn-save-goals-body"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  fieldGroup: {
    gap: space.xs + 2,
  },
  eyebrow: {
    paddingHorizontal: 2,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  colItem: {
    flex: 1,
    gap: space.xs + 1,
  },
  inputLabel: {
    paddingHorizontal: 2,
  },
  fieldBox: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  numTextInput: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textHi,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  paceCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  paceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paceTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  paceLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activePaceLabel: {
    fontFamily: fonts.bold,
  },
  birthdayCard: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dobDisplay: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  dobInput: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textHi,
    paddingVertical: 0,
  },
  historyNote: {
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    backgroundColor: colors.bg0,
  },
});
