import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeftIcon,
  Chip,
  LockIcon,
  MinusIcon,
  PlusIcon,
  PrimaryButton,
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

export interface DailyGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  currentStepGoal?: number;
  currentWaterGoalMl?: number;
  calorieTarget?: number | null;
  calorieFloor?: number;
  onSave?: (goals: { stepGoal: number; waterGoalMl: number }) => Promise<void> | void;
  testID?: string;
}

const STEP_PRESETS = [8000, 10000, 12000] as const;
const WATER_PRESETS = [2500, 3000, 3500] as const;

export function DailyGoalsModal({
  visible,
  onClose,
  currentStepGoal = 10000,
  currentWaterGoalMl = 3000,
  calorieTarget = 1900,
  calorieFloor = 1400,
  onSave,
  testID = 'modal-daily-goals',
}: DailyGoalsModalProps) {
  const insets = useSafeAreaInsets();
  const [stepGoal, setStepGoal] = useState<number>(currentStepGoal);
  const [waterGoalMl, setWaterGoalMl] = useState<number>(currentWaterGoalMl);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStepGoal(currentStepGoal);
      setWaterGoalMl(currentWaterGoalMl);
      setSaveError(null);
    }
  }, [visible, currentStepGoal, currentWaterGoalMl]);

  const handleSave = async () => {
    if (saving) return;
    playClickSound();
    setSaving(true);
    setSaveError(null);
    try {
      if (onSave) await onSave({ stepGoal, waterGoalMl });
      onClose();
    } catch {
      setSaveError(t('fixNovember.saveFailed'));
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
            testID="btn-close-daily-goals"
          >
            <ChevronLeftIcon size={18} color={colors.textHi} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('settingsV1.targetsTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: space.xl }]}
        >
          <View style={styles.innerWrap}>
            {/* Daily steps */}
            <View style={styles.card}>
              <View style={styles.metricHeaderRow}>
                <View style={styles.metricCopy}>
                  <Text variant="meta" color="textMid">
                    {t('settingsV1.targetsStepsLabel')}
                  </Text>
                  <View style={styles.numRow}>
                    <Text variant="numM" color="textHi" tabular testID="daily-steps-value">
                      {stepGoal.toLocaleString('en-US')}
                    </Text>
                    <Text variant="meta" color="textLo" style={styles.unitInline}>
                      {` ${t('me.dailyGoals.stepUnit')}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.stepperCluster}>
                  <Pressable
                    onPress={() => setStepGoal((v) => Math.max(1000, v - 500))}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease step goal"
                    style={({ pressed }) => [
                      styles.circleBtn,
                      pressed ? styles.circlePressed : null,
                    ]}
                    testID="btn-steps-minus"
                  >
                    <MinusIcon size={16} color={colors.textHi} />
                  </Pressable>
                  <Pressable
                    onPress={() => setStepGoal((v) => Math.min(50000, v + 500))}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Increase step goal"
                    style={({ pressed }) => [
                      styles.circleBtn,
                      pressed ? styles.circlePressed : null,
                    ]}
                    testID="btn-steps-plus"
                  >
                    <PlusIcon size={16} color={colors.textHi} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.presetsRow}>
                {STEP_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    label={preset.toLocaleString('en-US')}
                    selected={stepGoal === preset}
                    onPress={() => setStepGoal(preset)}
                    testID={`preset-steps-${preset}`}
                  />
                ))}
              </View>
            </View>

            {/* Daily water */}
            <View style={styles.card}>
              <View style={styles.metricHeaderRow}>
                <View style={styles.metricCopy}>
                  <Text variant="meta" color="textMid">
                    {t('settingsV1.targetsWaterLabel')}
                  </Text>
                  <View style={styles.numRow}>
                    <Text variant="numM" color="textHi" tabular testID="daily-water-value">
                      {waterGoalMl.toLocaleString('en-US')}
                    </Text>
                    <Text variant="meta" color="textLo" style={styles.unitInline}>
                      {` ${t('me.dailyGoals.waterUnit')}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.stepperCluster}>
                  <Pressable
                    onPress={() => setWaterGoalMl((v) => Math.max(500, v - 250))}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease water goal"
                    style={({ pressed }) => [
                      styles.circleBtn,
                      pressed ? styles.circlePressed : null,
                    ]}
                    testID="btn-water-minus"
                  >
                    <MinusIcon size={16} color={colors.textHi} />
                  </Pressable>
                  <Pressable
                    onPress={() => setWaterGoalMl((v) => Math.min(10000, v + 250))}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Increase water goal"
                    style={({ pressed }) => [
                      styles.circleBtn,
                      pressed ? styles.circlePressed : null,
                    ]}
                    testID="btn-water-plus"
                  >
                    <PlusIcon size={16} color={colors.textHi} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.presetsRow}>
                {WATER_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    label={preset.toLocaleString('en-US')}
                    selected={waterGoalMl === preset}
                    onPress={() => setWaterGoalMl(preset)}
                    testID={`preset-water-${preset}`}
                  />
                ))}
              </View>
            </View>

            {/* Locked Calorie Target */}
            <View style={styles.card}>
              <View style={styles.lockedHeader}>
                <Text variant="meta" color="textMid">
                  {t('settingsV1.targetsCalorieTitle')}
                </Text>
                <LockIcon size={15} color={colors.textLo} />
              </View>
              <View style={styles.numRow}>
                <Text variant="numM" color="textHi" tabular>
                  {calorieTarget != null ? Math.round(calorieTarget).toLocaleString('en-US') : '—'}
                </Text>
                <Text variant="meta" color="textLo" style={styles.unitInline}>
                  {' kcal'}
                </Text>
              </View>
              <Text variant="meta" color="textLo" style={styles.calorieHelp}>
                {t('settingsV1.targetsCalorieHelp', {
                  floor: Math.round(calorieFloor).toLocaleString('en-US'),
                })}
              </Text>
            </View>

            <Text variant="micro" color="textLo">
              {t('settingsV1.targetsFootnote')}
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
              title={saving ? t('common.saving') : t('settingsV1.targetsSave')}
              loading={saving}
              disabled={saving}
              onPress={() => void handleSave()}
              testID="btn-save-daily-goals"
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
  card: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  metricCopy: {
    flex: 1,
    gap: space.xs,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  unitInline: {
    marginBottom: 2,
  },
  stepperCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: {
    backgroundColor: colors.s3,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieHelp: {
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    backgroundColor: colors.bg0,
  },
});
