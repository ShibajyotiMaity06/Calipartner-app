import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { DODO_PRODUCT_KEYS, type DodoCatalogProduct } from '@calipartner/core';

export async function fetchDodoCatalog(): Promise<DodoCatalogProduct[]> {
  const { data, error } = await getSupabase().functions.invoke('dodo-checkout', {
    body: { action: 'catalog' },
  });
  const products = data?.products as DodoCatalogProduct[] | undefined;
  if (
    error ||
    !Array.isArray(products) ||
    products.length !== DODO_PRODUCT_KEYS.length ||
    !DODO_PRODUCT_KEYS.every((key) =>
      products.some(
        (p) =>
          p.key === key &&
          (p.currency === 'INR' || p.currency === 'USD') &&
          Number.isFinite(p.amount) &&
          p.amount > 0,
      ),
    )
  )
    throw new Error(t('fixes.dodoNotReady'));
  return products;
}

export async function createDodoCheckout(
  tier: 'plus' | 'pro',
  duration: 'monthly' | 'annual',
  requestId: string,
): Promise<string> {
  const { data, error } = await getSupabase().functions.invoke('dodo-checkout', {
    body: { tier, duration, request_id: requestId },
  });
  if (error || !data?.checkout_url) throw new Error(t('fixes.dodoNotReady'));
  const url = new URL(data.checkout_url);
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname === 'checkout.dodopayments.com' ||
      url.hostname === 'test.checkout.dodopayments.com'
    )
  )
    throw new Error(t('fixes.paymentFailed'));
  return url.href;
}

export function navigateToCheckout(url: string): void {
  const browser = globalThis as unknown as { location?: { assign: (url: string) => void } };
  if (!browser.location) throw new Error(t('fixes.paymentFailed'));
  browser.location.assign(url);
}

export async function openDodoPortal(): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('dodo-checkout', {
    body: { action: 'portal' },
  });
  if (error || !data?.portal_url || !data.portal_url.startsWith('https://'))
    throw new Error(t('fixes.dodoNotReady'));
  // Same-tab navigation remains reliable after the asynchronous portal request in Chrome.
  if ((globalThis as unknown as { location?: unknown }).location) {
    navigateToCheckout(data.portal_url);
    return;
  }
  const { Linking } = await import('react-native');
  await Linking.openURL(data.portal_url);
}
