import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';

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
  const { Linking } = await import('react-native');
  await Linking.openURL(data.portal_url);
}
