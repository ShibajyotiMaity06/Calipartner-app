import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  signUpWithPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  os: 'ios',
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
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
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@calipartner/ui', () => ({
  useTheme: () => ({ reduceMotion: true, reduceTransparency: false }),
}));

vi.mock('@calipartner/ui/v1', async () => {
  const tokens = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...tokens,
    AppleIcon: 'AppleIcon',
    ChevronLeftIcon: 'ChevronLeftIcon',
    CloseIcon: 'CloseIcon',
    EyeIcon: 'EyeIcon',
    EyeOffIcon: 'EyeOffIcon',
    GoogleIcon: 'GoogleIcon',
    IconButton: 'IconButton',
    Input: 'Input',
    LinkButton: 'LinkButton',
    PrimaryButton: 'PrimaryButton',
    ScreenTitle: 'ScreenTitle',
    SocialButton: 'SocialButton',
    Text: 'Text',
    useTheme: () => ({ reduceMotion: true, reduceTransparency: false }),
  };
});

vi.mock('@/components/legal', () => ({
  TermsOfServiceModal: 'TermsOfServiceModal',
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    signUpWithPassword: authState.signUpWithPassword,
    signInWithPassword: authState.signInWithPassword,
    resetPassword: authState.resetPassword,
    signInWithGoogle: authState.signInWithGoogle,
    signInWithApple: authState.signInWithApple,
  }),
}));

import { OnboardingAuthModal } from './OnboardingAuthModal';

let tree: ReactTestRenderer;
const findById = (id: string) => tree.root.findByProps({ testID: id });

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  authState.user = null;
  authState.os = 'ios';
  authState.signUpWithPassword.mockResolvedValue({ error: null, needsEmailConfirmation: false });
  authState.signInWithPassword.mockResolvedValue({ error: null });
  authState.resetPassword.mockResolvedValue({ error: null });
  authState.signInWithGoogle.mockResolvedValue({ error: null });
  authState.signInWithApple.mockResolvedValue({ error: null });
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('renders Screen 17 signup with Apple/Google primary and email + password below', async () => {
  const onClose = vi.fn();
  const onAuth = vi.fn();

  await act(async () => {
    tree = create(<OnboardingAuthModal visible onClose={onClose} onAuthenticated={onAuth} />);
  });

  expect(findById('auth-header').props).toMatchObject({
    title: 'Save your plan',
    accentWord: 'plan',
  });
  expect(findById('btn-apple-signin').props.provider).toBe('apple');
  expect(findById('btn-google-signin').props.provider).toBe('google');

  // Invalid email rejects
  await act(async () => {
    findById('input-email').props.onChangeText('invalid');
    findById('input-password').props.onChangeText('password123');
  });
  await act(async () => {
    findById('btn-submit-email-auth').props.onPress();
  });
  expect(authState.signUpWithPassword).not.toHaveBeenCalled();

  // Short password rejects
  await act(async () => {
    findById('input-email').props.onChangeText('test@example.com');
    findById('input-password').props.onChangeText('short');
  });
  await act(async () => {
    findById('btn-submit-email-auth').props.onPress();
  });
  expect(authState.signUpWithPassword).not.toHaveBeenCalled();

  // Valid email + 8+ password signs up cleanly
  await act(async () => {
    findById('input-password').props.onChangeText('password123');
  });
  await act(async () => {
    findById('btn-submit-email-auth').props.onPress();
  });
  expect(authState.signUpWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
  expect(onAuth).toHaveBeenCalledOnce();
});

it('switches smoothly to Screen 18 Sign in mode with Forgot password', async () => {
  const onClose = vi.fn();
  const onAuth = vi.fn();

  await act(async () => {
    tree = create(<OnboardingAuthModal visible onClose={onClose} onAuthenticated={onAuth} />);
  });

  await act(async () => {
    findById('auth-switch-mode').props.onPress();
  });

  expect(findById('auth-header').props).toMatchObject({
    title: 'Welcome back',
    accentWord: 'back',
  });

  await act(async () => {
    findById('input-email').props.onChangeText('user@test.com');
    findById('input-password').props.onChangeText('secret123');
  });
  await act(async () => {
    findById('btn-forgot-password').props.onPress();
  });
  expect(authState.resetPassword).toHaveBeenCalledWith('user@test.com');

  await act(async () => {
    findById('btn-submit-email-auth').props.onPress();
  });
  expect(authState.signInWithPassword).toHaveBeenCalledWith('user@test.com', 'secret123');
  expect(onAuth).toHaveBeenCalledOnce();
});
