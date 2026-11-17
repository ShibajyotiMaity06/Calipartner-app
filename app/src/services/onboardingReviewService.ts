import { secureStoreAdapter } from '@/lib/secureStore';

const key = (userId: string) => `calipartner.founders_review.${userId}`;
export type ReviewPlacement = 'before_plan' | 'end';

export const requireOnboardingReview = (userId: string, platform: string) =>
  secureStoreAdapter.setItem(key(userId), platform === 'ios' ? 'end' : 'before_plan');
export async function pendingOnboardingReview(userId: string): Promise<ReviewPlacement | null> {
  const value = await secureStoreAdapter.getItem(key(userId));
  return value === 'before_plan' || value === 'end' ? value : null;
}
export const finishOnboardingReview = (userId: string) =>
  secureStoreAdapter.setItem(key(userId), 'done');

/** Only app-owned destinations can be resumed from the optional review screen. */
export function reviewContinueDestination(next?: string, room?: string): string {
  if (next === 'plan') return '/weekly-plan?setup=1';
  if (next === 'rooms') return '/room';
  if (next === 'room')
    return room && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(room)
      ? `/room?room=${encodeURIComponent(room)}`
      : '/room';
  return '/today';
}
export async function afterPairReviewDestination(
  userId: string,
  next: 'home' | 'rooms' | 'room' = 'home',
  room?: string,
): Promise<string> {
  if ((await pendingOnboardingReview(userId)) === 'end')
    return `/founders?next=${next}${room ? '&room=' + encodeURIComponent(room) : ''}`;
  return next === 'room' && room
    ? `/room?room=${encodeURIComponent(room)}`
    : reviewContinueDestination(next);
}
