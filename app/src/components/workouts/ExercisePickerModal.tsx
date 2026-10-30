import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, type as typography } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { Equipment, Exercise, ExerciseType, MuscleGroup } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { createCustomExercise, getExercises } from '@/services/workoutService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  testID?: string;
}

const MUSCLE_GROUPS: Array<{ key: MuscleGroup | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'other', label: 'Other' },
];

export function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  testID = 'exercise-picker-modal',
}: ExercisePickerModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest-user';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Exercise Creation Sub-modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<Equipment>('barbell');
  const [customType, setCustomType] = useState<ExerciseType>('strength');
  const [creatingCustom, setCreatingCustom] = useState(false);

  const fetchExercises = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const list = await getExercises(db, {
        muscleGroup: selectedMuscle === 'all' ? undefined : selectedMuscle,
        searchQuery: searchQuery.trim().length > 0 ? searchQuery : undefined,
        userId,
      });
      setExercises(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedMuscle, searchQuery, userId]);

  useEffect(() => {
    if (visible) {
      void fetchExercises();
    }
  }, [visible, fetchExercises]);

  const handleCreateCustom = async () => {
    if (!customName.trim()) return;
    try {
      setCreatingCustom(true);
      const db = await getDb();
      const created = await createCustomExercise(
        db,
        {
          name: customName.trim(),
          muscleGroup: customMuscle,
          equipment: customEquipment,
          type: customType,
        },
        userId,
      );
      setShowCustomModal(false);
      setCustomName('');
      onSelectExercise(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingCustom(false);
    }
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => {
    return (
      <TouchableOpacity
        testID={`exercise-item-${item.id}`}
        style={[
          styles.exerciseItem,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => {
          onSelectExercise(item);
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.muscle_group}, ${item.equipment}`}
      >
        <View style={styles.exerciseContent}>
          <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                {item.muscle_group.replace('_', ' ')}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.textMuted }]}>{item.equipment}</Text>
            </View>
            {item.owner_id && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.accent }]}>Custom</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            testID={`${testID}-btn-close`}
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t('workouts.exercises.title')}
          </Text>
          <TouchableOpacity
            testID={`${testID}-btn-open-custom`}
            onPress={() => setShowCustomModal(true)}
            style={styles.customAddBtn}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.exercises.createCustom')}
          >
            <Ionicons name="add" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              testID={`${testID}-input-search`}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('workouts.exercises.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('workouts.exercises.searchPlaceholder')}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                testID={`${testID}-btn-clear-search`}
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Muscle Group Filter Chips */}
        <View style={styles.chipsRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLE_GROUPS}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
            renderItem={({ item }) => {
              const active = selectedMuscle === item.key;
              return (
                <TouchableOpacity
                  testID={`chip-muscle-${item.key}`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMuscle(item.key)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text
                    style={[styles.chipText, { color: active ? colors.onAccent : colors.text }]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Exercise List / Loading / Error / Empty states */}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              {t('common.loading')}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
            <Text style={[styles.stateText, { color: colors.danger }]}>{error}</Text>
            <TouchableOpacity
              testID={`${testID}-btn-retry`}
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              onPress={fetchExercises}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="barbell-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('workouts.exercises.noExercisesFound')}
            </Text>
            <TouchableOpacity
              testID={`${testID}-btn-create-custom-empty`}
              style={[styles.createCustomPromptBtn, { backgroundColor: colors.accent }]}
              onPress={() => setShowCustomModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('workouts.exercises.createCustom')}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.onAccent} />
              <Text style={[styles.createCustomPromptText, { color: colors.onAccent }]}>
                {t('workouts.exercises.createCustom')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            testID={`${testID}-list`}
            data={exercises}
            keyExtractor={(item) => item.id}
            renderItem={renderExerciseItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Custom Exercise Modal */}
        <Modal
          testID="custom-exercise-modal"
          visible={showCustomModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCustomModal(false)}
        >
          <View style={styles.dialogBackdrop}>
            <View
              style={[
                styles.dialogBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.dialogTitle, { color: colors.text }]}>
                {t('workouts.exercises.createCustom')}
              </Text>

              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>
                  {t('workouts.exercises.customName')}
                </Text>
                <TextInput
                  testID="input-custom-exercise-name"
                  style={[
                    styles.formInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Bulgarian Split Squat"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Muscle Group */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>
                  {t('workouts.exercises.muscleGroup')}
                </Text>
                <View style={styles.pillWrap}>
                  {(
                    [
                      'chest',
                      'back',
                      'legs',
                      'shoulders',
                      'arms',
                      'core',
                      'cardio',
                    ] as MuscleGroup[]
                  ).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor: customMuscle === m ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomMuscle(m)}
                    >
                      <Text
                        style={{
                          fontFamily: typography.body.fontFamily,
                          fontSize: fontSize.xs,
                          color: customMuscle === m ? colors.onAccent : colors.text,
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Equipment */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>
                  {t('workouts.exercises.equipment')}
                </Text>
                <View style={styles.pillWrap}>
                  {(
                    ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'none'] as Equipment[]
                  ).map((eq) => (
                    <TouchableOpacity
                      key={eq}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor:
                            customEquipment === eq ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomEquipment(eq)}
                    >
                      <Text
                        style={{
                          fontFamily: typography.body.fontFamily,
                          fontSize: fontSize.xs,
                          color: customEquipment === eq ? colors.onAccent : colors.text,
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}
                      >
                        {eq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Exercise Type */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>
                  {t('workouts.exercises.exerciseType')}
                </Text>
                <View style={styles.pillWrap}>
                  {(['strength', 'cardio', 'bodyweight'] as ExerciseType[]).map((tp) => (
                    <TouchableOpacity
                      key={tp}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor: customType === tp ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomType(tp)}
                    >
                      <Text
                        style={{
                          fontFamily: typography.body.fontFamily,
                          fontSize: fontSize.xs,
                          color: customType === tp ? colors.onAccent : colors.text,
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}
                      >
                        {tp}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.dialogActions}>
                <TouchableOpacity
                  testID="btn-cancel-custom-exercise"
                  style={[styles.dialogBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => setShowCustomModal(false)}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="btn-save-custom-exercise"
                  style={[
                    styles.dialogBtn,
                    {
                      backgroundColor:
                        customName.trim().length > 0 ? colors.accent : colors.surfaceAlt,
                    },
                  ]}
                  disabled={customName.trim().length === 0 || creatingCustom}
                  onPress={handleCreateCustom}
                >
                  {creatingCustom ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <Text
                      style={{
                        color: customName.trim().length > 0 ? colors.onAccent : colors.textMuted,
                        fontWeight: '700',
                      }}
                    >
                      {t('common.save')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScreen: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  modalTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  customAddBtn: {
    padding: 6,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
  },
  chipsRow: {
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  exerciseContent: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  badgeText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  emptyTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  createCustomPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  createCustomPromptText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  dialogBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  dialogTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  formInput: {
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dialogPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dialogBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
});
