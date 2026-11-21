export const DODO_PRODUCT_KEYS = ['pro_annual', 'pro_semiannual', 'pro_quarterly'] as const;
export const LEGACY_BILLING_PRODUCT_KEYS = [
  'plus_monthly',
  'plus_annual',
  'plus_semiannual',
  'plus_quarterly',
  'pro_monthly',
] as const;
export const BILLING_WEBHOOK_PRODUCT_KEYS = [
  ...DODO_PRODUCT_KEYS,
  ...LEGACY_BILLING_PRODUCT_KEYS,
] as const;
export type DodoProductKey = (typeof BILLING_WEBHOOK_PRODUCT_KEYS)[number];

export interface DodoCatalogProduct {
  key: DodoProductKey;
  currency: 'INR' | 'USD';
  amount: number;
  trialDays: number;
}

/** Fail closed before checkout when a provider product differs from the approved terms. */
export function verifiedDodoProduct(key: DodoProductKey, product: unknown): DodoCatalogProduct {
  const data = product as {
    is_recurring?: boolean;
    price?: {
      type?: string;
      price?: number;
      currency?: string;
      payment_frequency_count?: number;
      payment_frequency_interval?: string;
      trial_period_days?: number;
      trial_type?: string;
      trial_amount?: number | null;
      tax_inclusive?: boolean;
    };
  } | null;
  const tier = key.startsWith('plus_') ? 'plus' : 'pro';
  const duration = key.split('_')[1] as CheckoutDuration | 'monthly';
  const annual = duration === 'annual';
  const price = data?.price;
  const currency = price?.currency;
  if (currency !== 'INR' && currency !== 'USD') throw new Error('DODO_PRODUCT_MISMATCH');
  const plan = PRICING_PLANS[tier];
  const amount =
    duration === 'monthly'
      ? plan[currency === 'INR' ? 'inr' : 'usd'].rawMonthly
      : subscriptionTerm(tier, currency, duration).amount;
  if (
    !data?.is_recurring ||
    price?.type !== 'recurring_price' ||
    (DODO_PRODUCT_KEYS.some((activeKey) => activeKey === key) && price.tax_inclusive !== true) ||
    price.price !== Math.round(amount * 100) ||
    price.payment_frequency_count !==
      (annual || duration === 'monthly' ? 1 : CHECKOUT_MONTHS[duration]) ||
    price.payment_frequency_interval !== (annual ? 'Year' : 'Month') ||
    (price.trial_period_days ?? 0) !== 0 ||
    (price.trial_amount ?? 0) !== 0
  )
    throw new Error('DODO_PRODUCT_MISMATCH');
  return { key, currency, amount, trialDays: plan.trialDays };
}

export function dodoProductKey(tier: unknown, duration: unknown): DodoProductKey | null {
  const key = `${tier}_${duration}`;
  return DODO_PRODUCT_KEYS.find((candidate) => candidate === key) ?? null;
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
import {
  CHECKOUT_MONTHS,
  PRICING_PLANS,
  subscriptionTerm,
  type CheckoutDuration,
} from './subscriptions';
