import { CHECKOUT_DURATIONS, type CheckoutDuration, type RoomPeriod } from '@calipartner/core';
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { closeBrowserModalsThen } from '@/hooks/useBrowserModalBack';
import { PaywallModal } from '@/components/rooms/PaywallModal';

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    checkout?: string;
    tier?: string;
    duration?: string;
    cancelled?: string;
    feature?: string;
  }>();
  const checkoutReturn:
    { tier: 'plus' | 'pro'; duration: RoomPeriod; requestId: string } | undefined =
    params.checkout &&
    (params.tier === 'plus' || params.tier === 'pro') &&
    (params.duration === 'monthly' ||
      CHECKOUT_DURATIONS.some((duration) => duration === params.duration))
      ? {
          tier: params.tier,
          duration: params.duration as CheckoutDuration | 'monthly',
          requestId: params.checkout,
        }
      : undefined;

  const handleClose = () =>
    closeBrowserModalsThen(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/today' as never);
      }
    });

  return (
    <PaywallModal
      visible={true}
      checkoutReturn={checkoutReturn}
      checkoutCancelled={params.cancelled === '1'}
      preselectedTier={params.tier === 'pro' ? 'pro' : params.tier === 'plus' ? 'plus' : undefined}
      onClose={handleClose}
      context={params.feature === 'weekly_plan' ? 'weekly_plan' : 'general'}
      onSuccess={handleClose}
    />
  );
}
