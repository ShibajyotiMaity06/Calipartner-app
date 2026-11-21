import {
  CHECKOUT_MONTHS,
  CHECKOUT_DURATIONS,
  subscriptionTerm,
  type CheckoutDuration,
  type DodoCatalogProduct,
} from '@calipartner/core';
import type { PurchasesPackage } from 'react-native-purchases';
import { getLocale, t } from '@/i18n';

export const MAIN_PAYWALL_DURATIONS = CHECKOUT_DURATIONS;

export const PRO_BENEFITS = [
  'proPlan.rooms',
  'proPlan.coach',
  'proPlan.scans',
  'proPlan.finder',
  'proPlan.avatar',
  'proPlan.photos',
  'proPlan.trackers',
] as const;

export function checkoutPrice(
  tier: 'plus' | 'pro',
  duration: CheckoutDuration,
  webProduct?: DodoCatalogProduct,
  nativePackage?: PurchasesPackage | null,
) {
  const product = nativePackage?.product;
  const currency = webProduct?.currency ?? product?.currencyCode;
  const amount = webProduct?.amount ?? product?.price;
  if (!currency || !Number.isFinite(amount) || amount! <= 0) return null;
  const locale = currency === 'INR' ? 'en-IN' : currency === 'USD' ? 'en-US' : getLocale();
  const format = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(currency === 'INR' ? { maximumFractionDigits: 0 } : {}),
    }).format(value);
  const approved =
    currency === 'INR' || currency === 'USD' ? subscriptionTerm(tier, currency, duration) : null;
  if (approved && amount !== approved.amount) return null;
  const equivalent = approved?.monthlyEquivalent ?? amount! / CHECKOUT_MONTHS[duration];
  return {
    total: product?.priceString ?? format(amount!),
    equivalent: t('releaseUpdate.equivalent', { amount: format(equivalent) }),
  };
}
