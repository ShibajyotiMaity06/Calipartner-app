import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  dark,
  homeLayout,
  radius,
  space,
  motion,
  Text,
  useReducedMotion,
} from '@calipartner/ui';
import type { GoalProfile, PlanPreferences } from '@calipartner/core';
import { t } from '@/i18n';
import { NutrientSummary } from '@/components/diary/NutrientSummary';
import { squadStyles as styles } from '@/components/rooms/SquadViews';

export function WeeklyPlanPreparing({
  singleDay = false,
  name = '',
  preferences,
  targets,
}: {
  singleDay?: boolean;
  name?: string;
  preferences?: PlanPreferences;
  targets?: GoalProfile | null;
}) {
  const [selected, setSelected] = useState<'workout' | 'food' | 'targets'>('workout');
  const [width, setWidth] = useState<number>(homeLayout.cardWidth);
  const [longWait, setLongWait] = useState(false);
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.seam.duration * 2,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);
  useEffect(() => {
    const timer = setTimeout(() => setLongWait(true), 30000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.stack} testID="weekly-plan-preparing">
      <Text variant="title1">{t('personalDay.preparingTitle', { name })}</Text>
      <Text>{t('personalDay.preparingBody')}</Text>
      <View style={styles.card}>
        <View style={styles.spread}>
          <Text variant="heading">{t(singleDay ? 'personalDay.title' : 'fixNovember.weekly')}</Text>
          <ActivityIndicator color={dark.copper} />
        </View>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{
            height: space[3],
            backgroundColor: dark.s3,
            borderRadius: radius.full,
            overflow: 'hidden',
          }}
          accessibilityRole="progressbar"
          accessibilityValue={{ text: t('personalDay.buildingAndChecking') }}
          accessibilityLabel={t('personalDay.preparingBody')}
          testID="personal-plan-progress"
        >
          <Animated.View
            style={{
              height: '100%',
              width: `${homeLayout.planProgressChunk * 100}%`,
              borderRadius: radius.full,
              backgroundColor: dark.copper,
              transform: [
                {
                  translateX: reducedMotion
                    ? space[0]
                    : progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-width * homeLayout.planProgressChunk, width],
                      }),
                },
              ],
            }}
          />
        </View>
        <View style={styles.row}>
          <Ionicons
            name="checkmark-circle-outline"
            size={homeLayout.iconSize}
            color={dark.textMid}
            accessible={false}
          />
          <Text>{t('personalDay.detailsReady')}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons
            name="sparkles-outline"
            size={homeLayout.iconSize}
            color={dark.copper}
            accessible={false}
          />
          <Text>{t('personalDay.buildingAndChecking')}</Text>
        </View>
        <Text variant="bodyS">{t('personalDay.progressHonesty')}</Text>
        {longWait && (
          <Text accessibilityLiveRegion="polite">
            {t(singleDay ? 'personalDay.waitingPlan' : 'aha.waiting')}
          </Text>
        )}
      </View>
      <Text variant="heading">{t('personalDay.exploreInputs')}</Text>
      <View style={styles.row}>
        {(['workout', 'food', 'targets'] as const).map((value) => (
          <Button
            key={value}
            variant="secondary"
            fullWidth={false}
            label={t(
              value === 'workout'
                ? 'personalDay.workout'
                : value === 'food'
                  ? 'personalDay.diet'
                  : 'setup.dailyTarget',
            )}
            onPress={() => setSelected(value)}
            testID={`preparing-details-${value}`}
          />
        ))}
      </View>
      <View style={styles.card} accessibilityLiveRegion="polite">
        {selected === 'workout' ? (
          <>
            <Text variant="heading">
              {t('personalDay.preparingWorkout', { minutes: preferences?.session_minutes ?? 0 })}
            </Text>
            <Text>
              {preferences?.equipment.map((item) => t(`fixNovember.${item}`)).join(' ? ')}
            </Text>
          </>
        ) : selected === 'food' ? (
          <>
            <Text variant="heading">{preferences?.cuisine}</Text>
            <Text>{t('personalDay.fourMeals')}</Text>
            <Text>
              {t('personalDay.cookingTime', { minutes: preferences?.cooking_minutes ?? 0 })}
            </Text>
          </>
        ) : targets ? (
          <>
            <Text variant="heading" tabular>
              {t('setup.kcalDay', { kcal: targets.daily_calorie_target })}
            </Text>
            <NutrientSummary
              values={{
                protein: targets.protein_grams,
                carbs: targets.carb_grams,
                fat: targets.fat_grams,
              }}
            />
          </>
        ) : (
          <Text>{t('common.loading')}</Text>
        )}
      </View>
    </View>
  );
}
