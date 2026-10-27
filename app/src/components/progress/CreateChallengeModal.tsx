import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

export type ChallengeActivityType =
  'walking' | 'running' | 'studying' | 'gym' | 'cycling' | 'custom';

export type ChallengeDuration = '1d' | '7d' | '30d';

export interface ChallengeCreatedPayload {
  activity: ChallengeActivityType;
  customName?: string;
  goalValue: number;
  unit: string;
  durationDays: number;
  partnerNickname?: string;
  isWholeRoom: boolean;
}

interface CreateChallengeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: ChallengeCreatedPayload) => void;
  partnerNickname?: string;
  partnerAvatarUrl?: string;
  testID?: string;
}

interface ActivityTileConfig {
  id: ChallengeActivityType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  defaultGoal: number;
  step: number;
  min: number;
  max: number;
  unit: string;
}

// M15 specification: 3x2 grid of tiles. STRICT GUARDRAIL: No calorie or weight-loss tile.
const ACTIVITIES: ActivityTileConfig[] = [
  {
    id: 'walking',
    label: 'Walking',
    icon: 'footsteps-outline',
    defaultGoal: 8000,
    step: 500,
    min: 1000,
    max: 30000,
    unit: 'steps a day',
  },
  {
    id: 'running',
    label: 'Running',
    icon: 'walk-outline',
    defaultGoal: 3,
    step: 1,
    min: 1,
    max: 42,
    unit: 'km a day',
  },
  {
    id: 'studying',
    label: 'Studying',
    icon: 'book-outline',
    defaultGoal: 60,
    step: 15,
    min: 15,
    max: 480,
    unit: 'minutes a day',
  },
  {
    id: 'gym',
    label: 'Gym',
    icon: 'barbell-outline',
    defaultGoal: 3,
    step: 1,
    min: 1,
    max: 7,
    unit: 'workouts a week',
  },
  {
    id: 'cycling',
    label: 'Cycling',
    icon: 'bicycle-outline',
    defaultGoal: 10,
    step: 2,
    min: 2,
    max: 100,
    unit: 'km a day',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'information-circle-outline',
    defaultGoal: 1,
    step: 1,
    min: 1,
    max: 10,
    unit: 'times a day',
  },
];

