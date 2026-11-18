import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import { mapProductIdToTierAndPeriod } from '@calipartner/core';

export function findSubscriptionPackage(
  offerings: PurchasesOfferings | null,
  tier: string,
  duration: string,
): PurchasesPackage | null {
  if (!offerings) return null;
  const candidates = [
    offerings.all?.[tier],
    offerings.current,
    ...Object.values(offerings.all ?? {}),
  ];
  for (const offering of candidates) {
    const match = offering?.availablePackages.find((pkg) => {
      const product = mapProductIdToTierAndPeriod(pkg.product.identifier);
      if (product?.tier !== tier || product?.period !== duration) return false;
      if (duration === 'monthly') return true; // Historical product lookups only.
      const expected = { annual: 'P1Y', semiannual: 'P6M', quarterly: 'P3M' }[duration];
      const storePeriod = pkg.product.subscriptionPeriod;
      return (
        (!storePeriod ||
          storePeriod === expected ||
          (duration === 'annual' && storePeriod === 'P12M')) &&
        !pkg.product.introPrice &&
        !pkg.product.defaultOption?.freePhase &&
        !pkg.product.defaultOption?.introPhase
      );
    });
    if (match) return match;
  }
  return null;
}
