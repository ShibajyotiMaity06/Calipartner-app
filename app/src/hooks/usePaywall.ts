import { useCallback, useState } from 'react';
import {
  getPaywallTriggerData,
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
  const { hasPlan, hasActiveAccess, entitlement } = useSubscription();

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
      if (
        trigger === 'accept_room_invite' ||
        trigger === 'join_room' ||
        trigger === 'create_room_after_trial'
      )
        return false;

      // Feature specific gating
      if (trigger === 'open_ai_coach') {
        const isPro = entitlement?.tier === 'pro' && hasPlan;
        if (!isPro) {
          const data = getPaywallTriggerData(trigger, 'pro');
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

      if (trigger === 'open_partner_finder') {
        const hasAccess = hasActiveAccess;
        if (!hasAccess) {
          const data = getPaywallTriggerData(trigger, options?.currentTier ?? 'plus');
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

      if (trigger === 'ai_photo_scan') {
        const isPro = entitlement?.tier === 'pro' && hasPlan;
        if (!isPro) {
          const data = getPaywallTriggerData(trigger, 'pro');
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

      // Plus features: fasting, routines, meal planner, challenges, recipes, measurements
      if (
        trigger === 'fasting_tracker' ||
        trigger === 'challenges' ||
        trigger === 'meal_planner' ||
        trigger === 'workout_routines' ||
        trigger === 'body_measurements' ||
        trigger === 'recipe_library' ||
        trigger === 'extra_nutrients'
      ) {
        const hasAccess = hasActiveAccess;
        if (!hasAccess) {
          const data = getPaywallTriggerData(trigger, 'plus');
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
        const data = getPaywallTriggerData(
          trigger,
          options?.currentTier ?? entitlement?.tier ?? 'plus',
        );
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
    [hasPlan, hasActiveAccess, entitlement],
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
