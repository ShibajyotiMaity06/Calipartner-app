import { DODO_PRODUCT_KEYS } from '@calipartner/core';
import DodoPayments from 'npm:dodopayments@2.40.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

export function dodoConfig() {
  const apiKey = Deno.env.get('DODO_PAYMENTS_API_KEY');
  const appUrl = Deno.env.get('DODO_APP_URL');
  const products = JSON.parse(Deno.env.get('DODO_PRODUCTS_JSON') ?? '{}') as Record<string, string>;
  const globalProducts = JSON.parse(Deno.env.get('DODO_PRODUCTS_USD_JSON') ?? 'null') as Record<
    string,
    string
  > | null;
  const environment = Deno.env.get('DODO_ENVIRONMENT') ?? 'live_mode';
  const productIds = DODO_PRODUCT_KEYS.map((key) => products[key]);
  if (
    productIds.some((id) => typeof id !== 'string' || !id.trim()) ||
    new Set(productIds).size !== 4
  )
    throw new Error('DODO_PRODUCTS_NOT_CONFIGURED');
  if (
    globalProducts &&
    (DODO_PRODUCT_KEYS.some(
      (key) => typeof globalProducts[key] !== 'string' || !globalProducts[key].trim(),
    ) ||
      new Set([...productIds, ...DODO_PRODUCT_KEYS.map((key) => globalProducts[key])]).size !== 8)
  )
    throw new Error('DODO_GLOBAL_PRODUCTS_NOT_CONFIGURED');
  if (
    !apiKey ||
    !appUrl ||
    !['live_mode', 'test_mode'].includes(environment) ||
    (environment === 'test_mode' && Deno.env.get('DODO_ALLOW_TEST_MODE') !== 'true')
  )
    throw new Error('DODO_NOT_CONFIGURED');
  const origin = new URL(appUrl).origin;
  if (
    !origin.startsWith('https://') &&
    !(environment === 'test_mode' && new URL(origin).hostname === 'localhost')
  )
    throw new Error('INVALID_APP_URL');
  return {
    origin,
    products,
    globalProducts,
    dodo: new DodoPayments({
      bearerToken: apiKey,
      environment: environment as 'live_mode' | 'test_mode',
      webhookKey: Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY'),
    }),
    admin: createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
  };
}
export const dodoCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function dodoResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...dodoCors, 'Content-Type': 'application/json' },
  });
}
