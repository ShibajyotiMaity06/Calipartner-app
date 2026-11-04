import React from 'react';
import { useRouter } from 'expo-router';
import { FastingTimerModal } from '@/components/fasting';
export default function FastingScreen() {
  const router = useRouter();
  return (
    <FastingTimerModal
      visible
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/me');
      }}
    />
  );
}
