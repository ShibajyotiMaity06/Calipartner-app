import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { fetchOfferings, initPurchases, purchasePackage } from './subscriptionService';

/** Only native consumables from the dedicated offering; never route CC through web billing. */
export async function fetchAvatarPacks(
  userId: string,
  allowedIds: string[],
): Promise<PurchasesPackage[]> {
  if (Platform.OS === 'web') return [];
  if (!(await initPurchases(userId))) return [];
  const offerings = await fetchOfferings();
  return (offerings?.all.cc?.availablePackages ?? []).filter((pkg) =>
    allowedIds.includes(pkg.product.identifier),
  );
}
export async function buyAvatarPack(pkg: PurchasesPackage, allowedIds: string[]): Promise<void> {
  if (Platform.OS === 'web' || !allowedIds.includes(pkg.product.identifier))
    throw new Error('INVALID_CC_PACK');
  // The SDK receipt does not grant CC. A verified server webhook is the only grant path.
  await purchasePackage(pkg);
}
