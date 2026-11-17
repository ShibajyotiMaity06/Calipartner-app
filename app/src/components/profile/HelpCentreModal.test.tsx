import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tier: 'pro', active: true, open: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openURL: state.open },
  StyleSheet: { create: (s: unknown) => s },
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Card: 'Card',
  NavigationIcon: 'NavigationIcon',
}));
vi.mock('@calipartner/ui/theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '0.1.0' } } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner' }, profile: { username: 'alex' } }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    currentTier: state.tier,
    hasActiveAccess: state.active,
    loading: false,
  }),
}));
vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn() }));
import { HelpCentreModal } from './HelpCentreModal';
it('opens the owner-confirmed mailbox with Pro metadata and no false sent confirmation', async () => {
  state.tier = 'pro';
  state.active = true;
  state.open.mockResolvedValue(undefined);
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<HelpCentreModal visible onClose={vi.fn()} />);
  });
  expect(tree.root.findByProps({ testID: 'priority-support-card' })).toBeDefined();
  await act(async () => {
    await tree.root.findByProps({ testID: 'btn-contact-support' }).props.onPress();
  });
  const url = decodeURIComponent(state.open.mock.calls.at(-1)![0]);
  expect(url).toContain('mailto:shibajyoti.maity06@gmail.com');
  expect(url).toContain('[Priority Support]');
  expect(url).toContain('@alex');
  expect(url).toContain('User ID: owner');
  expect(url).toContain('CaliPartner Pro (Active)');
  await act(async () => tree.unmount());
});
it('expired Pro uses general support and failed email launch gives actionable feedback', async () => {
  state.tier = 'pro';
  state.active = false;
  state.open.mockRejectedValue(Error('NO_EMAIL_APP'));
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<HelpCentreModal visible onClose={vi.fn()} />);
  });
  expect(tree.root.findAllByProps({ testID: 'priority-support-card' })).toHaveLength(0);
  await act(async () => {
    await tree.root.findByProps({ testID: 'btn-contact-support' }).props.onPress();
  });
  expect(decodeURIComponent(state.open.mock.calls.at(-1)![0])).not.toContain('[Priority Support]');
  expect(JSON.stringify(tree.toJSON())).toContain('Could not open your email app');
  await act(async () => tree.unmount());
});
