import React from 'react';
import { useRouter } from 'expo-router';
import { CoachChatView } from '@/components/coach';

export default function CoachScreen() {
  const router = useRouter();

  return <CoachChatView onBack={() => router.back()} />;
}
