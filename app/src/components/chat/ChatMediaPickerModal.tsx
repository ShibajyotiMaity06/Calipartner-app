import React, { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Button, Text } from '@calipartner/ui';
import { MAX_CHAT_ATTACHMENT_SIZE_BYTES } from '@calipartner/core';
import { t } from '@/i18n';
import { processImageOnDevice } from '@/services/chatImageService';
import { planStyles } from '@/components/onboarding/PlanPrimitives';

export interface SelectedMediaItem {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  buffer: Uint8Array;
}
export interface ChatMediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMedia: (items: SelectedMediaItem[]) => void;
  currentCount: number;
  maxCount?: number;
  testID?: string;
}
export function ChatMediaPickerModal({
  visible,
  onClose,
  onSelectMedia,
  currentCount,
  maxCount = 5,
  testID = 'chat-media-picker-modal',
}: ChatMediaPickerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, maxCount - currentCount),
        exif: false,
        quality: 0.8,
      });
      if (result.canceled) return;
      const items: SelectedMediaItem[] = [];
      for (const asset of result.assets.slice(0, maxCount - currentCount)) {
        if ((asset.fileSize ?? 0) > MAX_CHAT_ATTACHMENT_SIZE_BYTES) throw new Error('size');
        const mime = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
        const bytes =
          Platform.OS === 'web'
            ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer())
            : await new File(asset.uri).bytes();
        if (bytes.length > MAX_CHAT_ATTACHMENT_SIZE_BYTES) throw new Error('size');
        const processed = processImageOnDevice(bytes, mime, asset.width, asset.height);
        items.push({
          uri: asset.uri,
          name: asset.fileName ?? `media.${mime.split('/')[1]}`,
          size: processed.size,
          mimeType: mime,
          width: asset.width,
          height: asset.height,
          buffer: processed.data,
        });
      }
      onSelectMedia(items);
      onClose();
    } catch {
      setError(t('setup.mediaError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={planStyles.reviewContent} testID={testID}>
        <Text variant="heading">{t('setup.chooseMedia')}</Text>
        <Text>{t('setup.mediaLimit')}</Text>
        {error ? <Text accessibilityRole="alert">{error}</Text> : null}
        <Button
          label={busy ? t('common.loading') : t('setup.chooseMedia')}
          disabled={busy || currentCount >= maxCount}
          onPress={() => void pick()}
          testID="choose-chat-media"
        />
        <Button
          variant="secondary"
          label={t('setup.close')}
          onPress={onClose}
          testID="close-chat-media"
        />
      </View>
    </Modal>
  );
}
