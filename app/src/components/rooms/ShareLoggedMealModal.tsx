import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useEffect, useRef, useState } from 'react';

import { Modal, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, dark, space, Text } from '@calipartner/ui';

import type { MealSection, RoomMemberSnapshot } from '@calipartner/core';

import { generateClientUuid } from '@/services/foodService';

import { copyRoomMeal, getRoomMeals, type RoomMeal } from '@/services/roomMealService';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { t } from '@/i18n';

import { RoomMemberPicker } from './RoomMemberPicker';

export function ShareLoggedMealModal({
  visible = true,
  roomId,
  userId,
  members,
  onClose,
  onShared,
}: {
  visible?: boolean;
  roomId: string;
  userId: string;
  members: RoomMemberSnapshot[];
  onClose: () => void;
  onShared: () => void;
  onPrivacy?: () => void;
}) {
  useBrowserModalBack(visible, onClose);
  const { isOnline } = useNetworkStatus();

  const partners = members.filter(
    (member) => member.user_id !== userId && member.status === 'active',
  );

  const [partner, setPartner] = useState(partners[0]?.user_id ?? '');

  const [meals, setMeals] = useState<RoomMeal[]>([]);

  const [selected, setSelected] = useState<RoomMeal | null>(null);

  const [section, setSection] = useState<MealSection>('lunch');

  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);

  const request = useRef<{ key: string; id: string } | null>(null);

  const sending = useRef(false);

  useEffect(() => {
    let current = true;

    setMeals([]);
    setSelected(null);
    setError(false);

    if (!visible || !partner || isOnline === false) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void getRoomMeals(roomId, partner)
      .then((items) => {
        if (current) setMeals(items);
      })

      .catch(() => {
        if (current) setError(true);
      })

      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [visible, roomId, partner, isOnline, retry]);

  const add = async () => {
    if (!selected?.can_copy || sending.current || isOnline === false) return;

    sending.current = true;
    setBusy(true);
    setError(false);

    const key = JSON.stringify([roomId, partner, selected.id, section]);

    if (request.current?.key !== key) request.current = { key, id: generateClientUuid() };

    try {
      await copyRoomMeal(request.current.id, roomId, partner, selected.id, section);
      onShared();
      onClose();
    } catch {
      setError(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.screen}>
        <Button
          variant="tertiary"
          label={t('repairs.close')}
          onPress={onClose}
          testID="close-share-logged-meal"
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          testID="share-logged-meal"
        >
          <Text variant="title2">{t('repairs.mealTitle')}</Text>

          <Text>{t('repairs.mealHint')}</Text>

          <RoomMemberPicker
            members={partners}
            selectedId={partner}
            onSelect={setPartner}
            disabled={busy}
          />

          {isOnline === false ? <Text>{t('setup.roomOnline')}</Text> : null}

          {loading ? <Text>{t('common.loading')}</Text> : null}

          {error ? (
            <View>
              <Text accessibilityRole="alert">{t('repairs.actionError')}</Text>

              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => setRetry((v) => v + 1)}
              />
            </View>
          ) : null}

          {!loading && !error && !meals.length ? <Text>{t('repairs.mealEmpty')}</Text> : null}

          {meals.map((meal) => (
            <Card key={meal.id}>
              <Button
                variant="secondary"
                label={`${meal.food_name} · ${meal.quantity} ${meal.unit} · ${t(`diary.sections.${meal.meal_section}`)}`}

                disabled={busy}
                onPress={() => {
                  setSelected(meal);
                  setSection(meal.meal_section);
                }}
                testID={`share-meal-choice-${meal.id}`}
              />

              {selected?.id === meal.id ? <Text>{t('repairs.selected', { count: 1 })}</Text> : null}
            </Card>
          ))}

          {selected ? (
            <>
              <Text>{t('repairs.mealSection')}</Text>

              {(['breakfast', 'lunch', 'dinner', 'snacks', 'extra'] as const).map((value) => (
                <Button
                  key={value}
                  variant={section === value ? 'secondary' : 'tertiary'}

                  label={t(`diary.sections.${value}`)}
                  onPress={() => setSection(value)}
                  disabled={busy}
                  testID={`copy-meal-section-${value}`}
                />
              ))}

              {!selected.can_copy ? <Text>{t('repairs.mealNutritionPrivate')}</Text> : null}

              <Button
                label={t('repairs.addMeal', {
                  section: t(`diary.sections.${section}`).toLowerCase(),
                })}
                disabled={busy || !selected.can_copy || isOnline === false}

                onPress={() => void add()}
                testID="send-logged-meal"
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
});
