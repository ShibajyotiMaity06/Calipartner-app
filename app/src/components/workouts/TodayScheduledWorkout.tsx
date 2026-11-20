import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, homeLayout, radius, space } from '@calipartner/ui';
import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { weeklyPlanDayIndex, type WorkoutPlanView } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkoutPlan } from '@/services/workoutRoutineService';
import { WorkoutHubModal } from './WorkoutHubModal';
import { t } from '@/i18n';

export function TodayScheduledWorkout({
  localDate,
  hasWorkout,
  onSaved,
}: {
  localDate: string;
  hasWorkout: boolean;
  onSaved: () => void;
}) {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [logger, setLogger] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPlan(null);
      setLoading(!!userId);
      setError(false);
      if (userId)
        void getWorkoutPlan(userId)
          .then((next) => {
            if (active) setPlan(next);
          })
          .catch(() => {
            if (active) setError(true);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      return () => {
        active = false;
      };
    }, [userId, retry]),
  );

  if (!userId) return null;
  if (loading) return <Text>{t('common.loading')}</Text>;
  if (error)
    return (
      <View style={{ gap: space[2] }}>
        <Text accessibilityRole="alert">{t('homeRefresh.routineError')}</Text>
        <Button
          variant="secondary"
          label={t('common.retry')}
          onPress={() => setRetry((value) => value + 1)}
          testID="home-routine-retry"
        />
      </View>
    );
  if (!plan || (!plan.id && !plan.needs_initial)) return null;
  const day = plan.days.find((item) => item.day === weeklyPlanDayIndex(localDate));
  if (day && !day.exercises.length) return null;

  return (
    <View style={styles.card} testID="home-scheduled-workout">
      <Pressable
        style={styles.headerRow}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={t('homeRefresh.scheduledRoutine')}
        accessibilityState={{ expanded }}
        testID="home-scheduled-workout-toggle"
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="barbell-outline" size={16} color={dark.copper} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text variant="heading" color={dark.textHi}>
              {day?.title ?? t('homeRefresh.scheduledRoutine')}
            </Text>
            <View style={styles.subRow}>
              {day && (
                <Text tabular variant="micro" color={dark.textMid}>
                  {t('squadDesign.minutes', { count: day.minutes })}
                </Text>
              )}
              {hasWorkout && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={dark.mint} />
                  <Text variant="micro" color={dark.mint}>
                    {t('homeRefresh.logged')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={dark.textMid} />
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          {day && day.exercises.length > 0 && (
            <View style={styles.exerciseList}>
              {day.exercises.map((exercise, idx) => (
                <View key={exercise.id ?? idx} style={styles.exerciseItem}>
                  <Text variant="bodyS" color={dark.textHi}>
                    {exercise.name}
                  </Text>
                  <Text variant="micro" color={dark.textMid} tabular>
                    {exercise.targetSets?.length ?? 3} sets
                  </Text>
                </View>
              ))}
            </View>
          )}

          {day ? (
            <Button
              variant="secondary"
              label={hasWorkout ? t('homeRefresh.logged') : t('homeRefresh.startWorkout')}
              onPress={() => setLogger(true)}
              testID="home-start-scheduled-workout"
            />
          ) : plan.full_access ? (
            <Button
              variant="secondary"
              label={t('homeRefresh.startWorkout')}
              onPress={() => setLogger(true)}
              testID="home-start-scheduled-workout"
            />
          ) : (
            <Button
              variant="secondary"
              label={t('squadDesign.unlock')}
              onPress={() => router.push('/paywall')}
              testID="home-scheduled-workout-upgrade"
            />
          )}
        </View>
      )}

      {logger && (
        <WorkoutHubModal
          visible
          defaultDate={localDate}
          onClose={() => setLogger(false)}
          onSaved={() => {
            onSaved();
          }}
        />
      )}
    </View>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: dark.s1,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: dark.hairline,
      padding: space[3],
      gap: space[2],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: homeLayout.compactTouchSize,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      flex: 1,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      backgroundColor: dark.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextWrap: {
      flex: 1,
      gap: 2,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: dark.s2,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.full,
    },
    expandedContent: {
      paddingTop: space[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: dark.hairline,
      gap: space[3],
    },
    exerciseList: {
      gap: space[2],
    },
    exerciseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
  });
