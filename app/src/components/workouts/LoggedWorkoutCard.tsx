import { Button } from '@calipartner/ui';
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { controls, radius, space, Text, useTheme } from '@calipartner/ui';
import type { WorkoutWithDetails } from '@calipartner/core';
import { t } from '@/i18n';
export function LoggedWorkoutCard({
  workout,
  onEdit,
  onDelete,
}: {
  workout: WorkoutWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const title =
    workout.name || workout.exercises[0]?.exercise_name || t(`workouts.types.${workout.type}`);
  return (
    <View
      style={{
        padding: space[3],
        gap: space[3],
        backgroundColor: colors.s1,
        borderColor: colors.hairline,
        borderWidth: controls.border,
        borderRadius: radius.card,
      }}
      testID={`logged-workout-${workout.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Ionicons name="barbell-outline" size={controls.icon} color={colors.textMid} />
        <Text variant="heading" style={{ flex: 1 }}>
          {title}
        </Text>
        {(['edit', 'delete'] as const).map((action) => (
          <Button
            variant="destructive"
            fullWidth={false}
            label={t(action === 'edit' ? 'workoutPolish.edit' : 'workoutPolish.remove', {
              name: title,
            })}
            iconOnly
            icon={
              <Ionicons
                name={action === 'edit' ? 'create-outline' : 'trash-outline'}
                size={controls.icon}
                color={action === 'delete' ? colors.danger : colors.textHi}
              />
            }
            key={action}
            accessibilityRole="button"
            accessibilityLabel={t(
              action === 'edit' ? 'workoutPolish.edit' : 'workoutPolish.remove',
              { name: title },
            )}
            onPress={action === 'edit' ? onEdit : onDelete}
            style={{
              minHeight: controls.touch,
              minWidth: controls.touch,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.full,
              backgroundColor: colors.s2,
            }}
            testID={`logged-workout-${action}-${workout.id}`}
          />
        ))}
      </View>
      {workout.exercises.map((exercise) => (
        <View key={exercise.id} style={{ gap: space[2] }}>
          {exercise.exercise_name.trim().toLowerCase() !== title.trim().toLowerCase() && (
            <Text variant="label">{exercise.exercise_name}</Text>
          )}
          {(exercise.sets ?? [])
            .filter((set) => set.completed)
            .map((set) => (
              <View
                key={set.id}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[2],
                  borderRadius: radius.control,
                  backgroundColor: colors.s2,
                }}
              >
                <Text variant="micro" color={colors.textMid}>
                  {t('workoutPolish.set', { number: set.set_number })}
                </Text>
                {!!set.reps && (
                  <Text tabular>{t('workoutPolish.repsValue', { count: set.reps })}</Text>
                )}
                {!!set.weight_kg && set.weight_kg > 0 && (
                  <Text tabular>{t('workoutPolish.weightValue', { value: set.weight_kg })}</Text>
                )}
                {!!set.duration_seconds && (
                  <Text tabular>
                    {t('workoutPolish.duration', { value: Math.round(set.duration_seconds / 60) })}
                  </Text>
                )}
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}
