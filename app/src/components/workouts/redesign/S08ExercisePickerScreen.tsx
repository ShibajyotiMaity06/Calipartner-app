import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { WorkoutChip } from '../s_common';
import { EXERCISE_CATALOG, type CatalogExercise } from '@calipartner/core';

interface S08ExercisePickerScreenProps {
  mode: 'plan' | 'session' | 'log';
  onSelect: (exercise: CatalogExercise) => void;
  onBack: () => void;
}

export function S08ExercisePickerScreen({ mode, onSelect, onBack }: S08ExercisePickerScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');

  const muscleFilters = [
    { id: 'all', label: 'All' },
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'legs', label: 'Legs' },
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'arms', label: 'Arms' },
    { id: 'core', label: 'Core' },
  ];

  const filteredExercises = EXERCISE_CATALOG.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesMuscle =
      selectedMuscle === 'all' || ex.primary_muscle.toLowerCase() === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  return (
    <View style={styles.screenContainer} testID="s08-exercise-picker-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="exercise-picker-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'log' ? 'Log activity' : 'Choose exercise'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={workoutTokens.dim} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          placeholderTextColor={workoutTokens.dim}
          style={styles.searchInput}
          testID="exercise-search-input"
        />
        {searchQuery ? (
          <Pressable
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={18} color={workoutTokens.dim} />
          </Pressable>
        ) : null}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScrollContainer}
        contentContainerStyle={styles.chipsScroll}
      >
        {muscleFilters.map((m) => (
          <WorkoutChip
            key={m.id}
            label={m.label}
            selected={selectedMuscle === m.id}
            onPress={() => setSelectedMuscle(m.id)}
            testID={`filter-${m.id}`}
          />
        ))}
      </ScrollView>

      {/* Exercise list */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultsCount}>{filteredExercises.length} EXERCISES</Text>

        {filteredExercises.map((ex) => (
          <Pressable
            key={ex.id}
            testID={`exercise-pick-${ex.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${ex.name}, muscle ${ex.primary_muscle}`}
            onPress={() => onSelect(ex)}
            style={styles.exerciseCard}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Text style={styles.exerciseMeta}>
                {ex.primary_muscle} · {ex.equipment.replace('_', ' ')}
              </Text>
            </View>
            <Ionicons name="add-circle-outline" size={24} color={workoutTokens.accent} />
          </Pressable>
        ))}

        <View style={styles.scrollSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: workoutTokens.text,
    fontSize: 15,
  },
  chipsScrollContainer: {
    flexGrow: 0,
    height: 44,
    marginBottom: 8,
  },
  chipsScroll: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 8,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 60,
  },
  resultsCount: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 8,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  scrollSpacer: {
    height: 40,
  },
});
