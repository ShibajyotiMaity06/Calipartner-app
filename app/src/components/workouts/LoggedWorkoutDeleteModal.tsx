import React, { useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { Button, controls, radius, space, Text, useTheme } from '@calipartner/ui';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
export function LoggedWorkoutDeleteModal({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const lock = useRef(false);
  const close = () => {
    if (!lock.current) onClose();
  };
  useBrowserModalBack(true, close);
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      testID="logged-workout-delete-modal"
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space[4],
          backgroundColor: colors.modalScrim,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            padding: space[4],
            width: '100%',
            maxWidth: controls.dialogMaxWidth,
            alignSelf: 'center',
            gap: space[3],
            backgroundColor: colors.s1,
            borderRadius: radius.card,
          }}
        >
          <Text variant="heading">{t('workoutPolish.deleteTitle')}</Text>
          <Text>{t('workoutPolish.deleteBody', { name })}</Text>
          {error && (
            <Text accessibilityRole="alert" color={colors.danger}>
              {t('workoutPolish.error')}
            </Text>
          )}
          <Button
            variant="destructive"
            label={t('workoutPolish.removeConfirm')}
            disabled={busy}
            testID="logged-delete-confirm"
            onPress={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError(false);
              try {
                await onDelete();
                onClose();
              } catch {
                setError(true);
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          />
          <Button
            variant="cancel"
            label={t('common.cancel')}
            disabled={busy}
            onPress={close}
            testID="logged-delete-cancel"
          />
        </View>
      </View>
    </Modal>
  );
}
