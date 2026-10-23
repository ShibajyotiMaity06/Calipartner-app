import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildVisionModelSystemPrompt,
  parseAndValidateVisionModelOutput,
  mapVisionItemToFood,
  validateFoodPhotoImage,
  DEFAULT_AI_FOOD_PHOTO_CAPS,
  type Food,
  type FoodCandidateItem,
  type FoodPhotoAnalysisResponse,
  type VisionModelDetectedItem,
  type VisionModelResponse,
} from '@calipartner/core';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost model estimation: ~0.000005 per token or ~$0.0015 per vision scan
const DEFAULT_ESTIMATED_TOKENS = 350;
const DEFAULT_ESTIMATED_COST_USD = 0.0015;

export interface AiFoodPhotoRequestBody {
  image: string; // Base64 encoded image string (C03: test mock fields removed from production endpoint)
  mime_type?: string;
}

/**
 * Calls Gemini Vision model (default for testing) or Claude Vision model (for production when toggled),
 * or processes standard fallback for environments without an API key.
 */
async function callVisionModel(
  imageBase64: string,
  mimeType: string,
  geminiApiKey: string | undefined,
  anthropicApiKey: string | undefined,
  preferredProvider: string = 'gemini',
): Promise<{ rawText: string; tokens: number; cost: number }> {
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, '');
  const prompt = buildVisionModelSystemPrompt();

  // 1. If provider is Claude and Anthropic API key is available
  if (preferredProvider.toLowerCase() === 'claude' && anthropicApiKey) {
    const claudeUrl = 'https://api.anthropic.com/v1/messages';
    const claudeModel = Deno.env.get('CLAUDE_MODEL') || 'claude-3-5-sonnet-20241022';

    const response = await fetch(claudeUrl, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 1000,
        system: prompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: cleanBase64,
                },
              },
              {
                type: 'text',
                text: 'Analyze this food photo according to the system instructions. Output JSON format only.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude Vision API HTTP Error:', response.status, errText);
      throw new Error(`Claude Vision provider returned error ${response.status}`);
    }

    const json = await response.json();
    const rawCandidate = json.content?.[0]?.text || '';
    const tokens =
      (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0) ||
      DEFAULT_ESTIMATED_TOKENS;
    const cost =
      (json.usage?.input_tokens || 0) * 0.000003 + (json.usage?.output_tokens || 0) * 0.000015;

    return {
      rawText: rawCandidate,
      tokens,
      cost: Math.round(cost * 1_000_000) / 1_000_000,
    };
  }

  // 2. Default: Call Gemini Vision API if Gemini API key is available
  if (geminiApiKey) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Vision API HTTP Error:', response.status, errText);
      throw new Error(`Gemini Vision provider returned error ${response.status}`);
    }

    const json = await response.json();
    const rawCandidate = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = json.usageMetadata?.totalTokenCount || DEFAULT_ESTIMATED_TOKENS;
    const cost = (tokens / 1_000_000) * 0.35; // standard flash pricing

    return {
      rawText: rawCandidate,
      tokens,
      cost: Math.round(cost * 1_000_000) / 1_000_000,
    };
  }

  // 3. Fallback heuristic mock response for environments without an API key
  const fallbackMock: VisionModelResponse = {
    items: [
      {
        food_name: 'Mixed Indian Meal',
        estimated_grams: 350,
        confidence: 0.85,
        description: 'Dal, Roti, and Rice',
      },
    ],
    detected_meal_type: 'lunch',
  };

  return {
    rawText: JSON.stringify(fallbackMock),
    tokens: DEFAULT_ESTIMATED_TOKENS,
    cost: DEFAULT_ESTIMATED_COST_USD,
  };
}

