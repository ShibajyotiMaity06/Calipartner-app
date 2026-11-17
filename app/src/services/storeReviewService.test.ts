import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  os: 'android',
  available: vi.fn(),
  review: vi.fn(),
  open: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  Linking: { openURL: state.open },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { android: { package: 'app.calipartner.mobile' } } },
}));
vi.mock('expo-store-review', () => ({
  isAvailableAsync: state.available,
  requestReview: state.review,
}));
import { requestStoreReview } from './storeReviewService';
beforeEach(() => {
  vi.resetAllMocks();
  state.os = 'android';
  delete process.env.EXPO_PUBLIC_APPLE_APP_ID;
});
it('uses the native dialog when available', async () => {
  state.available.mockResolvedValue(true);
  expect(await requestStoreReview()).toBe(true);
  expect(state.review).toHaveBeenCalledOnce();
  expect(state.open).not.toHaveBeenCalled();
});
it('uses the actual Android package and HTTPS if the market scheme fails', async () => {
  state.open.mockRejectedValueOnce(Error('NO_MARKET'));
  expect(await requestStoreReview()).toBe(true);
  expect(state.open).toHaveBeenLastCalledWith(
    'https://play.google.com/store/apps/details?id=app.calipartner.mobile',
  );
});
it('offers feedback on web or an iPhone without a published store ID', async () => {
  state.os = 'web';
  expect(await requestStoreReview()).toBe(false);
  state.os = 'ios';
  expect(await requestStoreReview()).toBe(false);
  expect(state.open).not.toHaveBeenCalled();
});
