import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, dark, radius, Sheet, space, Text } from '@calipartner/ui';
import { useRooms } from '@/hooks/useRooms';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';

export function PersonalSquads() {
  const { rooms, loading, error, refresh, leaveRoom } = useRooms();
  const router = useRouter();
  const [leaving, setLeaving] = useState<RoomSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const close = () => {
    if (!inFlight.current) {
      setLeaving(null);
      setFailed(false);
    }
  };
  const confirmLeave = async () => {
    if (!leaving || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await leaveRoom(leaving.id);
      setLeaving(null);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.card} testID="personal-squads">
      <Text variant="heading">{t('homeRefresh.mySquads')}</Text>
      {error && !leaving ? (
        <View style={styles.stack}>
          <Text accessibilityRole="alert">{t('repairs.squadError')}</Text>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void refresh()} />
        </View>
      ) : loading && !rooms.length ? (
        <Text>{t('common.loading')}</Text>
      ) : !rooms.length ? (
        <Text>{t('homeRefresh.noSquads')}</Text>
      ) : (
        rooms.map((room) => (
          <View key={room.id} style={styles.stack} testID={'personal-squad-' + room.id}>
            <Text variant="heading">{room.name}</Text>
            <Text variant="bodyS" tabular>
              {room.member_cap
                ? t('homeRefresh.members', { count: room.member_count, cap: room.member_cap })
                : t('squadDesign.members', { count: room.member_count })}
            </Text>
            <View style={styles.actions}>
              <Button
                variant="secondary"
                fullWidth={false}
                size="sm"
                label={t('squadDesign.open')}
                onPress={() => router.push({ pathname: '/(tabs)/room', params: { room: room.id } })}
                testID={'personal-open-squad-' + room.id}
              />
              <Button
                variant="secondary"
                fullWidth={false}
                size="sm"
                label={t('homeRefresh.leaveSquad')}
                onPress={() => {
                  setFailed(false);
                  setLeaving(room);
                }}
                testID={'personal-leave-squad-' + room.id}
              />
            </View>
          </View>
        ))
      )}
      <Sheet
        visible={!!leaving}
        onClose={close}
        snapPoint="half"
        accessibilityLabel={t('homeRefresh.leaveSquad')}
        testID="personal-leave-sheet"
      >
        <View style={styles.card}>
          <Text variant="heading">
            {t('homeRefresh.leaveNamedSquad', { name: leaving?.name ?? '' })}
          </Text>
          <Text>{t('rooms.settingsModal.leaveConfirm')}</Text>
          {failed && (
            <Text accessibilityRole="alert" color={dark.danger}>
              {t('homeRefresh.leaveError')}
            </Text>
          )}
          <Button
            variant="destructiveFill"
            loading={busy}
            label={t('homeRefresh.leaveSquad')}
            onPress={() => void confirmLeave()}
            testID="personal-confirm-leave"
          />
          <Button variant="secondary" disabled={busy} label={t('common.cancel')} onPress={close} />
        </View>
      </Sheet>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: dark.s1, borderRadius: radius.card, padding: space[4], gap: space[4] },
  stack: { gap: space[2] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
