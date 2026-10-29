import React, { useEffect, useRef, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, dark, space, SwitchRow, Text } from '@calipartner/ui';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t } from '@/i18n';

export function ShareLoggedMealModal({
  roomId,
  userId,
  members,
  onClose,
  onShared,
  onPrivacy,
}: {
  roomId: string;
  userId: string;
  members: RoomMemberSnapshot[];
  onClose: () => void;
  onShared: () => void;
  onPrivacy: () => void;
}) {
  const { isOnline } = useNetworkStatus();
  const [meals, setMeals] = useState<Array<{ id: string; food_name: string; local_date: string }>>(
    [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    let current = true;
    setError(false);
    setLoading(true);
    if (isOnline === false) {
      setLoading(false);
      return;
    }
    void getSupabase()
      .from('food_entries')
      .select('id,food_name,local_date')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('logged_at', { ascending: false })
      .limit(20)
      .then((result) => {
        if (!current) return;
        if (result.error) setError(true);
        else setMeals(result.data ?? []);
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [userId, isOnline, retry]);
  const send = async () => {
    if (!selected || !recipients.length || busy || isOnline === false) return;
    setBusy(true);
    setError(false);
    const key = JSON.stringify([roomId, selected, [...recipients].sort()]);
    if (request.current?.key !== key) request.current = { key, id: generateClientUuid() };
    try {
      const result = await getSupabase().rpc('share_room_meal', {
        p_client_id: request.current.id,
        p_room_id: roomId,
        p_food_entry_id: selected,
        p_participant_user_ids: recipients,
      });
      if (result.error) throw result.error;
      onShared();
      onClose();
    } catch (error) {
      setPrivacyBlocked(
        String((error as { message?: string }).message).includes('PRIVACY_REQUIRED'),
      );
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} testID="share-logged-meal">
          <Button
            variant="tertiary"
            label={t('rooms.paywall.close')}
            onPress={onClose}
            testID="close-share-logged-meal"
          />
          <Text variant="title2">{t('roomAudit.shareMeal')}</Text>
          <Text>{t('roomAudit.chooseMeal')}</Text>
          {isOnline === false ? <Text>{t('setup.roomOnline')}</Text> : null}
          {loading ? <Text>{t('common.loading')}</Text> : null}
          {error ? (
            <>
              <Text accessibilityRole="alert">
                {t(privacyBlocked ? 'roomAudit.mealPrivacyRequired' : 'roomAudit.actionError')}
              </Text>
              {privacyBlocked ? (
                <Button
                  variant="secondary"
                  label={t('rooms.privacyModal.title')}
                  onPress={onPrivacy}
                />
              ) : null}
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => setRetry((v) => v + 1)}
              />
            </>
          ) : null}
          {!loading && !meals.length ? <Text>{t('roomAudit.noMeals')}</Text> : null}
          <Card>
            {meals.map((meal) => (
              <SwitchRow
                key={meal.id}
                title={`${meal.food_name} · ${meal.local_date}`}
                value={selected === meal.id}
                disabled={busy}
                onValueChange={() => setSelected(meal.id)}
                testID={`share-meal-choice-${meal.id}`}
              />
            ))}
          </Card>
          <Card>
            {members
              .filter((member) => member.user_id !== userId && member.status === 'active')
              .map((member) => (
                <SwitchRow
                  key={member.user_id}
                  title={member.nickname}
                  value={recipients.includes(member.user_id)}
                  disabled={busy}
                  onValueChange={(value) =>
                    setRecipients((previous) =>
                      value
                        ? [...previous, member.user_id]
                        : previous.filter((id) => id !== member.user_id),
                    )
                  }
                  testID={`share-meal-recipient-${member.user_id}`}
                />
              ))}
          </Card>
          <Button
            label={t('roomAudit.sendMeal')}
            disabled={busy || isOnline === false || !selected || !recipients.length}
            onPress={() => void send()}
            testID="send-logged-meal"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
});
