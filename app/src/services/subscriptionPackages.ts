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
      return product?.tier === tier && product.period === duration;
    });
    if (match) return match;
  }
  return null;
}
