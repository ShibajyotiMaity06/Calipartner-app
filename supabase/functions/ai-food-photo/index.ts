import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildVisionModelSystemPrompt,
  checkGlobalAiBudget,
  DEFAULT_AI_FOOD_PHOTO_CAPS,
  getDailyFoodPhotoCap,
  mapVisionItemToFood,
  parseAndValidateVisionModelOutput,
  resolveAiUserState,
  validateFoodPhotoImage,
  type AiDailyCapsConfig,
  type AiMonthlyBudgetConfig,
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
  image?: string; // Base64 encoded image string
  mime_type?: string;
  test_mock_response?: VisionModelResponse;
  test_raw_output?: string;
}

/**
 * Calls Gemini or OpenAI Vision model if server secret key is available,
 * or processes mock/fallback for automated test suites.
 */
async function callVisionModel(
  imageBase64: string,
  mimeType: string,
  apiKey: string | undefined,
  mockOutput?: VisionModelResponse,
  rawOutput?: string,
): Promise<{ rawText: string; tokens: number; cost: number }> {
  // If mock/test output is provided directly
  if (rawOutput !== undefined) {
    return {
      rawText: rawOutput,
      tokens: DEFAULT_ESTIMATED_TOKENS,
      cost: DEFAULT_ESTIMATED_COST_USD,
    };
  }

  if (mockOutput !== undefined) {
    return {
      rawText: JSON.stringify(mockOutput),
      tokens: DEFAULT_ESTIMATED_TOKENS,
      cost: DEFAULT_ESTIMATED_COST_USD,
    };
  }

  // If server secret API key is set, call Gemini Vision API
  if (apiKey) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = buildVisionModelSystemPrompt();
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, '');

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
      console.error('Vision API HTTP Error:', response.status, errText);
      throw new Error(`Vision provider returned error ${response.status}`);
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

  // Fallback heuristic mock response for test/dev environments without an API key
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
    const { image, mime_type, test_mock_response, test_raw_output } = body;

    const mime = (mime_type || 'image/jpeg').toLowerCase().trim();

    if (!image && !test_mock_response && !test_raw_output) {
      return new Response(
        JSON.stringify({ error: 'Missing image payload', code: 'INVALID_IMAGE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Estimate size in bytes from Base64 string if present
    const imageSizeApprox = image ? Math.floor((image.length * 3) / 4) : 1024;
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
    // Read secret key strictly on server - NEVER leaked to app or response
    const aiApiKey =
      Deno.env.get('AI_API_KEY') ||
      Deno.env.get('GEMINI_API_KEY') ||
      Deno.env.get('OPENAI_API_KEY');

    let visionResult: { rawText: string; tokens: number; cost: number };
    try {
      visionResult = await callVisionModel(
        image || '',
        mime,
        aiApiKey,
        test_mock_response,
        test_raw_output,
      );
    } catch (modelErr: unknown) {
      const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
      console.error('Vision model execution error:', msg);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze food photograph', code: 'MODEL_ERROR' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Images are processed in-memory and NOT stored anywhere in persistent buckets
    // (Prompt item 2: Images are processed and deleted; stored only if shared to chat)

    // -------------------------------------------------------------------------
    // 5. PARSE & VALIDATE MODEL OUTPUT (STRICT SCHEMA & PROMPT INJECTION DEFENSE)
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
    // 6. FOOD CATALOG MAPPING & FALLBACK ESTIMATES
    // -------------------------------------------------------------------------
    const candidates: FoodCandidateItem[] = [];

    for (let i = 0; i < parsedModelResponse.items.length; i++) {
      const detectedItem: VisionModelDetectedItem = parsedModelResponse.items[i];
      const clientCandidateId = `cand-${i + 1}`;

      // Search database for potential food matches
      const { data: dbFoods } = await adminClient
        .from('foods')
        .select('*')
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

if (typeof Deno !== 'undefined') {
  Deno.serve(handleAiFoodPhoto);
}
