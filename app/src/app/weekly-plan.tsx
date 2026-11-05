import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import {
  WEEK_DAYS,
  planDayNutrition,
  hasRepeatedMealNutrition,
  type PlanPreferences,
  type WeeklyPlanView,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalWeeklyPlan, buildPersonalWeeklyPlan } from '@/services/weeklyPlanService';
import { afterSetupDestination } from '@/services/pairOnboardingService';
import { WeeklyPlanForm } from '@/components/onboarding/WeeklyPlanForm';
import { WeeklyPlanPreparing } from '@/components/onboarding/WeeklyPlanPreparing';
import { WeeklyRoutineEditor } from '@/components/workouts/WeeklyRoutineEditor';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { squadStyles as styles } from '@/components/rooms/SquadViews';
import { t } from '@/i18n';
import { NutrientSummary } from '@/components/diary/NutrientSummary';

export default function WeeklyPlanScreen({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth(),
    router = useRouter(),
    params = useLocalSearchParams<{ setup?: string }>();
  const userId = user?.id;
  const [plan, setPlan] = useState<WeeklyPlanView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [day, setDay] = useState(0),
    [editor, setEditor] = useState(false);
  const [nestedPaywall, setNestedPaywall] = useState(false);
  useBrowserModalBack(nestedPaywall, () => setNestedPaywall(false));
  const openPaywall = () => {
    if (onClose) setNestedPaywall(true);
    else router.push('/paywall?feature=weekly_plan');
  };
  const draft = useRef<PlanPreferences | undefined>(undefined),
    lock = useRef(false),
    owner = useRef(user?.id),
    mounted = useRef(true);
  owner.current = user?.id;
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const id = userId;
    setLoading(true);
    setError(null);
    try {
      const next = await getPersonalWeeklyPlan(id);
      if (mounted.current && owner.current === id) {
        setPlan(next);
        if (!next?.full_access) {
          setDay(0);
          setEditor(false);
        }
      }
    } catch {
      if (mounted.current && owner.current === id) {
        setPlan(null);
        setEditor(false);
        setError('PLAN_UNAVAILABLE');
      }
    } finally {
      if (mounted.current && owner.current === id) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const exit = async () => {
    if (onClose) {
      onClose();
      return;
    }
    if (params.setup === '1' && user)
      router.replace((await afterSetupDestination(user.id)) as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/progress');
  };
  const build = async (preferences: PlanPreferences) => {
    if (!user || lock.current) return;
    const id = user.id;
    draft.current = preferences;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await buildPersonalWeeklyPlan(id, preferences);
      if (mounted.current && owner.current === id) {
        setPlan(next);
        setDay(0);
      }
    } catch (error) {
      if (mounted.current && owner.current === id)
        setError(error instanceof Error ? error.message : 'PLAN_UNAVAILABLE');
    } finally {
      lock.current = false;
      if (mounted.current && owner.current === id) setBusy(false);
    }
  };
  const selected = plan?.days.find((d) => d.day === day);
  const nutritionNeedsRebuild = !!plan && hasRepeatedMealNutrition(plan.days);
  const nutrition = selected ? planDayNutrition(selected) : null;
  const failure =
    error === 'PLAN_SAFETY'
      ? 'fixNovember.safety'
      : error === 'GOALS_REQUIRED'
        ? 'fixNovember.needsGoals'
        : error === 'PLAN_LIMIT_REACHED'
          ? 'fixNovember.rateLimit'
          : 'fixNovember.unavailable';
  return (
    <SafeAreaView style={styles.screen} testID="screen-weekly-plan">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('fixNovember.back')}
          onPress={() => {
            if (onClose) onClose();
            else if (router.canGoBack()) router.back();
            else void exit();
          }}
          testID="weekly-plan-back"
        />
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : busy ? (
          <WeeklyPlanPreparing />
        ) : (
          <>
            {error && (
              <View style={styles.card}>
                <Text accessibilityRole="alert">{t(failure)}</Text>
                {!draft.current && (
                  <Button
                    variant="secondary"
                    label={t('fixNovember.retry')}
                    onPress={() => void load()}
                    testID="reload-weekly-plan"
                  />
                )}
              </View>
            )}
            {!plan ? (
              <WeeklyPlanForm
                initial={draft.current}
                onBuild={(p) => void build(p)}
                onLater={() => void exit()}
              />
            ) : (
              <>
                <Text variant="bodyS">{t('fixNovember.preferred')}</Text>
                <Text variant="title1">
                  {t(plan.full_access ? 'fixNovember.weekly' : 'fixNovember.mondayPreview')}
                </Text>
                <Text variant="bodyS">{t('fixNovember.planDisclaimer')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space[2] }}
                >
                  {WEEK_DAYS.map((name, index) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityState={{ selected: day === index }}
                      accessibilityLabel={t(
                        !plan.full_access && index > 0
                          ? 'fixNovember.lockedDay'
                          : `fixNovember.${name}`,
                        { day: t(`fixNovember.${name}`) },
                      )}
                      onPress={() => {
                        if (plan.full_access || index === 0) setDay(index);
                        else openPaywall();
                      }}
                      style={({ pressed }) => [
                        {
                          minHeight: homeLayout.touchSize,
                          padding: space[3],
                          borderRadius: radius.control,
                          backgroundColor: pressed ? dark.s3 : dark.s1,
                          borderWidth: 1,
                          borderColor: day === index ? dark.copper : dark.hairline,
                        },
                      ]}
                      testID={`weekly-plan-day-${index}`}
                    >
                      <Text>{t(`fixNovember.${name}`)}</Text>
                      {!plan.full_access && index > 0 && (
                        <Ionicons
                          name="lock-closed-outline"
                          size={homeLayout.iconSize}
                          color={dark.textMid}
                          accessible={false}
                        />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
                {selected && (
                  <>
                    <View style={styles.card} testID="preferred-workout-day">
                      <View style={styles.spread}>
                        <Text variant="heading">{t('fixNovember.workout')}</Text>
                        {plan.full_access && (
                          <Button
                            variant="tertiary"
                            size="sm"
                            fullWidth={false}
                            label={t('fixNovember.edit')}
                            onPress={() => setEditor(true)}
                            testID="edit-preferred-routine"
                          />
                        )}
                      </View>
                      <Text variant="title2">
                        {selected.workout.exercises.length
                          ? selected.workout.title
                          : t('fixNovember.rest')}
                      </Text>
                      {selected.workout.exercises.length > 0 && (
                        <Text tabular>
                          {t('squadDesign.minutes', { count: selected.workout.minutes })}
                        </Text>
                      )}
                      {selected.workout.exercises.map((exercise, index) => (
                        <View style={styles.divider} key={index}>
                          <Text variant="label">{exercise.name}</Text>
                          <Text variant="bodyS" tabular>
                            {t('fixNovember.exerciseSummary', {
                              sets: exercise.sets,
                              reps: exercise.reps,
                              rest: exercise.rest_seconds,
                            })}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.card} testID="preferred-food-day">
                      <Text variant="heading">{t('fixNovember.food')}</Text>
                      {nutritionNeedsRebuild && (
                        <View style={{ gap: space[3] }} testID="weekly-nutrition-warning">
                          <Text accessibilityRole="alert">{t('fixNovember.copiedNutrition')}</Text>
                          <Text variant="bodyS">{t('fixNovember.rebuildHint')}</Text>
                          <Button
                            variant="secondary"
                            label={t('fixNovember.rebuild')}
                            onPress={() => void build(plan.preferences)}
                            testID="rebuild-weekly-nutrition"
                          />
                        </View>
                      )}
                      {nutrition && !nutritionNeedsRebuild && (
                        <NutrientSummary values={nutrition} testID="weekly-daily-nutrition" />
                      )}
                      {selected.meals.map((meal, index) => (
                        <View style={styles.divider} key={index}>
                          <Text variant="heading">{meal.name}</Text>
                          <Text>{meal.portion}</Text>
                          <Text variant="bodyS">{meal.ingredients.join(' · ')}</Text>
                          {!nutritionNeedsRebuild && (
                            <NutrientSummary
                              values={meal}
                              testID={`weekly-meal-nutrition-${index}`}
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {plan.full_access ? (
                  <View style={styles.card} testID="weekly-personal-tips">
                    <Text variant="heading">{t('fixNovember.tips')}</Text>
                    {[...plan.workout_tips, ...plan.diet_tips].map((tip, index) => (
                      <Text key={index}>{tip}</Text>
                    ))}
                  </View>
                ) : (
                  <View style={styles.card} testID="weekly-plan-paid-lock">
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      accessible={false}
                      style={{ gap: space[3], opacity: 0.2 }}
                    >
                      {[0, 1, 2].map((index) => (
                        <View
                          key={index}
                          style={{
                            height: space[4],
                            width: index === 1 ? '60%' : '90%',
                            borderRadius: radius.control,
                            backgroundColor: dark.textLo,
                          }}
                        />
                      ))}
                    </View>
                    <Ionicons
                      name="lock-closed-outline"
                      size={homeLayout.iconSize}
                      color={dark.copper}
                    />
                    <Text variant="title2">{t('fixNovember.lockedTitle')}</Text>
                    <Text>{t('fixNovember.lockedBody')}</Text>
                    <Text variant="bodyS">{t('fixNovember.personalTips')}</Text>
                    <Button
                      label={t('fixNovember.buy')}
                      onPress={openPaywall}
                      testID="buy-plus-weekly-plan"
                    />
                  </View>
                )}
                {params.setup === '1' && (
                  <Button
                    variant="secondary"
                    label={t('fixNovember.continue')}
                    onPress={() => void exit()}
                    testID="finish-weekly-plan-setup"
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      {editor && plan?.full_access && (
        <WeeklyRoutineEditor
          plan={plan}
          day={day}
          onClose={() => setEditor(false)}
          onSaved={setPlan}
        />
      )}
      {nestedPaywall && (
        <PaywallModal
          visible
          context="weekly_plan"
          preselectedTier="plus"
          onClose={() => setNestedPaywall(false)}
          onSuccess={() => {
            setNestedPaywall(false);
            void load();
          }}
        />
      )}
    </SafeAreaView>
  );
}
