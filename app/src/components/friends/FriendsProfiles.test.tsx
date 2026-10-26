import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialProfile } from '@calipartner/core';
import { HiddenMetric } from '@calipartner/ui';
vi.mock('react-native', () => ({
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Linking: { openURL: vi.fn(async () => {}) },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@calipartner/ui', () => ({
  Avatar: 'Avatar',
  Button: 'Button',
  HiddenMetric: 'HiddenMetric',
  Text: 'Text',
  SwitchRow: 'SwitchRow',
  SegmentedControl: 'SegmentedControl',
  useTheme: () => ({ colors: { bg0: 'background', danger: 'danger' } }),
}));
vi.mock('@/components/onboarding/PlanPrimitives', () => ({
  PlanTextField: 'TextInput',
  planStyles: { reviewContent: {} },
}));
import { PublicSocialProfile } from './PublicSocialProfile';
import { SocialProfileEditor } from './SocialProfileEditor';

const person: SocialProfile = {
  id: 'person',
  username: 'ari_fit',
  nickname: 'Ari',
  avatar_url: null,
  bio: 'Private bio',
  training_style: 'Private routine',
  instagram_handle: 'private_handle',
  website_url: 'https://example.com/private',
  is_public: false,
  relationship: 'none',
  request_id: null,
};
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
describe('social profile controls', () => {
  it('renders a lock instead of private social fields and replaces exhausted sends with an upgrade', async () => {
    const send = vi.fn();
    const upgrade = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <PublicSocialProfile
          profile={person}
          busy={false}
          queued={false}
          limitReached
          onClose={vi.fn()}
          onSend={send}
          onRespond={vi.fn()}
          onUpgrade={upgrade}
          onBlock={vi.fn()}
          onReport={vi.fn()}
        />,
      );
    });
    const content = JSON.stringify(renderer.toJSON());
    expect(content).not.toContain(person.bio);
    expect(content).not.toContain(person.training_style);
    expect(content).not.toContain(person.website_url);
    expect(renderer.root.findAllByType(HiddenMetric)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'send-friend-request' })).toHaveLength(0);
    await act(async () =>
      renderer.root.findByProps({ testID: 'upgrade-friend-limit' }).props.onPress(),
    );
    expect(upgrade).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });
  it('shows incoming consent controls even with an exhausted sender allowance and disables queued responses', async () => {
    const respond = vi.fn();
    const props = {
      profile: {
        ...person,
        is_public: true,
        relationship: 'incoming' as const,
        request_id: 'request',
      },
      busy: false,
      queued: false,
      limitReached: true,
      onClose: vi.fn(),
      onSend: vi.fn(),
      onRespond: respond,
      onUpgrade: vi.fn(),
      onBlock: vi.fn(),
      onReport: vi.fn(),
    };
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<PublicSocialProfile {...props} />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(person.bio);
    expect(renderer.root.findAllByProps({ testID: 'upgrade-friend-limit' })).toHaveLength(0);
    await act(async () =>
      renderer.root.findByProps({ testID: 'accept-friend-request' }).props.onPress(),
    );
    expect(respond).toHaveBeenCalledWith('accept');
    await act(async () => renderer.update(<PublicSocialProfile {...props} queued />));
    expect(renderer.root.findByProps({ testID: 'accept-friend-request' }).props.disabled).toBe(
      true,
    );
    expect(renderer.root.findByProps({ testID: 'decline-friend-request' }).props.disabled).toBe(
      true,
    );
    await act(async () => renderer.unmount());
  });
  it('offers bio and bulk/cut without contact links, preserves explicit sharing and reports failed saves', async () => {
    const save = vi.fn(async () => false);
    const close = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <SocialProfileEditor profile={person} busy={false} onClose={close} onSave={save} />,
      );
    });
    expect(renderer.root.findByProps({ testID: 'social-sharing' }).props.value).toBe(false);
    expect(renderer.root.findAllByProps({ testID: 'social-website' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'social-instagram' })).toHaveLength(0);
    await act(async () =>
      renderer.root.findByProps({ testID: 'social-goal' }).props.onChange('bulk'),
    );
    await act(async () =>
      renderer.root.findByProps({ testID: 'social-sharing' }).props.onValueChange(true),
    );
    await act(async () =>
      renderer.root.findByProps({ testID: 'save-social-profile' }).props.onPress(),
    );
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        is_public: true,
        training_style: 'bulk',
        website_url: '',
        instagram_handle: '',
      }),
    );
    expect(close).not.toHaveBeenCalled();
    save.mockResolvedValue(true);
    await act(async () =>
      renderer.root.findByProps({ testID: 'save-social-profile' }).props.onPress(),
    );
    expect(close).toHaveBeenCalledOnce();
    await act(async () => renderer.unmount());
  });
});
