import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

export interface RoutineItem {
  id: string;
  name: string;
  type: string;
  exerciseCount: number;
  estimatedMinutes: number;
}

export interface WorkoutRoutinesModalProps {
  visible: boolean;
  onClose: () => void;
  onStartRoutine?: (routine: RoutineItem) => void;
  testID?: string;
}

const SAMPLE_ROUTINES: RoutineItem[] = [
  {
    id: 'r1',
    name: 'Upper Body Push (Chest & Shoulders)',
    type: 'Strength',
    exerciseCount: 5,
    estimatedMinutes: 45,
  },
  { id: 'r2', name: 'Lower Body & Core', type: 'Strength', exerciseCount: 4, estimatedMinutes: 50 },
  {
    id: 'r3',
    name: 'High-Intensity Interval Run',
    type: 'Cardio',
    exerciseCount: 1,
    estimatedMinutes: 30,
  },
];

export function WorkoutRoutinesModal({
  visible,
  onClose,
  onStartRoutine,
  testID = 'workout-routines-modal',
}: WorkoutRoutinesModalProps) {
  const [routines, setRoutines] = useState<RoutineItem[]>(SAMPLE_ROUTINES);

  if (!visible) return null;

  const handleDuplicate = (routine: RoutineItem) => {
    const copy: RoutineItem = {
      ...routine,
      id: `r-${Date.now()}`,
      name: `${routine.name} (Copy)`,
    };
    setRoutines([...routines, copy]);
  };

  const handleDelete = (id: string) => {
    setRoutines(routines.filter((r) => r.id !== id));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
        />

        <View style={styles.sheet} testID="routines-sheet-container">
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="folder-outline" size={20} color={dark.apricot} />
              <Text style={styles.title}>{t('workouts.routinesTitle')}</Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={dark.textMid} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {routines.length === 0 ? (
              <View style={styles.emptyBox} testID="routines-empty-state">
                <Ionicons name="fitness-outline" size={32} color={dark.textLo} />
                <Text style={styles.emptyText}>{t('workouts.noRoutinesYet')}</Text>
              </View>
            ) : (
              routines.map((routine) => (
                <View
                  key={routine.id}
                  style={styles.routineCard}
                  testID={`routine-card-${routine.id}`}
                >
                  <View style={styles.routineInfo}>
                    <Text style={styles.routineName}>{routine.name}</Text>
                    <Text style={styles.routineMeta}>
                      {`${routine.type} • ${routine.exerciseCount} exercises • ${routine.estimatedMinutes} min`}
                    </Text>
                  </View>

                  <View style={styles.routineActions}>
                    {/* Duplicate button */}
                    <Pressable
                      onPress={() => handleDuplicate(routine)}
                      style={styles.iconBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('workouts.duplicateRoutine')} ${routine.name}`}
                    >
                      <Ionicons name="copy-outline" size={16} color={dark.textMid} />
                    </Pressable>

                    {/* Delete button */}
                    <Pressable
                      onPress={() => handleDelete(routine.id)}
                      style={styles.iconBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${routine.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={dark.textLo} />
                    </Pressable>

                    {/* Start routine button */}
                    <Pressable
                      testID={`btn-start-routine-${routine.id}`}
                      style={styles.startBtn}
                      onPress={() => {
                        onStartRoutine?.(routine);
                        onClose();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('workouts.startRoutine')} ${routine.name}`}
                    >
                      <Text style={styles.startBtnText}>{t('workouts.startRoutine')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Close Action */}
          <View style={styles.footer}>
            <Pressable
              style={styles.closeActionBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeActionBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dark.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
    maxHeight: '90%',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: dark.hairlineLit,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 400,
  },
  scrollContent: {
    gap: space[2],
  },
  emptyBox: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  emptyText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
    paddingHorizontal: space[4],
  },
  routineCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  routineInfo: {
    gap: 2,
  },
  routineName: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  routineMeta: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  routineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[2],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    minHeight: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
  footer: {
    paddingTop: space[2],
  },
  closeActionBtn: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
});
