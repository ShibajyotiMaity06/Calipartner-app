import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { DODO_PRODUCT_KEYS } from '@calipartner/core';

export const billingHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
export const billingResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: billingHeaders });

export async function signatureMatches(secret: string, message: string, signature: string) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16)),
    new TextEncoder().encode(message),
  );
}

export function razorpayConfig() {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
  const mode = Deno.env.get('RAZORPAY_ENVIRONMENT') ?? 'live';
  const test = mode === 'test';
  const origin = new URL(Deno.env.get('RAZORPAY_APP_URL') ?? Deno.env.get('DODO_APP_URL') ?? '')
    .origin;
  const plans = JSON.parse(Deno.env.get('RAZORPAY_PLANS_JSON') ?? '{}') as Record<string, string>;
  if (
    !keySecret ||
    !['test', 'live'].includes(mode) ||
    !webhookSecret ||
    !keyId.startsWith(test ? 'rzp_test_' : 'rzp_live_') ||
    (test && Deno.env.get('RAZORPAY_ALLOW_TEST_MODE') !== 'true') ||
    (!origin.startsWith('https://') && !(test && new URL(origin).hostname === 'localhost')) ||
    DODO_PRODUCT_KEYS.some((key) => !/^plan_[A-Za-z0-9]+$/.test(plans[key] ?? '')) ||
    new Set(DODO_PRODUCT_KEYS.map((key) => plans[key])).size !== 4
  )
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  return {
    keyId,
    keySecret,
    webhookSecret,
    plans,
    origin,
    admin: createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
    api: async (path: string, body?: unknown): Promise<Record<string, unknown>> => {
      if (!/^\/(plans|subscriptions|payments|invoices)(?:\/[A-Za-z0-9_]+){0,2}$/.test(path))
        throw new Error('INVALID_PROVIDER_PATH');
      const result = await fetch('https://api.razorpay.com/v1' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(keyId + ':' + keySecret),
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!result.ok) throw new Error('RAZORPAY_UNAVAILABLE');
      return result.json();
    },
  };
}
