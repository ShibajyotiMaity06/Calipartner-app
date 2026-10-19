import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

interface OccasionPlanModalProps {
  visible: boolean;
  onClose: () => void;
  onMakeRoomChallenge: (plan: { event: string; targetDate: string; targetWeight: number }) => void;
  currentWeightKg?: number;
  testID?: string;
}

const EVENTS = [
  { id: 'wedding', label: 'Wedding', icon: 'heart-outline' as const },
  { id: 'vacation', label: 'Trip', icon: 'airplane-outline' as const },
  { id: 'birthday', label: 'Birthday', icon: 'gift-outline' as const },
  { id: 'newYear', label: 'New Year', icon: 'sparkles-outline' as const },
];

export function OccasionPlanModal({
  visible,
  onClose,
  onMakeRoomChallenge,
  currentWeightKg = 78,
  testID = 'occasion-plan-modal',
}: OccasionPlanModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedEvent, setSelectedEvent] = useState('wedding');
  const [targetWeight, setTargetWeight] = useState(String(currentWeightKg - 4));
  const [weeksAvailable, setWeeksAvailable] = useState(8);

  if (!visible) return null;

  const targetNum = parseFloat(targetWeight) || currentWeightKg;
  const weightChange = Math.abs(currentWeightKg - targetNum);
  const requiredRatePerWeek = weeksAvailable > 0 ? weightChange / weeksAvailable : 0;
  // Maximum safe rate cap is 1% of body weight per week per PRD 7.2
  const maxSafeRate = currentWeightKg * 0.01;
  const isUnrealistic = requiredRatePerWeek > maxSafeRate;

  // Realistic weeks needed
  const realisticWeeks = Math.ceil(weightChange / (maxSafeRate * 0.75));

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as 2 | 3);
    } else {
      onMakeRoomChallenge({
        event: selectedEvent,
        targetDate: `${weeksAvailable} weeks`,
        targetWeight: targetNum,
      });
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close occasion planner" />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('progress.challenges.occasion.title')}</Text>
              <Text style={styles.subtitle}>Step {step} of 3</Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID={`${testID}-close`}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Step 1: Pick Event & Timeline */}
            {step === 1 && (
              <View style={styles.stepContainer} testID={`${testID}-step-1`}>
                <Text style={styles.sectionLabel}>Pick an occasion</Text>
                <View style={styles.eventGrid}>
                  {EVENTS.map((evt) => {
                    const isSelected = selectedEvent === evt.id;
                    return (
                      <Pressable
                        key={evt.id}
                        style={[styles.eventTile, isSelected && styles.eventTileSelected]}
                        onPress={() => setSelectedEvent(evt.id)}
                        accessibilityRole="radio"
                        accessibilityLabel={evt.label}
                        accessibilityState={{ selected: isSelected }}
                        testID={`${testID}-evt-${evt.id}`}
                      >
                        <Ionicons
                          name={evt.icon}
                          size={24}
                          color={isSelected ? dark.apricot : dark.textMid}
                        />
                        <Text style={[styles.eventLabel, isSelected && styles.eventLabelSelected]}>
                          {evt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: space[4] }]}>
                  Weeks until the event
                </Text>
                <View style={styles.weeksStepperRow}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setWeeksAvailable(Math.max(2, weeksAvailable - 1))}
                    testID={`${testID}-weeks-dec`}
                  >
                    <Ionicons name="remove" size={20} color={dark.textHi} />
                  </Pressable>
                  <Text style={styles.weeksNumeral}>{weeksAvailable} weeks</Text>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setWeeksAvailable(weeksAvailable + 1)}
                    testID={`${testID}-weeks-inc`}
                  >
                    <Ionicons name="add" size={20} color={dark.textHi} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: Current & Target Weight */}
            {step === 2 && (
              <View style={styles.stepContainer} testID={`${testID}-step-2`}>
                <Text style={styles.sectionLabel}>Current vs Target Weight</Text>
                <View style={styles.weightRow}>
                  <View style={styles.weightBox}>
                    <Text style={styles.weightLabel}>Current</Text>
                    <Text style={styles.weightValue}>{currentWeightKg.toFixed(1)} kg</Text>
                  </View>

                  <Ionicons name="arrow-forward" size={20} color={dark.textLo} />

                  <View style={styles.weightBox}>
                    <Text style={styles.weightLabel}>Target</Text>
                    <TextInput
                      style={styles.weightInput}
                      value={targetWeight}
                      onChangeText={setTargetWeight}
                      keyboardType="decimal-pad"
                      testID={`${testID}-input-target-weight`}
                    />
                  </View>
                </View>

                <View style={styles.rateAdvisoryCard}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={dark.apricot} />
                  <Text style={styles.rateAdvisoryText}>
                    Required rate: {requiredRatePerWeek.toFixed(2)} kg / week (Safe cap is{' '}
                    {maxSafeRate.toFixed(2)} kg/wk)
                  </Text>
                </View>
              </View>
            )}

            {/* Step 3: Realistic Timeline Plan */}
            {step === 3 && (
              <View style={styles.stepContainer} testID={`${testID}-step-3`}>
                {isUnrealistic ? (
                  <View style={styles.warningCard} testID={`${testID}-warning-unrealistic`}>
                    <Ionicons name="alert-circle-outline" size={22} color={dark.apricot} />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>Pace warning</Text>
                      <Text style={styles.warningText}>
                        That's quicker than is safe. Here's a realistic plan that works in{' '}
                        {realisticWeeks} weeks at a safe pace of {(maxSafeRate * 0.75).toFixed(2)}{' '}
                        kg/week.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.safePlanCard} testID={`${testID}-safe-plan`}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={dark.teal} />
                    <View style={styles.warningContent}>
                      <Text style={styles.safePlanTitle}>Safe & Sustainable Plan</Text>
                      <Text style={styles.safePlanText}>
                        Your target rate of {requiredRatePerWeek.toFixed(2)} kg/wk is safely within
                        the 1% body weight limit.
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={[styles.sectionLabel, { marginTop: space[3] }]}>
                  Weekly Milestones
                </Text>
                <View style={styles.milestonesList}>
                  {[1, 2, 3, 4].map((wk) => {
                    const projected = currentWeightKg - (requiredRatePerWeek * wk);
                    return (
                      <View key={wk} style={styles.milestoneRow}>
                        <Text style={styles.milestoneWeek}>Week {wk}</Text>
                        <Text style={styles.milestoneWeight}>{projected.toFixed(1)} kg</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Button */}
          <Pressable
            style={styles.primaryBtn}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={step === 3 ? t('progress.challenges.occasion.makeRoomChallenge') : 'Next'}
            testID={`${testID}-next-btn`}
          >
            <Text style={styles.primaryBtnText}>
              {step === 3 ? t('progress.challenges.occasion.makeRoomChallenge') : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[6],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[3],
  },
  title: {
    ...type.title2,
    color: dark.textHi,
  },
  subtitle: {
    ...type.bodyS,
    color: dark.textLo,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: dark.s2,
  },
  scrollContent: {
    paddingBottom: space[4],
  },
  stepContainer: {
    marginBottom: space[4],
  },
  sectionLabel: {
    ...type.label,
    color: dark.textLo,
    marginBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  eventTile: {
    width: '48%',
    height: 72,
    borderRadius: radius.card,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  eventTileSelected: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
  },
  eventLabel: {
    ...type.bodyS,
    color: dark.textMid,
  },
  eventLabelSelected: {
    color: dark.apricot,
    fontWeight: '700',
  },
  weeksStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeksNumeral: {
    ...type.heading,
    color: dark.textHi,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  weightBox: {
    alignItems: 'center',
  },
  weightLabel: {
    ...type.label,
    color: dark.textLo,
    marginBottom: 4,
  },
  weightValue: {
    ...type.numeralL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textHi,
  },
  weightInput: {
    ...type.numeralL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.apricot,
    borderBottomWidth: 1,
    borderBottomColor: dark.apricot,
    paddingHorizontal: space[2],
    textAlign: 'center',
    minWidth: 80,
  },
  rateAdvisoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[3],
    marginTop: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  rateAdvisoryText: {
    ...type.bodyS,
    color: dark.textMid,
    flex: 1,
  },
  warningCard: {
    flexDirection: 'row',
    gap: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.apricot,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...type.heading,
    color: dark.apricot,
    marginBottom: 2,
  },
  warningText: {
    ...type.bodyS,
    color: dark.textHi,
    lineHeight: 20,
  },
  safePlanCard: {
    flexDirection: 'row',
    gap: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.teal,
  },
  safePlanTitle: {
    ...type.heading,
    color: dark.teal,
    marginBottom: 2,
  },
  safePlanText: {
    ...type.bodyS,
    color: dark.textHi,
    lineHeight: 20,
  },
  milestonesList: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.hairline,
  },
  milestoneWeek: {
    ...type.bodyS,
    color: dark.textLo,
  },
  milestoneWeight: {
    ...type.bodyS,
    color: dark.textHi,
    fontWeight: '600',
  },
  primaryBtn: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
});
