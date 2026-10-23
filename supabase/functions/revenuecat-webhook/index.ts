import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  mapProductIdToTierAndPeriod,
  verifyWebhookAuth,
  type RevenueCatWebhookPayload,
} from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'REVOCATION',
  'TRANSFER',
  'SUBSCRIPTION_EXTENDED',
  'SUBSCRIPTION_PAUSED',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleRevenueCatWebhook(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify authorization header — fail closed if secret is absent or invalid (C02)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const webhookSecret =
      Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || Deno.env.get('REVENUECAT_SHARED_SECRET') || '';

    if (!webhookSecret || webhookSecret.trim().length === 0) {
      console.error('Server misconfiguration: Webhook secret not configured');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!verifyWebhookAuth(authHeader, webhookSecret)) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED: Invalid webhook secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse payload
    const body = (await req.json()) as RevenueCatWebhookPayload;
    const event = body?.event;

    if (!event || !event.id || !event.type || !event.app_user_id) {
      return new Response(
        JSON.stringify({
          error: 'BAD_REQUEST: Missing required event fields (id, type, app_user_id)',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate event type allowlist (C02)
    if (!ALLOWED_EVENT_TYPES.has(event.type)) {
      return new Response(
        JSON.stringify({
          error: `BAD_REQUEST: Unsupported event type: ${event.type}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate app_user_id UUID format (C02)
    if (!UUID_REGEX.test(event.app_user_id)) {
      return new Response(
        JSON.stringify({
          error: 'BAD_REQUEST: app_user_id must be a valid UUID',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const eventId = event.id;
    const eventType = event.type;
    const appUserId = event.app_user_id;
    const productId = event.product_id || event.new_product_id || '';
    const store = event.store || 'app_store';
    const expirationMs = event.expiration_at_ms;

    const isPurchaseEvent = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'PRODUCT_CHANGE',
      'UNCANCELLATION',
      'SUBSCRIPTION_EXTENDED',
    ].includes(eventType);

    // Validate product ID for purchase events (C02)
    const parsedProduct = mapProductIdToTierAndPeriod(productId);
    if (isPurchaseEvent && !parsedProduct) {
      return new Response(
        JSON.stringify({
          error: `BAD_REQUEST: Unrecognized or invalid product_id: ${productId}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate expiration: must be positive number if provided; compute fallback if missing on purchase (C02)
    let periodEnd: string | null = null;
    if (expirationMs !== undefined && expirationMs !== null) {
      if (typeof expirationMs !== 'number' || isNaN(expirationMs) || expirationMs <= 0) {
        return new Response(
          JSON.stringify({
            error: 'BAD_REQUEST: Invalid expiration_at_ms value',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      periodEnd = new Date(expirationMs).toISOString();
    } else if (isPurchaseEvent) {
      const durationDays = parsedProduct?.period === 'annual' ? 365 : 30;
      periodEnd = new Date(Date.now() + durationDays * 86400 * 1000).toISOString();
    }

    const eventTimestamp = new Date(event.event_timestamp_ms || Date.now()).toISOString();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Handle TRANSFER event
    if (eventType === 'TRANSFER') {
      const transferredFrom = event.transferred_from || [];
      const transferredTo = event.transferred_to || [appUserId];

      for (const uid of [...transferredFrom, ...transferredTo]) {
        if (!UUID_REGEX.test(uid)) {
          return new Response(
            JSON.stringify({ error: `BAD_REQUEST: Invalid user ID in transfer: ${uid}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      for (const fromUserId of transferredFrom) {
        // Mark old user entitlement lapsed
        await adminClient
          .from('entitlements')
          .update({
            status: 'lapsed',
            is_unattached: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', fromUserId);
      }

      for (const toUserId of transferredTo) {
        await adminClient.rpc('apply_revenuecat_event', {
          p_event_id: `${eventId}_transfer_${toUserId}`,
          p_event_type: 'INITIAL_PURCHASE',
          p_user_id: toUserId,
          p_product_id: productId,
          p_store: store,
          p_period_end: periodEnd,
          p_event_timestamp: eventTimestamp,
          p_payload: body,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'transferred',
          event_id: eventId,
          from: transferredFrom,
          to: transferredTo,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Call apply_revenuecat_event RPC
    const { data, error: rpcError } = await adminClient.rpc('apply_revenuecat_event', {
      p_event_id: eventId,
      p_event_type: eventType,
      p_user_id: appUserId,
      p_product_id: productId,
      p_store: store,
      p_period_end: periodEnd,
      p_event_timestamp: eventTimestamp,
      p_payload: body,
    });

    if (rpcError) {
      console.error('apply_revenuecat_event RPC error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventId,
        result: data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('revenuecat-webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get: (key: string) => string | undefined };
};

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRevenueCatWebhook);
}
