import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PaywallModal } from '@/components/rooms/PaywallModal';

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string; tier?: string; duration?: string }>();
  const checkoutReturn:
    { tier: 'plus' | 'pro'; duration: 'monthly' | 'annual'; requestId: string } | undefined =
    params.checkout &&
    (params.tier === 'plus' || params.tier === 'pro') &&
    (params.duration === 'monthly' || params.duration === 'annual')
      ? { tier: params.tier, duration: params.duration, requestId: params.checkout }
      : undefined;

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
      checkoutReturn={checkoutReturn}
      onClose={handleClose}
      context="partner_finder"
      onSuccess={handleClose}
    />
  );
}
