import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  catalog: vi.fn(),
  otp: vi.fn(),
  google: vi.fn(),
  verify: vi.fn(),
  params: { mode: 'signup' },
  setParams: vi.fn(),
  refresh: vi.fn(),
  cached: vi.fn(),
  trial: vi.fn(),
  eligible: true,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({
  useRouter: () => ({ setParams: api.setParams, replace: vi.fn() }),
  useLocalSearchParams: () => api.params,
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@calipartner/ui', async () => {
  const tokens = await import('../../../../packages/ui/src/tokens');
  return {
    ...tokens,
    Text: 'Text',
    SegmentedControl: (await import('@/test/SegmentedControlStub')).SegmentedControlStub,
    NavigationIcon: 'NavigationIcon',
    Button: 'Button',
    Field: 'Field',
    CheckIcon: 'CheckIcon',
    Skeleton: 'Skeleton',
    useTheme: () => ({ colors: tokens.dark }),
  };
});
vi.mock('@/hooks/usePlusTrial', () => ({
  usePlusTrial: () => ({
    offer: { eligible: api.eligible },
    loading: false,
    starting: false,
    error: false,
    start: api.trial,
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ offerings: null, loading: false, refresh: api.refresh }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signInWithOtp: api.otp,
    verifyOtp: api.verify,
    signInWithGoogle: api.google,
  }),
}));
vi.mock('@/services/webBillingService', () => ({
  fetchWebCatalog: api.catalog,
  getCachedWebCatalog: api.cached,
}));
vi.mock('@/services/pairOnboardingService', () => ({ afterSetupDestination: vi.fn() }));
vi.mock('@/components/brand/CaliPartnerLogo', () => ({ CaliPartnerLogo: 'CaliPartnerLogo' }));
vi.mock('@/components/brand/EntryTerms', () => ({ EntryTerms: 'EntryTerms' }));
vi.mock('./PlanPrimitives', () => ({
  PlanCard: 'PlanCard',
  planStyles: { section: {}, row: {}, flex: {} },
}));
import { PremiumStep } from './PremiumStep';
import SignInScreen from '@/app/auth/sign-in';
import WelcomeScreen from '@/app/welcome';
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.cached.mockReturnValue(undefined);
  api.eligible = true;
  api.trial.mockResolvedValue(true);
  api.params.mode = 'signup';
  api.otp.mockResolvedValue({ error: null });
  api.verify.mockResolvedValue({ error: null });
});
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
});
const products = (currency: string) =>
  ['pro_semiannual', 'pro_annual', 'pro_quarterly'].map((key, index) => ({
    key,
    currency,
    amount: (currency === 'INR' ? [1599, 2499, 899] : [32.99, 49.99, 18.99])[index],
    trialDays: 0,
  }));
