import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useEffect, useRef, useState } from 'react';

import { Modal, SafeAreaView, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button, dark, radius, space, Text, type as typography } from '@calipartner/ui';

import type { RoomMemberSnapshot } from '@calipartner/core';

import { t } from '@/i18n';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { RoomMemberPicker } from './RoomMemberPicker';

interface NudgeModalProps {
  visible: boolean;

  targetMember: RoomMemberSnapshot | null;

  members?: RoomMemberSnapshot[];

  onClose: () => void;

  onSendNudge: (targetUserId: string, message: string) => Promise<unknown>;
}

export function NudgeModal({
  visible,
  targetMember,
  members,
  onClose,
  onSendNudge,
}: NudgeModalProps) {
  useBrowserModalBack(visible, onClose);
  const { isOnline } = useNetworkStatus();

  const [recipient, setRecipient] = useState('');

  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(false);

  const sending = useRef(false);

  useEffect(() => {
    if (visible) {
      setRecipient(targetMember?.user_id ?? '');
      setMessage('');
      setError(false);
    }
  }, [visible, targetMember?.user_id]);

  const send = async () => {
    if (sending.current || !recipient || !message.trim() || isOnline === false) return;

    sending.current = true;
    setBusy(true);
    setError(false);

    try {
      await onSendNudge(recipient, message.trim());
      onClose();
    } catch {
      setError(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <Button
          variant="tertiary"
          label={t('repairs.close')}
          onPress={onClose}
          testID="btn-close-nudge-modal"
        />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title2">{t('repairs.nudge')}</Text>

          <RoomMemberPicker
            members={members ?? (targetMember ? [targetMember] : [])}
            selectedId={recipient}
            onSelect={setRecipient}
            disabled={busy}
          />

          <Text>{t('repairs.message')}</Text>

          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={160}

            editable={!busy}
            accessibilityLabel={t('repairs.message')}
            placeholder={t('repairs.messagePlaceholder')}

            placeholderTextColor={dark.textLo}
            style={styles.input}
            testID="nudge-message"
          />

          <Text tabular variant="label">
            {t('repairs.characters', { count: message.length })}
          </Text>

          <Text variant="bodyS">{t('rooms.nudgeModal.limitNotice')}</Text>

          {isOnline === false ? <Text>{t('setup.roomOnline')}</Text> : null}

          {error ? (
            <Text color={dark.danger} accessibilityRole="alert">
              {t('repairs.actionError')}
            </Text>
          ) : null}

          <Button
            label={t('rooms.nudgeModal.sendBtn')}
            disabled={busy || !recipient || !message.trim() || isOnline === false}

            onPress={() => void send()}
            testID="btn-send-nudge-submit"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg0 },

  content: { padding: space[4], gap: space[3] },

  input: {
    ...typography.body,
    color: dark.textHi,
    minHeight: space[9],
    padding: space[3],
    borderRadius: radius.control,
    backgroundColor: dark.s1,
    textAlignVertical: 'top',
  },
});
