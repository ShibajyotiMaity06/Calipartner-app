import React, { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import { usePlusTrial } from '@/hooks/usePlusTrial';
import { PaywallModal } from '@/components/rooms/PaywallModal';

/** Shows the upgrade choice once per app session; Free screens remain available. */
export function PlusTrialExpiryGate() {
  const { offer } = usePlusTrial();
  const [visible, setVisible] = useState(false);
  const shown = useRef(new Set<string>());
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  useEffect(() => {
    if (!offer?.expired) {
      setVisible(false);
      return;
    }
    if (!first || ['auth', 'onboarding', 'welcome', 'index', 'paywall', 'invite'].includes(first))
      return;
    const key = offer.claim_id ?? offer.ends_at;
    if (key && !shown.current.has(key)) {
      shown.current.add(key);
      setVisible(true);
    }
  }, [offer, first]);
  return visible ? (
    <PaywallModal visible trialExpired onClose={() => setVisible(false)} preselectedTier="plus" />
  ) : null;
}