it('shows prepared onboarding prices immediately without a loading-prices message', async () => {
  api.cached.mockReturnValue({ products: products('INR') });
  api.catalog.mockResolvedValue({ products: products('INR') });
  await act(async () => {
    tree = create(<PremiumStep onContinue={vi.fn()} onSkip={vi.fn()} />);
  });
  expect(tree!.root.findAllByProps({ testID: 'onboarding-pricing-placeholder' })).toHaveLength(0);
  expect(
    tree!.root.findByProps({ testID: 'onboarding-semiannual-price' }).props.children.join(''),
  ).toContain('1,599');
  expect(JSON.stringify(tree!.toJSON())).not.toContain('Loading prices');
});
it('uses a price placeholder while an unprepared request is still pending', async () => {
  api.catalog.mockReturnValue(new Promise(() => {}));
  await act(async () => {
    tree = create(<PremiumStep onContinue={vi.fn()} onSkip={vi.fn()} />);
  });
  expect(tree!.root.findByProps({ testID: 'onboarding-pricing-placeholder' })).toBeDefined();
  expect(JSON.stringify(tree!.toJSON())).toContain('Loading prices');
});
it.each(['INR', 'USD'])(
  'uses live %s prices and passes the selected Pro tier without offering a Pro trial',
  async (currency) => {
    api.catalog.mockResolvedValue({ products: products(currency) });
    const proceed = vi.fn(),
      skip = vi.fn();
    await act(async () => {
      tree = create(<PremiumStep onContinue={proceed} onSkip={skip} />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain(currency === 'INR' ? '₹1,599' : '$32.99');
    expect(tree!.root.findAllByProps({ testID: 'onboarding-plan-plus' })).toHaveLength(0);
    expect(tree!.root.findByProps({ testID: 'onboarding-quarterly-price' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'btn-onboarding-next' }).props.label).toBe(
      'Continue with Pro',
    );
    await act(async () =>
      tree!.root.findByProps({ testID: 'btn-onboarding-next' }).props.onPress(),
    );
    expect(proceed).toHaveBeenCalledWith('pro');
    await act(async () =>
      tree!.root.findByProps({ testID: 'btn-onboarding-free' }).props.onPress(),
    );
    expect(skip).toHaveBeenCalledOnce();
  },
);
it('keeps Free and price retry usable after automatic country detection fails', async () => {
  api.eligible = false;
  api.catalog
    .mockRejectedValueOnce(new Error('location unavailable'))
    .mockResolvedValueOnce({ products: products('USD') });
  await act(async () => {
    tree = create(<PremiumStep onContinue={vi.fn()} onSkip={vi.fn()} />);
  });
  expect(tree!.root.findByProps({ testID: 'btn-onboarding-next' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ testID: 'btn-onboarding-free' }).props.disabled).toBeUndefined();
  await act(async () =>
    tree!.root.findByProps({ testID: 'onboarding-prices-retry' }).props.onPress(),
  );
  expect(tree!.root.findByProps({ testID: 'btn-onboarding-next' }).props.disabled).toBe(false);
});
it.each(['signup', 'signin'])(
  'preserves email-code %s semantics and validates six digits',
  async (mode) => {
    api.params.mode = mode;
    await act(async () => {
      tree = create(<SignInScreen />);
    });
    expect(tree!.root.findByProps({ testID: 'auth-logo' })).toBeTruthy();
    expect(tree!.root.findAllByProps({ secureTextEntry: true })).toHaveLength(0);
    await act(async () =>
      tree!.root.findByProps({ testID: 'input-email' }).props.onChangeText('person@example.com'),
    );
    await act(async () => tree!.root.findByProps({ testID: 'btn-send-code' }).props.onPress());
    expect(api.otp).toHaveBeenCalledWith('person@example.com', mode === 'signup');
    expect(tree!.root.findByProps({ testID: 'input-otp' }).props.autoComplete).toBe(
      'one-time-code',
    );
    await act(async () =>
      tree!.root.findByProps({ testID: 'input-otp' }).props.onChangeText('abc123'),
    );
    await act(async () => tree!.root.findByProps({ testID: 'btn-verify-code' }).props.onPress());
    expect(api.verify).not.toHaveBeenCalled();
    await act(async () =>
      tree!.root.findByProps({ testID: 'input-otp' }).props.onChangeText('123456'),
    );
    await act(async () => tree!.root.findByProps({ testID: 'btn-verify-code' }).props.onPress());
    expect(api.verify).toHaveBeenCalledWith('person@example.com', '123456');
  },
);
it('shows request errors and restores the email action for a retry', async () => {
  api.otp.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    tree = create(<SignInScreen />);
  });
  await act(async () =>
    tree!.root.findByProps({ testID: 'input-email' }).props.onChangeText('person@example.com'),
  );
  await act(async () => tree!.root.findByProps({ testID: 'btn-send-code' }).props.onPress());
  expect(tree!.root.findByProps({ testID: 'auth-error-banner' })).toBeTruthy();
  expect(tree!.root.findByProps({ testID: 'btn-send-code' }).props.loading).toBe(false);
});

it('keeps the Free action available while paid checkout waits for verified pricing', async () => {
  api.catalog.mockReturnValue(new Promise(() => {}));
  const skip = vi.fn(),
    proceed = vi.fn();
  await act(async () => {
    tree = create(<PremiumStep onContinue={proceed} onSkip={skip} />);
  });
  expect(tree!.root.findByProps({ testID: 'btn-onboarding-next' }).props.disabled).toBe(true);
  await act(async () => tree!.root.findByProps({ testID: 'btn-onboarding-free' }).props.onPress());
  expect(skip).toHaveBeenCalledOnce();
  expect(proceed).not.toHaveBeenCalled();
  expect(api.trial).not.toHaveBeenCalled();
});
it('explains Indian food and free personal tracking before registration', async () => {
  await act(async () => {
    tree = create(<WelcomeScreen />);
  });
  expect(tree!.root.findByProps({ testID: 'welcome-audience' }).props.children).toContain(
    'Indian food',
  );
  expect(tree!.root.findByProps({ testID: 'welcome-trial' }).props.children).toContain(
    'Personal tracking is free forever.',
  );
});
it('keeps email available when Google hangs and shows recovery guidance', async () => {
  vi.useFakeTimers();
  try {
    api.google.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      tree = create(<SignInScreen />);
    });
    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-google-signin' }).props.onPress();
    });
    expect(tree!.root.findByProps({ testID: 'auth-browser-help' }).props.children).toContain(
      'Safari/Chrome',
    );
    expect(tree!.root.findByProps({ testID: 'btn-send-code' }).props.disabled).not.toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });
    expect(tree!.root.findByProps({ testID: 'auth-error-banner' })).toBeTruthy();
    expect(tree!.root.findByProps({ testID: 'btn-google-signin' }).props.disabled).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
it('shows actionable alternatives on disallowed Google user agent', async () => {
  api.google.mockResolvedValue({ error: new Error('disallowed_useragent') });
  await act(async () => {
    tree = create(<SignInScreen />);
  });
  await act(async () => {
    tree!.root.findByProps({ testID: 'btn-google-signin' }).props.onPress();
  });
  expect(tree!.root.findByProps({ testID: 'auth-browser-help' }).props.children).toContain(
    'email 6-digit code',
  );
  expect(tree!.root.findByProps({ testID: 'btn-send-code' }).props.disabled).not.toBe(true);
});
