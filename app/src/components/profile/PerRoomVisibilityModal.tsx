import React, { useCallback, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { Button, dark, onboardingLayout as layout, space, Text } from '@calipartner/ui';
import { PrivacySettingsModal } from '@/components/rooms/PrivacySettingsModal';
import { getPrivacySettings, updatePrivacySettings } from '@/services/roomService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import type { RoomSummary } from '@/types/rooms';

export interface PerRoomVisibilityModalProps {
  visible: boolean;
  onClose: () => void;
  rooms?: RoomSummary[];
  testID?: string;
}
export function PerRoomVisibilityModal({
  visible,
  onClose,
  rooms = [],
  testID = 'modal-per-room-visibility',
}: PerRoomVisibilityModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const roomId = rooms.some((room) => room.id === selected) ? selected : null;
  const getPrivacy = useCallback(() => getPrivacySettings(getSupabase(), roomId!), [roomId]);
  const updatePrivacy = useCallback(
    (settings: Parameters<typeof updatePrivacySettings>[2]) =>
      updatePrivacySettings(getSupabase(), roomId!, settings),
    [roomId],
  );
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} testID={testID}>
          <Button
            variant="tertiary"
            label={t('rooms.paywall.close')}
            onPress={onClose}
            testID="btn-close-per-room"
          />
          <Text variant="title2">{t('me.perRoomVisibility.title')}</Text>
          <Text color={dark.textMid}>
            {t(rooms.length ? 'roomAudit.chooseRoom' : 'roomAudit.noRooms')}
          </Text>
          {rooms.map((room) => (
            <Pressable
              key={room.id}
              onPress={() => setSelected(room.id)}
              accessibilityRole="button"
              accessibilityLabel={room.name}
              testID={`room-option-${room.id}`}
              style={({ pressed }) => [
                styles.room,
                { backgroundColor: pressed ? dark.s2 : dark.s1 },
              ]}
            >
              <Text>{room.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {roomId ? (
          <PrivacySettingsModal
            visible={visible}
            roomId={roomId}
            rooms={rooms}
            onClose={() => setSelected(null)}
            onGetPrivacy={getPrivacy}
            onUpdatePrivacy={updatePrivacy}
            onOpenPerRoom={() => setSelected(null)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  room: { minHeight: layout.touch, padding: space[3] },
});
