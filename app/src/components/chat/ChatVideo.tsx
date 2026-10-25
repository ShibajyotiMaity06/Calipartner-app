import React from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { onboardingLayout as layout } from '@calipartner/ui';
import { t } from '@/i18n';

export function ChatVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={t('setup.playVideo')}
      style={{ width: layout.contentWidth, maxWidth: '100%', height: layout.ring }}
    />
  );
}
