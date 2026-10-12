import React from 'react';
import { PaywallModal } from './PaywallModal';

export interface PlaceholderPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  preselectedTier?: 'basic' | 'plus' | 'pro';
  sponsorRoomId?: string;
  isUpgrade?: boolean;
}

export function PlaceholderPaywallModal(props: PlaceholderPaywallModalProps) {
  return <PaywallModal {...props} />;
}

export { PaywallModal };
