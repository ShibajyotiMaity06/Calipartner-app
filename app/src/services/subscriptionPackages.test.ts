import { describe, expect, it } from 'vitest';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import { findSubscriptionPackage } from './subscriptionPackages';
const pkg = (identifier: string, product: string) =>
  ({ identifier, product: { identifier: product, priceString: '$39.99' } }) as PurchasesPackage;

describe('real subscription package selection', () => {
  it('selects standard RevenueCat packages by product tier and duration', () => {
    const plus = pkg('$rc_annual', 'plus_annual');
    const pro = pkg('$rc_annual', 'pro_annual');
    const offerings = {
      all: { plus: { availablePackages: [plus] }, pro: { availablePackages: [pro] } },
      current: { availablePackages: [plus] },
    } as unknown as PurchasesOfferings;
    expect(findSubscriptionPackage(offerings, 'pro', 'annual')).toBe(pro);
    expect(findSubscriptionPackage(offerings, 'plus', 'annual')).toBe(plus);
    expect(findSubscriptionPackage(offerings, 'pro', 'monthly')).toBeNull();
  });
  it('never substitutes another tier or invents a missing offering', () => {
    const offerings = {
      all: {},
      current: { availablePackages: [pkg('anything', 'plus_monthly')] },
    } as unknown as PurchasesOfferings;
    expect(findSubscriptionPackage(offerings, 'pro', 'monthly')).toBeNull();
    expect(findSubscriptionPackage(null, 'plus', 'annual')).toBeNull();
  });
});
