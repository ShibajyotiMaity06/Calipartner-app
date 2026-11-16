import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ balance: 0, buy: vi.fn(), push: vi.fn(), close: vi.fn() }));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
  Text: 'Text',
  useTheme: () => ({ colors: {} }),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('./CoinAmount', () => ({ CoinAmount: 'CoinAmount' }));
vi.mock('@/hooks/useAvatar', () => ({
  useAvatar: () => ({
    state: { balances: { earned: state.balance, purchased: 0 } },
    acknowledge: vi.fn(),
  }),
}));
vi.mock('@/services/avatarService', () => ({ purchaseAvatarProduct: state.buy }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'request-id' }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
import { PurchaseSheet } from './PurchaseSheet';
let renderer: ReactTestRenderer;
const quote = { name: 'Comfy joggers', price: 100, productId: 'joggers', collectionId: null };
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.clearAllMocks();
});
it('shows an item-specific shortfall without a negative projected balance or purchase action', async () => {
  state.balance = 0;
  await act(async () => {
    renderer = create(<PurchaseSheet quote={quote} onClose={state.close} />);
  });
  const content = JSON.stringify(renderer.toJSON());
  expect(content).toContain('Not enough coins to buy Comfy joggers.');
  expect(content).not.toContain('-100');
  expect(renderer.root.findAllByProps({ testID: 'avatar-confirm-purchase' })).toHaveLength(0);
  expect(renderer.root.findByProps({ testID: 'avatar-cancel-purchase' }).props.variant).toBe(
    'destructive',
  );
  await act(async () => renderer.root.findByProps({ testID: 'purchase-buy-cc' }).props.onPress());
  expect(state.buy).not.toHaveBeenCalled();
  expect(state.close).toHaveBeenCalledOnce();
  expect(state.push).toHaveBeenCalledWith('/wallet');
});
it('only spends after explicit confirmation when the item is affordable', async () => {
  state.balance = 250;
  state.buy.mockResolvedValue({});
  await act(async () => {
    renderer = create(<PurchaseSheet quote={quote} onClose={state.close} />);
  });
  expect(state.buy).not.toHaveBeenCalled();
  await act(async () =>
    renderer.root.findByProps({ testID: 'avatar-confirm-purchase' }).props.onPress(),
  );
  expect(state.buy).toHaveBeenCalledOnce();
  expect(state.close).toHaveBeenCalledOnce();
});
