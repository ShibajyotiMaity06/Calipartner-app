import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  radius,
  SegmentedControl,
  space,
  Text,
} from '@calipartner/ui';
import { HeightField } from '@/components/onboarding/HeightField';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface GoalsAndBodyModalProps {
  visible: boolean;
  onClose: () => void;
  currentGoal?: 'cut' | 'maintain' | 'bulk';
  currentRate?: number;
  currentHeightCm?: number;
  currentWeightKg?: number;
  currentSex?: 'male' | 'female' | 'other';
  onSave?: (data: {
    goal: 'cut' | 'maintain' | 'bulk';
    rate: number;
    heightCm: number;
    weightKg: number;
    sex: 'male' | 'female' | 'other';
  }) => Promise<void> | void;
  testID?: string;
}

export function GoalsAndBodyModal({
  visible,
  onClose,
  currentGoal = 'cut',
  currentRate = 0.5,
  currentHeightCm = 175,
  currentWeightKg = 72,
  currentSex = 'male',
  onSave,
  testID = 'modal-goals-and-body',
}: GoalsAndBodyModalProps) {
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>(currentGoal);
  const [rate, setRate] = useState<number>(currentRate);
  const [heightCm, setHeightCm] = useState<string>(String(currentHeightCm));
  const [weightKg, setWeightKg] = useState<string>(String(currentWeightKg));
  const [sex, setSex] = useState<'male' | 'female' | 'other'>(currentSex);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const goalOptions = [
    { value: 'cut', label: 'Lose fat' },
    { value: 'maintain', label: 'Maintain' },
    { value: 'bulk', label: 'Build muscle' },
  ];

  const rateOptions = [
    { value: '0.25', label: '0.25 kg/wk' },
    { value: '0.50', label: '0.50 kg/wk' },
    { value: '0.75', label: '0.75 kg/wk' },
    { value: '1.00', label: '1.00 kg/wk' },
  ];

  const handleSave = async () => {
    playClickSound();
    setSaveError(false);
    setSaving(true);
    try {
      const parsedHeight = parseFloat(heightCm);
      const parsedWeight = parseFloat(weightKg);
      if (onSave) {
        await onSave({
          goal,
          rate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          sex,
        });
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSaving(false);
        onClose();
      }, 600);
    } catch {
      setSaveError(true);
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
              testID="btn-close-goals-body"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.goalsAndBody.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Notice: changes apply from today */}
            <Card elevation="s2" style={styles.noticeCard}>
              <Text variant="bodyS" color={dark.textMid}>
                {t('me.goalsAndBody.subtitle')}
              </Text>
            </Card>

            {/* Goal selector */}
            <View style={styles.section}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.goalsAndBody.goalLabel')}
              </Text>
              <SegmentedControl
                options={goalOptions}
                value={goal}
                onChange={(val: string) => setGoal(val as 'cut' | 'maintain' | 'bulk')}
                testID="segment-goal-type"
              />
            </View>

            {/* Rate selector if cut or bulk */}
            {goal !== 'maintain' && (
              <View style={styles.section}>
                <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                  {t('me.goalsAndBody.rateLabel')}
                </Text>
                <SegmentedControl
                  options={rateOptions}
                  value={rate.toFixed(2)}
                  onChange={(val: string) => setRate(parseFloat(val))}
                  testID="segment-rate-pace"
                />
                <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                  {t('me.goalsAndBody.calorieFloorNotice')}
                </Text>
              </View>
            )}

            {/* Measurements */}
            <View style={styles.section}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                Body measurements
              </Text>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <HeightField
                    value={Number(heightCm)}
                    onChange={(value) => setHeightCm(String(value))}
                  />
                </View>

                <View style={styles.inputCol}>
                  <Text variant="micro" color={dark.textMid} style={styles.inputLabel}>
                    Weight (kg)
                  </Text>
                  <TextInput
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                    style={styles.textInput}
                    placeholderTextColor={dark.textOff}
                    testID="input-weight-kg"
                    accessibilityLabel="Weight in kilograms"
                  />
                </View>
              </View>
            </View>

            {/* Sex / Biology */}
            <View style={styles.section}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                Biological Sex (for metabolic rate)
              </Text>
              <SegmentedControl
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
                value={sex}
                onChange={(val: string) => setSex(val as 'male' | 'female' | 'other')}
                testID="segment-biological-sex"
              />
            </View>
          </ScrollView>

          {saveError ? (
            <Text accessibilityRole="alert" color={dark.danger}>
              {t('setup.detailsError')}
            </Text>
          ) : null}
          {/* Bottom Save Action */}
          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label={success ? 'Saved' : saving ? 'Saving…' : t('me.goalsAndBody.saveBtn')}
              onPress={handleSave}
              disabled={saving}
              testID="btn-save-goals-body"
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
  noticeCard: {
    padding: space[3],
    marginBottom: space[5],
  },
  section: {
    marginBottom: space[6],
  },
  sectionLabel: {
    marginBottom: space[2],
  },
  helperText: {
    marginTop: space[2],
  },
  inputRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: space[1],
  },
  textInput: {
    backgroundColor: dark.s2,
    borderColor: dark.hairline,
    borderWidth: 1,
    borderRadius: radius.control,
    height: 48,
    paddingHorizontal: space[3],
    color: dark.textHi,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
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
