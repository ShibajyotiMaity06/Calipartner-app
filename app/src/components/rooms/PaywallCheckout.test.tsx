import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const billing = vi.hoisted(() => ({
  catalog: vi.fn(),
  create: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'web' },
  Linking: { openURL: vi.fn() },
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
  Card: 'Card',
  Text: 'Text',
  useReducedMotion: () => true,
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    offerings: null,
    entitlement: null,
    loading: false,
    error: null,
    hasActiveAccess: false,
    refresh: billing.refresh,
  }),
}));
vi.mock('@/services/dodoService', () => ({
  fetchDodoCatalog: billing.catalog,
  createDodoCheckout: billing.create,
  navigateToCheckout: billing.navigate,
  openDodoPortal: vi.fn(),
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'request-id' }));
vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn(), playSuccessSound: vi.fn() }));
import { PaywallModal } from './PaywallModal';
let renderer: ReactTestRenderer | undefined;
const products = [
  { key: 'plus_monthly', currency: 'INR', amount: 249, trialDays: 7 },
  { key: 'plus_annual', currency: 'INR', amount: 1499, trialDays: 7 },
  { key: 'pro_monthly', currency: 'INR', amount: 499, trialDays: 0 },
  { key: 'pro_annual', currency: 'INR', amount: 2499, trialDays: 0 },
];
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.useFakeTimers();
  billing.catalog.mockResolvedValue(products);
  billing.refresh.mockResolvedValue(null);
  billing.create.mockResolvedValue('https://checkout.dodopayments.com/session');
});
afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.useRealTimers();
});
async function render(returning = false, cancelled = false) {
  await act(async () => {
    renderer = create(
      <PaywallModal
        visible
        onClose={vi.fn()}
        checkoutCancelled={cancelled}
        checkoutReturn={
          returning ? { tier: 'plus', duration: 'annual', requestId: 'request-id' } : undefined
        }
      />,
    );
  });
}
describe('Chrome payment UI', () => {
  it('returns a cancelled checkout to plan selection without polling or showing success', async () => {
    await render(true, true);
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Checkout was cancelled. Your plan has not changed.',
    );
    expect(billing.refresh).not.toHaveBeenCalled();
    expect(
      renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
    ).toHaveLength(1);
  });
  it('displays verified prices and opens the selected product without granting access', async () => {
    await render();
    const content = JSON.stringify(renderer!.toJSON());
    expect(content).toContain('₹1,499.00 / year');
    expect(content).toContain('₹2,499.00 / year');
    await act(async () =>
      renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress(),
    );
    expect(billing.create).toHaveBeenCalledWith('plus', 'annual', 'request-id');
    expect(billing.navigate).toHaveBeenCalledWith('https://checkout.dodopayments.com/session');
    expect(
      renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
    ).toHaveLength(1);
  });
  it('allows retry after the catalog fails without starting a checkout', async () => {
    billing.catalog.mockRejectedValueOnce(new Error('Unavailable'));
    await render();
    expect(JSON.stringify(renderer!.toJSON())).toContain('Retry loading prices');
    await act(async () =>
      renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress(),
    );
    expect(billing.catalog).toHaveBeenCalledTimes(2);
    expect(billing.create).not.toHaveBeenCalled();
  });
  it('never treats a return URL as proof of payment and stops polling when closed', async () => {
    await render(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(billing.refresh).toHaveBeenCalledTimes(2);
    expect(
      renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
    ).toHaveLength(1);
    await act(async () => renderer!.unmount());
    renderer = undefined;
    await vi.advanceTimersByTimeAsync(5000);
    expect(billing.refresh).toHaveBeenCalledTimes(2);
  });
  it('automatically confirms a matching server entitlement after returning', async () => {
    billing.refresh.mockResolvedValue({
      tier: 'plus',
      period: 'annual',
      source: 'dodo',
      status: 'paid',
      period_end: '2099-01-01',
    });
    await render(true);
    expect(
      renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
    ).toHaveLength(2);
    expect(billing.create).not.toHaveBeenCalled();
  });
});
