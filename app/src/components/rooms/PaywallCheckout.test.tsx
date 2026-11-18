import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const billing = vi.hoisted(() => ({
  catalog: vi.fn(),
  prepared: vi.fn(),
  create: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
  portal: vi.fn(),
  start: vi.fn(),
  manage: vi.fn(),
  cancel: vi.fn(),
  provider: 'dodo' as 'dodo' | 'razorpay',
  active: false,
  trialEligible: false,
  trial: vi.fn(),
  entitlement: null as Record<string, unknown> | null,
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
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Card: 'Card',
  Text: 'Text',
  Skeleton: 'Skeleton',
  useReducedMotion: () => true,
}));
vi.mock('@/hooks/usePlusTrial', () => ({
  usePlusTrial: () => ({
    offer: { eligible: billing.trialEligible },
    loading: false,
    starting: false,
    error: false,
    start: billing.trial,
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    offerings: null,
    entitlement: billing.entitlement,
    loading: false,
    error: null,
    hasActiveAccess: billing.active,
    refresh: billing.refresh,
  }),
}));
vi.mock('@/services/dodoService', () => ({
  fetchDodoCatalog: billing.catalog,
  createDodoCheckout: billing.create,
  navigateToCheckout: billing.navigate,
  openDodoPortal: billing.portal,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { access_token: 'fixture-session' } }),
}));
vi.mock('@/services/webBillingService', () => ({
  getCachedWebCatalog: billing.prepared,
  fetchBillingCountry: async () => 'US',
  saveBillingCountry: async () => undefined,
  fetchWebCatalog: async () => ({ provider: billing.provider, products: await billing.catalog() }),
  startWebCheckout: async (provider: string, tier: string, duration: string, id: string) => {
    if (provider === 'razorpay') return billing.start(provider, tier, duration, id);
    billing.navigate(await billing.create(tier, duration, id));
    return 'redirected';
  },
  fetchRazorpayManagement: billing.manage,
  cancelRazorpayRenewal: billing.cancel,
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'request-id' }));
vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn(), playSuccessSound: vi.fn() }));
import { Platform, Linking } from 'react-native';
import { PaywallModal } from './PaywallModal';
import { MeRoomPlanCard } from './MeRoomPlanCard';
let renderer: ReactTestRenderer | undefined;
const products = [
  { key: 'plus_semiannual', currency: 'INR', amount: 999, trialDays: 0 },
  { key: 'plus_quarterly', currency: 'INR', amount: 599, trialDays: 0 },
  { key: 'plus_annual', currency: 'INR', amount: 1499, trialDays: 0 },
  { key: 'pro_semiannual', currency: 'INR', amount: 1599, trialDays: 0 },
  { key: 'pro_quarterly', currency: 'INR', amount: 899, trialDays: 0 },
  { key: 'pro_annual', currency: 'INR', amount: 2499, trialDays: 0 },
];
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  billing.prepared.mockReturnValue(undefined);
  Platform.OS = 'web';
  billing.active = false;
  billing.trialEligible = false;
  billing.trial.mockResolvedValue(true);
  billing.provider = 'dodo';
  billing.start.mockResolvedValue('pending');
  billing.manage.mockResolvedValue({ request_id: 'request-id', cancelled: false });
  billing.cancel.mockResolvedValue(undefined);
  billing.entitlement = null;
  billing.portal.mockResolvedValue(undefined);
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
async function render(returning = false, cancelled = false, tier: 'plus' | 'pro' = 'plus') {
  await act(async () => {
    renderer = create(
      <PaywallModal
        visible
        onClose={vi.fn()}
        checkoutCancelled={cancelled}
        checkoutReturn={
          returning ? { tier, duration: 'annual', requestId: 'request-id' } : undefined
        }
      />,
    );
  });
}
describe('Chrome payment UI', () => {
  it('opens with prepared INR prices and the matching provider without a loading label', async () => {
    billing.prepared.mockReturnValue({ provider: 'razorpay', products });
    billing.catalog.mockReturnValue(new Promise(() => {}));
    await render();
    expect(JSON.stringify(renderer!.toJSON())).toContain('₹1,499');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('Loading prices');
    expect(
      renderer!.root.findAllByProps({ testID: 'paywall-plus-price-placeholder' }),
    ).toHaveLength(0);
    await act(async () =>
      renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress(),
    );
    expect(billing.start).toHaveBeenCalledWith('razorpay', 'plus', 'annual', 'request-id');
  });
  it('keeps purchase disabled with price placeholders while a fresh catalog is pending', async () => {
    billing.catalog.mockReturnValue(new Promise(() => {}));
    await render();
    expect(renderer!.root.findByProps({ testID: 'paywall-plus-price-placeholder' })).toBeDefined();
    expect(renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.disabled).toBe(true);
    expect(JSON.stringify(renderer!.toJSON())).toContain('Loading prices');
  });
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
    expect(content).toContain('₹1,499');
    expect(content).toContain('₹2,499');
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

it('annual Pro change-plan opens the existing subscription manager without creating another checkout', async () => {
  billing.active = true;
  billing.entitlement = {
    tier: 'pro',
    period: 'annual',
    source: 'dodo',
    status: 'paid',
    period_end: '2099-01-01',
  };
  const change = vi.fn();
  await act(async () => {
    renderer = create(<MeRoomPlanCard onChangePlan={change} />);
  });
  const text = JSON.stringify(renderer!.toJSON());
  expect(text).toContain('Capacity per room');
  expect(text).toContain('20 people per room');
  expect(text).toContain('Up to 5 rooms');
  await act(async () =>
    renderer!.root.findByProps({ testID: 'btn-me-change-plan' }).props.onPress(),
  );
  expect(billing.portal).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
  expect(billing.create).not.toHaveBeenCalled();
});
it('an active Pro paywall offers management and never starts a new subscription checkout', async () => {
  billing.active = true;
  billing.entitlement = {
    tier: 'pro',
    period: 'annual',
    source: 'dodo',
    status: 'paid',
    period_end: '2099-01-01',
  };
  await render();
  const cta = renderer!.root.findByProps({ testID: 'btn-paywall-cta' });
  expect(cta.props.label).toBe('Manage current plan');
  await act(async () => cta.props.onPress());
  expect(billing.portal).toHaveBeenCalledOnce();
  expect(billing.create).not.toHaveBeenCalled();
});
it('confirmed Pro success has only its unlocked title and Done action', async () => {
  billing.refresh.mockResolvedValue({
    tier: 'pro',
    period: 'annual',
    source: 'dodo',
    status: 'paid',
    period_end: '2099-01-01',
  });
  await render(true, false, 'pro');
  const success = renderer!.root.findByProps({ testID: 'modal-purchase-success' });
  const texts = success.findAll((node) => String(node.type) === 'Text');
  expect(texts.map((node) => node.props.children)).toEqual(['CaliPartner Pro unlocked', 'Done']);
  expect(texts[0]!.props.children).toBe('CaliPartner Pro unlocked');
});

it.each(['ios', 'android'] as const)(
  'active native %s subscriptions open management without another purchase',
  async (platform) => {
    Platform.OS = platform;
    billing.active = true;
    billing.entitlement = {
      tier: 'pro',
      period: 'annual',
      source: platform === 'ios' ? 'apple' : 'google',
      status: 'paid',
      period_end: '2099-01-01',
    };
    vi.mocked(Linking.openURL).mockResolvedValue(true);
    await render();
    await act(async () =>
      renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress(),
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      platform === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions',
    );
    expect(billing.create).not.toHaveBeenCalled();
  },
);

it('Indian web checkout stays pending until a matching Razorpay webhook entitlement exists', async () => {
  billing.provider = 'razorpay';
  await render();
  await act(async () => renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress());
  expect(billing.start).toHaveBeenCalledWith('razorpay', 'plus', 'annual', 'request-id');
  expect(billing.create).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Check plan status');
  expect(
    renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
  ).toHaveLength(1);
  billing.refresh.mockResolvedValue({
    source: 'razorpay',
    tier: 'plus',
    period: 'annual',
    status: 'paid',
    period_end: '2099-01-01',
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(
    renderer!.root.findAll((node) => String(node.type) === 'Modal' && node.props.visible),
  ).toHaveLength(2);
});
it('Razorpay management requires explicit confirmation before stopping renewal', async () => {
  billing.active = true;
  billing.provider = 'razorpay';
  billing.entitlement = {
    source: 'razorpay',
    tier: 'plus',
    period: 'annual',
    status: 'paid',
    period_end: '2099-01-01',
  };
  await render();
  await act(async () => renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress());
  expect(billing.manage).toHaveBeenCalledOnce();
  expect(billing.cancel).not.toHaveBeenCalled();
  await act(async () =>
    renderer!.root.findByProps({ testID: 'btn-razorpay-cancel' }).props.onPress(),
  );
  expect(billing.cancel).not.toHaveBeenCalled();
  await act(async () =>
    renderer!.root.findByProps({ testID: 'btn-confirm-razorpay-cancel' }).props.onPress(),
  );
  expect(billing.cancel).toHaveBeenCalledWith('request-id');
  expect(JSON.stringify(renderer!.toJSON())).toContain('Renewal stopped.');
  expect(billing.start).not.toHaveBeenCalled();
});

it.each(['close', 'back', 'swipe'])(
  'shows the quarterly offer on %s and checks out only after claim',
  async (method) => {
    await render();
    const root = renderer!.root;
    expect(
      root.findByProps({ testID: 'toggle-duration-annual' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(root.findByProps({ testID: 'toggle-duration-semiannual' })).toBeDefined();
    expect(root.findAllByProps({ testID: 'toggle-duration-monthly' })).toHaveLength(0);
    expect(root.findAllByProps({ testID: 'toggle-duration-quarterly' })).toHaveLength(0);
    await act(async () => root.findByProps({ testID: 'picker-size-21-50' }).props.onPress());
    await act(async () => {
      if (method === 'close') root.findByProps({ testID: 'btn-close-paywall' }).props.onPress();
      if (method === 'back')
        root.find((node) => String(node.type) === 'Modal').props.onRequestClose();
      if (method === 'swipe') {
        const header = root.findByProps({ testID: 'paywall-swipe-header' });
        header.props.onTouchStart({ nativeEvent: { pageX: 10, pageY: 20 } });
        header.props.onTouchEnd({ nativeEvent: { pageX: 10, pageY: 100 } });
      }
    });
    expect(root.findByProps({ testID: 'paywall-downsell' })).toBeDefined();
    expect(root.findByProps({ testID: 'paywall-downsell-total' }).props.children).toBe('₹899');
    expect(billing.create).not.toHaveBeenCalled();
    await act(async () => root.findByProps({ testID: 'claim-three-month-pass' }).props.onPress());
    expect(billing.create).toHaveBeenCalledWith('pro', 'quarterly', 'request-id');
  },
);
it('declines the three-month offer without initiating checkout', async () => {
  const close = vi.fn();
  await act(async () => {
    renderer = create(<PaywallModal visible onClose={close} />);
  });
  await act(async () =>
    renderer!.root.findByProps({ testID: 'btn-close-paywall' }).props.onPress(),
  );
  await act(async () =>
    renderer!.root.findByProps({ testID: 'dismiss-three-month-pass' }).props.onPress(),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(billing.create).not.toHaveBeenCalled();
});
it('lets an expired trial continue on Free even when pricing fails', async () => {
  billing.catalog.mockRejectedValue(new Error('offline'));
  const close = vi.fn();
  await act(async () => {
    renderer = create(<PaywallModal visible trialExpired onClose={close} />);
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your Plus trial has ended');
  await act(async () =>
    renderer!.root.findByProps({ testID: 'continue-free-after-trial' }).props.onPress(),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(billing.create).not.toHaveBeenCalled();
});
it('offers the onboarding Free action on the standard paywall without starting checkout', async () => {
  const home = vi.fn(),
    close = vi.fn();
  await act(async () => {
    renderer = create(<PaywallModal visible onClose={close} onContinueFree={home} />);
  });
  await act(async () =>
    renderer!.root.findByProps({ testID: 'continue-free-onboarding' }).props.onPress(),
  );
  expect(home).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  expect(billing.create).not.toHaveBeenCalled();
  expect(billing.trial).not.toHaveBeenCalled();
});

it('separates future benefits from currently available Pro support and hides numerical AI quotas', async () => {
  await render();
  await act(async () => {
    renderer!.root.findByProps({ testID: 'picker-size-21-50' }).props.onPress();
  });
  const content = JSON.stringify(renderer!.toJSON());
  const future = renderer!.root
    .findByProps({ testID: 'paywall-coming-soon' })
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' ');
  expect(content).toContain('Everything in Plus');
  expect(content).toContain('Personal AI Coach');
  expect(content).toContain('Priority support');
  expect(future.match(/Coming Soon/g)).toHaveLength(1);
  expect(future).not.toContain('Priority support');
  expect(content).not.toMatch(/10 messages|5 scans|900.*month|300.*month/);
  expect(future).not.toContain('not available with your purchase today');
});

it.each(['dodo', 'razorpay', 'apple', 'google'])(
  'account management follows the %s purchase provider on web',
  async (source) => {
    billing.active = true;
    billing.entitlement = { tier: 'pro', source, status: 'paid', period_end: '2099-01-01' };
    const change = vi.fn();
    vi.mocked(Linking.openURL).mockResolvedValue(true);
    await act(async () => {
      renderer = create(<MeRoomPlanCard compact onChangePlan={change} />);
    });
    const button = renderer!.root.findByProps({ testID: 'btn-me-change-plan' });
    expect(button.props.label).toBe(
      source === 'dodo' || source === 'razorpay'
        ? 'Manage web subscription'
        : 'Manage app subscription',
    );
    await act(async () => button.props.onPress());
    if (source === 'dodo') expect(billing.portal).toHaveBeenCalledOnce();
    else if (source === 'razorpay') expect(change).toHaveBeenCalledOnce();
    else
      expect(Linking.openURL).toHaveBeenCalledWith(
        source === 'apple'
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions',
      );
    expect(billing.create).not.toHaveBeenCalled();
  },
);

it.each(['paywall', 'account'] as const)(
  'Android %s management never opens an Apple URL, even for an Apple entitlement',
  async (surface) => {
    Platform.OS = 'android';
    billing.active = true;
    billing.entitlement = {
      tier: 'pro',
      source: 'apple',
      status: 'paid',
      period_end: '2099-01-01',
    };
    vi.mocked(Linking.openURL).mockResolvedValue(true);
    if (surface === 'paywall') {
      await render();
      await act(async () =>
        renderer!.root.findByProps({ testID: 'btn-paywall-cta' }).props.onPress(),
      );
    } else {
      await act(async () => {
        renderer = create(<MeRoomPlanCard compact onChangePlan={vi.fn()} />);
      });
      await act(async () =>
        renderer!.root.findByProps({ testID: 'btn-me-change-plan' }).props.onPress(),
      );
    }
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/account/subscriptions',
    );
  },
);
