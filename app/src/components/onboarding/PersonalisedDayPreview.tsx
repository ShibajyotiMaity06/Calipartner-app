import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Text, dark, homeLayout, radius, space } from '@calipartner/ui';
import { planDayNutrition, type Goal, type WeeklyPlanView } from '@calipartner/core';
import { t } from '@/i18n';
import { CoachMessageBubble } from '@/components/coach/CoachMessageBubble';
import { NutrientSummary } from '@/components/diary/NutrientSummary';
import { ProgressTrack, squadStyles as styles } from '@/components/rooms/SquadViews';

export function PersonalisedDayPreview({
  plan,
  name,
  goal,
  stage,
  onNext,
}: {
  plan: WeeklyPlanView;
  name: string;
  goal: Goal;
  stage: number;
  onNext: () => void;
}) {
  const day = plan.days[0];
  if (!day) return <Text accessibilityRole="alert">{t('fixNovember.unavailable')}</Text>;
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
            <View style={styles.spread}>
              <Text variant="heading">{t('personalDay.diet')}</Text>
              <Ionicons
                name="restaurant-outline"
                size={homeLayout.iconSize}
                color={dark.copper}
                accessible={false}
              />
            </View>
            <NutrientSummary values={planDayNutrition(day)} />
            {day.meals.map((meal, index) => (
              <View key={index} style={styles.divider}>
                <Text variant="heading">{meal.name}</Text>
                <Text variant="bodyS">{meal.portion}</Text>
                <Text variant="bodyS">{meal.ingredients.join(' · ')}</Text>
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
          </View>
          <Text variant="bodyS">{t('personalDay.estimated')}</Text>
        </>
      ) : stage === 1 ? (
        <>
          <Text variant="title1">{t('personalDay.assistant')}</Text>
          <Text>{t('personalDay.coachSubtitle')}</Text>
          <View style={styles.card} testID="onboarding-coach-demo">
            <View style={styles.row}>
              <Ionicons
                name="medkit-outline"
                size={homeLayout.iconSize}
                color={dark.copper}
                accessible={false}
              />
              <Text variant="heading">{t('personalDay.coach')}</Text>
            </View>
            <Text variant="bodyS">{t('personalDay.demo')}</Text>
            {(['ai1', 'human1', 'ai2', 'human2', 'ai3'] as const).map((key, index) => (
              <CoachMessageBubble
                demo
                key={key}
                message={{
                  id: `demo-${key}`,
                  role: index % 2 ? 'user' : 'assistant',
                  content: t(`personalDay.${goal}.${key}`),
                  timestamp: '',
                }}
              />
            ))}
            <View
              style={[styles.row, local.composer]}
              accessible
              accessibilityLabel={t('personalDay.demo')}
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
            {[name, t('personalDay.partner')].map((person, index) => (
              <View key={index} style={styles.column}>
                <View style={styles.card}>
                  <Avatar name={person} size="sm" identityHue={index ? 'teal' : 'iris'} />
                  <Text variant="heading">{person}</Text>
                  <Text variant="bodyS">{t('personalDay.pro')}</Text>
                  <Text variant="bodyS">{t('personalDay.allShared')}</Text>
                  {(['calories', 'protein', 'carbs', 'fat', 'steps', 'water'] as const).map(
                    (metric, metricIndex) => {
                      const percent = [96, 100, 94, 98, 100, 100][metricIndex]! - index * 2;
                      return (
                        <View
                          key={metric}
                          style={styles.metricGroup}
                          accessible
                          accessibilityLabel={`${t(`squadDesign.${metric}`)} ${percent}%`}
                        >
                          <Text variant="bodyS">{t(`squadDesign.${metric}`)}</Text>
                          <Text tabular>{t('squadDesign.percent', { value: percent })}</Text>
                          <ProgressTrack percent={percent} color={index ? dark.teal : dark.iris} />
                        </View>
                      );
                    },
                  )}
                </View>
                <View style={styles.card}>
                  <Text variant="heading">{t('personalDay.workouts')}</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={homeLayout.iconSize}
                    color={index ? dark.teal : dark.iris}
                    accessible={false}
                  />
                  <Text>{t('personalDay.workoutLogged')}</Text>
                  <Text variant="bodyS">
                    {t('personalDay.minutes', { value: index ? 35 : day.workout.minutes || 30 })}
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text variant="heading">{t('personalDay.mealsLogged')}</Text>
                  <Text variant="bodyS">{t('personalDay.sampleMeal')}</Text>
                  <Text variant="bodyS">{t('personalDay.partnerMeal')}</Text>
                </View>
              </View>
            ))}
          </View>
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
