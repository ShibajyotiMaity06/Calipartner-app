import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, space } from '@calipartner/ui';
import { getMealSectionForTime, plannedMealSection, type WeeklyPlanView } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { logPlannedMeal, swapPlannedMeal } from '@/services/weeklyPlanService';
import { diaryEvents } from '@/services/diaryEvents';
import { t } from '@/i18n';

export function WeeklyMealActions({
  plan,
  day,
  index,
  onChanged,
  onUpgrade,
}: {
  plan: WeeklyPlanView;
  day: number;
  index: number;
  onChanged: (plan: WeeklyPlanView) => void;
  onUpgrade: () => void;
}) {
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    if (!logged) return;
    const timer = setTimeout(() => setLogged(false), 3_000);
    return () => clearTimeout(timer);
  }, [logged]);
  const [error, setError] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const lock = useRef(false);
  const meal = plan.days.find((item) => item.day === day)?.meals[index];
  const perform = async (option?: number) => {
    if (lock.current || !user || !meal) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      if (option === undefined) {
        const fallback = getMealSectionForTime(new Date(), profile?.timezone);
        await logPlannedMeal(
          user.id,
          plan,
          day,
          index,
          plannedMealSection(meal.name, fallback === 'extra' ? 'snacks' : fallback),
        );
        setLogged(true);
        diaryEvents.emitChange();
      } else {
        onChanged(await swapPlannedMeal(user.id, plan, day, index, option));
        setSwapping(false);
      }
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space[2] }}>
      <Button
        variant="secondary"
        label={t(logged ? 'homeRefresh.logged' : 'homeRefresh.logToDiary')}
        disabled={busy || logged}
        loading={busy}
        onPress={() => void perform()}
        testID={`weekly-log-meal-${index}`}
      />
      {error && <Text accessibilityRole="alert">{t('homeRefresh.mealActionError')}</Text>}
      {(!plan.full_access || !!meal?.alternatives?.length) && (
        <Button
          variant="tertiary"
          label={t('homeRefresh.swapMeal')}
          disabled={busy || logged}
          onPress={() => (plan.full_access ? setSwapping((value) => !value) : onUpgrade())}
          testID={`weekly-swap-meal-${index}`}
        />
      )}
      {swapping &&
        meal?.alternatives?.map((option, optionIndex) => (
          <Button
            key={optionIndex}
            variant="secondary"
            label={option.name}
            disabled={busy}
            onPress={() => void perform(optionIndex)}
            testID={`weekly-swap-option-${index}-${optionIndex}`}
          />
        ))}
    </View>
  );
}
