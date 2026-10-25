import type { Entitlement } from './types';
import { hasPlan } from './rooms';

/** Monthly check-ins use the confirmation's UTC calendar date, clamped to month end. */
export function nextMonthlyReviewAt(confirmedAt: string): Date | null {
  const confirmed = new Date(confirmedAt);
  if (!Number.isFinite(confirmed.getTime())) return null;
  const next = new Date(confirmed);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(confirmed.getUTCDate(), lastDay));
  return next;
}

export function isMonthlyReviewDue(
  confirmedAt: string,
  entitlement: Entitlement | null,
  now = new Date(),
): boolean {
  if (entitlement?.tier !== 'pro' || !hasPlan(entitlement, now)) return false;
  const next = nextMonthlyReviewAt(confirmedAt);
  return next !== null && now >= next;
}
