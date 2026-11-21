import React, { useRef, useState } from 'react';
import { Modal, SafeAreaView, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { ModalNavigation } from '@/components/ModalNavigation';
import { requestCustomAvatar, type CustomAvatar } from '@/services/aiAvatarService';
import { generateClientUuid } from '@/services/foodService';
import { t } from '@/i18n';

type Photo = { id: string; base64: string };

export function CreateAiAvatarModal({
  onClose,
  onCreated,
  onUpgrade,
}: {
  onClose: () => void;
  onCreated: (avatar: CustomAvatar) => void;
  onUpgrade: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<'error' | 'fullBody'>();
  const [photo, setPhoto] = useState<Photo>();

  const generate = async (input?: Photo) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (!input) {
        const selection = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          exif: false,
        });
        if (selection.canceled || !selection.assets[0]) return;
        const asset = selection.assets[0];
        const resize =
          Math.max(asset.width, asset.height) > 1400
            ? [{ resize: asset.width >= asset.height ? { width: 1400 } : { height: 1400 } }]
            : [];
        const prepared = await ImageManipulator.manipulateAsync(asset.uri, resize, {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.82,
          base64: true,
        });
        if (!prepared.base64) throw new Error('INVALID_PHOTO');
        input = { id: generateClientUuid(), base64: prepared.base64.replace(/\s+/g, '') };
      }
      setPhoto(input);
      const result = await requestCustomAvatar({
        action: 'generate',
        request_id: input.id,
        image_base64: input.base64,
      });
      if (!result) throw new Error('AVATAR_UNAVAILABLE');
      onCreated(result);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      if (code === 'UPGRADE_REQUIRED') {
        onUpgrade();
      } else if (code === 'FULL_BODY_REQUIRED' || code === 'AVATAR_FIT_FAILED') {
        setPhoto(undefined);
        setError('fullBody');
      } else {
        setError('error');
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (!locked.current) onClose();
  };
  return (
    <Modal visible onRequestClose={close} animationType={reduceMotion ? 'none' : 'slide'}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          contentContainerStyle={{ padding: space[4], gap: space[3] }}
          testID="ai-avatar-modal"
        >
          <ModalNavigation onClose={close} disabled={busy} />
          <Text variant="title1" accessibilityRole="header">
            {t('avatarAi.title')}
          </Text>
          <Text>{t('avatarAi.instructions')}</Text>
          {error && <Text accessibilityRole="alert">{t(`avatarAi.${error}`)}</Text>}
          <Button
            label={t(busy ? 'avatarAi.generating' : 'avatarAi.choose')}
            disabled={busy}
            loading={busy}
            onPress={() => void generate()}
            testID="ai-avatar-pick-photo"
          />
          {photo && !busy && error && (
            <Button
              variant="secondary"
              label={t('avatarAi.retry')}
              onPress={() => void generate(photo)}
              testID="ai-avatar-retry"
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
