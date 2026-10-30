import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, dark, onboardingLayout as layout, radius, space, Text } from '@calipartner/ui';
import type { ChatAttachment } from '@/types/chat';
import { getSignedImageUrl } from '@/services/chatImageService';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { ChatVideo } from './ChatVideo';

export function ChatAttachmentPreview({
  roomId,
  attachment,
  onOpen,
}: {
  roomId: string;
  attachment: ChatAttachment;
  onOpen?: (attachment: ChatAttachment) => void;
}) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    setUri(undefined);
    setError(false);
    const load = async () => {
      try {
        const url = await getSignedImageUrl(getSupabase(), roomId, attachment.storage_key);
        if (current) {
          setUri(url);
          timer = setTimeout(() => void load(), 12 * 60 * 1000);
        }
      } catch {
        if (current) setError(true);
      }
    };
    void load();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [roomId, attachment.storage_key, retry]);
  return (
    <View style={styles.container} testID={`attachment-preview-${attachment.id}`}>
      {error ? (
        <>
          <Text accessibilityRole="alert">{t('chatAudit.mediaUnavailable')}</Text>
          <Button
            variant="secondary"
            label={t('repairs.mediaRetry')}
            onPress={() => setRetry((value) => value + 1)}
            testID={`reload-attachment-${attachment.id}`}
          />
        </>
      ) : uri ? (
        attachment.mime_type.startsWith('video/') ? (
          <>
            <ChatVideo uri={uri} compact />
            <Button
              variant="tertiary"
              label={t('repairs.mediaOpen')}
              onPress={() => onOpen?.({ ...attachment, signed_url: uri })}
            />
          </>
        ) : (
          <Pressable
            onPress={() => onOpen?.({ ...attachment, signed_url: uri })}
            accessibilityRole="button"
            accessibilityLabel={t('repairs.mediaOpen')}
            testID={`att-image-${attachment.id}`}
          >
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setError(true)}
              accessibilityLabel={t('repairs.mediaOpen')}
            />
          </Pressable>
        )
      ) : (
        <Text accessibilityLiveRegion="polite">{t('repairs.mediaLoading')}</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: space[2], maxWidth: '100%' },
  image: {
    width: layout.ring,
    height: layout.ring,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
  },
});
