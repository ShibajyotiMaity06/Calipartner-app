import {
  CHECKOUT_MONTHS,
  CHECKOUT_DURATIONS,
  subscriptionTerm,
  type CheckoutDuration,
  type DodoCatalogProduct,
} from '@calipartner/core';
import type { PurchasesPackage } from 'react-native-purchases';
import { getLocale, t } from '@/i18n';

export const MAIN_PAYWALL_DURATIONS: CheckoutDuration[] = ['annual', 'semiannual'];

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

  const fallbackCurrency =
    getLocale().startsWith('en-IN') || getLocale().startsWith('hi') ? 'INR' : 'INR';
  const approvedFallback = subscriptionTerm(tier, fallbackCurrency, duration);
  const resolvedCurrency = currency ?? fallbackCurrency;
  const resolvedAmount =
    Number.isFinite(amount) && amount! > 0 ? amount! : approvedFallback?.amount;

  if (!resolvedCurrency || !Number.isFinite(resolvedAmount) || resolvedAmount <= 0) return null;
  const locale =
    resolvedCurrency === 'INR' ? 'en-IN' : resolvedCurrency === 'USD' ? 'en-US' : getLocale();
  const format = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolvedCurrency,
      ...(resolvedCurrency === 'INR' ? { maximumFractionDigits: 0 } : {}),
    }).format(value);
  const approved =
    resolvedCurrency === 'INR' || resolvedCurrency === 'USD'
      ? subscriptionTerm(tier, resolvedCurrency, duration)
      : null;
  if (approved && resolvedAmount !== approved.amount) return null;
  const equivalent = approved?.monthlyEquivalent ?? resolvedAmount / CHECKOUT_MONTHS[duration];
  return {
    total: product?.priceString ?? format(resolvedAmount),
    equivalent: t('releaseUpdate.equivalent', { amount: format(equivalent) }),
  };
}
