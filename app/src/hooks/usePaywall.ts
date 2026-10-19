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
      // Free user accepting invite or joining room
      if (options?.isInvited !== undefined) {
        if (!shouldShowPaywallForInvite(options.isInvited, hasPlan)) {
          return false;
        }
      }

      if (trigger === 'accept_room_invite' || trigger === 'join_room') {
        const hasAccess =
          hasPlan ||
          (isTrial &&
            (!entitlement?.period_end || new Date(entitlement.period_end) > new Date()));
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
        const hasAccess =
          hasPlan ||
          (isTrial &&
            (!entitlement?.period_end || new Date(entitlement.period_end) > new Date()));
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
        const hasAccess =
          hasPlan ||
          (isTrial &&
            (!entitlement?.period_end || new Date(entitlement.period_end) > new Date()));
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

      if (trigger === 'create_room_after_trial') {
        // Only if trial is used and user doesn't have an active plan
        if (
          !hasPlan &&
          (!isTrial || (entitlement?.period_end && new Date(entitlement.period_end) <= new Date()))
        ) {
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

      if (trigger === 'add_member_beyond_cap' || trigger === 'sponsor_locked_room') {
        const data = getPaywallTriggerData(trigger, options?.currentTier ?? entitlement?.tier ?? 'plus');
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
