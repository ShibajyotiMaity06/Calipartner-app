import { Platform } from 'react-native';
import {
  BILLING_COUNTRY_CODES,
  DODO_PRODUCT_KEYS,
  type DodoCatalogProduct,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { createDodoCheckout, navigateToCheckout } from './dodoService';

export type WebPaymentProvider = 'dodo' | 'razorpay';
export interface WebCatalog {
  provider: WebPaymentProvider;
  products: DodoCatalogProduct[];
  managementRequired?: boolean;
}
export async function fetchBillingCountry(): Promise<string> {
  const data = await request('web-billing', { action: 'routing' });
  if (!BILLING_COUNTRY_CODES.includes(data?.country))
    throw new Error(t('entryRefresh.countryError'));
  return data.country;
}
function webOnly() {
  if (Platform.OS !== 'web') throw new Error(t('fixes.storeNotReady'));
}
async function request(name: string, body: Record<string, unknown>) {
  webOnly();
  const { data, error } = await getSupabase().functions.invoke(name, { body });
  if (error || data?.error) {
    let code = data?.error;
    if (!code && error && 'context' in error && error.context instanceof Response)
      code = (
        await error.context
          .clone()
          .json()
          .catch(() => null)
      )?.error;
    throw new Error(
      t(
        code === 'BILLING_COUNTRY_REQUIRED'
          ? 'entryRefresh.countryError'
          : ['CHECKOUT_PENDING', 'CHECKOUT_CLOSED', 'MANAGE_EXISTING_SUBSCRIPTION'].includes(code)
            ? 'webBilling.pendingCheckout'
            : 'webBilling.unavailable',
      ),
    );
  }
  return data;
}
const pendingCatalogs = new Map<string, Promise<WebCatalog>>();
export async function fetchWebCatalog(): Promise<WebCatalog> {
  webOnly();
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error(t('webBilling.unavailable'));
  // The onboarding preview and paywall can mount together. Share only in-flight reads,
  // never cached prices or country results across sessions.
  const key = session.access_token;
  let pending = pendingCatalogs.get(key);
  if (!pending) {
    pending = loadWebCatalog().finally(() => {
      pendingCatalogs.delete(key);
    });
    pendingCatalogs.set(key, pending);
  }
  return pending;
}
async function loadWebCatalog(): Promise<WebCatalog> {
  // Detect and acknowledge the country before quoting any new web purchase.
  await fetchBillingCountry();
  const data = await request('web-billing', { action: 'catalog' });
  if (
    !['dodo', 'razorpay'].includes(data?.provider) ||
    !Array.isArray(data?.products) ||
    data.products.length !== 4 ||
    !DODO_PRODUCT_KEYS.every((key) =>
      data.products.some(
        (p: DodoCatalogProduct) =>
          p.key === key &&
          p.currency === (data.provider === 'razorpay' ? 'INR' : 'USD') &&
          Number.isFinite(p.amount) &&
          p.amount > 0,
      ),
    )
  )
    throw new Error(t('webBilling.unavailable'));
  return data;
}

type Receipt = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};
type CheckoutConstructor = new (options: {
  key: string;
  subscription_id: string;
  name: string;
  prefill: { email: string };
  handler: (receipt: Receipt) => void;
  modal: { ondismiss: () => void };
}) => { open: () => void };
let sdk: Promise<CheckoutConstructor> | null = null;
interface CheckoutScript {
  src: string;
  async: boolean;
  onerror: (() => void) | null;
  onload: (() => void) | null;
  remove: () => void;
}
async function loadRazorpay(): Promise<CheckoutConstructor> {
  webOnly();
  const browser = globalThis as unknown as {
    Razorpay?: CheckoutConstructor;
    document?: {
      createElement: (tag: 'script') => CheckoutScript;
      head: { appendChild: (script: CheckoutScript) => unknown };
    };
  };
  if (browser.Razorpay) return browser.Razorpay;
  if (!browser.document) throw new Error(t('webBilling.unavailable'));
  if (!sdk)
    sdk = new Promise<CheckoutConstructor>((resolve, reject) => {
      const script = browser.document!.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error(t('webBilling.unavailable')));
      };
      const timer = setTimeout(fail, 15000);
      script.onerror = fail;
      script.onload = () => {
        clearTimeout(timer);
        if (browser.Razorpay) resolve(browser.Razorpay);
        else fail();
      };
      browser.document!.head.appendChild(script);
    }).catch((error) => {
      sdk = null;
      throw error;
    });
  return sdk;
}

export async function startWebCheckout(
  provider: WebPaymentProvider,
  tier: 'plus' | 'pro',
  duration: 'monthly' | 'annual',
  requestId: string,
): Promise<'redirected' | 'pending' | 'cancelled'> {
  webOnly();
  if (provider === 'dodo') {
    navigateToCheckout(await createDodoCheckout(tier, duration, requestId));
    return 'redirected';
  }
  // Load the SDK before reserving a provider subscription; blocked scripts create no checkout.
  const Checkout = await loadRazorpay();
  const data = await request('web-billing', { tier, duration, request_id: requestId });
  if (data?.provider !== 'razorpay') throw new Error(t('webBilling.unavailable'));
  if (data.status === 'awaiting_webhook') return 'pending';
  if (
    !/^rzp_(live|test)_[A-Za-z0-9]+$/.test(data.key_id ?? '') ||
    !/^sub_[A-Za-z0-9]+$/.test(data.subscription_id ?? '') ||
    data.request_id !== requestId
  )
    throw new Error(t('webBilling.unavailable'));
  return new Promise((resolve, reject) => {
    let handling = false;
    try {
      const checkout = new Checkout({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: 'CaliPartner',
        prefill: { email: data.email ?? '' },
        handler: (receipt) => {
          if (handling) return;
          handling = true;
          // Even a verified receipt only starts the wait for the signed webhook.
          void request('razorpay-checkout', { action: 'verify', request_id: requestId, ...receipt })
            .catch(() => undefined)
            .finally(() => resolve('pending'));
        },
        modal: {
          ondismiss: () => {
            if (!handling) {
              handling = true;
              void request('razorpay-checkout', { action: 'dismiss', request_id: requestId })
                .then((result) =>
                  resolve(result.status === 'checkout_cancelled' ? 'cancelled' : 'pending'),
                )
                .catch(() => resolve('pending'));
            }
          },
        },
      });
      checkout.open();
    } catch {
      reject(new Error(t('webBilling.unavailable')));
    }
  });
}

export async function fetchRazorpayManagement(): Promise<{
  request_id: string;
  cancelled: boolean;
}> {
  const data = await request('razorpay-checkout', { action: 'manage' });
  if (typeof data?.request_id !== 'string' || typeof data.cancelled !== 'boolean')
    throw new Error(t('webBilling.unavailable'));
  return data;
}
export async function cancelRazorpayRenewal(requestId: string): Promise<void> {
  const data = await request('razorpay-checkout', { action: 'cancel', request_id: requestId });
  if (data?.status !== 'renewal_cancelled') throw new Error(t('webBilling.unavailable'));
}
