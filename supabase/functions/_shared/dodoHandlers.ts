import {
  dodoProductKey,
  hasPlan,
  DODO_PRODUCT_KEYS,
  dodoSubscriptionEvent,
} from '@calipartner/core';
import { dodoConfig, dodoCors, dodoResponse } from './dodo.ts';

export async function handleDodoCheckout(req: Request, getConfig = dodoConfig) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: dodoCors });
  if (req.method !== 'POST') return dodoResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const { admin, dodo, origin, products } = getConfig();
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return dodoResponse({ error: 'UNAUTHENTICATED' }, 401);
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user?.email) return dodoResponse({ error: 'UNAUTHENTICATED' }, 401);
    const body = await req.json();
    const { data: allowed, error: rateError } = await admin.rpc('check_rate_limit', {
      p_key: `dodo_checkout:${user.id}`,
      p_max_requests: 10,
      p_window_seconds: 60,
    });
    if (rateError || !allowed) return dodoResponse({ error: 'RATE_LIMITED' }, 429);
    if (body.action === 'portal') {
      const { data: subscription } = await admin
        .from('dodo_subscriptions')
        .select('customer_id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!subscription) return dodoResponse({ error: 'NO_DODO_SUBSCRIPTION' }, 404);
      const portal = await dodo.customers.customerPortal.create(subscription.customer_id, {
        return_url: `${origin}/me`,
      });
      return dodoResponse({ portal_url: portal.link });
    }
    const key = dodoProductKey(body.tier, body.duration);
    const requestId = body.request_id;
    if (
      !key ||
      typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    )
      return dodoResponse({ error: 'INVALID_CHECKOUT' }, 400);
    const productId = products[key];
    if (!productId) return dodoResponse({ error: 'DODO_NOT_CONFIGURED' }, 503);
    const { data: entitlement, error: entitlementError } = await admin
      .from('entitlements')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (
      hasPlan(entitlement) ||
      (entitlement?.status === 'trial' && new Date(entitlement.period_end) > new Date())
    )
      return dodoResponse({ error: 'MANAGE_EXISTING_SUBSCRIPTION' }, 409);
    const { data: existing } = await admin
      .from('dodo_checkouts')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (existing) {
      if (existing.user_id !== user.id || existing.product_key !== key)
        return dodoResponse({ error: 'INVALID_CHECKOUT' }, 403);
      return existing.checkout_url
        ? dodoResponse({ checkout_url: existing.checkout_url })
        : dodoResponse({ error: 'CHECKOUT_PENDING' }, 409);
    }
    const { error: reservationError } = await admin
      .from('dodo_checkouts')
      .insert({ id: requestId, user_id: user.id, product_key: key, product_id: productId });
    if (reservationError) return dodoResponse({ error: 'CHECKOUT_PENDING' }, 409);
    // No saved payment method or confirm flag: checkout requires user interaction.
    const session = await dodo.checkoutSessions.create(
      {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email },
        metadata: { checkout_id: requestId },
        return_url: `${origin}/paywall?checkout=${requestId}&tier=${body.tier}&duration=${body.duration}`,
      },
      { maxRetries: 0 },
    );
    if (!session.checkout_url) throw new Error('MISSING_CHECKOUT_URL');
    const { error: saveError } = await admin
      .from('dodo_checkouts')
      .update({ session_id: session.session_id, checkout_url: session.checkout_url })
      .eq('id', requestId)
      .eq('user_id', user.id);
    if (saveError) throw saveError;
    return dodoResponse({ checkout_url: session.checkout_url });
  } catch {
    return dodoResponse({ error: 'CHECKOUT_UNAVAILABLE' }, 503);
  }
}

export async function handleDodoWebhook(req: Request, getConfig = dodoConfig) {
  if (req.method !== 'POST') return dodoResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY'))
      return dodoResponse({ error: 'WEBHOOK_NOT_CONFIGURED' }, 503);
    const { dodo, admin, products } = getConfig();
    const raw = await req.text();
    let event;
    try {
      event = dodo.webhooks.unwrap(raw, {
        headers: {
          'webhook-id': req.headers.get('webhook-id') ?? '',
          'webhook-signature': req.headers.get('webhook-signature') ?? '',
          'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
        },
      });
    } catch {
      return dodoResponse({ error: 'INVALID_SIGNATURE' }, 401);
    }
    const id = req.headers.get('webhook-id');
    if (!id) return dodoResponse({ error: 'INVALID_EVENT' }, 400);
    let subscriptionId: string | undefined;
    const revoked = event.type === 'refund.succeeded' || event.type === 'dispute.lost';
    if (event.type.startsWith('subscription.') && 'subscription_id' in event.data)
      subscriptionId = event.data.subscription_id ?? undefined;
    else if (revoked && 'payment_id' in event.data && event.data.payment_id) {
      const payment = await dodo.payments.retrieve(event.data.payment_id);
      subscriptionId = payment.subscription_id ?? undefined;
    }
    if (!subscriptionId) return dodoResponse({ status: 'ignored' });
    const subscription = await dodo.subscriptions.retrieve(subscriptionId);
    const key = DODO_PRODUCT_KEYS.find((key) => products[key] === subscription.product_id);
    if (!key) return dodoResponse({ error: 'UNKNOWN_PRODUCT' }, 400);
    const normalized = dodoSubscriptionEvent(subscription, revoked);
    const { error } = await admin.rpc('apply_dodo_event', {
      p_event_id: id,
      p_event_type: normalized.eventType,
      p_product_key: key,
      p_period_end: normalized.periodEnd,
      p_event_timestamp: event.timestamp,
      p_subscription_id: subscription.subscription_id,
      p_customer_id: subscription.customer.customer_id,
      p_product_id: subscription.product_id,
      p_checkout_id: subscription.metadata.checkout_id ?? null,
      p_payload: { ...event, event: { original_transaction_id: subscription.subscription_id } },
    });
    if (error) return dodoResponse({ error: 'EVENT_NOT_APPLIED' }, 500);
    return dodoResponse({ status: 'processed' });
  } catch {
    return dodoResponse({ error: 'WEBHOOK_UNAVAILABLE' }, 503);
  }
}
