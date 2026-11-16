import { verifiedCCPrice } from '../../../packages/core/src/ccBilling.ts';
import { dodoConfig } from './dodo.ts';
import { razorpayConfig, billingResponse } from './razorpay.ts';

export const ccUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export type CCCheckout = {
  id: string;
  user_id: string;
  pack_id: string;
  cc: number;
  provider: 'dodo' | 'razorpay';
  product_id: string;
  currency: 'INR' | 'USD';
  amount: number;
  provider_ref: string | null;
  checkout_url: string | null;
  state: string;
};
export async function ccCatalog(currency: 'INR' | 'USD', config = dodoConfig()) {
  const mapping = JSON.parse(Deno.env.get(`DODO_CC_PRODUCTS_${currency}_JSON`) ?? '{}');
  const { data: packs, error } = await config.admin
    .from('cc_packs')
    .select('id,store_product_id,cc')
    .eq('active', true)
    .order('cc');
  if (error || !packs?.length) throw new Error('CC_PACKS_UNAVAILABLE');
  return Promise.all(
    packs.map(async (pack) => {
      const productId = mapping[pack.id] ?? mapping[pack.store_product_id];
      if (typeof productId !== 'string' || !productId.startsWith('pdt_'))
        throw new Error('CC_PRODUCTS_NOT_CONFIGURED');
      const product = await config.dodo.products.retrieve(productId);
      let amount: number;
      try {
        amount = verifiedCCPrice(product, currency);
      } catch {
        throw new Error(
          `CC_PRODUCT_MISMATCH:${pack.id}:${currency}:${JSON.stringify(product.price)}`,
        );
      }
      return { id: pack.id as string, cc: pack.cc as number, currency, amount, productId };
    }),
  );
}

/** Separate from subscription API: orders are one-time purchases, never entitlements. */
export async function ccRazorpay(path: string, body?: unknown) {
  if (!/^\/orders(?:\/[A-Za-z0-9_]+(?:\/payments)?)?$/.test(path))
    throw new Error('INVALID_PROVIDER_PATH');
  const { keyId, keySecret } = razorpayConfig();
  const result = await fetch('https://api.razorpay.com/v1' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(keyId + ':' + keySecret),
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!result.ok) throw new Error('RAZORPAY_UNAVAILABLE');
  return await result.json();
}

export async function ccCheckoutResponse(c: CCCheckout, email: string) {
  if (c.state === 'paid' || c.state === 'refunded') return billingResponse({ state: c.state });
  if (!c.provider_ref) return billingResponse({ error: 'CC_CHECKOUT_PENDING' }, 409);
  return c.provider === 'dodo'
    ? billingResponse({ provider: 'dodo', checkout_url: c.checkout_url, request_id: c.id })
    : billingResponse({
        provider: 'razorpay',
        order_id: c.provider_ref,
        key_id: razorpayConfig().keyId,
        request_id: c.id,
        amount: c.amount,
        currency: c.currency,
        email,
      });
}

export async function createCCDodo(c: CCCheckout, email: string, config = dodoConfig()) {
  const switching = await config.admin
    .from('cc_web_checkouts')
    .update({ provider: 'dodo' })
    .eq('id', c.id)
    .eq('state', 'pending');
  if (switching.error) throw switching.error;
  const session = await config.dodo.checkoutSessions.create(
    {
      product_cart: [{ product_id: c.product_id, quantity: 1 }],
      customer: { email },
      billing_currency: c.currency,
      minimal_address: true,
      feature_flags: { allow_currency_selection: false, redirect_immediately: true },
      metadata: { cc_checkout_id: c.id },
      return_url: `${config.origin}/wallet?cc_checkout=${c.id}`,
      cancel_url: `${config.origin}/wallet?cc_checkout=${c.id}&cancelled=1`,
    },
    { maxRetries: 0 },
  );
  if (!session.checkout_url) throw new Error('CC_CHECKOUT_UNAVAILABLE');
  const url = new URL(session.checkout_url);
  if (
    url.protocol !== 'https:' ||
    !['checkout.dodopayments.com', 'test.checkout.dodopayments.com'].includes(url.hostname)
  )
    throw new Error('INVALID_CHECKOUT_URL');
  const { error } = await config.admin
    .from('cc_web_checkouts')
    .update({
      provider: 'dodo',
      provider_ref: session.session_id,
      checkout_url: url.href,
      state: 'ready',
    })
    .eq('id', c.id)
    .eq('state', 'pending');
  if (error) throw error;
  return ccCheckoutResponse(
    { ...c, provider: 'dodo', provider_ref: session.session_id, checkout_url: url.href },
    email,
  );
}

/** Called only after the original handler has verified the provider signature. */
export async function applyDodoCC(paymentId: string, refund: boolean, config = dodoConfig()) {
  const payment = await config.dodo.payments.retrieve(paymentId);
  const checkoutId = payment.metadata?.cc_checkout_id;
  if (!checkoutId) return false;
  if (!ccUuid(checkoutId)) throw new Error('INVALID_CC_CHECKOUT');
  const { data: c, error } = await config.admin
    .from('cc_web_checkouts')
    .select('*')
    .eq('id', checkoutId)
    .single();
  if (error || !c || c.provider !== 'dodo') throw new Error('CC_CHECKOUT_NOT_READY');
  if (!c.provider_ref && c.state === 'pending' && payment.checkout_session_id) {
    const saved = await config.admin
      .from('cc_web_checkouts')
      .update({ provider_ref: payment.checkout_session_id })
      .eq('id', c.id)
      .is('provider_ref', null);
    if (saved.error) throw saved.error;
    c.provider_ref = payment.checkout_session_id;
  }
  const cart = payment.product_cart;
  if (
    payment.subscription_id ||
    payment.checkout_session_id !== c.provider_ref ||
    payment.currency !== c.currency ||
    !cart ||
    cart.length !== 1 ||
    cart[0].product_id !== c.product_id ||
    cart[0].quantity !== 1 ||
    payment.total_amount < c.amount ||
    (!refund && payment.status !== 'succeeded')
  )
    throw new Error('INVALID_CC_PAYMENT');
  const result = await config.admin.rpc('apply_cc_web_event', {
    p_id: c.id,
    p_provider: 'dodo',
    p_ref: c.provider_ref,
    p_payment: paymentId,
    p_refund: refund,
  });
  if (result.error) throw result.error;
  return true;
}

export async function applyRazorpayCC(
  payment: Record<string, unknown>,
  refund: boolean,
  config = razorpayConfig(),
) {
  if (typeof payment.order_id !== 'string') return false;
  const { data: c, error } = await config.admin
    .from('cc_web_checkouts')
    .select('*')
    .eq('provider', 'razorpay')
    .eq('provider_ref', payment.order_id)
    .maybeSingle();
  if (error) throw error;
  if (!c) return false;
  if (
    payment.currency !== c.currency ||
    payment.amount !== c.amount ||
    typeof payment.id !== 'string' ||
    (!refund && (payment.status !== 'captured' || payment.captured !== true))
  )
    throw new Error('INVALID_CC_PAYMENT');
  const result = await config.admin.rpc('apply_cc_web_event', {
    p_id: c.id,
    p_provider: 'razorpay',
    p_ref: c.provider_ref,
    p_payment: payment.id,
    p_refund: refund,
  });
  if (result.error) throw result.error;
  return true;
}
