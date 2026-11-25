import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android' | 'web',
  purchase: vi.fn(),
  restore: vi.fn(),
  refresh: vi.fn(),
  checkAvailability: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  catalog: vi.fn(),
  startWebCheckout: vi.fn(),
  profile: null as { id: string; username: string; country?: string } | null,
  offerings: null as unknown,
  hasActiveAccess: false,
}));

vi.mock('react-native', () => ({
  View: 'View',
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: {
    get OS() {
      return mocks.os;
    },
  },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
}));
vi.mock('@calipartner/ui/v1', async () => {
  const tokens = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...tokens,
    AppleIcon: 'AppleIcon',
    AvatarRing: 'AvatarRing',
    Badge: 'Badge',
    BrandRingMark: 'BrandRingMark',
    CameraIcon: 'CameraIcon',
    Card: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Card', rest, children as React.ReactNode),
    CheckIcon: 'CheckIcon',
    ChevronLeftIcon: 'ChevronLeftIcon',
    DropletIcon: 'DropletIcon',
    EyeIcon: 'EyeIcon',
    EyeOffIcon: 'EyeOffIcon',
    GoogleIcon: 'GoogleIcon',
    IconButton: 'IconButton',
    Input: 'Input',
    LinkButton: 'LinkButton',
    NotificationPreview: 'NotificationPreview',
    PrimaryButton: 'PrimaryButton',
    Radio: 'Radio',
    ScanIcon: 'ScanIcon',
    ScreenTitle: 'ScreenTitle',
    SocialButton: 'SocialButton',
    SquadIcon: 'SquadIcon',
    SwitchRow: 'SwitchRow',
    Text: 'Text',
    UtensilsIcon: 'UtensilsIcon',
  };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'tok' },
    user: { id: 'owner' },
    profile: mocks.profile,
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPassword: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    offerings: mocks.offerings,
    purchase: mocks.purchase,
    restore: mocks.restore,
    refresh: mocks.refresh,
    hasActiveAccess: mocks.hasActiveAccess,
    loading: false,
  }),
}));
vi.mock('@/hooks/useUsername', () => ({
  useUsername: () => ({
    checkAvailability: mocks.checkAvailability,
    status: 'available',
    setStatus: vi.fn(),
  }),
}));
vi.mock('@/services/subscriptionPackages', () => ({
  findSubscriptionPackage: (_offerings: unknown, _tier: string, duration: string) => ({
    product: {
      identifier: `pro_${duration}`,
      price:
        duration === 'annual'
          ? 2499
          : duration === 'semiannual'
            ? 1599
            : duration === 'quarterly'
              ? 899
              : 499,
      priceString:
        duration === 'annual'
          ? '₹2,499'
          : duration === 'semiannual'
            ? '₹1,599'
            : duration === 'quarterly'
              ? '₹899'
              : '₹499',
      currencyCode: 'INR',
    },
  }),
}));
vi.mock('@/services/webBillingService', () => ({
  fetchWebCatalog: mocks.catalog,
  getCachedWebCatalog: () => undefined,
  startWebCheckout: mocks.startWebCheckout,
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'uuid-1' }));
vi.mock('@/components/legal', () => ({ TermsOfServiceModal: 'TermsOfServiceModal' }));

import { RemindersStep } from './RemindersStep';
import { ProTeaserStep } from './ProTeaserStep';
import { PaywallV1Step } from './PaywallV1Step';
import { ProfileSetupStep } from './ProfileSetupStep';
import { AllSetStep } from './AllSetStep';

let tree: ReactTestRenderer;
const byId = (id: string) => tree.root.findByProps({ testID: id });

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.os = 'ios';
  mocks.profile = null;
  mocks.hasActiveAccess = false;
  mocks.checkAvailability.mockResolvedValue(true);
  mocks.restore.mockResolvedValue(false);
  mocks.purchase.mockResolvedValue('verified');
  mocks.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///avatar.jpg' }],
  });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

