import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, space } from '@calipartner/ui';
import type { MealSection } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { repeatPreviousMeal } from '@/services/weeklyPlanService';
import { diaryEvents } from '@/services/diaryEvents';
import { t } from '@/i18n';

export function RepeatPreviousMeal({
  localDate,
  section,
}: {
  localDate: string;
  section: MealSection;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  if (!user) return null;
  const repeat = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const count = await repeatPreviousMeal(user.id, localDate, section);
      setEmpty(count === 0);
      setSaved(count > 0);
      if (count) diaryEvents.emitChange();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space[1] }}>
      <Button
        variant="tertiary"
        label={t(saved ? 'homeRefresh.logged' : 'homeRefresh.repeatMeal', {
          meal: t(`diary.sections.${section}`),
        })}
        loading={busy}
        disabled={busy || saved || empty}
        onPress={(event) => {
          event.stopPropagation();
          void repeat();
        }}
        testID={`repeat-previous-${section}`}
      />
      {error && <Text accessibilityRole="alert">{t('homeRefresh.mealActionError')}</Text>}
      {empty && <Text accessibilityLiveRegion="polite">{t('homeRefresh.noPreviousMeal')}</Text>}
    </View>
  );
}
