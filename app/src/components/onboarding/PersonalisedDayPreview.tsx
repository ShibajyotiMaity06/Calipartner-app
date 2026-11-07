import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Text, dark, homeLayout, radius, space } from '@calipartner/ui';
import {
  buildOnboardingDemo,
  demoGoalPercent,
  hasStructuredDayMeals,
  planDayNutrition,
  type Goal,
  type GoalProfile,
  type WeeklyPlanView,
} from '@calipartner/core';
import { t } from '@/i18n';
import { CoachMessageBubble } from '@/components/coach/CoachMessageBubble';
import { NutrientSummary } from '@/components/diary/NutrientSummary';
import { ProgressTrack, squadStyles as styles } from '@/components/rooms/SquadViews';

export function PersonalisedDayPreview({
  plan,
  name,
  goal,
  targets = null,
  stage,
  onNext,
  onRebuild,
}: {
  plan: WeeklyPlanView;
  name: string;
  goal: Goal;
  targets?: GoalProfile | null;
  stage: number;
  onNext: () => void;
  onRebuild?: () => void;
}) {
  const [copiedWorkout, setCopiedWorkout] = useState(false),
    [copiedMeals, setCopiedMeals] = useState(false);
  const day = plan.days[0];
  if (!day) return <Text accessibilityRole="alert">{t('fixNovember.unavailable')}</Text>;
  if (!hasStructuredDayMeals(day))
    return (
      <View style={styles.card}>
        <Text>{t('personalDay.refreshDay')}</Text>
        {onRebuild && (
          <Button
            label={t('personalDay.refreshDayAction')}
            onPress={onRebuild}
            testID="refresh-personalised-day"
          />
        )}
      </View>
    );
  const demo = buildOnboardingDemo(targets, day, plan.preferences);
  const params = {
    name,
    calories: demo.targets.calories,
    protein: demo.targets.protein,
    carbs: demo.targets.carbs,
    fat: demo.targets.fat,
    yesterdayCalories: demo.yesterdayCalories,
    yesterdayProtein: demo.yesterdayProtein,
    exercise: demo.exercise?.name ?? t('personalDay.comfortableMovement'),
    sets: demo.sets,
    reps: demo.reps,
    nextReps: demo.nextReps,
    load:
      demo.exampleLoad == null
        ? t('personalDay.bodyweight')
        : t('personalDay.exampleLoad', { value: demo.exampleLoad }),
    minutes: demo.minutes,
    cuisine: plan.preferences.cuisine,
    meal: day.meals[0]!.name,
    steps: demo.targets.steps,
    water: demo.targets.water,
  };
  return (
    <View style={styles.stack} testID={`personalised-preview-${stage}`}>
      <View style={styles.row}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[local.step, { backgroundColor: index === stage ? dark.copper : dark.s3 }]}
          />
        ))}
      </View>
      {stage === 0 ? (
        <>
          <Text variant="title1">{t('personalDay.title')}</Text>
          <Text>{t('personalDay.subtitle')}</Text>
          <View style={styles.card}>
            <View style={styles.spread}>
              <Text variant="heading">{t('personalDay.workout')}</Text>
              <Ionicons
                name="barbell-outline"
                size={homeLayout.iconSize}
                color={dark.copper}
                accessible={false}
              />
            </View>
            <Text variant="title2">{day.workout.title}</Text>
            <Text tabular>{t('personalDay.minutes', { value: day.workout.minutes })}</Text>
            {day.workout.exercises.length ? (
              day.workout.exercises.map((exercise, index) => (
                <View style={styles.divider} key={index}>
                  <Text variant="heading">{exercise.name}</Text>
                  <Text variant="bodyS" tabular>
                    {t('personalDay.exercise', {
                      sets: exercise.sets,
                      reps: exercise.reps,
                      rest: exercise.rest_seconds,
                    })}
                  </Text>
                </View>
              ))
            ) : (
              <Text>{t('personalDay.rest')}</Text>
            )}
          </View>
          <View style={styles.card}>
            <Text variant="heading">{t('personalDay.diet')}</Text>
            <NutrientSummary values={planDayNutrition(day)} />
          </View>
          {day.meals.map((meal) => (
            <View key={meal.section} style={styles.card} testID={`preview-meal-${meal.section}`}>
              <Text variant="bodyS" color={dark.copper}>
                {t(`diary.sections.${meal.section!}`)}
              </Text>
              <Text variant="heading">{meal.name}</Text>
              <NutrientSummary
                values={{
                  calories: meal.calories,
                  protein: meal.protein,
                  carbs: meal.carbs,
                  fat: meal.fat,
                }}
              />
            </View>
          ))}
          <Text variant="bodyS">{t('personalDay.estimated')}</Text>
        </>
      ) : stage === 1 ? (
        <>
          <Text variant="title1">{t('personalDay.assistant')}</Text>
          <Text>{t('personalDay.coachSubtitle')}</Text>
          <View style={styles.card} testID="onboarding-coach-demo">
            <Text variant="heading">{t('personalDay.coach')}</Text>
            {(['ai1', 'human1', 'ai2', 'human2', 'ai3'] as const).map((key, index) => (
              <CoachMessageBubble
                demo
                key={key}
                message={{
                  id: `demo-${key}`,
                  role: index % 2 ? 'user' : 'assistant',
                  content: t(`personalDay.${goal}.${key}`, params),
                  timestamp: '',
                }}
              />
            ))}
            <View
              style={[styles.row, local.composer]}
              accessible
              accessibilityLabel={t('personalDay.coachSubtitle')}
            >
              <Text color={dark.textLo}>{t('personalDay.composer')}</Text>
              <Ionicons
                name="arrow-up-circle-outline"
                size={homeLayout.iconSize}
                color={dark.textLo}
                accessible={false}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text variant="title1">{t('personalDay.compare')}</Text>
          <Text>{t('personalDay.compareSubtitle')}</Text>
          <Text variant="bodyS">{t('personalDay.compareDemo')}</Text>
          <View style={styles.columns} testID="onboarding-compare-demo">
            {[name, t('personalDay.partner')].map((person, index) => {
              const values = index ? demo.partnerValues : demo.values,
                limits = index ? demo.partnerTargets : demo.targets;
              return (
                <View key={index} style={styles.column}>
                  <View style={styles.card}>
                    <Avatar name={person} size="sm" identityHue={index ? 'teal' : 'iris'} />
                    <Text variant="heading">{person}</Text>
                    <Text variant="bodyS">{t('personalDay.pro')}</Text>
                    <Text variant="bodyS">{t('personalDay.allShared')}</Text>
                    {(['calories', 'protein', 'carbs', 'fat', 'steps', 'water'] as const).map(
                      (metric) => (
                        <View key={metric} style={styles.metricGroup}>
                          <Text variant="bodyS">{t(`squadDesign.${metric}`)}</Text>
                          <Text variant="bodyS" tabular>
                            {t('squadDesign.amount', {
                              value: values[metric],
                              target: limits[metric],
                              unit: t(
                                metric === 'steps'
                                  ? 'squadDesign.stepUnit'
                                  : metric === 'water'
                                    ? 'squadDesign.ml'
                                    : metric === 'calories'
                                      ? 'squadDesign.kcal'
                                      : 'squadDesign.grams',
                              ),
                            })}
                          </Text>
                          <Text tabular>
                            {t('squadDesign.percent', {
                              value: demoGoalPercent(values[metric], limits[metric]),
                            })}
                          </Text>
                          <ProgressTrack
                            percent={demoGoalPercent(values[metric], limits[metric])}
                            color={index ? dark.teal : dark.iris}
                          />
                        </View>
                      ),
                    )}
                  </View>
                  <View style={styles.card}>
                    <Text variant="heading">{t('personalDay.workouts')}</Text>
                    <Text>{t('personalDay.workoutLogged')}</Text>
                    <Text variant="bodyS" tabular>
                      {t('personalDay.minutes', { value: demo.minutes })}
                    </Text>
                    {day.workout.exercises.map((exercise, exerciseIndex) => (
                      <View key={exerciseIndex} style={styles.metricGroup}>
                        <Text variant="bodyS">{exercise.name}</Text>
                        <Text variant="bodyS" tabular>
                          {t('personalDay.exercise', {
                            sets: exercise.sets,
                            reps: exercise.reps,
                            rest: exercise.rest_seconds,
                          })}
                        </Text>
                      </View>
                    ))}
                    {!day.workout.exercises.length && (
                      <Text>{t('personalDay.comfortableMovement')}</Text>
                    )}
                    {!index && copiedWorkout && (
                      <Text accessibilityLiveRegion="polite">{t('personalDay.addedPreview')}</Text>
                    )}
                    {index === 1 && (
                      <Button
                        variant="secondary"
                        label={t(
                          copiedWorkout ? 'personalDay.addedPreview' : 'personalDay.addMine',
                        )}
                        disabled={copiedWorkout}
                        onPress={() => setCopiedWorkout(true)}
                        testID="demo-copy-workout"
                      />
                    )}
                  </View>
                  <View style={styles.card}>
                    <Text variant="heading">{t('personalDay.mealsLogged')}</Text>
                    {day.meals.map((meal) => (
                      <View style={styles.metricGroup} key={meal.section}>
                        <Text variant="bodyS">{t(`diary.sections.${meal.section!}`)}</Text>
                        <Text variant="bodyS">{meal.name}</Text>
                        <NutrientSummary
                          values={{
                            calories: meal.calories,
                            protein: meal.protein,
                            carbs: meal.carbs,
                            fat: meal.fat,
                          }}
                        />
                      </View>
                    ))}
                    {!index && copiedMeals && (
                      <Text accessibilityLiveRegion="polite">{t('personalDay.addedPreview')}</Text>
                    )}
                    {index === 1 && (
                      <Button
                        variant="secondary"
                        label={t(copiedMeals ? 'personalDay.addedPreview' : 'personalDay.addMine')}
                        disabled={copiedMeals}
                        onPress={() => setCopiedMeals(true)}
                        testID="demo-copy-meals"
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <Text variant="bodyS">{t('personalDay.previewOnly')}</Text>
          <View style={styles.card}>
            <Text variant="title2">{t('personalDay.waiting')}</Text>
            <Text>{t('personalDay.waitingBody')}</Text>
          </View>
        </>
      )}
      <Button
        label={t(stage === 2 ? 'personalDay.grab' : 'personalDay.next')}
        onPress={onNext}
        testID="personalised-preview-next"
      />
    </View>
  );
}
const local = StyleSheet.create({
  step: { flex: 1, height: space[1], borderRadius: radius.full },
  composer: {
    padding: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    justifyContent: 'space-between',
  },
});
