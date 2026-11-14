import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React from 'react';
import { useEvent } from 'expo';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Button, Text, onboardingLayout as layout } from '@calipartner/ui';
import { t } from '@/i18n';

export function ChatVideo({ uri, compact = false }: { uri: string; compact?: boolean }) {
  const { colors: dark } = useAppearance();

  const player = useVideoPlayer(uri);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View
      style={{
        width: compact ? layout.ring : layout.contentWidth,
        maxWidth: '100%',
        height: layout.ring,
      }}
    >
      {status === 'error' ? (
        <>
          <Text style={{ color: dark.textHi }} accessibilityRole="alert">
            {t('chatAudit.mediaUnavailable')}
          </Text>
          <Button
            label={t('common.retry')}
            variant="secondary"
            onPress={() => void player.replaceAsync(uri).catch(() => {})}
            testID="retry-chat-video"
          />
        </>
      ) : (
        <VideoView
          player={player}
          nativeControls
          contentFit="contain"
          accessibilityLabel={t('setup.playVideo')}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </View>
  );
}
