import { billingResponse, billingHeaders, razorpayConfig } from '../_shared/razorpay.ts';
import { dodoConfig } from '../_shared/dodo.ts';
import {
  ccCatalog,
  ccUuid,
  ccRazorpay,
  ccCheckoutResponse,
  createCCDodo,
  type CCCheckout,
} from '../_shared/ccBilling.ts';
import { detectBillingCountry } from '../web-billing/country.ts';

export async function handleCCCheckout(
  req: Request,
  dependencies: {
    config?: typeof dodoConfig;
    catalog?: typeof ccCatalog;
    detectCountry?: typeof detectBillingCountry;
    razorConfig?: typeof razorpayConfig;
    razorpay?: typeof ccRazorpay;
    createDodo?: typeof createCCDodo;
  } = {},
) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: billingHeaders });
  if (req.method !== 'POST') return billingResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const config = (dependencies.config ?? dodoConfig)();
    if (req.headers.get('origin') !== config.origin)
      return billingResponse({ error: 'WEB_CHECKOUT_ONLY' }, 403);
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
    const {
      data: { user },
      error: authError,
    } = await config.admin.auth.getUser(token);
    if (authError || !user?.email) return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
    const raw = await req.text();
    if (raw.length > 4000) return billingResponse({ error: 'INVALID_REQUEST' }, 400);
    const body = JSON.parse(raw);
    const { data: allowed, error: rateError } = await config.admin.rpc('check_rate_limit', {
      p_key: `cc_checkout:${user.id}`,
      p_max_requests: 30,
      p_window_seconds: 60,
    });
    if (rateError || !allowed) return billingResponse({ error: 'RATE_LIMITED' }, 429);
    if (body.action === 'status') {
      if (!ccUuid(body.request_id)) return billingResponse({ error: 'INVALID_REQUEST' }, 400);
      const { data, error } = await config.admin
        .from('cc_web_checkouts')
        .select('state')
        .eq('id', body.request_id)
        .eq('user_id', user.id)
        .single();
      if (error) return billingResponse({ error: 'CHECKOUT_NOT_FOUND' }, 404);
      return billingResponse(data);
    }
    // Retry must reuse the acknowledged reservation, regardless of a changed IP or catalogue.
    if (body.action === 'checkout' && ccUuid(body.request_id)) {
      const { data: existing, error } = await config.admin
        .from('cc_web_checkouts')
        .select('*')
        .eq('id', body.request_id)
        .maybeSingle();
      if (error) throw error;
      if (existing) {
        if (existing.user_id !== user.id || existing.pack_id !== body.pack_id)
          return billingResponse({ error: 'CHECKOUT_CONFLICT' }, 409);
        return ccCheckoutResponse(existing, user.email);
      }
    }
    const country = await (dependencies.detectCountry ?? detectBillingCountry)(req);
    const currency: 'INR' | 'USD' =
      body.action === 'catalog' && ['INR', 'USD'].includes(body.quote_currency)
        ? body.quote_currency
        : country === 'IN'
          ? 'INR'
          : 'USD';
    const catalog = await (dependencies.catalog ?? ccCatalog)(currency, config);
    let provider: 'dodo' | 'razorpay' = 'dodo';
    if (country === 'IN' && body.dodo_fallback !== true) {
      try {
        (dependencies.razorConfig ?? razorpayConfig)();
        provider = 'razorpay';
      } catch {
        /* Dodo INR fallback. */
      }
    }
    if (body.action === 'catalog')
      return billingResponse({
        provider,
        products: catalog.map(({ productId: _productId, ...quote }) => quote),
      });
    if (body.action !== 'checkout' || !ccUuid(body.request_id))
      return billingResponse({ error: 'INVALID_REQUEST' }, 400);
    const pack = catalog.find((p) => p.id === body.pack_id);
    if (!pack || pack.amount !== body.amount || pack.currency !== body.currency)
      return billingResponse({ error: 'CC_PRICE_CHANGED' }, 409);
    const { data: reservation, error } = await config.admin.rpc('reserve_cc_web_checkout', {
      p_id: body.request_id,
      p_user: user.id,
      p_pack: pack.id,
      p_provider: provider,
      p_product: pack.productId,
      p_currency: currency,
      p_amount: pack.amount,
    });
    if (error) throw error;
    const c = reservation.checkout as CCCheckout;
    if (!reservation.fresh) return ccCheckoutResponse(c, user.email);
    if (provider === 'razorpay') {
      let order;
      try {
        order = await (dependencies.razorpay ?? ccRazorpay)('/orders', {
          amount: pack.amount,
          currency,
          receipt: c.id,
          notes: { cc_checkout_id: c.id },
        });
        if (
          typeof order.id !== 'string' ||
          order.amount !== pack.amount ||
          order.currency !== currency
        )
          throw new Error('INVALID_ORDER');
      } catch {
        // No Razorpay checkout was exposed to the browser, so this order cannot have charged it.
        return await (dependencies.createDodo ?? createCCDodo)(c, user.email, config);
      }
      const saved = await config.admin
        .from('cc_web_checkouts')
        .update({ provider_ref: order.id, state: 'ready' })
        .eq('id', c.id);
      if (saved.error) throw saved.error;
      return ccCheckoutResponse({ ...c, provider_ref: order.id }, user.email);
    }
    return await (dependencies.createDodo ?? createCCDodo)(c, user.email, config);
  } catch {
    return billingResponse({ error: 'CC_CHECKOUT_UNAVAILABLE' }, 503);
  }
}
if (import.meta.main) Deno.serve((req) => handleCCCheckout(req));
