export const DODO_PRODUCT_KEYS = [
  'plus_monthly',
  'plus_annual',
  'pro_monthly',
  'pro_annual',
] as const;
export type DodoProductKey = (typeof DODO_PRODUCT_KEYS)[number];

export function dodoProductKey(tier: unknown, duration: unknown): DodoProductKey | null {
  const key = `${tier}_${duration}`;
  return DODO_PRODUCT_KEYS.includes(key as DodoProductKey) ? (key as DodoProductKey) : null;
}

export interface DodoSubscription {
  subscription_id: string;
  product_id: string;
  customer: { customer_id: string };
  status: string;
  next_billing_date?: string;
  expires_at?: string | null;
  cancel_at_next_billing_date?: boolean;
  metadata?: Record<string, string>;
}

export function dodoSubscriptionEvent(
  subscription: DodoSubscription,
  revoked = false,
): { eventType: string; periodEnd: string | null } {
  const date = subscription.next_billing_date ?? subscription.expires_at;
  const periodEnd = date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null;
  if (revoked) return { eventType: 'REVOCATION', periodEnd };
  if (subscription.status === 'active') {
    if (!periodEnd) throw new Error('INVALID_DODO_PERIOD');
    return {
      eventType: subscription.cancel_at_next_billing_date ? 'CANCELLATION' : 'INITIAL_PURCHASE',
      periodEnd,
    };
  }
  // Pending, failed and on-hold subscriptions must not activate access.
  return { eventType: 'EXPIRATION', periodEnd };
}
