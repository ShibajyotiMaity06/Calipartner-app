import {
  DODO_PRODUCT_KEYS,
  dodoProductKey,
  razorpayEpoch,
  verifiedRazorpayPlan,
  webBillingProvider,
  isCapturedRazorpayInvoice,
} from '@calipartner/core';
import { billingHeaders, billingResponse, razorpayConfig, signatureMatches } from './razorpay.ts';

const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id = (value: unknown, prefix: string): value is string =>
  typeof value === 'string' && new RegExp('^' + prefix + '_[A-Za-z0-9]+$').test(value);
const knownErrors = [
  'BILLING_COUNTRY_REQUIRED',
  'WRONG_BILLING_PROVIDER',
  'MANAGE_EXISTING_SUBSCRIPTION',
  'CHECKOUT_PENDING',
  'CHECKOUT_CLOSED',
  'IDEMPOTENCY_CONFLICT',
];

export async function handleRazorpayCheckout(req: Request, getConfig = razorpayConfig) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: billingHeaders });
  if (req.method !== 'POST') return billingResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
  try {
    const { admin, api, keyId, keySecret, plans, origin } = getConfig();
    if (req.headers.get('origin') !== origin)
      return billingResponse({ error: 'WEB_CHECKOUT_ONLY' }, 403);
    const actor = await admin.auth.getUser(token);
    if (actor.error || !actor.data.user?.email)
      return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
    const user = actor.data.user;
    const raw = await req.text();
    if (raw.length > 8000) return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
    const body = JSON.parse(raw);
    const rate = await admin.rpc('check_rate_limit', {
      p_key: 'razorpay_checkout:' + user.id,
      p_max_requests: 15,
      p_window_seconds: 60,
    });
    if (rate.error || !rate.data) return billingResponse({ error: 'RATE_LIMITED' }, 429);
    if (body.action === 'verify') {
      if (!uuid(body.request_id) || !id(body.razorpay_payment_id, 'pay'))
        return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
      const saved = await admin
        .from('web_billing_checkouts')
        .select('*')
        .eq('id', body.request_id)
        .eq('user_id', user.id)
        .eq('provider', 'razorpay')
        .maybeSingle();
      if (
        saved.error ||
        !saved.data?.subscription_id ||
        saved.data.subscription_id !== body.razorpay_subscription_id ||
        !(await signatureMatches(
          keySecret,
          body.razorpay_payment_id + '|' + saved.data.subscription_id,
          body.razorpay_signature ?? '',
        ))
      )
        return billingResponse({ error: 'INVALID_SIGNATURE' }, 401);
      // Callback verification never writes an entitlement. The signed webhook is authoritative.
      return billingResponse({ status: 'awaiting_webhook' });
    }
    if (body.action === 'cancel' || body.action === 'dismiss') {
      if (!uuid(body.request_id)) return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
      const saved = await admin
        .from('web_billing_checkouts')
        .select('*')
        .eq('id', body.request_id)
        .eq('user_id', user.id)
        .eq('provider', 'razorpay')
        .maybeSingle();
      if (saved.error || !id(saved.data?.subscription_id, 'sub'))
        return billingResponse({ error: 'NOT_AUTHORIZED' }, 403);
      const c = saved.data;
      let subscription = await api('/subscriptions/' + c.subscription_id);
      if (body.action === 'dismiss' && subscription.status !== 'created')
        return billingResponse({ status: 'awaiting_webhook' });
      if (!['cancelled', 'completed', 'expired'].includes(String(subscription.status))) {
        try {
          subscription = await api('/subscriptions/' + c.subscription_id + '/cancel', {
            cancel_at_cycle_end: false,
          });
        } catch {
          subscription = await api('/subscriptions/' + c.subscription_id);
        }
      }
      if (!['cancelled', 'completed', 'expired'].includes(String(subscription.status)))
        throw new Error('CANCEL_NOT_ACKNOWLEDGED');
      const savedCancel = await admin
        .from('web_billing_checkouts')
        .update({
          cancel_requested_at: c.cancel_requested_at ?? new Date().toISOString(),
          state: 'closed',
        })
        .eq('id', c.id);
      if (savedCancel.error) throw savedCancel.error;
      // Current paid/trial access is retained. Webhooks reconcile the cancellation flag.
      return billingResponse({
        status:
          body.action === 'dismiss'
            ? Number(subscription.paid_count) > 0
              ? 'awaiting_webhook'
              : 'checkout_cancelled'
            : 'renewal_cancelled',
      });
    }
    if (body.action === 'manage') {
      const current = await admin
        .from('entitlements')
        .select('original_transaction_id')
        .eq('user_id', user.id)
        .eq('source', 'razorpay')
        .maybeSingle();
      const saved = await admin
        .from('web_billing_checkouts')
        .select('id,cancel_requested_at')
        .eq('user_id', user.id)
        .eq('subscription_id', current.data?.original_transaction_id ?? '')
        .eq('provider', 'razorpay')
        .maybeSingle();
      if (current.error || saved.error || !saved.data)
        return billingResponse({ error: 'NOT_AUTHORIZED' }, 403);
      return billingResponse({
        request_id: saved.data.id,
        cancelled: Boolean(saved.data.cancel_requested_at),
      });
    }
    const profile = await admin.from('profiles').select('country').eq('id', user.id).maybeSingle();
    if (profile.error) throw profile.error;
    if (webBillingProvider('web', profile.data?.country) !== 'razorpay')
      return billingResponse({ error: 'WRONG_BILLING_PROVIDER' }, 403);
    if (body.action === 'catalog') {
      const entitlement = await admin
        .from('entitlements')
        .select('trial_started_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (entitlement.error) throw entitlement.error;
      return billingResponse({
        provider: 'razorpay',
        products: await Promise.all(
          DODO_PRODUCT_KEYS.map(async (key) => {
            const product = verifiedRazorpayPlan(key, await api('/plans/' + plans[key]));
            return {
              ...product,
              trialDays: entitlement.data?.trial_started_at ? 0 : product.trialDays,
            };
          }),
        ),
      });
    }
    const key = dodoProductKey(body.tier, body.duration);
    if (!key || !uuid(body.request_id) || (body.action && body.action !== 'checkout'))
      return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
    verifiedRazorpayPlan(key, await api('/plans/' + plans[key]));
    const reserved = await admin.rpc('reserve_web_checkout', {
      p_user_id: user.id,
      p_id: body.request_id,
      p_provider: 'razorpay',
      p_product_key: key,
      p_product_id: plans[key],
    });
    if (reserved.error) {
      const code =
        knownErrors.find((code) => reserved.error.message.includes(code)) ?? 'CHECKOUT_UNAVAILABLE';
      return billingResponse({ error: code }, 409);
    }
    const c = reserved.data;
    if (c.cached && !c.subscription_id) return billingResponse({ error: 'CHECKOUT_PENDING' }, 409);
    let subscriptionId = c.subscription_id;
    if (subscriptionId) {
      const current = await api('/subscriptions/' + subscriptionId);
      if (['cancelled', 'completed', 'expired'].includes(String(current.status)))
        return billingResponse({ error: 'CHECKOUT_CLOSED' }, 409);
      if (current.status !== 'created')
        return billingResponse({ provider: 'razorpay', status: 'awaiting_webhook' });
    }
    if (!subscriptionId) {
      // Razorpay has no documented create-subscription idempotency key. Reserve first;
      // an unknown provider outcome stays pending and is never retried as a new charge.
      const subscription = await api('/subscriptions', {
        plan_id: plans[key],
        quantity: 1,
        total_count: key.endsWith('_annual') ? 9 : 119,
        customer_notify: 1,
        ...(c.trial_end ? { start_at: Math.floor(Date.parse(c.trial_end) / 1000) } : {}),
        notes: { checkout_id: c.id },
      });
      if (!id(subscription.id, 'sub') || subscription.plan_id !== plans[key])
        throw new Error('INVALID_PROVIDER_RESPONSE');
      subscriptionId = subscription.id;
      const saved = await admin
        .from('web_billing_checkouts')
        .update({ subscription_id: subscriptionId, state: 'ready' })
        .eq('id', c.id);
      if (saved.error) throw saved.error;
    }
    return billingResponse({
      provider: 'razorpay',
      key_id: keyId,
      subscription_id: subscriptionId,
      request_id: c.id,
      email: user.email,
    });
  } catch (error) {
    const code =
      error instanceof Error && knownErrors.includes(error.message)
        ? error.message
        : 'RAZORPAY_NOT_READY';
    return billingResponse({ error: code }, 503);
  }
}

