import React from 'react';
import { useRouter } from 'expo-router';
import { FocusCard } from '@/components/focus/FocusCard';
import { CSheet } from '@/components/progress/ChallengeUI';
import { ct } from '@/i18n/challenges';
export default function FocusScreen() {
  const router = useRouter();
  return (
    <CSheet
      visible
      title={ct('focus_minutes')}
      onClose={() => router.back()}
      testID="challenge-focus-log"
    >
      <FocusCard />
    </CSheet>
  );
}
