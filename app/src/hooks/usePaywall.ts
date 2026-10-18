import { useCallback, useState } from 'react';
import {
  getPaywallTriggerData,
  shouldShowPaywallForInvite,
  type PaywallTrigger,
  type PaywallTriggerData,
  type RoomTier,
} from '@calipartner/core';
import { useSubscription } from './useSubscription';

export interface PaywallState {
  isOpen: boolean;
  trigger: PaywallTrigger | null;
  triggerData: PaywallTriggerData | null;
  roomId?: string;
}

export function usePaywall() {
  const { hasPlan, isTrial, entitlement } = useSubscription();

  const [paywallState, setPaywallState] = useState<PaywallState>({
    isOpen: false,
    trigger: null,
    triggerData: null,
  });

  const checkAndTrigger = useCallback(
    (
      trigger: PaywallTrigger,
      options?: {
        isInvited?: boolean;
        currentTier?: RoomTier;
        roomId?: string;
      },
    ): boolean => {
      // PRD 6.18 SUB-9: "Invited people are never shown a paywall to join a room."
      if (options?.isInvited && !shouldShowPaywallForInvite(options.isInvited)) {
        return false;
      }

      // Feature specific gating
      if (trigger === 'open_ai_coach' || trigger === 'open_partner_finder') {
        // Plan holders only; no trial
        if (!hasPlan) {
          const data = getPaywallTriggerData(trigger, options?.currentTier);
          setPaywallState({
            isOpen: true,
            trigger,
            triggerData: data,
            roomId: options?.roomId,
          });
          return true;
        }
        return false;
      }

      if (trigger === 'create_room_after_trial') {
        // Only if trial is used and user doesn't have an active plan
        if (
          !hasPlan &&
          (!isTrial || (entitlement?.period_end && new Date(entitlement.period_end) <= new Date()))
        ) {
          const data = getPaywallTriggerData(trigger, options?.currentTier);
          setPaywallState({
            isOpen: true,
            trigger,
            triggerData: data,
            roomId: options?.roomId,
          });
          return true;
        }
        return false;
      }

      if (trigger === 'add_member_beyond_cap' || trigger === 'sponsor_locked_room') {
        const data = getPaywallTriggerData(trigger, options?.currentTier ?? entitlement?.tier);
        setPaywallState({
          isOpen: true,
          trigger,
          triggerData: data,
          roomId: options?.roomId,
        });
        return true;
      }

      return false;
    },
    [hasPlan, isTrial, entitlement],
  );

  const closePaywall = useCallback(() => {
    setPaywallState({
      isOpen: false,
      trigger: null,
      triggerData: null,
    });
  }, []);

  return {
    paywallState,
    checkAndTrigger,
    closePaywall,
  };
}
