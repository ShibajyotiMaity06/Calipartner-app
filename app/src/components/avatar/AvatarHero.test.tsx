import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  sex: 'female',
  disabled: false,
  owner: 'owner',
  existing: false,
  create: vi.fn(),
  acknowledge: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View', StyleSheet: { create: (v: unknown) => v } }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  CoinIcon: 'Coin',
  useTheme: () => ({ colors: {} }),
}));
vi.mock('expo-router', () => ({ useFocusEffect: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mock.owner }, profile: { sex: mock.sex } }),
}));
vi.mock('@/hooks/useAvatar', () => ({
  useAvatar: () => ({
    loading: false,
    error: false,
    refresh: mock.refresh,
    acknowledge: mock.acknowledge,
    state: mock.disabled
      ? { enabled: false }
      : {
          enabled: true,
          profile: mock.existing ? { xp: 0 } : null,
          tints: [{ kind: 'skin', id: 'skin-basic' }],
          levels: [{ level: 1, xp_required: 0, form: 1 }],
          products: [],
          config: { level_cap: 100 },
        },
  }),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/avatarService', () => ({
  createAvatar: mock.create,
  claimAvatarDrop: vi.fn(),
}));
vi.mock('./AvatarView', () => ({ AvatarView: 'Avatar' }));
import { AvatarHero } from './AvatarHero';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  mock.owner = 'owner';
  mock.existing = false;
  mock.disabled = false;
  mock.create.mockResolvedValue({ profile: { user_id: 'owner' } });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it.each([
  ['female', 'f'],
  ['male', 'm'],
])('creates one basic %s avatar on Home and waits for acknowledgement', async (sex, gender) => {
  mock.sex = sex;
  await act(async () => {
    tree = create(<AvatarHero />);
  });
  expect(mock.create).toHaveBeenCalledWith({}, gender, 'skin-basic');
  expect(mock.acknowledge).toHaveBeenCalledWith({ profile: { user_id: 'owner' } });
  await act(async () => tree.update(<AvatarHero />));
  expect(mock.create).toHaveBeenCalledTimes(1);
});
it('does not replace a customized avatar', async () => {
  mock.existing = true;
  await act(async () => {
    tree = create(<AvatarHero />);
  });
  expect(mock.create).not.toHaveBeenCalled();
});
it('does not acknowledge an avatar after the Home screen unmounts', async () => {
  let resolve!: (value: unknown) => void;
  mock.create.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await act(async () => {
    tree = create(<AvatarHero />);
  });
  await act(async () => tree.unmount());
  await act(async () => resolve({ profile: { user_id: 'owner' } }));
  expect(mock.acknowledge).not.toHaveBeenCalled();
});

it('does not read catalog data or create when avatars are disabled', async () => {
  mock.disabled = true;
  await act(async () => {
    tree = create(<AvatarHero />);
  });
  expect(tree.toJSON()).toBeNull();
  expect(mock.create).not.toHaveBeenCalled();
});
