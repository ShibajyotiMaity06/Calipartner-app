import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import React, { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
  useBrowserModalBack(visible, onClose);
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
        const photo = asset.type !== 'video';
        const prepared = photo
          ? await ImageManipulator.manipulateAsync(
              asset.uri,
              [
                {
                  resize:
                    asset.width > asset.height
                      ? { width: Math.min(asset.width, 1600) }
                      : { height: Math.min(asset.height, 1600) },
                },
              ],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
            )
          : asset;
        const mime = photo ? 'image/jpeg' : (asset.mimeType ?? 'video/mp4');
        const bytes =
          Platform.OS === 'web'
            ? new Uint8Array(await (await fetch(prepared.uri)).arrayBuffer())
            : await new File(prepared.uri).bytes();
        if (bytes.length > MAX_CHAT_ATTACHMENT_SIZE_BYTES) throw new Error('size');
        const processed = processImageOnDevice(bytes, mime, asset.width, asset.height);
        items.push({
          uri: prepared.uri,
          name: photo ? 'photo.jpg' : (asset.fileName ?? `video.${mime.split('/')[1]}`),
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
