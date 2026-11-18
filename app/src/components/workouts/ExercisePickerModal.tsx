import { Button } from '@calipartner/ui';
import { loadAccountTable } from '@/services/accountDataService';
import { ExerciseSetsForm, type ExerciseSetInput } from './ExerciseSetsForm';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { type as inputTypography } from '@calipartner/ui';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, homeLayout, type as typography } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { Equipment, Exercise, ExerciseType, MuscleGroup } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { createCustomExercise, getExercises } from '@/services/workoutService';
import { generateClientUuid } from '@/services/foodService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise, sets: ExerciseSetInput[]) => void | Promise<void>;
  submitLabel?: string;
  testID?: string;
}

const MUSCLE_GROUPS = ['upper', 'lower', 'core'] as const;
type ExerciseFilter = (typeof MUSCLE_GROUPS)[number];
const filterGroups: Record<ExerciseFilter, readonly string[]> = {
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs'],
  core: ['core'],
};

export function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  submitLabel,
  testID = 'exercise-picker-modal',
}: ExercisePickerModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest-user';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<ExerciseFilter>('upper');
  const [configuring, setConfiguring] = useState<Exercise | null>(null);
  const requestVersion = React.useRef(0);
  const loadedCatalog = React.useRef<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
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
  const [customError, setCustomError] = useState(false);
  const customRequest = React.useRef<string | null>(null);
  const customSaving = React.useRef(false);
  const closeCustom = () => {
    if (!customSaving.current) setShowCustomModal(false);
  };
  const backLabel = t(configuring ? 'common.back' : 'common.cancel');
  const back = () => {
    if (showCustomModal) closeCustom();
    else if (configuring) setConfiguring(null);
    else onClose();
  };
  useBrowserModalBack(visible, onClose, {
    depth: Number(Boolean(configuring || showCustomModal)),
    onDepthChange: back,
  });

  const fetchExercises = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      if (loadedCatalog.current !== userId) {
        await loadAccountTable(db, 'exercises', userId);
        loadedCatalog.current = userId;
      }
      const list = await getExercises(db, {
        searchQuery: searchQuery.trim().length > 0 ? searchQuery : undefined,
        userId,
      });
      const filtered = list.filter((exercise) =>
        filterGroups[selectedMuscle].includes(exercise.muscle_group),
      );
      if (version === requestVersion.current) {
        setExercises(filtered);
        setVisibleCount(5);
      }
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [selectedMuscle, searchQuery, userId]);

  useEffect(() => {
    if (visible) {
      void fetchExercises();
    }
  }, [visible, fetchExercises]);

  const handleCreateCustom = async () => {
    if (!customName.trim() || customSaving.current) return;
    customSaving.current = true;
    setCustomError(false);
    try {
      setCreatingCustom(true);
      const db = await getDb();
      const created = await createCustomExercise(
        db,
        {
          id: (customRequest.current ??= generateClientUuid()),
          name: customName.trim(),
          muscleGroup: customMuscle,
          equipment: customEquipment,
          type: customType,
        },
        userId,
      );
      setShowCustomModal(false);
      setCustomName('');
      setConfiguring(created);
      customRequest.current = null;
    } catch {
      setCustomError(true);
    } finally {
      customSaving.current = false;
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
          setConfiguring(item);
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
      onRequestClose={back}
    >
      <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.modalHeader,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <Button
            variant="tertiary"
            fullWidth={false}
            label={backLabel}
            iconOnly
            icon={
              <Ionicons
                name={configuring ? 'chevron-back' : 'close'}
                size={24}
                color={colors.text}
              />
            }
            testID={`${testID}-btn-close`}
            onPress={back}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          />
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t('workouts.exercises.title')}
          </Text>
          <View style={styles.closeBtn} accessible={false} />
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
              style={[
                [styles.searchInput, { color: colors.text }],
                { fontFamily: inputTypography.body.fontFamily },
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('workouts.exercises.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('workouts.exercises.searchPlaceholder')}
            />
            {searchQuery.length > 0 && (
              <Button
                variant="tertiary"
                fullWidth={false}
                label={t('personalDay.clearSearch')}
                iconOnly
                icon={<Ionicons name="close-circle" size={18} color={colors.textMuted} />}
                testID={`${testID}-btn-clear-search`}
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('personalDay.clearSearch')}
                style={styles.closeBtn}
              />
            )}
          </View>
        </View>

        {!configuring && (
          <>
            {/* Muscle Group Filter Chips */}
            <View style={styles.chipsRow}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={MUSCLE_GROUPS}
                ListFooterComponent={
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    label={t('ownerPolish.custom')}
                    testID="workout-custom-exercise"
                    onPress={() => {
                      setCustomError(false);
                      setShowCustomModal(true);
                    }}
                    style={styles.chip}
                  />
                }
                keyExtractor={(item) => item}
                contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
                renderItem={({ item }) => {
                  const active = selectedMuscle === item;
                  return (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={t(`personalDay.${item}`)}
                      testID={`chip-muscle-${item}`}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedMuscle(item)}
                      accessibilityRole="button"
                      accessibilityLabel={t(`personalDay.${item}`)}
                      accessibilityState={{ selected: active }}
                    />
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
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('common.retry')}
                  testID={`${testID}-btn-retry`}
                  style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                  onPress={fetchExercises}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                />
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons name="barbell-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('workouts.exercises.noExercisesFound')}
                </Text>
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('workouts.exercises.createCustom')}
                  icon={<Ionicons name="add-circle-outline" size={18} color={colors.onAccent} />}
                  testID={`${testID}-btn-create-custom-empty`}
                  style={[styles.createCustomPromptBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setShowCustomModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.exercises.createCustom')}
                />
              </View>
            ) : (
              <FlatList
                testID={`${testID}-list`}
                data={exercises.slice(0, visibleCount)}
                keyExtractor={(item) => item.id}
                renderItem={renderExerciseItem}
                ListFooterComponent={
                  visibleCount < exercises.length ? (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={t('workoutFlow.moreExercises', {
                        count: Math.min(5, exercises.length - visibleCount),
                      })}
                      style={styles.moreAction}
                      accessibilityRole="button"
                      accessibilityLabel={t('workoutFlow.moreExercises', {
                        count: Math.min(5, exercises.length - visibleCount),
                      })}
                      onPress={() =>
                        setVisibleCount((count) => Math.min(count + 5, exercises.length))
                      }
                      testID="exercise-show-more"
                    />
                  ) : null
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
        {configuring && (
          <ScrollView
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            <ExerciseSetsForm
              key={configuring.id}
              name={configuring.name}
              onCancel={() => setConfiguring(null)}
              submitLabel={submitLabel}
              onAdd={async (sets) => {
                await onSelectExercise(configuring, sets);
                setConfiguring(null);
                onClose();
              }}
            />
          </ScrollView>
        )}

        {/* Custom Exercise Modal */}
        <Modal
          testID="custom-exercise-modal"
          visible={showCustomModal}
          transparent
          animationType="fade"
          onRequestClose={closeCustom}
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
                    [
                      styles.formInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ],
                    { fontFamily: inputTypography.body.fontFamily },
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
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={m}
                      key={m}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor: customMuscle === m ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomMuscle(m)}
                    />
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
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={eq}
                      key={eq}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor:
                            customEquipment === eq ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomEquipment(eq)}
                    />
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
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={tp}
                      key={tp}
                      style={[
                        styles.dialogPill,
                        {
                          backgroundColor: customType === tp ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setCustomType(tp)}
                    />
                  ))}
                </View>
              </View>

              {customError && <Text accessibilityRole="alert">{t('workoutFlow.error')}</Text>}
              <View style={styles.dialogActions}>
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
                <Button
                  variant="cancel"
                  label={t('common.cancel')}
                  testID="btn-cancel-custom-exercise"
                  disabled={creatingCustom}
                  onPress={() => setShowCustomModal(false)}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  moreAction: {
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
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
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  modalTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  customAddBtn: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: homeLayout.touchSize,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    minHeight: homeLayout.touchSize,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
  },
  chipsRow: {
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: homeLayout.touchSize,
    justifyContent: 'center',
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
    minHeight: homeLayout.touchSize,
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
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dialogBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
});
