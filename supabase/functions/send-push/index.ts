// Supabase Edge Function: send-push
// FCM HTTP v1 push notification dispatcher with Google OAuth2, batching, and stale token cleanup.
// Complies with PRD 6.12, 7.1 and AGENT_RULES.md.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

// In-memory token cache for Google OAuth access token
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, '')
    .replace(/-----END[ A-Z0-9_-]+-----/g, '')
    .replace(/\s+/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(data: string | Uint8Array): string {
  let b64: string;
  if (typeof data === 'string') {
    b64 = btoa(data);
  } else {
    let str = '';
    for (let i = 0; i < data.length; i++) {
      str += String.fromCharCode(data[i]);
    }
    b64 = btoa(str);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

function sanitizePushPayload(payload: PushPayload, hidePreviews = false): PushPayload {
  let body = payload.body;
  let title = payload.title;

  // PRD 6.12 NTF-3: Never include another person's calorie numbers in push notifications
  body = body.replace(/\b\d+(\.\d+)?\s*(kcal|calories|cals)\b/gi, 'logged meal');

  // If hide_previews is enabled and this is a chat message, hide the message text
  if (hidePreviews && payload.data?.type === 'chat_message') {
    title = payload.data.roomName ? String(payload.data.roomName) : 'New Message';
    body = 'New message received';
  }

  // Sanitize data payload: strip any raw nutritional/calorie keys that could have leaked
  const safeData: Record<string, unknown> = { ...(payload.data || {}) };
  delete safeData.calories;
  delete safeData.macros;
  delete safeData.calories_kcal;
  delete safeData.protein_g;
  delete safeData.carbs_g;
  delete safeData.fat_g;
  delete safeData.weight_kg;

  return {
    title,
    body,
    data: safeData,
  };
}

/**
 * Generates an OAuth2 access token for FCM HTTP v1 using the Google Service Account.
 */
async function getGoogleAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const binaryKey = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey as unknown as BufferSource,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const signedJwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Failed to fetch Google OAuth token: ${tokenResponse.status} ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };

  return cachedAccessToken.token;
}

/**
 * Sends a single push message to FCM HTTP v1.
 */
async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; isInvalidToken: boolean; error?: string }> {
  // FCM data values must be strings
  const stringData: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== null && val !== undefined) {
      stringData[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }
  }

  const fcmPayload = {
    message: {
      token,
      notification: {
        title,
        body,
      },
      data: stringData,
      android: {
        priority: 'HIGH',
        notification: {
          sound: 'default',
          channel_id: 'calipartner_default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    },
  };

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fcmPayload),
  });

  if (res.ok) {
    return { success: true, isInvalidToken: false };
  }

  const errText = await res.text();
  let isInvalid = false;

  // Detect token invalidation (UNREGISTERED, INVALID_ARGUMENT, etc.)
  if (
    res.status === 404 ||
    res.status === 410 ||
    errText.includes('UNREGISTERED') ||
    errText.includes('INVALID_ARGUMENT') ||
    errText.includes('NOT_FOUND')
  ) {
    isInvalid = true;
  }

  return {
    success: false,
    isInvalidToken: isInvalid,
    error: `FCM error ${res.status}: ${errText}`,
  };
}

async function validWorkerSignature(req: Request, body: string, secret: string): Promise<boolean> {
  const timestamp = req.headers.get('x-push-worker-timestamp') ?? '';
  const signature = req.headers.get('x-push-worker-signature') ?? '';
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 90
  )
    return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(signature.match(/../g)!.map((value) => parseInt(value, 16))),
    encoder.encode(`${timestamp}.${body}`),
  );
}

export async function handleSendPush(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405 });
  }
  const rawBody = await req.text();
  if (rawBody.length > 4096) return new Response('Request too large', { status: 413 });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const workerSecret = Deno.env.get('PUSH_WORKER_SECRET');
  // Hosted runtimes can inject an internal database key that differs from the
  // project's external service-role JWT. A scoped worker credential also keeps
  // database administrator credentials out of scheduled HTTP requests.
  const authorized = workerSecret
    ? req.headers.get('x-push-worker-secret') === workerSecret ||
      (await validWorkerSignature(req, rawBody, workerSecret))
    : Boolean(serviceKey && req.headers.get('authorization') === `Bearer ${serviceKey}`);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'NOT_AUTHORIZED' }), { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    let serviceAccount: ServiceAccount | null = null;
    if (serviceAccountJson) {
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch (e) {
        console.error('Invalid FIREBASE_SERVICE_ACCOUNT json:', e);
      }
    }

    if (
      !serviceAccount?.private_key ||
      !serviceAccount.project_id ||
      !serviceAccount.client_email
    ) {
      return new Response(JSON.stringify({ error: 'FIREBASE_NOT_CONFIGURED' }), { status: 503 });
    }
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = rawBody ? JSON.parse(rawBody) : {};
    const { limit = 50, notification_id } = body;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'INVALID_LIMIT' }), { status: 400 });
    }

    // 1. Fetch pending notifications from queue
    let query = adminClient
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (notification_id) {
      query = query.eq('id', notification_id);
    }

    const { data: queueItems, error: queueErr } = await query;
    if (queueErr) {
      return new Response(JSON.stringify({ error: queueErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending push notifications to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Real FCM HTTP v1 delivery
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const invalidTokens: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const item of queueItems) {
      // Find devices for the recipient user
      const { data: devices } = await adminClient
        .from('devices')
        .select('fcm_token')
        .eq('user_id', item.user_id);

      if (!devices || devices.length === 0) {
        await adminClient
          .from('push_notification_queue')
          .update({ status: 'skipped', skip_reason: 'no_devices' })
          .eq('id', item.id);
        continue;
      }

      // Sanitize payload (safety & privacy check)
      const sanitized = sanitizePushPayload(
        {
          title: item.title,
          body: item.body,
          data: item.data || {},
        },
        false,
      );

      let itemDelivered = false;
      let lastErrMsg = '';

      for (const device of devices) {
        const result = await sendFcmMessage(
          accessToken,
          projectId,
          device.fcm_token,
          sanitized.title,
          sanitized.body,
          sanitized.data,
        );

        if (result.success) {
          itemDelivered = true;
          sentCount++;
        } else {
          lastErrMsg = result.error || 'Failed to deliver';
          if (result.isInvalidToken) {
            invalidTokens.push(device.fcm_token);
          }
        }
      }

      if (itemDelivered) {
        await adminClient
          .from('push_notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      } else {
        failedCount++;
        await adminClient
          .from('push_notification_queue')
          .update({
            status: 'failed',
            last_error: lastErrMsg,
            attempts: (item.attempts || 0) + 1,
          })
          .eq('id', item.id);
      }
    }

    // 3. Token cleanup: remove invalid tokens from the database immediately
    if (invalidTokens.length > 0) {
      const { data: cleaned } = await adminClient.rpc('remove_invalid_device_tokens', {
        p_tokens: invalidTokens,
      });
      console.log(`Cleaned up ${cleaned} invalid FCM tokens from devices table.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        invalid_tokens_cleaned: invalidTokens.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in send-push Edge Function:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

if (import.meta.main) {
  Deno.serve(handleSendPush);
}
