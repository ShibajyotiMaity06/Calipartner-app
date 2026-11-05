import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  offer: { expired: true, claim_id: 'claim', ends_at: '2026-11-12' },
  route: '(tabs)',
}));
vi.mock('@/hooks/usePlusTrial', () => ({ usePlusTrial: () => ({ offer: api.offer }) }));
vi.mock('expo-router', () => ({ useSegments: () => [api.route] }));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'PaywallModal' }));
import { PlusTrialExpiryGate } from './PlusTrialExpiryGate';
it('opens on expiry, allows Free dismissal, and does not reopen on navigation', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<PlusTrialExpiryGate />);
  });
  const modal = tree.root.findByType('PaywallModal' as React.ElementType);
  expect(modal.props.trialExpired).toBe(true);
  await act(async () => modal.props.onClose());
  expect(tree.toJSON()).toBe(null);
  api.route = 'community';
  await act(async () => tree.update(<PlusTrialExpiryGate />));
  expect(tree.toJSON()).toBe(null);
  await act(async () => tree.unmount());
  api.route = 'onboarding';
  await act(async () => {
    tree = create(<PlusTrialExpiryGate />);
  });
  expect(tree.toJSON()).toBe(null);
  api.route = '(tabs)';
  await act(async () => tree.update(<PlusTrialExpiryGate />));
  expect(tree.toJSON()).not.toBe(null);
  api.offer = { ...api.offer, expired: false };
  await act(async () => tree.update(<PlusTrialExpiryGate />));
  expect(tree.toJSON()).toBe(null);
  await act(async () => tree.unmount());
});
