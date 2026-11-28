import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { GoalProfile, Sex } from '@calipartner/core';
import { applyOnboardingTargetOverrides, macroRecommendation } from '@calipartner/core';
import {
  Badge,
  CheckIcon,
  ChevronLeftIcon,
  LinkButton,
  PrimaryButton,
  Switch,
  Text,
  borders,
  colors,
  fonts,
  layout,
  macroColors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { LoadingState } from '@/components/LoadingState';
import { useSubscription } from '@/hooks/useSubscription';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { macroErrorMessage } from '@/i18n/macroErrors';
import { TrackSlider } from './TrackSlider';

export interface CustomMacrosModalProps {
  goal: GoalProfile;
  sex: Sex;
  onClose: () => void;
}

function computePctShares(proteinG: number, carbsG: number, fatG: number) {
  const pKcal = Math.max(0, proteinG) * 4;
  const cKcal = Math.max(0, carbsG) * 4;
  const fKcal = Math.max(0, fatG) * 9;
  const sumKcal = pKcal + cKcal + fKcal;
  if (sumKcal <= 0) return { pPct: 30, cPct: 45, fPct: 25 };
  const pPct = Math.round((pKcal / sumKcal) * 100);
  const fPct = Math.round((fKcal / sumKcal) * 100);
  const cPct = Math.max(0, 100 - pPct - fPct);
  return { pPct, cPct, fPct };
}

export function CustomMacrosModal({ goal, sex, onClose }: CustomMacrosModalProps) {
  const insets = useSafeAreaInsets();
  const { updateCustomMacros } = useTargets();
  const subscription = useSubscription();
  const lock = useRef(false);

  const baseline = useMemo(() => macroRecommendation(goal, sex), [goal, sex]);
  const [protein, setProtein] = useState<number>(Math.round(goal.protein_grams));
  const [carbs, setCarbs] = useState<number>(Math.round(goal.carb_grams));
  const [fat, setFat] = useState<number>(Math.round(goal.fat_grams));
  const [calories, setCalories] = useState<number>(Math.round(goal.daily_calorie_target));
  const [lockInGrams, setLockInGrams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setProtein(Math.round(goal.protein_grams));
    setCarbs(Math.round(goal.carb_grams));
    setFat(Math.round(goal.fat_grams));
    setCalories(Math.round(goal.daily_calorie_target));
  }, [goal.protein_grams, goal.carb_grams, goal.fat_grams, goal.daily_calorie_target]);

  const allowed = subscription.hasPlan && ['plus', 'pro'].includes(subscription.currentTier);

  const { pPct, cPct, fPct } = computePctShares(protein, carbs, fat);
  const totalPct = pPct + cPct + fPct;

  let preview: GoalProfile | null = null;
  let validationError: string | null = null;
  try {
    preview = applyOnboardingTargetOverrides(goal, sex, {
      calories,
      protein,
      carbs,
      fat,
      steps: goal.step_goal ?? 10000,
      water: goal.water_ml_goal ?? 2500,
    });
  } catch (err) {
    validationError = macroErrorMessage(err);
  }

  const updateByMacro = (target: 'protein' | 'carbs' | 'fat', nextGrams: number) => {
    const cleanG = Math.max(0, Math.round(nextGrams));
    if (lockInGrams) {
      const nextP = target === 'protein' ? cleanG : protein;
      const nextC = target === 'carbs' ? cleanG : carbs;
      const nextF = target === 'fat' ? cleanG : fat;
      setProtein(nextP);
      setCarbs(nextC);
      setFat(nextF);
      setCalories(Math.round(nextP * 4 + nextC * 4 + nextF * 9));
      return;
    }

    const activeCal = Math.max(800, calories);
    if (target === 'protein') {
      const remaining = Math.max(0, activeCal - cleanG * 4);
      const oldOther = Math.max(1, carbs * 4 + fat * 9);
      const nextF = Math.max(0, Math.round((remaining * ((fat * 9) / oldOther)) / 9));
      const nextC = Math.max(0, Math.round((remaining - nextF * 9) / 4));
      setProtein(cleanG);
      setFat(nextF);
      setCarbs(nextC);
    } else if (target === 'carbs') {
      const remaining = Math.max(0, activeCal - cleanG * 4);
      const oldOther = Math.max(1, protein * 4 + fat * 9);
      const nextP = Math.max(0, Math.round((remaining * ((protein * 4) / oldOther)) / 4));
      const nextF = Math.max(0, Math.round((remaining - nextP * 4) / 9));
      setCarbs(cleanG);
      setProtein(nextP);
      setFat(nextF);
    } else {
      const remaining = Math.max(0, activeCal - cleanG * 9);
      const oldOther = Math.max(1, protein * 4 + carbs * 4);
      const nextP = Math.max(0, Math.round((remaining * ((protein * 4) / oldOther)) / 4));
      const nextC = Math.max(0, Math.round((remaining - nextP * 4) / 4));
      setFat(cleanG);
      setProtein(nextP);
      setCarbs(nextC);
    }
  };

  const handleReset = () => {
    setCalories(baseline.calories);
    setProtein(baseline.protein);
    setCarbs(baseline.carbs);
    setFat(baseline.fat);
    setSaveError(false);
  };

  const handleSave = async () => {
    if (!allowed || !preview || lock.current) return;
    lock.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const result = await updateCustomMacros(
        {
          calories: preview.daily_calorie_target,
          protein: preview.protein_grams,
          carbs: preview.carb_grams,
          fat: preview.fat_grams,
        },
        sex,
      );
      if (result.success) onClose();
    } catch {
      setSaveError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const ringSize = 104;
  const strokeWidth = 10;
  const r = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pLen = (pPct / 100) * circumference;
  const cLen = (cPct / 100) * circumference;
  const fLen = Math.max(0, circumference - pLen - cLen);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <View style={styles.root} testID="custom-macros-modal">
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={() => {
              if (!saving) onClose();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('squadDesign.back')}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
            testID="custom-macros-keep"
          >
            <ChevronLeftIcon size={18} color={colors.textHi} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('settingsV1.macrosTitle')}
          </Text>
          <Badge variant="pro" label={t('onboardingV1.paywallColPro')} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: space.xl }]}
        >
          <View style={styles.innerWrap}>
            {subscription.loading ? (
              <LoadingState />
            ) : subscription.error ? (
              <View style={styles.errorCard}>
                <Text variant="meta" color="danger" accessibilityRole="alert">
                  {t('common.errorBody')}
                </Text>
                <PrimaryButton
                  title={t('setup.retry')}
                  onPress={() => void subscription.refresh()}
                  compact
                  testID="custom-macros-retry"
                />
              </View>
            ) : !allowed ? (
              <View style={styles.errorCard}>
                <Text variant="body" color="textMid">
                  {t('customMacros.locked')}
                </Text>
              </View>
            ) : (
              <>
                {/* Top Donut Summary Card */}
                <View style={styles.donutCard}>
                  <View style={styles.ringWrap}>
                    <Svg width={ringSize} height={ringSize}>
                      <Circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        stroke={colors.s3}
                        strokeWidth={strokeWidth}
                        fill="none"
                      />
                      <Circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        stroke={macroColors.protein}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={`${pLen} ${circumference}`}
                        transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                      />
                      <Circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        stroke={macroColors.carbs}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={`${cLen} ${circumference}`}
                        transform={`rotate(${-90 + (pPct / 100) * 360} ${ringSize / 2} ${ringSize / 2})`}
                      />
                      <Circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        stroke={macroColors.fat}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={`${fLen} ${circumference}`}
                        transform={`rotate(${-90 + ((pPct + cPct) / 100) * 360} ${ringSize / 2} ${ringSize / 2})`}
                      />
                    </Svg>
                    <View style={styles.ringCenter} pointerEvents="none">
                      <Text variant="numS" color="textHi" tabular testID="custom-macros-preview">
                        {calories.toLocaleString('en-US')}
                      </Text>
                      <Text variant="micro" color="textLo">
                        kcal
                      </Text>
                    </View>
                  </View>

                  <View style={styles.donutMetaCol}>
                    <View style={styles.totalPctPill}>
                      <CheckIcon size={13} color={colors.textMid} />
                      <Text variant="meta" color="textHi" tabular>
                        {t('settingsV1.macrosTotalPct', { pct: totalPct })}
                      </Text>
                    </View>
                    <Text variant="meta" color="textLo" style={styles.sliderHint}>
                      {t('settingsV1.macrosSliderHint')}
                    </Text>
                  </View>
                </View>

                {/* Sliders Card */}
                <View style={styles.slidersCard}>
                  <View style={styles.sliderBlock}>
                    <View style={styles.sliderTopRow}>
                      <Text variant="label" color="textHi" style={styles.macroLabel}>
                        {t('homeV1.protein')}
                      </Text>
                      <Text variant="meta" color="textHi" tabular>
                        {`${protein} g · `}
                        <Text variant="meta" color="textLo" tabular>
                          {`${pPct}%`}
                        </Text>
                      </Text>
                    </View>
                    <TrackSlider
                      value={protein}
                      min={Math.max(20, baseline.protein - 50)}
                      max={baseline.protein + 50}
                      step={1}
                      fillColor={macroColors.protein}
                      onChange={(val) => updateByMacro('protein', val)}
                      accessibilityLabel={t('customMacros.protein')}
                      testID="custom-macros-protein"
                    />
                  </View>

                  <View style={styles.sliderBlock}>
                    <View style={styles.sliderTopRow}>
                      <Text variant="label" color="textHi" style={styles.macroLabel}>
                        {t('homeV1.carbs')}
                      </Text>
                      <Text variant="meta" color="textHi" tabular>
                        {`${carbs} g · `}
                        <Text variant="meta" color="textLo" tabular>
                          {`${cPct}%`}
                        </Text>
                      </Text>
                    </View>
                    <TrackSlider
                      value={carbs}
                      min={Math.max(20, baseline.carbs - 125)}
                      max={baseline.carbs + 125}
                      step={1}
                      fillColor={macroColors.carbs}
                      onChange={(val) => updateByMacro('carbs', val)}
                      accessibilityLabel={t('customMacros.carbs')}
                      testID="custom-macros-carbs"
                    />
                  </View>

                  <View style={styles.sliderBlock}>
                    <View style={styles.sliderTopRow}>
                      <Text variant="label" color="textHi" style={styles.macroLabel}>
                        {t('homeV1.fat')}
                      </Text>
                      <Text variant="meta" color="textHi" tabular>
                        {`${fat} g · `}
                        <Text variant="meta" color="textLo" tabular>
                          {`${fPct}%`}
                        </Text>
                      </Text>
                    </View>
                    <TrackSlider
                      value={fat}
                      min={Math.max(15, baseline.fat - 55)}
                      max={baseline.fat + 55}
                      step={1}
                      fillColor={macroColors.fat}
                      onChange={(val) => updateByMacro('fat', val)}
                      accessibilityLabel={t('customMacros.fat')}
                      testID="custom-macros-fat"
                    />
                  </View>
                </View>

                {/* Lock in grams toggle */}
                <View style={styles.lockCard}>
                  <View style={styles.lockTextCol}>
                    <Text variant="label" color="textHi" style={styles.macroLabel}>
                      {t('settingsV1.macrosLockTitle')}
                    </Text>
                    <Text variant="meta" color="textLo">
                      {t('settingsV1.macrosLockSub')}
                    </Text>
                  </View>
                  <Switch
                    value={lockInGrams}
                    onValueChange={setLockInGrams}
                    accessibilityLabel={t('settingsV1.macrosLockTitle')}
                    testID="switch-lock-macros-grams"
                  />
                </View>

                <LinkButton
                  title={t('settingsV1.macrosReset')}
                  onPress={handleReset}
                  testID="btn-reset-macros"
                  style={styles.resetLink}
                />

                {validationError ? (
                  <Text variant="meta" color="danger" accessibilityRole="alert">
                    {validationError}
                  </Text>
                ) : null}

                {saveError ? (
                  <Text variant="meta" color="danger" accessibilityRole="alert">
                    {t('customMacros.error')}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>

        {allowed ? (
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(space.lg, insets.bottom + space.md) },
            ]}
          >
            <View style={styles.innerWrap}>
              <PrimaryButton
                title={saving ? t('customMacros.saving') : t('settingsV1.macrosSave')}
                loading={saving}
                disabled={saving || !preview}
                onPress={() => void handleSave()}
                testID="custom-macros-override"
              />
            </View>
          </View>
        ) : null}
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
  errorCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  donutCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  ringWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutMetaCol: {
    flex: 1,
    gap: space.sm,
    alignItems: 'flex-start',
  },
  totalPctPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.chip,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  sliderHint: {
    lineHeight: 18,
  },
  slidersCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  sliderBlock: {
    gap: space.xs,
  },
  sliderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  lockCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  lockTextCol: {
    flex: 1,
    gap: 2,
  },
  resetLink: {
    alignSelf: 'center',
  },
  bottomBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    backgroundColor: colors.bg0,
  },
});
