import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { webBillingProvider, BILLING_COUNTRY_CODES } from '@calipartner/core';
import { handleDodoCheckout } from '../_shared/dodoHandlers.ts';
import { handleRazorpayCheckout } from '../_shared/razorpayHandlers.ts';
import { billingHeaders, billingResponse } from '../_shared/razorpay.ts';

export async function handleWebBilling(
  req: Request,
  dependencies: {
    admin?: SupabaseClient;
    dodo?: typeof handleDodoCheckout;
    razorpay?: typeof handleRazorpayCheckout;
  } = {},
) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: billingHeaders });
  if (req.method !== 'POST') return billingResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
  try {
    const admin =
      dependencies.admin ??
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const actor = await admin.auth.getUser(token);
    if (actor.error || !actor.data.user) return billingResponse({ error: 'UNAUTHENTICATED' }, 401);
    const raw = await req.clone().text();
    if (raw.length > 8000) return billingResponse({ error: 'INVALID_CHECKOUT' }, 400);
    const body = JSON.parse(raw);
    if (body.action === 'country') {
      const origin = Deno.env.get('RAZORPAY_APP_URL') ?? Deno.env.get('DODO_APP_URL');
      if (!origin || req.headers.get('origin') !== new URL(origin).origin)
        return billingResponse({ error: 'WEB_CHECKOUT_ONLY' }, 403);
      const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
      if (!BILLING_COUNTRY_CODES.includes(country))
        return billingResponse({ error: 'BILLING_COUNTRY_REQUIRED' }, 400);
      const saved = await admin
        .from('profiles')
        .update({ country })
        .eq('id', actor.data.user.id)
        .select('country')
        .single();
      if (saved.error || saved.data?.country !== country) throw new Error('COUNTRY_NOT_SAVED');
      return billingResponse({ country, provider: webBillingProvider('web', country) });
    }
    const profile = await admin
      .from('profiles')
      .select('country')
      .eq('id', actor.data.user.id)
      .maybeSingle();
    if (profile.error) throw profile.error;
    if (body.action === 'routing')
      return billingResponse({
        country: BILLING_COUNTRY_CODES.includes(profile.data?.country ?? '')
          ? profile.data?.country
          : null,
      });
    const provider = webBillingProvider('web', profile.data?.country);
    const result = await (
      provider === 'razorpay'
        ? (dependencies.razorpay ?? handleRazorpayCheckout)
        : (dependencies.dodo ?? handleDodoCheckout)
    )(req);
    const resultBody = await result.json();
    let managementRequired = false;
    if (body.action === 'catalog') {
      const open = await admin
        .from('web_billing_checkouts')
        .select('provider')
        .eq('user_id', actor.data.user.id)
        .eq('state', 'active')
        .eq('provider', 'razorpay')
        .maybeSingle();
      if (open.error) throw open.error;
      managementRequired = open.data?.provider === 'razorpay';
    }
    return billingResponse({ ...resultBody, provider, managementRequired }, result.status);
  } catch (error) {
    return billingResponse(
      {
        error:
          error instanceof Error && error.message === 'BILLING_COUNTRY_REQUIRED'
            ? 'BILLING_COUNTRY_REQUIRED'
            : 'CHECKOUT_UNAVAILABLE',
      },
      503,
    );
  }
}
if (import.meta.main) Deno.serve((req) => handleWebBilling(req));