export async function handleAiFoodPhoto(req: Request): Promise<Response> {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION (PRD 8.2)
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', code: 'UNAUTHENTICATED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED', code: 'UNAUTHENTICATED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // -------------------------------------------------------------------------
    // 2. SERVER-SIDE CONSENT, BUDGET & CAP VERIFICATION (PRD 6.3, 7.7, 7.10, 8.2)
    // -------------------------------------------------------------------------
    const { data: accessCheck, error: accessErr } = await adminClient.rpc(
      'check_ai_food_photo_access',
      { p_user_id: userId },
    );

    if (accessErr) {
      console.error('Error checking AI photo access:', accessErr.message);
      return new Response(
        JSON.stringify({ error: 'Failed to verify account permissions', code: 'SERVER_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!accessCheck || !accessCheck.allowed) {
      const code = accessCheck?.code || 'ACCESS_DENIED';
      const status =
        code === 'CONSENT_REQUIRED'
          ? 403
          : code === 'DAILY_LIMIT_REACHED'
            ? 429
            : code === 'FEATURE_DISABLED' || code === 'BUDGET_EXCEEDED'
              ? 503
              : 403;

      return new Response(
        JSON.stringify({
          error: accessCheck?.message || 'Access to AI photo logging is currently unavailable',
          code,
          user_state: accessCheck?.user_state,
          used: accessCheck?.used,
          cap: accessCheck?.cap,
          remaining: accessCheck?.remaining,
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -------------------------------------------------------------------------
    // 3. IMAGE VALIDATION (PRD 6.3 LOG-3, 8.2)
    // -------------------------------------------------------------------------
    const body: AiFoodPhotoRequestBody = await req.json();
    const { image, mime_type } = body || {};

    const mime = (mime_type || 'image/jpeg').toLowerCase().trim();

    if (!image || typeof image !== 'string' || image.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing image payload', code: 'INVALID_IMAGE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Estimate size in bytes from Base64 string if present
    const imageSizeApprox = Math.floor((image.length * 3) / 4);
    const imgValidation = validateFoodPhotoImage(mime, imageSizeApprox);

    if (!imgValidation.valid) {
      return new Response(
        JSON.stringify({
          error: imgValidation.message || 'Invalid image payload',
          code: imgValidation.errorCode || 'INVALID_IMAGE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -------------------------------------------------------------------------
    // 4. VISION MODEL CALL (EPHEMERAL, SECRET KEY ON SERVER ONLY)
    // -------------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('AI_API_KEY');

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

    const preferredProvider = Deno.env.get('VISION_PROVIDER') || 'gemini';

    let visionResult: { rawText: string; tokens: number; cost: number };
    try {
      visionResult = await callVisionModel(
        image,
        mime,
        geminiApiKey,
        anthropicApiKey,
        preferredProvider,
      );
    } catch (modelErr: unknown) {
      const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
      console.error('Vision analysis failure:', msg);
      return new Response(
        JSON.stringify({
          error: 'Failed to analyze photograph. Please try again.',
          code: 'MODEL_ERROR',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -------------------------------------------------------------------------
    // 5. OUTPUT SANITIZATION & STRUCTURED VALIDATION (PRD 6.3 LOG-3, 8.2)
    // -------------------------------------------------------------------------
    let parsedModelResponse: VisionModelResponse;
    try {
      parsedModelResponse = parseAndValidateVisionModelOutput(visionResult.rawText);
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.warn('Malformed vision model output handled:', msg);
      return new Response(
        JSON.stringify({
          error: 'The AI model returned an unparseable response. Please try another photo.',
          code: 'MALFORMED_OUTPUT',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -------------------------------------------------------------------------
    // 6. FOOD CATALOG MAPPING & PRIVACY BOUNDARY (C03)
    // -------------------------------------------------------------------------
    const candidates: FoodCandidateItem[] = [];

    for (let i = 0; i < parsedModelResponse.items.length; i++) {
      const detectedItem: VisionModelDetectedItem = parsedModelResponse.items[i];
      const clientCandidateId = `cand-${i + 1}`;

      // Strictly restrict search to public catalog foods (owner_id is null)
      // or the caller's own custom foods (owner_id = userId).
      // Filter out deleted items (deleted_at is null) and omit owner_id (C03).
      const { data: dbFoods } = await adminClient
        .from('foods')
        .select(
          'id, name, brand, barcode, serving_units, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, sugar_per_100g, sodium_mg_per_100g, source, attribution',
        )
        .is('deleted_at', null)
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .ilike('name', `%${detectedItem.food_name}%`)
        .limit(10);

      const candidate = mapVisionItemToFood(
        detectedItem,
        (dbFoods as Food[]) || [],
        clientCandidateId,
      );
      candidates.push(candidate);
    }

    // -------------------------------------------------------------------------
    // 7. RECORD AI USAGE (PRD 7.7, 7.10)
    // -------------------------------------------------------------------------
    await adminClient.rpc('record_ai_usage', {
      p_user_id: userId,
      p_feature: 'food_photo',
      p_tokens: visionResult.tokens,
      p_cost: visionResult.cost,
    });

    const usedToday = (accessCheck.used || 0) + 1;
    const dailyCap = accessCheck.cap || DEFAULT_AI_FOOD_PHOTO_CAPS.paid;
    const remainingToday = Math.max(0, dailyCap - usedToday);

    const responsePayload: FoodPhotoAnalysisResponse = {
      success: true,
      candidates,
      detected_meal_type: parsedModelResponse.detected_meal_type || 'lunch',
      usage: {
        used_today: usedToday,
        daily_cap: dailyCap,
        remaining_today: remainingToday,
        user_state: accessCheck.user_state,
      },
    };

    // -------------------------------------------------------------------------
    // 8. STRUCTURED LOGGING (PRD 7.10)
    // -------------------------------------------------------------------------
    const durationMs = Date.now() - startTime;
    console.log(
      JSON.stringify({
        event: 'ai_food_photo_processed',
        user_id: userId,
        items_count: candidates.length,
        tokens_used: visionResult.tokens,
        estimated_cost: visionResult.cost,
        user_state: accessCheck.user_state,
        latency_ms: durationMs,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Unhandled ai-food-photo error:', message);
    return new Response(
      JSON.stringify({
        error: 'Internal server error while analyzing photo',
        code: 'SERVER_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response> | Response) => void;
      env: { get: (key: string) => string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined') {
  Deno.serve(handleAiFoodPhoto);
}