export async function handleRazorpayWebhook(req: Request, getConfig = razorpayConfig) {
  if (req.method !== 'POST') return billingResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const { admin, api, webhookSecret, plans } = getConfig();
    const raw = await req.text();
    if (
      raw.length > 128000 ||
      !(await signatureMatches(webhookSecret, raw, req.headers.get('x-razorpay-signature') ?? ''))
    )
      return billingResponse({ error: 'INVALID_SIGNATURE' }, 401);
    const eventId = req.headers.get('x-razorpay-event-id');
    const event = JSON.parse(raw);
    if (!eventId || eventId.length > 200 || !razorpayEpoch(event.created_at))
      return billingResponse({ error: 'INVALID_EVENT' }, 400);
    const subscriptionEvents = [
      'subscription.authenticated',
      'subscription.activated',
      'subscription.charged',
      'subscription.updated',
      'subscription.pending',
      'subscription.halted',
      'subscription.cancelled',
      'subscription.completed',
      'subscription.paused',
      'subscription.resumed',
    ];
    const refund = event.event === 'refund.processed';
    const dispute = event.event === 'payment.dispute.lost';
    if (!subscriptionEvents.includes(event.event) && !refund && !dispute)
      return billingResponse({ status: 'ignored' });
    let subscriptionId = event.payload?.subscription?.entity?.id;
    let payment: Record<string, unknown> | undefined;
    let invoice: Record<string, unknown> | undefined;
    const paymentId = refund
      ? event.payload?.refund?.entity?.payment_id
      : dispute
        ? event.payload?.dispute?.entity?.payment_id
        : event.payload?.payment?.entity?.id;
    if (paymentId) {
      if (!id(paymentId, 'pay')) return billingResponse({ error: 'INVALID_PAYMENT' }, 400);
      payment = await api('/payments/' + paymentId);
      if (!id(payment.invoice_id, 'inv')) {
        // Mandate verification can have a nominal payment without a recurring invoice.
        // Its automatic refund is never a refund of a purchased billing period.
        if (refund || dispute)
          return billingResponse({ status: 'ignored_non_subscription_payment' });
        if (!subscriptionId) return billingResponse({ error: 'INVALID_INVOICE' }, 400);
        payment = undefined;
      } else {
        invoice = await api('/invoices/' + payment.invoice_id);
        if (invoice.payment_id !== paymentId || !id(invoice.subscription_id, 'sub'))
          return billingResponse({ error: 'INVALID_INVOICE' }, 400);
        if (subscriptionId && subscriptionId !== invoice.subscription_id)
          return billingResponse({ error: 'SUBSCRIPTION_MISMATCH' }, 400);
        subscriptionId = invoice.subscription_id;
      }
    }
    if (!id(subscriptionId, 'sub')) return billingResponse({ error: 'INVALID_SUBSCRIPTION' }, 400);
    const subscription = await api('/subscriptions/' + subscriptionId);
    const key = DODO_PRODUCT_KEYS.find((key) => plans[key] === subscription.plan_id);
    if (!key || subscription.id !== subscriptionId)
      return billingResponse({ error: 'UNKNOWN_PLAN' }, 400);
    const product = verifiedRazorpayPlan(key, await api('/plans/' + plans[key]));
    const notes = subscription.notes as Record<string, unknown> | undefined;
    if (!uuid(notes?.checkout_id)) return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
    const checkout = await admin
      .from('web_billing_checkouts')
      .select('trial_end')
      .eq('id', notes.checkout_id)
      .eq('provider', 'razorpay')
      .maybeSingle();
    if (checkout.error || !checkout.data)
      return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
    let kind = 'retain';
    let periodEnd: string | null = null;
    if (refund || dispute) {
      if (!payment || !invoice) return billingResponse({ error: 'INVALID_PAYMENT' }, 400);
      if (
        refund &&
        (payment.status !== 'refunded' || Number(payment.amount_refunded) < Number(payment.amount))
      )
        return billingResponse({ status: 'ignored_partial_refund' });
      kind = 'revoke';
      periodEnd = razorpayEpoch(invoice.billing_end);
    } else if (payment && invoice && isCapturedRazorpayInvoice(payment, invoice, product)) {
      kind = 'paid';
      periodEnd = razorpayEpoch(invoice.billing_end);
    } else if (
      key.startsWith('plus_') &&
      Number(subscription.paid_count) === 0 &&
      ['authenticated', 'active'].includes(String(subscription.status)) &&
      checkout.data.trial_end &&
      razorpayEpoch(subscription.start_at) === new Date(checkout.data.trial_end).toISOString()
    ) {
      kind = 'trial';
      periodEnd = new Date(checkout.data.trial_end).toISOString();
    }
    if (['paid', 'revoke'].includes(kind) && !periodEnd)
      return billingResponse({ error: 'INVALID_PERIOD' }, 400);
    const result = await admin.rpc('apply_razorpay_event', {
      p_event_id: eventId,
      p_event_type: event.event,
      p_checkout_id: notes.checkout_id,
      p_subscription_id: subscriptionId,
      p_plan_id: plans[key],
      p_kind: kind,
      p_period_end: periodEnd,
      p_event_timestamp: razorpayEpoch(event.created_at),
      p_provider_status: subscription.status,
    });
    if (result.error) return billingResponse({ error: 'EVENT_NOT_APPLIED' }, 500);
    return billingResponse({ status: 'processed' });
  } catch {
    return billingResponse({ error: 'WEBHOOK_UNAVAILABLE' }, 503);
  }
}
