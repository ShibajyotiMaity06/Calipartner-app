import { beforeEach, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/secureStore', () => ({
  secureStoreAdapter: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('./foodService', () => ({ generateClientUuid: vi.fn() }));
import {
  requireOnboardingReview,
  finishOnboardingReview,
  pendingOnboardingReview,
  afterPairReviewDestination,
  reviewContinueDestination,
} from './onboardingReviewService';
import {
  requirePairPrompt,
  finishPairPrompt,
  afterSetupDestination,
  rememberPairInvite,
} from './pairOnboardingService';
beforeEach(() => store.clear());
it('resumes Android after onboarding and before the invitation prompt', async () => {
  await requireOnboardingReview('owner', 'android');
  await requirePairPrompt('owner');
  expect(await afterSetupDestination('owner')).toBe('/founders?next=pair');
  expect(await afterSetupDestination('other')).toBe('/today');
  await finishOnboardingReview('owner');
  expect(await afterSetupDestination('owner')).toBe('/pair-start');
  await finishPairPrompt('owner');
  expect(await afterSetupDestination('owner')).toBe('/today');
});
it('defers iOS until the end and preserves an invitation before the review', async () => {
  await requireOnboardingReview('owner', 'ios');
  await requirePairPrompt('owner');
  expect(await afterSetupDestination('owner')).toBe('/pair-start');
  await finishPairPrompt('owner');
  expect(await afterSetupDestination('owner')).toBe('/founders?next=home');
  const token = 'aa280000-0000-4000-8000-000000000001';
  await rememberPairInvite(token);
  expect(await afterSetupDestination('owner')).toBe('/invite/' + token);
  expect(await afterPairReviewDestination('owner', 'room', token)).toBe(
    '/founders?next=room&room=' + token,
  );
  await finishOnboardingReview('owner');
  expect(await pendingOnboardingReview('owner')).toBeNull();
  expect(await afterPairReviewDestination('owner', 'room', token)).toBe('/room?room=' + token);
});
it('resumes a saved founders prompt from the retired plan flow', async () => {
  store.set('calipartner.founders_review.owner', 'before_plan');
  expect(await afterSetupDestination('owner')).toBe('/founders?next=pair');
});
it('only resumes known app routes, never a user-supplied URL', () => {
  expect(reviewContinueDestination('https://example.invalid')).toBe('/today');
  expect(reviewContinueDestination('room', 'bad&redirect=outside')).toBe('/room');
});
