import { NutrientSummary } from '../diary/NutrientSummary';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPreviousDateString, type MealSection } from '@calipartner/core';
import { Button, dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useDiary } from '@/hooks/useDiary';
import { useSteps } from '@/hooks/useSteps';
import { useWater } from '@/hooks/useWater';
import { useWorkouts } from '@/hooks/useWorkouts';
import { FoodLogModal } from '@/components/diary/FoodLogModal';
import { DatePickerSheet } from '@/components/diary/DatePickerSheet';
import { LoadingState } from '@/components/LoadingState';
import { t, getLocale } from '@/i18n';
import { RepeatPreviousMeal } from '@/components/diary/RepeatPreviousMeal';

const sections: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];
const macroColors = [dark.copper, dark.iris, dark.teal, dark.rose];
export function PersonalDiaryView({
  onRefreshReady,
}: {
  onRefreshReady?: (refresh: () => Promise<void>) => void;
}) {
  const { localDate: today } = useCurrentLocalDate();
  const [date, setDate] = useState<string | null>(null);
  const selectedDate = date ?? today;
  const diary = useDiary(selectedDate);
  const [loadedDiaryDate, setLoadedDiaryDate] = useState<string | null>(null);
  useEffect(() => {
    if (!diary.loading && !diary.error) setLoadedDiaryDate(selectedDate);
  }, [diary.loading, diary.error, selectedDate]);
  const steps = useSteps(selectedDate);
  const water = useWater(selectedDate);
  const workouts = useWorkouts(selectedDate);
  const [section, setSection] = useState<MealSection | null>(null);
  const [calendar, setCalendar] = useState(false);
  const { refresh: refreshDiary } = diary;
  const { refresh: refreshSteps } = steps;
  const { refresh: refreshWater } = water;
  const { refresh: refreshWorkouts } = workouts;
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshDiary(), refreshSteps(), refreshWater(), refreshWorkouts()]);
  }, [refreshDiary, refreshSteps, refreshWater, refreshWorkouts]);
  useEffect(() => {
    onRefreshReady?.(refreshAll);
  }, [onRefreshReady, refreshAll]);
  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );
  return (
    <View style={styles.stack} testID="personal-diary">
      <View style={styles.dateRow}>
        <Pressable
          style={styles.touch}
          onPress={() => setDate(getPreviousDateString(selectedDate, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('diary.previousDay')}
          testID="you-previous-day"
        >
          <Ionicons name="chevron-back" size={homeLayout.iconSize} color={dark.textHi} />
        </Pressable>
        <Pressable
          style={[styles.touch, styles.date]}
          onPress={() => setCalendar(true)}
          accessibilityRole="button"
          testID="you-select-date"
        >
          <Text variant="heading">
            {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString(getLocale(), {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </Text>
        </Pressable>
        <Pressable
          style={styles.touch}
          disabled={selectedDate >= today}
          onPress={() => setDate(getPreviousDateString(selectedDate, -1))}
          accessibilityRole="button"
          accessibilityState={{ disabled: selectedDate >= today }}
          accessibilityLabel={t('diary.nextDay')}
          testID="you-next-day"
        >
          <Ionicons
            name="chevron-forward"
            size={homeLayout.iconSize}
            color={selectedDate >= today ? dark.textOff : dark.textHi}
          />
        </Pressable>
      </View>
      {diary.error ? (
        <View style={styles.stack}>
          <Text accessibilityRole="alert">
            {t(
              diary.error === 'FOOD_ENERGY_UNAVAILABLE'
                ? 'fixNovember.energyMissing'
                : 'common.errorBody',
            )}
          </Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void refreshDiary()}
            testID="you-diary-retry"
          />
        </View>
      ) : diary.loading && loadedDiaryDate !== selectedDate ? (
        <LoadingState />
      ) : (
        <>
          <View style={styles.card} testID="you-daily-macros">
            <Text variant="heading">{t('homeRefresh.diary')}</Text>
            <View style={styles.macros}>
              {(['calories', 'protein', 'carbs', 'fat'] as const).map((key, index) => (
                <View key={key} style={styles.macro}>
                  <Text variant="label" nutrient={key} color={macroColors[index]}>
                    {t(('repairs.' + key) as Parameters<typeof t>[0])}
                  </Text>
                  <Text nutrient={key} variant="numeralM" tabular>
                    {diary.daySummary.totals[key]}{' '}
                    {key === 'calories' ? t('homeRefresh.kcalUnit') : t('homeRefresh.gramUnit')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {sections.map((meal) => (
            <View key={meal} style={styles.card} testID={'you-meal-' + meal}>
              <View style={styles.dateRow}>
                <Text variant="heading" style={styles.date}>
                  {t(('diary.sections.' + meal) as Parameters<typeof t>[0])}
                </Text>
                <Pressable
                  style={styles.touch}
                  onPress={() => setSection(meal)}
                  accessibilityRole="button"
                  accessibilityLabel={t('repairs.addFood', {
                    section: t(('diary.sections.' + meal) as Parameters<typeof t>[0]),
                  })}
                  testID={'you-add-' + meal}
                >
                  <Ionicons name="add" size={homeLayout.iconSize} color={dark.copper} />
                </Pressable>
              </View>
              {!diary.daySummary.sections[meal].entries.length ? (
                <Text variant="bodyS">{t('homeRefresh.mealEmpty')}</Text>
              ) : (
                diary.daySummary.sections[meal].entries.map((entry) => (
                  <View key={entry.id} style={styles.food} testID={'you-food-' + entry.id}>
                    <Text color={dark.textHi}>{entry.food_name}</Text>
                    <Text variant="bodyS" tabular>
                      {entry.quantity} {entry.unit}
                    </Text>
                    <NutrientSummary values={entry} />
                  </View>
                ))
              )}
              <RepeatPreviousMeal
                key={`${selectedDate}-${meal}`}
                localDate={selectedDate}
                section={meal}
              />
            </View>
          ))}
        </>
      )}
      <View style={styles.card} testID="you-daily-activity">
        <Text variant="heading">{t('homeRefresh.steps')}</Text>
        {steps.error ? (
          <View>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void refreshSteps()}
            />
          </View>
        ) : (
          <Text variant="numeralM" tabular>
            {steps.loading ? t('common.loading') : steps.steps}
          </Text>
        )}
        <Text variant="heading">{t('homeRefresh.water')}</Text>
        {water.error ? (
          <View>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void refreshWater()}
            />
          </View>
        ) : (
          <Text variant="numeralM" tabular>
            {water.loading
              ? t('common.loading')
              : t('homeRefresh.waterAmount', { amount: water.totalMl })}
          </Text>
        )}
      </View>
      <View style={styles.card} testID="you-daily-workouts">
        <Text variant="heading">{t('squadDesign.workouts')}</Text>
        {workouts.error ? (
          <View>
            <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void refreshWorkouts()}
            />
          </View>
        ) : workouts.loading ? (
          <LoadingState />
        ) : !workouts.workouts.length ? (
          <Text>{t('homeRefresh.workoutEmpty')}</Text>
        ) : (
          workouts.workouts.map((workout) => {
            const summary = workouts.getSummary(workout);
            return (
              <View key={workout.id} style={styles.food}>
                <Text variant="heading">{workout.name ?? t('homeRefresh.workout')}</Text>
                <Text variant="bodyS" tabular>
                  {t('homeRefresh.workoutSummary', {
                    minutes: workout.duration_minutes,
                    sets: summary.total_sets,
                    reps: summary.total_reps,
                  })}
                </Text>
                {workout.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.stack}>
                    <Text>{exercise.exercise_name}</Text>
                    {(exercise.sets ?? []).map((set) => (
                      <Text key={set.id} variant="bodyS" tabular>
                        {t('squadDesign.set', {
                          number: set.set_number,
                          reps: set.reps ?? '\u2014',
                        })}
                        {set.weight_kg != null
                          ? ' \u00b7 ' + t('squadDesign.load', { weight: set.weight_kg })
                          : ''}
                        {set.duration_seconds != null
                          ? ' \u00b7 ' + t('squadDesign.seconds', { count: set.duration_seconds })
                          : ''}
                        {set.distance_meters != null
                          ? ' \u00b7 ' + t('squadDesign.meters', { count: set.distance_meters })
                          : ''}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </View>
      {section && (
        <FoodLogModal
          visible
          defaultSection={section}
          localDate={selectedDate}
          onClose={() => setSection(null)}
          onLogged={() => void refreshDiary()}
        />
      )}
      {calendar && (
        <DatePickerSheet
          visible
          selectedDate={selectedDate}
          onSelectDate={setDate}
          onClose={() => setCalendar(false)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: space[3] },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  date: { flex: 1 },
  touch: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  macros: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  macro: { flexGrow: 1, flexBasis: '40%', gap: space[1] },
  food: {
    gap: space[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
    paddingTop: space[3],
  },
});
