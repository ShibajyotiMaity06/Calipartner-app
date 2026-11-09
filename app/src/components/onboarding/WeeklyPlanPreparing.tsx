import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { dark, homeLayout, radius, space, motion, Text, useReducedMotion } from '@calipartner/ui';
import type { GoalProfile, PlanPreferences } from '@calipartner/core';
import { t } from '@/i18n';
import { squadStyles as styles } from '@/components/rooms/SquadViews';

export function WeeklyPlanPreparing({
  singleDay = false,
  name = '',
  workoutOnly = false,
}: {
  singleDay?: boolean;
  name?: string;
  workoutOnly?: boolean;
  preferences?: PlanPreferences;
  targets?: GoalProfile | null;
}) {
  const [width, setWidth] = useState<number>(homeLayout.cardWidth);
  const [longWait, setLongWait] = useState(false);
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.seam.duration,
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
      <Text variant="title1">
        {t(workoutOnly ? 'workoutFlow.preparing' : 'personalDay.preparingTitle', { name })}
      </Text>
      <Text>{t(workoutOnly ? 'workoutFlow.preparingHint' : 'personalDay.preparingBody')}</Text>
      <View style={styles.card}>
        <View style={styles.spread}>
          <Text variant="heading">
            {t(
              workoutOnly
                ? 'fixNovember.workoutTitle'
                : singleDay
                  ? 'personalDay.title'
                  : 'fixNovember.weekly',
            )}
          </Text>
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
        {longWait && (
          <Text accessibilityLiveRegion="polite">
            {t(singleDay ? 'personalDay.waitingPlan' : 'aha.waiting')}
          </Text>
        )}
      </View>
    </View>
  );
}
