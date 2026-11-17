import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, Text, space, radius, homeLayout, type as typography } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import type { MealSelection, SavedMeal, MealSection } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { generateClientUuid } from '@/services/foodService';
import { deleteMyMeal, loadMyMeals, logMyMeal, saveMyMeal } from '@/services/myMealsService';
import { t } from '@/i18n';

export function MyMealsView({
  selection,
  section,
  localDate,
  onLogged,
}: {
  selection: MealSelection[];
  section: MealSection;
  localDate: string;
  onLogged?: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [rows, setRows] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [mealSlot, setMealSlot] = useState(section);
  const [saved, setSaved] = useState(false);
  const [logged, setLogged] = useState(false);
  const acting = useRef(false);
  const saveRequest = useRef<{ key: string; id: string } | undefined>(undefined);
  const logRequest = useRef<{ key: string; ids: string[] } | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const meals = await loadMyMeals(user.id);
      if (owner.current === user.id) setRows(meals);
    } catch {
      if (owner.current === user.id) setError(true);
    } finally {
      if (owner.current === user.id) setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    setRows([]);
    void refresh();
  }, [refresh]);
  const act = async (operation: () => Promise<void>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(false);
    setSaved(false);
    setLogged(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const save = () =>
    act(async () => {
      if (!user) return;
      const key = JSON.stringify([user.id, name, selection]);
      if (saveRequest.current?.key !== key) saveRequest.current = { key, id: generateClientUuid() };
      await saveMyMeal(user.id, saveRequest.current.id, name, selection);
      setSaved(true);
      setName('');
      saveRequest.current = undefined;
      await refresh();
    });
  const log = (meal: SavedMeal) =>
    act(async () => {
      if (!user) return;
      const key = JSON.stringify([user.id, meal.id, localDate, mealSlot]);
      if (logRequest.current?.key !== key)
        logRequest.current = { key, ids: meal.items.map(() => generateClientUuid()) };
      await logMyMeal(await getDb(), user.id, meal, mealSlot, localDate, logRequest.current.ids);
      logRequest.current = undefined;
      setLogged(true);
      onLogged?.();
    });
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      testID="my-meals-view"
      keyboardShouldPersistTaps="handled"
    >
      {!!selection.length && (
        <View style={styles.content}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={100}
            accessibilityLabel={t('launch.mealName')}
            placeholder={t('launch.mealName')}
            placeholderTextColor={colors.textLo}
            testID="my-meal-name"
            style={[styles.input, { color: colors.textHi, borderColor: colors.hairline }]}
          />
          <Button
            label={t('launch.saveMeal')}
            disabled={busy || !name.trim()}
            onPress={() => void save()}
            testID="my-meal-save"
          />
        </View>
      )}
      {logged && <Text accessibilityRole="alert">{t('launch.mealLogged')}</Text>}
      {saved && <Text accessibilityRole="alert">{t('launch.mealSaved')}</Text>}
      {loading && <ActivityIndicator accessibilityLabel={t('launch.loading')} />}
      {error && (
        <>
          <Text accessibilityRole="alert">{t('launch.mealError')}</Text>
          <Button
            variant="secondary"
            label={t('common.retry')}
            onPress={() => void refresh()}
            testID="my-meals-retry"
          />
        </>
      )}
      {!loading && !rows.length && <Text>{t('launch.mealEmpty')}</Text>}
      <View style={styles.actions}>
        {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((slot) => (
          <Chip
            key={slot}
            label={t(`diary.sections.${slot}`)}
            selected={mealSlot === slot}
            onPress={() => setMealSlot(slot)}
            testID={'my-meal-slot-' + slot}
          />
        ))}
      </View>
      {rows
        .filter((meal) => meal.user_id === user?.id)
        .map((meal) => (
          <View key={meal.id} style={styles.content}>
            <Text variant="heading">{meal.name}</Text>
            <Text>{meal.items.map((item) => item.food_name).join(', ')}</Text>
            <Text style={styles.number}>{meal.total_calories} kcal</Text>
            <Button
              variant="secondary"
              label={t('launch.mealLog', { meal: t(`diary.sections.${mealSlot}`) })}
              disabled={busy}
              onPress={() => void log(meal)}
              testID={'my-meal-log-' + meal.id}
            />
            <Button
              variant="tertiary"
              label={t('launch.deleteMeal')}
              disabled={busy}
              testID={'my-meal-delete-' + meal.id}
              onPress={() =>
                Alert.alert(t('launch.deleteMeal'), t('launch.deleteMealConfirm'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('launch.deleteMeal'),
                    style: 'destructive',
                    onPress: () =>
                      void act(async () => {
                        await deleteMyMeal(user!.id, meal.id);
                        await refresh();
                      }),
                  },
                ])
              }
            />
          </View>
        ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: space[3], gap: space[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  input: {
    fontFamily: typography.body.fontFamily,
    padding: space[3],
    minHeight: homeLayout.touchSize,
    borderWidth: 1,
    borderRadius: radius.control,
  },
  number: { fontVariant: ['tabular-nums'] },
});
