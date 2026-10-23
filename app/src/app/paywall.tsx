import React from 'react';
import { useRouter } from 'expo-router';
import { PaywallModal } from '@/components/rooms/PaywallModal';

export default function PaywallScreen() {
  const router = useRouter();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/today' as never);
    }
  };

  return (
    <PaywallModal
      visible={true}
      onClose={handleClose}
      context="partner_finder"
      onSuccess={handleClose}
    />
  );
}
