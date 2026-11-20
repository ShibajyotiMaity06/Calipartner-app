import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { NavigationIcon } from '@calipartner/ui';
import { type as inputTypography } from '@calipartner/ui';
import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, radius, SegmentedControl, space, Text } from '@calipartner/ui';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '@calipartner/core';
import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import type { SelectedGoal } from '@/services/onboardingStateMachine';

export interface GoalsAndBodyModalProps {
  visible: boolean;
  onClose: () => void;
  currentGoal?: 'cut' | 'maintain' | 'bulk';
  currentRate?: number;
  currentHeightCm?: number;
  currentWeightKg?: number;
  currentSex?: 'male' | 'female' | 'other';
  onSave?: (data: {
    goal: SelectedGoal;
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
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const [goal, setGoal] = useState<SelectedGoal | null>(
    currentGoal === 'maintain' ? null : currentGoal,
  );
  const [rate, setRate] = useState<number>(currentRate);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [heightCm, setHeightCm] = useState<string>(String(currentHeightCm));
  const [weightKg, setWeightKg] = useState<string>(String(currentWeightKg));
  const initialFtIn = cmToFtIn(currentHeightCm);
  const [feetStr, setFeetStr] = useState<string>(String(initialFtIn.feet));
  const [inchesStr, setInchesStr] = useState<string>(String(initialFtIn.inches));
  const [weightLbStr, setWeightLbStr] = useState<string>(
    String(Math.round(kgToLb(currentWeightKg) * 10) / 10),
  );
  const [sex, setSex] = useState<'male' | 'female' | 'other'>(currentSex);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const goalOptions = [
    { value: 'bulk', label: t('socialUpdate.bulk') },
    { value: 'cut', label: t('socialUpdate.cut') },
  ];

  const rateOptions = [
    { value: '0.25', label: '0.25 kg/wk' },
    { value: '0.50', label: '0.50 kg/wk' },
    { value: '0.75', label: '0.75 kg/wk' },
    { value: '1.00', label: '1.00 kg/wk' },
  ];

  const handleSave = async () => {
    if (!goal || saving) return;
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
            <Button
              variant="tertiary"
              fullWidth={false}
              label="Back to Me"
              iconOnly
              icon={<NavigationIcon action="back" />}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back to Me"
              style={styles.backButton}
              testID="btn-close-goals-body"
            />
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
                value={goal ?? ''}
                onChange={(value) => {
                  if (value === 'bulk' || value === 'cut') {
                    setGoal(value);
                    if (rate === 0) setRate(0.5);
                  }
                }}
                testID="segment-goal-type"
              />
            </View>

            {/* Rate selector if cut or bulk */}
            {goal && (
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
                <NumberField
                  label={t('fixes.customPace')}
                  value={rate}
                  onChange={(value) => setRate(value ?? NaN)}
                  testID="input-profile-custom-pace"
                />
                <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                  {t('fixes.advisory')}
                </Text>
              </View>
            )}

            {/* Measurements */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="label" color={dark.textHi}>
                  Body measurements
                </Text>
              </View>

              <View style={styles.unitToggleWrap}>
                <SegmentedControl
                  options={[
                    { value: 'metric', label: 'Metric (cm, kg)' },
                    { value: 'imperial', label: 'Imperial (ft, lb)' },
                  ]}
                  value={unitSystem}
                  onChange={(val: string) => {
                    const next = val as 'metric' | 'imperial';
                    setUnitSystem(next);
                    if (next === 'imperial') {
                      const h = parseFloat(heightCm) || 0;
                      const w = parseFloat(weightKg) || 0;
                      const ftIn = cmToFtIn(h);
                      setFeetStr(String(ftIn.feet));
                      setInchesStr(String(ftIn.inches));
                      setWeightLbStr(String(Math.round(kgToLb(w) * 10) / 10));
                    } else {
                      const ft = parseFloat(feetStr) || 0;
                      const inch = parseFloat(inchesStr) || 0;
                      const lb = parseFloat(weightLbStr) || 0;
                      if (ft || inch) setHeightCm(String(Math.round(ftInToCm(ft, inch))));
                      if (lb) setWeightKg(String(Math.round(lbToKg(lb) * 10) / 10));
                    }
                  }}
                  testID="segment-measurements-unit"
                />
              </View>

              <View style={styles.inputRow}>
                {unitSystem === 'metric' ? (
                  <>
                    <View style={styles.inputCol}>
                      <Text variant="micro" color={dark.textMid} style={styles.inputLabel}>
                        Height (cm)
                      </Text>
                      <TextInput
                        value={heightCm}
                        onChangeText={setHeightCm}
                        keyboardType="numeric"
                        style={[styles.textInput, { fontFamily: inputTypography.body.fontFamily }]}
                        placeholder="175"
                        placeholderTextColor={dark.textOff}
                        testID="input-height"
                        accessibilityLabel="Height in centimetres"
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
                        style={[styles.textInput, { fontFamily: inputTypography.body.fontFamily }]}
                        placeholder="70"
                        placeholderTextColor={dark.textOff}
                        testID="input-weight-kg"
                        accessibilityLabel="Weight in kilograms"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.inputCol}>
                      <Text variant="micro" color={dark.textMid} style={styles.inputLabel}>
                        Height (ft / in)
                      </Text>
                      <View style={styles.ftInRow}>
                        <TextInput
                          value={feetStr}
                          onChangeText={(val) => {
                            setFeetStr(val);
                            const ft = parseFloat(val) || 0;
                            const inch = parseFloat(inchesStr) || 0;
                            setHeightCm(String(Math.round(ftInToCm(ft, inch))));
                          }}
                          keyboardType="numeric"
                          style={[
                            styles.textInput,
                            styles.halfInput,
                            { fontFamily: inputTypography.body.fontFamily },
                          ]}
                          placeholder="ft"
                          placeholderTextColor={dark.textOff}
                          testID="input-height-ft"
                          accessibilityLabel="Height in feet"
                        />
                        <TextInput
                          value={inchesStr}
                          onChangeText={(val) => {
                            setInchesStr(val);
                            const ft = parseFloat(feetStr) || 0;
                            const inch = parseFloat(val) || 0;
                            setHeightCm(String(Math.round(ftInToCm(ft, inch))));
                          }}
                          keyboardType="numeric"
                          style={[
                            styles.textInput,
                            styles.halfInput,
                            { fontFamily: inputTypography.body.fontFamily },
                          ]}
                          placeholder="in"
                          placeholderTextColor={dark.textOff}
                          testID="input-height-in"
                          accessibilityLabel="Height in inches"
                        />
                      </View>
                    </View>
                    <View style={styles.inputCol}>
                      <Text variant="micro" color={dark.textMid} style={styles.inputLabel}>
                        Weight (lb)
                      </Text>
                      <TextInput
                        value={weightLbStr}
                        onChangeText={(val) => {
                          setWeightLbStr(val);
                          const lb = parseFloat(val) || 0;
                          setWeightKg(String(Math.round(lbToKg(lb) * 10) / 10));
                        }}
                        keyboardType="numeric"
                        style={[styles.textInput, { fontFamily: inputTypography.body.fontFamily }]}
                        placeholder="154"
                        placeholderTextColor={dark.textOff}
                        testID="input-weight-kg"
                        accessibilityLabel="Weight in pounds"
                      />
                    </View>
                  </>
                )}
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
              disabled={saving || !goal}
              testID="btn-save-goals-body"
              style={styles.saveButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space[2],
    },
    unitToggleWrap: {
      marginBottom: space[3],
    },
    ftInRow: {
      flexDirection: 'row',
      gap: space[2],
    },
    halfInput: {
      flex: 1,
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
