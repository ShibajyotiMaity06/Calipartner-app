import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const plan = vi.hoisted(() => ({ tier: 'free', active: false, loading: false }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'Loading',
  Modal: 'Modal',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Card: 'Card',
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    entitlement: { tier: plan.tier },
    hasActiveAccess: plan.active,
    loading: plan.loading,
  }),
}));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'Paywall' }));
import { PremiumFeatureModal } from './PremiumFeatureModal';
let renderer: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  plan.tier = 'free';
  plan.active = false;
  plan.loading = false;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it.each([
  'fasting_tracker',
  'workout_routines',
  'rest_timer_prs',
  'export_data',
  'body_measurements',
  'progress_photos',
] as const)('locks %s for Free without mounting paid content', async (feature) => {
  const mounted = vi.fn();
  function Content() {
    mounted();
    return <>{'Paid content'}</>;
  }
  await act(async () => {
    renderer = create(
      <PremiumFeatureModal feature={feature} visible onClose={vi.fn()}>
        <Content />
      </PremiumFeatureModal>,
    );
  });
  expect(mounted).not.toHaveBeenCalled();
  await act(async () =>
    renderer.root.findByProps({ testID: `upgrade-${feature}` }).props.onPress(),
  );
  expect(renderer.root.findByType('Paywall' as React.ElementType).props.preselectedTier).toBe(
    'plus',
  );
});
it.each(['plus', 'pro'])(
  'allows active %s but locks expired access even if its tier is retained',
  async (tier) => {
    plan.tier = tier;
    plan.active = true;
    const element = (
      <PremiumFeatureModal feature="workout_routines" visible onClose={vi.fn()}>
        <>{'Paid content'}</>
      </PremiumFeatureModal>
    );
    await act(async () => {
      renderer = create(element);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Paid content');
    plan.active = false;
    await act(async () =>
      renderer.update(
        <PremiumFeatureModal feature="workout_routines" visible onClose={vi.fn()}>
          <>{'Paid content'}</>
        </PremiumFeatureModal>,
      ),
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Paid content');
  },
);