describe('Onboarding Screens 16–25 Design System v1 components', () => {
  it('renders Screen 16 Reminders with personalized preview and toggles', async () => {
    const onChange = vi.fn();
    await act(async () => {
      tree = create(
        <RemindersStep
          nickname="Priya"
          prefs={{ meals: true, hydration: true, partner: true }}
          onChangePrefs={onChange}
        />,
      );
    });
    expect(byId('reminders-header').props).toMatchObject({
      eyebrow: 'STAY ON TRACK',
      title: 'Gentle nudges, never noise',
      accentWord: 'never noise',
    });
    expect(byId('reminders-notification-preview').props).toMatchObject({
      appName: 'CALIPARTNER',
      title: 'Time for lunch, Priya',
    });
    await act(async () => byId('switch-reminder-hydration').props.onValueChange(false));
    expect(onChange).toHaveBeenCalledWith({ meals: true, hydration: false, partner: true });
  });

  it('renders Screens 19, 20, and 21 Pro teaser cards accurately', async () => {
    await act(async () => {
      tree = create(<ProTeaserStep slide="pro_coach" nickname="Priya" />);
    });
    expect(byId('pro-coach-scan-card')).toBeTruthy();
    expect(byId('pro-coach-reply-card')).toBeTruthy();

    await act(async () => {
      tree.update(<ProTeaserStep slide="pro_partners" nickname="Priya" />);
    });
    expect(byId('pro-partners-match-card')).toBeTruthy();
    expect(byId('pro-partners-squad-card')).toBeTruthy();

    await act(async () => {
      tree.update(<ProTeaserStep slide="pro_adaptive" nickname="Priya" goal="cut" />);
    });
    expect(byId('pro-adaptive-chart')).toBeTruthy();
    expect(byId('pro-adaptive-calories-new').props.children).toBe('1,850');
    expect(byId('pro-adaptive-protein-new').props.children).toBe('145 g');

    await act(async () => {
      tree.update(<ProTeaserStep slide="pro_adaptive" nickname="Priya" goal="bulk" />);
    });
    expect(byId('pro-adaptive-chart')).toBeTruthy();
    expect(byId('pro-adaptive-calories-new').props.children).toBe('2,950');
    expect(byId('pro-adaptive-protein-new').props.children).toBe('165 g');
  });

  it('renders Screen 22 Paywall, switches via See other plans to Screen 23 All plans, and purchases or skips cleanly', async () => {
    const onPro = vi.fn();
    const onFree = vi.fn();
    await act(async () => {
      tree = create(<PaywallV1Step onContinueProSuccess={onPro} onContinueFree={onFree} />);
    });

    expect(byId('onboarding-screen-paywall')).toBeTruthy();
    expect(byId('paywall-header').props.title).toBe('Everything in Pro');

    // Open Screen 23 All plans via "See other plans"
    await act(async () => byId('btn-see-other-plans').props.onPress());
    expect(byId('onboarding-screen-all-plans')).toBeTruthy();
    expect(byId('all-plans-header').props.title).toBe('Pick your plan');

    // Select 6 months option and purchase
    await act(async () => byId('plan-option-semiannual').props.onPress());
    await act(async () => byId('btn-all-plans-continue').props.onPress());
    expect(mocks.purchase).toHaveBeenCalled();
    expect(onPro).toHaveBeenCalledOnce();

    // Navigate back to compare and tap Continue with Free
    await act(async () => byId('btn-all-plans-back').props.onPress());
    expect(byId('onboarding-screen-paywall')).toBeTruthy();
    await act(async () => byId('continue-free-onboarding').props.onPress());
    expect(onFree).toHaveBeenCalledOnce();
  });

  it('renders Screen 24 Profile setup with handle preview and optional photo picker', async () => {
    const onChangeUsername = vi.fn();
    const onChangeValid = vi.fn();
    const onChangePhotoUri = vi.fn();

    await act(async () => {
      tree = create(
        <ProfileSetupStep
          nickname="Priya"
          onChangeUsername={onChangeUsername}
          onChangeValid={onChangeValid}
          onChangePhotoUri={onChangePhotoUri}
        />,
      );
    });

    expect(byId('profile-setup-header').props).toMatchObject({
      eyebrow: 'ALMOST THERE',
      title: 'Make it yours',
    });
    expect(byId('profile-squad-preview')).toBeTruthy();

    await act(async () => {
      await byId('btn-pick-profile-photo').props.onPress();
    });
    expect(onChangePhotoUri).toHaveBeenCalledWith('file:///avatar.jpg');
  });

  it('renders Screen 25 All set celebration with Go to Today and Invite a partner actions', async () => {
    const onToday = vi.fn();
    const onInvite = vi.fn();

    await act(async () => {
      tree = create(
        <AllSetStep nickname="Priya" onGoToToday={onToday} onInvitePartner={onInvite} />,
      );
    });

    expect(byId('all-set-check-ring')).toBeTruthy();
    expect(byId('all-set-header').props).toMatchObject({
      title: "You're all set, Priya!",
      accentWord: 'Priya!',
    });

    await act(async () => byId('btn-all-set-today').props.onPress());
    expect(onToday).toHaveBeenCalledOnce();

    await act(async () => byId('btn-all-set-invite').props.onPress());
    expect(onInvite).toHaveBeenCalledOnce();
  });
});
