import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, ChevronLeftIcon, dark, space, Stepper, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface DailyGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  currentStepGoal?: number;
  currentWaterGoalMl?: number;
  currentFocusGoalMins?: number;
  onSave?: (goals: {
    stepGoal: number;
    waterGoalMl: number;
    focusGoalMins?: number;
  }) => Promise<void> | void;
  testID?: string;
}

export function DailyGoalsModal({
  visible,
  onClose,
  currentStepGoal = 8000,
  currentWaterGoalMl = 2500,
  onSave,
  testID = 'modal-daily-goals',
}: DailyGoalsModalProps) {
  const [stepGoal, setStepGoal] = useState<number>(currentStepGoal);
  const [waterGoalMl, setWaterGoalMl] = useState<number>(currentWaterGoalMl);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    playClickSound();
    setSaving(true);
    try {
      if (onSave) {
        await onSave({ stepGoal, waterGoalMl, focusGoalMins: 0 });
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSaving(false);
        onClose();
      }, 600);
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back to Me"
              style={styles.backButton}
              testID="btn-close-daily-goals"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.dailyGoals.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.dailyGoals.subtitle')}
            </Text>

            {/* 1. Step Goal Card */}
            <Card elevation="s1" style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View>
                  <Text variant="heading" color={dark.textHi}>
                    {t('me.dailyGoals.stepGoal')}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid}>
                    Daily target for walking and running
                  </Text>
                </View>
                <Text variant="numeralM" color={dark.apricot} style={styles.metricDisplay}>
                  {stepGoal.toLocaleString()}
                </Text>
              </View>
              <View style={styles.stepperWrap}>
                <Stepper
                  value={stepGoal}
                  onChange={setStepGoal}
                  min={1000}
                  max={30000}
                  step={500}
                  unit={t('me.dailyGoals.stepUnit')}
                  accessibilityLabel="Step goal stepper"
                  testID="stepper-step-goal"
                />
              </View>
            </Card>

            {/* 2. Water Goal Card */}
            <Card elevation="s1" style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View>
                  <Text variant="heading" color={dark.textHi}>
                    {t('me.dailyGoals.waterGoal')}
                  </Text>
                  <Text variant="bodyS" color={dark.textMid}>
                    Hydration target throughout the day
                  </Text>
                </View>
                <Text variant="numeralM" color={dark.teal} style={styles.metricDisplay}>
                  {waterGoalMl.toLocaleString()} ml
                </Text>
              </View>
              <View style={styles.stepperWrap}>
                <Stepper
                  value={waterGoalMl}
                  onChange={setWaterGoalMl}
                  min={500}
                  max={5000}
                  step={250}
                  unit={t('me.dailyGoals.waterUnit')}
                  accessibilityLabel="Water goal stepper"
                  testID="stepper-water-goal"
                />
              </View>
            </Card>
          </ScrollView>

          {/* Bottom Save Action */}
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label={success ? 'Saved' : saving ? 'Saving…' : t('me.dailyGoals.saveBtn')}
              onPress={handleSave}
              disabled={saving}
              testID="btn-save-daily-goals"
              style={styles.saveButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
  },
  scrollContent: {
    padding: space[4],
    paddingBottom: space[8],
  },
  introSubtitle: {
    marginBottom: space[4],
  },
  goalCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space[3],
  },
  metricDisplay: {
    fontVariant: ['tabular-nums'],
  },
  stepperWrap: {
    marginTop: space[2],
    alignItems: 'center',
  },
  bottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  saveButton: {
    width: '100%',
  },
});
