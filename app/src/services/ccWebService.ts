import { Platform } from 'react-native';
import type { CCPackQuote } from '../../../packages/core/src/ccBilling';
import { getSupabase } from '@/lib/supabase';
import { loadRazorpay } from './webBillingService';
import { navigateToCheckout } from './dodoService';
import { t } from '@/i18n';

async function request(body: Record<string, unknown>) {
  if (Platform.OS !== 'web') throw new Error(t('avatar.nativePacks'));
  const { data, error } = await getSupabase().functions.invoke('cc-checkout', { body });
  if (error || data?.error) throw new Error(t('avatar.webPacksError'));
  return data;
}
export async function fetchCCWebCatalog(): Promise<{
  provider: 'dodo' | 'razorpay';
  products: CCPackQuote[];
}> {
  const data = await request({ action: 'catalog' });
  if (
    !['dodo', 'razorpay'].includes(data?.provider) ||
    !Array.isArray(data.products) ||
    !data.products.length ||
    !data.products.every(
      (p: CCPackQuote) =>
        typeof p.id === 'string' &&
        Number.isSafeInteger(p.cc) &&
        p.cc > 0 &&
        Number.isSafeInteger(p.amount) &&
        p.amount > 0 &&
        ['USD', 'INR'].includes(p.currency),
    )
  )
    throw new Error(t('avatar.webPacksError'));
  return data;
}
export async function ccWebStatus(requestId: string): Promise<string> {
  return (await request({ action: 'status', request_id: requestId })).state;
}
export async function startCCWebCheckout(
  pack: CCPackQuote,
  provider: 'razorpay' | 'dodo',
  requestId: string,
): Promise<'redirected' | 'pending' | 'cancelled' | 'paid' | 'refunded'> {
  if (Platform.OS !== 'web') throw new Error(t('avatar.nativePacks'));
  let Checkout: Awaited<ReturnType<typeof loadRazorpay>> | undefined;
  let fallback = false;
  if (provider === 'razorpay') {
    try {
      Checkout = await loadRazorpay();
    } catch {
      fallback = true;
    }
  }
  const data = await request({
    action: 'checkout',
    request_id: requestId,
    pack_id: pack.id,
    amount: pack.amount,
    currency: pack.currency,
    dodo_fallback: fallback,
  });
  if (data.state === 'paid' || data.state === 'refunded') return data.state;
  if (data.provider === 'dodo') {
    const url = new URL(data.checkout_url);
    if (
      url.protocol !== 'https:' ||
      !['checkout.dodopayments.com', 'test.checkout.dodopayments.com'].includes(url.hostname)
    )
      throw new Error(t('avatar.webPacksError'));
    navigateToCheckout(url.href);
    return 'redirected';
  }
  if (
    !Checkout ||
    data.provider !== 'razorpay' ||
    !/^order_[A-Za-z0-9]+$/.test(data.order_id ?? '') ||
    !/^rzp_(live|test)_[A-Za-z0-9]+$/.test(data.key_id ?? '') ||
    data.request_id !== requestId ||
    data.amount !== pack.amount ||
    data.currency !== pack.currency
  )
    throw new Error(t('avatar.webPacksError'));
  return new Promise((resolve) => {
    let submitted = false;
    const checkout = new Checkout!({
      key: data.key_id,
      order_id: data.order_id,
      amount: data.amount,
      currency: data.currency,
      name: 'CaliPartner',
      prefill: { email: data.email ?? '' },
      handler: () => {
        submitted = true;
        resolve('pending');
      },
      modal: {
        ondismiss: () => {
          if (!submitted) resolve('cancelled');
        },
      },
    });
    checkout.open();
  });
}
