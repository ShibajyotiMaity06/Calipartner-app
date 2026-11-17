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
import { openStoreReviewPage, requestStoreReview } from './storeReviewService';
beforeEach(() => {
  vi.resetAllMocks();
  state.os = 'android';
  delete process.env.EXPO_PUBLIC_APPLE_APP_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE;
});
it('uses the native dialog when available', async () => {
  state.available.mockResolvedValue(true);
  expect(await requestStoreReview()).toBe(true);
  expect(state.review).toHaveBeenCalledOnce();
  expect(state.open).not.toHaveBeenCalled();
});
it('uses the actual Android package and HTTPS if the market scheme fails', async () => {
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE = 'true';
  state.open.mockRejectedValueOnce(Error('NO_MARKET'));
  expect(await requestStoreReview()).toBe(true);
  expect(state.open).toHaveBeenLastCalledWith(
    'https://play.google.com/store/apps/details?id=app.calipartner.mobile',
  );
});
it('offers feedback instead of a broken Android listing before store launch', async () => {
  expect(await requestStoreReview()).toBe(false);
  expect(state.open).not.toHaveBeenCalled();
});
it('offers feedback on web or an iPhone without a published store ID', async () => {
  state.os = 'web';
  expect(await requestStoreReview()).toBe(false);
  state.os = 'ios';
  expect(await requestStoreReview()).toBe(false);
  expect(state.open).not.toHaveBeenCalled();
});
it('opens Android reviews from the explicit button, with an HTTPS fallback', async () => {
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE = 'true';
  state.available.mockResolvedValue(true);
  expect(await openStoreReviewPage()).toBe(true);
  expect(state.open).toHaveBeenLastCalledWith(
    'market://details?id=app.calipartner.mobile&showAllReviews=true',
  );
  expect(state.review).not.toHaveBeenCalled();
  state.open.mockRejectedValueOnce(Error('NO_MARKET'));
  expect(await openStoreReviewPage()).toBe(true);
  expect(state.open).toHaveBeenLastCalledWith(
    'https://play.google.com/store/apps/details?id=app.calipartner.mobile&showAllReviews=true',
  );
});
it('opens Apple write-review only with a real configured numeric ID', async () => {
  state.os = 'ios';
  expect(await openStoreReviewPage()).toBe(false);
  process.env.EXPO_PUBLIC_APPLE_APP_ID = 'not-a-listing';
  expect(await openStoreReviewPage()).toBe(false);
  process.env.EXPO_PUBLIC_APPLE_APP_ID = '123456789';
  expect(await openStoreReviewPage()).toBe(true);
  expect(state.open).toHaveBeenCalledWith(
    'https://apps.apple.com/app/id123456789?action=write-review',
  );
  expect(state.review).not.toHaveBeenCalled();
});
it('does not invent unpublished listings and propagates store errors for retry', async () => {
  expect(await openStoreReviewPage()).toBe(false);
  expect(state.open).not.toHaveBeenCalled();
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE = 'true';
  state.open.mockRejectedValue(Error('offline'));
  await expect(openStoreReviewPage()).rejects.toThrow('offline');
});
