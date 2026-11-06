import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, View } from 'react-native';
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
import { BlueprintStep } from '@/components/onboarding/BlueprintStep';
import { OnboardingPaywall } from '@/components/onboarding/OnboardingPaywall';
import { useTargets } from '@/hooks/useTargets';
import { WeeklyRoutineEditor } from '@/components/workouts/WeeklyRoutineEditor';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { squadStyles as styles } from '@/components/rooms/SquadViews';
import { t } from '@/i18n';
import { NutrientSummary } from '@/components/diary/NutrientSummary';
import { WeeklyMealActions } from '@/components/diary/WeeklyMealActions';
import { WeeklyGroceryList } from '@/components/diary/WeeklyGroceryList';

export default function WeeklyPlanScreen({ onClose }: { onClose?: () => void } = {}) {
  const { user, profile } = useAuth(),
    router = useRouter(),
    params = useLocalSearchParams<{ setup?: string }>();
  const userId = user?.id;
  const scroll = useRef<ScrollView>(null);
  const { currentGoalProfile: goal } = useTargets();
  const [blueprint, setBlueprint] = useState(false),
    [plans, setPlans] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<'plus' | 'pro'>('plus');
  const [checkoutDuration, setCheckoutDuration] = useState<'monthly' | 'annual'>('annual');
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || (!blueprint && !plans)) return;
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        if (plans) setPlans(false);
        else setBlueprint(false);
        return true;
      });
      return () => listener.remove();
    }, [blueprint, plans]),
  );
  const [plan, setPlan] = useState<WeeklyPlanView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [day, setDay] = useState(0),
    [editor, setEditor] = useState(false);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [blueprint, plans, busy, plan?.id]);
  const [nestedPaywall, setNestedPaywall] = useState(false);
  useBrowserModalBack(
    blueprint || plans || nestedPaywall,
    () => {
      if (nestedPaywall) setNestedPaywall(false);
      else if (plans) setPlans(false);
      else setBlueprint(false);
    },
    { depth: nestedPaywall ? 1 : 0, onDepthChange: () => setNestedPaywall(false) },
  );
  const openPaywall = () => {
    setPlans(true);
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
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('fixNovember.back')}
          onPress={() => {
            if (plans) setPlans(false);
            else if (blueprint) setBlueprint(false);
            else if (onClose) onClose();
            else if (router.canGoBack()) router.back();
            else void exit();
          }}
          testID="weekly-plan-back"
        />
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : busy ? (
          <WeeklyPlanPreparing />
        ) : plans ? (
          <OnboardingPaywall
            onCheckout={(tier, duration) => {
              setCheckoutTier(tier);
              setCheckoutDuration(duration);
              setNestedPaywall(true);
            }}
            onFree={() => {
              setPlans(false);
              if (params.setup === '1') void exit();
            }}
          />
        ) : blueprint && goal && profile ? (
          <BlueprintStep
            goal={goal}
            sex={profile.sex}
            onMake={() => {
              setBlueprint(false);
              if (draft.current) void build(draft.current);
            }}
            onEdit={() => setBlueprint(false)}
            onFree={() => void exit()}
          />
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
                onBuild={(p) => {
                  draft.current = p;
                  if (params.setup === '1' && goal && profile) setBlueprint(true);
                  else void build(p);
                }}
                onLater={() => void exit()}
              />
            ) : (
              <>
                <Text variant="bodyS">{t('aha.ready')}</Text>
                <Text variant="title1">
                  {t(plan.full_access ? 'fixNovember.weekly' : 'fixNovember.mondayPreview')}
                </Text>
                <Text variant="bodyS">{t('fixNovember.planDisclaimer')}</Text>
                <Text variant="bodyS">{t('aha.flexible')}</Text>
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
                      <WeeklyGroceryList key={plan.id} plan={plan} onUpgrade={openPaywall} />
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
                          {!nutritionNeedsRebuild && (
                            <WeeklyMealActions
                              key={`${plan.id}-${plan.revision}-${day}-${index}`}
                              plan={plan}
                              day={day}
                              index={index}
                              onChanged={setPlan}
                              onUpgrade={openPaywall}
                            />
                          )}
                          {plan.full_access && meal.alternatives?.length ? (
                            <View style={styles.stack} testID={`meal-alternatives-${index}`}>
                              <Text variant="label">{t('aha.alternatives')}</Text>
                              {meal.alternatives.map((option, optionIndex) => (
                                <View style={styles.divider} key={optionIndex}>
                                  <Text variant="heading">{option.name}</Text>
                                  <Text>{option.portion}</Text>
                                  <Text variant="bodyS">{option.ingredients.join(' · ')}</Text>
                                  <NutrientSummary values={option} />
                                </View>
                              ))}
                            </View>
                          ) : null}
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
                    <Text variant="bodyS">{t('aha.rebuildHint')}</Text>
                    <Button
                      variant="secondary"
                      label={t('aha.rebuildWeek')}
                      onPress={() => void build(plan.preferences)}
                      testID="rebuild-personal-week"
                    />
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
                    label={t('aha.next')}
                    onPress={() => setPlans(true)}
                    testID="weekly-plan-choose-support"
                  />
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
          preselectedTier={checkoutTier}
          preselectedDuration={checkoutDuration}
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
