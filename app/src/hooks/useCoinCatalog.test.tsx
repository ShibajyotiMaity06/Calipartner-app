import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: 'alice', os: 'web', web: vi.fn(), native: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock('./useAvatar', () => ({
  useAvatar: () => ({ state: { packs: [{ store_product_id: 'coins_100' }] } }),
}));
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/services/ccWebService', () => ({ fetchCCWebCatalog: state.web }));
vi.mock('@/services/avatarPackService', () => ({ fetchAvatarPacks: state.native }));
import { CoinCatalogProvider, useCoinCatalog } from './useCoinCatalog';
let catalog: ReturnType<typeof useCoinCatalog>;
let renderer: ReactTestRenderer;
function Wallet() {
  catalog = useCoinCatalog();
  return null;
}
const tree = (wallet = true) => (
  <CoinCatalogProvider>{wallet ? <Wallet /> : null}</CoinCatalogProvider>
);
const quote = {
  provider: 'dodo',
  products: [{ id: 'cc_100', cc: 100, currency: 'USD', amount: 199 }],
};
beforeEach(() => {
  vi.resetAllMocks();
  state.user = 'alice';
  state.os = 'web';
  state.web.mockResolvedValue(quote);
  state.native.mockResolvedValue([{ identifier: 'native100' }]);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
it('preloads before the wallet opens, reuses prices on navigation and never invokes native billing on web', async () => {
  await act(async () => {
    renderer = create(tree(false));
  });
  expect(state.web).toHaveBeenCalledOnce();
  await act(async () => {
    renderer.update(tree());
  });
  expect(catalog.web).toEqual(quote);
  expect(catalog.loading).toBe(false);
  await act(async () => {
    renderer.update(tree(false));
  });
  await act(async () => {
    renderer.update(tree());
  });
  expect(state.web).toHaveBeenCalledOnce();
  expect(state.native).not.toHaveBeenCalled();
});
it('keeps existing prices during a failed background refresh', async () => {
  await act(async () => {
    renderer = create(tree());
  });
  state.web.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await catalog.refresh();
  });
  expect(catalog.web).toEqual(quote);
  expect(catalog.error).toBe(true);
});
it('discards the previous account cache and ignores its late result', async () => {
  let finish!: (value: unknown) => void;
  state.web.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    renderer = create(tree());
  });
  state.user = 'bob';
  await act(async () => {
    renderer.update(tree());
  });
  await act(async () => {
    finish({ ...quote, provider: 'razorpay' });
  });
  expect(catalog.web?.provider).toBe('dodo');
});
it('loads only the dedicated in-app offering on native', async () => {
  state.os = 'ios';
  await act(async () => {
    renderer = create(tree());
  });
  expect(state.web).not.toHaveBeenCalled();
  expect(state.native).toHaveBeenCalledWith('alice', ['coins_100']);
  expect(catalog.packages).toHaveLength(1);
});
