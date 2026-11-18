import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const chime = require('../../../assets/cardio-goal.wav');

export function useCardioGoalSound() {
  const player = useAudioPlayer(chime);
  return useCallback(() => {
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => {});
  }, [player]);
}
