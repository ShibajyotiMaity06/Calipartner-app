import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { webBillingProvider, BILLING_COUNTRY_CODES } from '@calipartner/core';
import { handleDodoCheckout } from '../_shared/dodoHandlers.ts';
import { handleRazorpayCheckout } from '../_shared/razorpayHandlers.ts';
import { billingHeaders, billingResponse } from '../_shared/razorpay.ts';
import { detectBillingCountry } from './country.ts';

export async function handleWebBilling(
  req: Request,
  dependencies: {
    admin?: SupabaseClient;
    dodo?: typeof handleDodoCheckout;
    razorpay?: typeof handleRazorpayCheckout;
    detectCountry?: typeof detectBillingCountry;
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
    const profile = await admin
      .from('profiles')
      .select('country')
      .eq('id', actor.data.user.id)
      .maybeSingle();
    if (profile.error) throw profile.error;
    let country = BILLING_COUNTRY_CODES.includes(profile.data?.country ?? '')
      ? profile.data!.country
      : null;
    // Detect on the routing screen, or before first checkout if no country has been saved.
    // Never accept a caller-selected country from the removed dropdown.
    if (body.action === 'country' || body.action === 'routing' || !country) {
      const origin = Deno.env.get('RAZORPAY_APP_URL') ?? Deno.env.get('DODO_APP_URL');
      if (!origin || req.headers.get('origin') !== new URL(origin).origin)
        return billingResponse({ error: 'WEB_CHECKOUT_ONLY' }, 403);
      try {
        country = await (dependencies.detectCountry ?? detectBillingCountry)(req);
      } catch {
        return billingResponse({ error: 'BILLING_COUNTRY_REQUIRED' }, 503);
      }
      const saved = await admin
        .from('profiles')
        .update({ country })
        .eq('id', actor.data.user.id)
        .select('country')
        .single();
      if (saved.error || saved.data?.country !== country) throw new Error('COUNTRY_NOT_SAVED');
    }
    if (body.action === 'routing' || body.action === 'country')
      return billingResponse({ country, provider: webBillingProvider('web', country) });
    const provider = webBillingProvider('web', country);
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
