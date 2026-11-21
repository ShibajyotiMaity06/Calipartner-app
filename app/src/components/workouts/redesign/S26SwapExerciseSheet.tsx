import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton } from '../s_common';
import type { SessionExercise } from '@/services/workoutRedesignService';
import { EXERCISE_CATALOG, type CatalogExercise } from '@calipartner/core';

interface S26SwapExerciseSheetProps {
  visible: boolean;
  exercise: SessionExercise | null;
  onSwap: (newExercise: CatalogExercise, scope: 'just_today' | 'update_plan') => void;
  onClose: () => void;
}

export function S26SwapExerciseSheet({
  visible,
  exercise,
  onSwap,
  onClose,
}: S26SwapExerciseSheetProps) {
  const [selectedScope, setSelectedScope] = useState<'just_today' | 'update_plan'>('just_today');
  const [selectedEx, setSelectedEx] = useState<CatalogExercise | null>(null);

  if (!exercise) return null;

  // Filter alternatives from catalog
  const currentCatalogEx = EXERCISE_CATALOG.find(
    (e: CatalogExercise) => e.name.toLowerCase() === exercise.exercise_name.toLowerCase(),
  );
  const muscleGroup = currentCatalogEx?.primary_muscle || 'chest';

  const alternatives: CatalogExercise[] = EXERCISE_CATALOG.filter(
    (e: CatalogExercise) =>
      e.primary_muscle === muscleGroup &&
      e.name.toLowerCase() !== exercise.exercise_name.toLowerCase(),
  ).slice(0, 8);

  const handleConfirmSwap = () => {
    if (selectedEx) {
      onSwap(selectedEx, selectedScope);
    }
  };

  return (
    <WorkoutSheet
      visible={visible}
      onClose={onClose}
      title={`Swap ${exercise.exercise_name}`}
      testID="s26-swap-exercise-sheet"
    >
      <View style={styles.container}>
        {/* Scope Selector */}
        <View style={styles.scopeContainer}>
          <Pressable
            testID="scope-just-today"
            accessibilityRole="button"
            accessibilityState={{ selected: selectedScope === 'just_today' }}
            onPress={() => setSelectedScope('just_today')}
            style={[styles.scopeBtn, selectedScope === 'just_today' && styles.scopeBtnActive]}
          >
            <Text
              style={[styles.scopeText, selectedScope === 'just_today' && styles.scopeTextActive]}
            >
              Just today
            </Text>
          </Pressable>
          <Pressable
            testID="scope-update-plan"
            accessibilityRole="button"
            accessibilityState={{ selected: selectedScope === 'update_plan' }}
            onPress={() => setSelectedScope('update_plan')}
            style={[styles.scopeBtn, selectedScope === 'update_plan' && styles.scopeBtnActive]}
          >
            <Text
              style={[styles.scopeText, selectedScope === 'update_plan' && styles.scopeTextActive]}
            >
              Update my plan
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>ALTERNATIVE EXERCISES</Text>

        <ScrollView style={styles.alternativesList} showsVerticalScrollIndicator={false}>
          {alternatives.map((alt: CatalogExercise) => {
            const isSelected = selectedEx?.id === alt.id;
            return (
              <Pressable
                key={alt.id}
                testID={`swap-alt-${alt.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${alt.name}, equipment ${alt.equipment}`}
                onPress={() => setSelectedEx(alt)}
                style={[styles.altCard, isSelected && styles.altCardSelected]}
              >
                <View style={styles.altTextCol}>
                  <Text style={styles.altName}>{alt.name}</Text>
                  <Text style={styles.altMeta}>
                    {alt.equipment.replace('_', ' ')} · {alt.is_compound ? 'Compound' : 'Isolation'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    isSelected ? styles.checkCircleSelected : styles.checkCircleUnselected,
                  ]}
                >
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color={workoutTokens.onAccent} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <PrimaryButton
          label="Swap exercise"
          onPress={handleConfirmSwap}
          disabled={!selectedEx}
          style={styles.confirmBtn}
          testID="confirm-swap-btn"
        />
      </View>
    </WorkoutSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
  },
  scopeContainer: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.control,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  scopeBtn: {
    flex: 1,
    borderRadius: workoutRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: workoutTokens.selected,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  scopeText: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
  },
  scopeTextActive: {
    color: workoutTokens.text,
  },
  sectionTitle: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  alternativesList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1.5,
    borderColor: workoutTokens.border,
    padding: 14,
    marginBottom: 8,
  },
  altCardSelected: {
    backgroundColor: workoutTokens.accentSoft,
    borderColor: workoutTokens.accent,
  },
  altTextCol: {
    flex: 1,
  },
  altName: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  altMeta: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: workoutRadius.badge,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleUnselected: {
    borderColor: workoutTokens.borderStrong,
  },
  checkCircleSelected: {
    borderColor: workoutTokens.accent,
    backgroundColor: workoutTokens.accent,
  },
  confirmBtn: {
    width: '100%',
  },
});