export function CreateChallengeModal({
  visible,
  onClose,
  onSubmit,
  partnerNickname = 'Priya',
  partnerAvatarUrl,
  testID = 'create-challenge-modal',
}: CreateChallengeModalProps) {
  const [selectedActivity, setSelectedActivity] = useState<ChallengeActivityType>('walking');
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState<ChallengeDuration>('7d');
  const [isWholeRoom, setIsWholeRoom] = useState(false);

  // Goal state keyed by activity
  const [goals, setGoals] = useState<Record<ChallengeActivityType, number>>({
    walking: 8000,
    running: 3,
    studying: 60,
    gym: 3,
    cycling: 10,
    custom: 1,
  });

  if (!visible) return null;

  const currentConfig = ACTIVITIES.find((a) => a.id === selectedActivity) ?? ACTIVITIES[0]!;
  const currentGoal = goals[selectedActivity] ?? currentConfig.defaultGoal;

  const handleAdjustGoal = (delta: number) => {
    const next = Math.max(currentConfig.min, Math.min(currentConfig.max, currentGoal + delta));
    setGoals((prev) => ({ ...prev, [selectedActivity]: next }));
  };

  const durationDays = duration === '1d' ? 1 : duration === '7d' ? 7 : 30;
  const durationLabel = duration === '1d' ? '1 day' : duration === '7d' ? '7 days' : '30 days';
  const partnerLabel = isWholeRoom ? 'Whole room' : `You and ${partnerNickname}`;

  const summarySentence = `${partnerLabel} · ${currentGoal.toLocaleString()} ${currentConfig.unit} · ${durationLabel} · starts today.`;

  const handleSubmit = () => {
    onSubmit({
      activity: selectedActivity,
      customName: selectedActivity === 'custom' ? customName || 'Custom habit' : undefined,
      goalValue: currentGoal,
      unit: currentConfig.unit,
      durationDays,
      partnerNickname: isWholeRoom ? undefined : partnerNickname,
      isWholeRoom,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close creator" />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('progress.challenges.create.title')}</Text>
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Activity Section: 3x2 Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {t('progress.challenges.create.activityLabel')}
              </Text>
              <View style={styles.tilesGrid} accessibilityRole="radiogroup">
                {ACTIVITIES.map((act) => {
                  const isSelected = selectedActivity === act.id;
                  return (
                    <Pressable
                      key={act.id}
                      style={[styles.activityTile, isSelected && styles.activityTileSelected]}
                      onPress={() => setSelectedActivity(act.id)}
                      accessibilityRole="radio"
                      accessibilityLabel={act.label}
                      accessibilityState={{ selected: isSelected }}
                      testID={`${testID}-tile-${act.id}`}
                    >
                      <Ionicons
                        name={act.icon}
                        size={28}
                        color={isSelected ? dark.apricot : dark.textMid}
                      />
                      <Text style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                        {act.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Custom activity name if custom selected */}
            {selectedActivity === 'custom' && (
              <View style={styles.customNameField}>
                <Text style={styles.fieldLabel}>Custom activity name</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder={t('progress.challenges.create.customNamePlaceholder')}
                  placeholderTextColor={dark.textLo}
                  value={customName}
                  onChangeText={setCustomName}
                  testID={`${testID}-input-custom-name`}
                />
              </View>
            )}

            {/* 2. Goal Section with Stepper ± (48x48) & Unit Chip */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('progress.challenges.create.goalLabel')}</Text>
              <View style={styles.goalRow}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustGoal(-currentConfig.step)}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease goal"
                  testID={`${testID}-btn-decrease`}
                >
                  <Ionicons name="remove" size={22} color={dark.textHi} />
                </Pressable>

                <View style={styles.goalDisplay}>
                  <Text style={styles.goalNumeral} testID={`${testID}-goal-value`}>
                    {currentGoal.toLocaleString()}
                  </Text>
                  <View style={styles.unitChip}>
                    <Text style={styles.unitChipText}>{currentConfig.unit}</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustGoal(currentConfig.step)}
                  accessibilityRole="button"
                  accessibilityLabel="Increase goal"
                  testID={`${testID}-btn-increase`}
                >
                  <Ionicons name="add" size={22} color={dark.textHi} />
                </Pressable>
              </View>
            </View>

            {/* 3. Duration Section: 1d · 7d · 30d */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {t('progress.challenges.create.durationLabel')}
              </Text>
              <View style={styles.chipsRow}>
                {(['1d', '7d', '30d'] as ChallengeDuration[]).map((dur) => {
                  const isSelected = duration === dur;
                  const label = dur === '1d' ? '1 day' : dur === '7d' ? '7 days' : '30 days';
                  return (
                    <Pressable
                      key={dur}
                      style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                      onPress={() => setDuration(dur)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: isSelected }}
                      testID={`${testID}-chip-dur-${dur}`}
                    >
                      <Text
                        style={[styles.durationText, isSelected && styles.durationTextSelected]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Partner Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {t('progress.challenges.create.partnerLabel')}
              </Text>
              <View style={styles.partnerRow}>
                <View style={styles.partnerAvatarCol}>
                  <Avatar
                    name={partnerNickname}
                    uri={partnerAvatarUrl}
                    size="md"
                    identityHue="iris"
                  />
                  <Text style={styles.partnerNameText}>{partnerNickname}</Text>
                </View>

                <View style={styles.wholeRoomCol}>
                  <Text style={styles.wholeRoomLabel}>
                    {t('progress.challenges.create.wholeRoom')}
                  </Text>
                  <Switch
                    value={isWholeRoom}
                    onValueChange={setIsWholeRoom}
                    trackColor={{ false: dark.s3, true: dark.apricot }}
                    thumbColor={dark.onBrand}
                    testID={`${testID}-switch-whole-room`}
                  />
                </View>
              </View>
            </View>

            {/* 5. Summary Line */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText} testID={`${testID}-summary-text`}>
                {summarySentence}
              </Text>
            </View>
          </ScrollView>

          {/* 6. Pinned 56px Primary Button */}
          <Pressable
            style={styles.submitBtn}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel={t('progress.challenges.create.submit')}
            testID={`${testID}-submit-btn`}
          >
            <Text style={styles.submitBtnText}>{t('progress.challenges.create.submit')}</Text>
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
    ...type.title1,
    color: dark.textHi,
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
  section: {
    marginBottom: space[4],
  },
  sectionLabel: {
    ...type.label,
    color: dark.textLo,
    marginBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    justifyContent: 'space-between',
  },
  activityTile: {
    width: '31%',
    height: 88,
    borderRadius: 16,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
  activityTileSelected: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
  },
  tileLabel: {
    ...type.label,
    color: dark.textMid,
  },
  tileLabelSelected: {
    color: dark.apricot,
    fontWeight: '700',
  },
  customNameField: {
    marginBottom: space[3],
  },
  fieldLabel: {
    ...type.label,
    color: dark.textLo,
    marginBottom: space[1],
  },
  customInput: {
    height: 48,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    color: dark.textHi,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  goalRow: {
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
  goalDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalNumeral: {
    ...type.numeralL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textHi,
  },
  unitChip: {
    backgroundColor: dark.s3,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 2,
  },
  unitChipText: {
    ...type.label,
    color: dark.textLo,
    fontSize: 11,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  durationChip: {
    flex: 1,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipSelected: {
    backgroundColor: 'rgba(244, 182, 125, 0.16)',
    borderColor: dark.apricot,
  },
  durationText: {
    ...type.bodyS,
    color: dark.textMid,
  },
  durationTextSelected: {
    color: dark.apricot,
    fontWeight: '700',
  },
  partnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  partnerAvatarCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  partnerNameText: {
    ...type.body,
    color: dark.textHi,
    fontWeight: '600',
  },
  wholeRoomCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  wholeRoomLabel: {
    ...type.label,
    color: dark.textLo,
  },
  summaryCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[3],
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  summaryText: {
    ...type.bodyS,
    color: dark.textHi,
    textAlign: 'center',
    lineHeight: 20,
  },
  submitBtn: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    ...type.heading,
    color: dark.onBrand,
    fontWeight: '700',
  },
});
