import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  os: 'ios',
}));

vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  TouchableOpacity: 'TouchableOpacity',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: {
    get OS() {
      return authState.os;
    },
  },
  StyleSheet: { create: (value: unknown) => value },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Field: 'Field',
  SegmentedControl: 'SegmentedControl',
  Text: 'Text',
  useTheme: () => ({ colors: {}, reduceMotion: true }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    signInWithOtp: authState.signInWithOtp,
    verifyOtp: authState.verifyOtp,
    signInWithGoogle: authState.signInWithGoogle,
    signInWithApple: authState.signInWithApple,
  }),
}));

vi.mock('@/components/brand/CaliPartnerLogo', () => ({
  CaliPartnerLogo: 'Logo',
}));

vi.mock('@/components/brand/EntryTerms', () => ({
  EntryTerms: 'Terms',
}));

import { OnboardingAuthModal } from './OnboardingAuthModal';

let tree: ReactTestRenderer;
const find = (type: string) => tree.root.findByType(type as React.ElementType);
const findById = (id: string) => tree.root.findByProps({ testID: id });

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  authState.user = null;
  authState.os = 'ios';
  authState.signInWithOtp.mockResolvedValue({ error: null });
  authState.verifyOtp.mockResolvedValue({ error: null });
  authState.signInWithGoogle.mockResolvedValue({ error: null });
  authState.signInWithApple.mockResolvedValue({ error: null });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('renders signup options with Apple and Google and validates email OTP', async () => {
  const onClose = vi.fn();
  const onAuth = vi.fn();

  await act(async () => {
    tree = create(<OnboardingAuthModal visible onClose={onClose} onAuthenticated={onAuth} />);
  });

  expect(findById('onboarding-auth-title').props.children).toBe('Save your plan & start tracking');
  expect(findById('btn-onboarding-apple-signin')).toBeTruthy();
  expect(findById('btn-onboarding-google-signin')).toBeTruthy();

  // Invalid email rejects
  await act(async () => {
    findById('input-onboarding-email').props.onChangeText('invalid');
  });
  await act(async () => {
    findById('btn-onboarding-send-code').props.onPress();
  });
  expect(authState.signInWithOtp).not.toHaveBeenCalled();

  // Valid email triggers OTP send
  await act(async () => {
    findById('input-onboarding-email').props.onChangeText('test@example.com');
  });
  await act(async () => {
    findById('btn-onboarding-send-code').props.onPress();
  });
  expect(authState.signInWithOtp).toHaveBeenCalledWith('test@example.com', true);

  // Now in OTP step: valid 6 digit code verifies
  await act(async () => {
    findById('input-onboarding-otp').props.onChangeText('123456');
  });
  await act(async () => {
    findById('btn-onboarding-verify-code').props.onPress();
  });
  expect(authState.verifyOtp).toHaveBeenCalledWith('test@example.com', '123456');
});

it('switches to signin mode smoothly', async () => {
  const onClose = vi.fn();
  const onAuth = vi.fn();

  await act(async () => {
    tree = create(<OnboardingAuthModal visible onClose={onClose} onAuthenticated={onAuth} />);
  });

  await act(async () => {
    find('SegmentedControl').props.onChange('signin');
  });

  expect(findById('input-onboarding-email')).toBeTruthy();
  await act(async () => {
    findById('input-onboarding-email').props.onChangeText('user@test.com');
  });
  await act(async () => {
    findById('btn-onboarding-send-code').props.onPress();
  });
  expect(authState.signInWithOtp).toHaveBeenCalledWith('user@test.com', false);
});
