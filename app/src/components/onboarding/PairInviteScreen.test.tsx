import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  user: 'sender' as string | null,
  preview: vi.fn(),
  remember: vi.fn(),
  clear: vi.fn(),
  accept: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  share: vi.fn(),
}));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  Share: { share: fake.share },
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@calipartner/ui', () => ({
  Button: 'Button',
  Text: 'Text',
  space: [],
  useTheme: () => ({ colors: {} }),
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: 'aa290000-0000-4000-8000-000000000001' }),
  useRouter: () => ({ replace: fake.replace, push: fake.push }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: fake.user ? { id: fake.user } : null, isLoading: false }),
}));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/services/onboardingStatus', () => ({ isUserOnboarded: async () => true }));
vi.mock('@/services/pairOnboardingService', () => ({
  isPairToken: () => true,
  previewPairInvite: fake.preview,
  rememberPairInvite: fake.remember,
  clearPendingPairInvite: fake.clear,
  acceptPairInvite: fake.accept,
}));
import PairInviteScreen from '../../app/invite/[token]';
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fake.user = 'sender';
  fake.preview.mockResolvedValue({ state: 'sender', can_share: true });
  fake.remember.mockResolvedValue(undefined);
  fake.clear.mockResolvedValue(undefined);
  fake.share.mockResolvedValue(undefined);
  fake.accept.mockResolvedValue('room-id');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const render = async () =>
  act(async () => {
    tree = create(<PairInviteScreen />);
  });
describe('invitation identity before showing join', () => {
  it('the sender sees Share and never sees Join or stores their own token', async () => {
    await render();
    expect(tree.root.findAllByProps({ testID: 'accept-onboarding-pair' })).toHaveLength(0);
    expect(fake.clear).toHaveBeenCalled();
    expect(fake.remember).not.toHaveBeenCalled();
    await act(async () =>
      tree.root.findByProps({ testID: 'share-own-pair-invite' }).props.onPress(),
    );
    expect(fake.share).toHaveBeenCalled();
    expect(fake.accept).not.toHaveBeenCalled();
  });
  it('a recipient joins only after pressing Accept and opens the exact returned room', async () => {
    fake.user = 'recipient';
    fake.preview.mockResolvedValue({ state: 'joinable' });
    await render();
    expect(fake.accept).not.toHaveBeenCalled();
    expect(fake.remember).toHaveBeenCalled();
    await act(async () =>
      tree.root.findByProps({ testID: 'accept-onboarding-pair' }).props.onPress(),
    );
    expect(fake.accept).toHaveBeenCalledOnce();
    expect(fake.replace).toHaveBeenCalledWith('/room?room=room-id');
  });
  it('an existing member opens their room without accepting again', async () => {
    fake.preview.mockResolvedValue({ state: 'member', room_id: 'existing' });
    await render();
    expect(tree.root.findAllByProps({ testID: 'accept-onboarding-pair' })).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'open-invited-room' }).props.onPress());
    expect(fake.replace).toHaveBeenCalledWith('/room?room=existing');
    expect(fake.accept).not.toHaveBeenCalled();
  });
  it('unavailable links never offer acceptance', async () => {
    fake.preview.mockResolvedValue({ state: 'unavailable' });
    await render();
    expect(tree.root.findAllByProps({ testID: 'accept-onboarding-pair' })).toHaveLength(0);
    expect(fake.clear).toHaveBeenCalled();
  });
  it('a guest keeps the link through sign-in without attempting acceptance', async () => {
    fake.user = null;
    await render();
    expect(fake.preview).not.toHaveBeenCalled();
    expect(fake.remember).toHaveBeenCalled();
    await act(async () =>
      tree.root.findByProps({ testID: 'accept-onboarding-pair' }).props.onPress(),
    );
    expect(fake.push).toHaveBeenCalledWith('/auth/sign-in?mode=signup');
    expect(fake.accept).not.toHaveBeenCalled();
  });
});
