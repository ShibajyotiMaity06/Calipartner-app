import { createClient } from 'jsr:@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get: (key: string) => string | undefined };
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_COACH_MODEL = 'deepseek/deepseek-v4-flash:free';
const DEFAULT_ESTIMATED_TOKENS = 350;
const DEFAULT_ESTIMATED_COST_USD = 0.0005;

interface CoachMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CoachRequestBody {
  messages: CoachMessageInput[];
  conversation_id?: string;
}

async function callGroqChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: CoachMessageInput[],
): Promise<{ text: string; tokens: number } | null> {
  try {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-8)],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Groq (${model}) returned HTTP ${response.status}:`, errText);
      return null;
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content || '';
    const tokens = json?.usage?.total_tokens || DEFAULT_ESTIMATED_TOKENS;
    return text ? { text, tokens } : null;
  } catch (err: unknown) {
    console.warn(`Groq (${model}) network error:`, err);
    return null;
  }
}

async function callGeminiChat(
  apiKey: string,
  systemPrompt: string,
  messages: CoachMessageInput[],
): Promise<{ text: string; tokens: number } | null> {
  try {
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const contents = messages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Gemini returned HTTP ${res.status}:`, errText);
      return null;
    }

    const resJson = await res.json();
    const text = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = resJson?.usageMetadata?.totalTokenCount || DEFAULT_ESTIMATED_TOKENS;
    return text ? { text, tokens } : null;
  } catch (err: unknown) {
    console.warn('Gemini chat network error:', err);
    return null;
  }
}

async function callClaudeChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: CoachMessageInput[],
): Promise<{ text: string; tokens: number } | null> {
  try {
    const claudeUrl = 'https://api.anthropic.com/v1/messages';
    const anthropicMessages = messages
      .slice(-8)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(claudeUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Claude returned HTTP ${res.status}:`, errText);
      return null;
    }

    const resJson = await res.json();
    const text = resJson?.content?.[0]?.text || '';
    const tokens =
      (resJson?.usage?.input_tokens || 0) + (resJson?.usage?.output_tokens || 0) ||
      DEFAULT_ESTIMATED_TOKENS;
    return text ? { text, tokens } : null;
  } catch (err: unknown) {
    console.warn('Claude chat network error:', err);
    return null;
  }
}

export async function handleAiCoach(req: Request): Promise<Response> {
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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', code: 'UNAUTHENTICATED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Server configuration error: SUPABASE_URL or SERVICE_ROLE_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration', code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // 1. Authenticate user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', code: 'UNAUTHENTICATED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;

    // 2. Check entitlement access (Pro plan or active trial required)
    const { data: coachAccess, error: accessErr } = await adminClient.rpc('check_ai_coach_access', {
      p_user_id: userId,
    });

    if (accessErr || !coachAccess?.allowed) {
      return new Response(
        JSON.stringify({
          error:
            'AI Coach is included with CaliPartner Pro. Upgrade to access personalized dietitian guidance.',
          code: 'UPGRADE_REQUIRED',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Check AI processing consent
    const { data: consentRows } = await adminClient
      .from('consent_records')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_type', 'ai_processing')
      .limit(1);

    if (!consentRows || consentRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'AI processing consent is required before using the AI Coach.',
          code: 'CONSENT_REQUIRED',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Parse payload (support either messages array or message + history)
    const body = (await req.json()) as any;
    let incomingMessages: CoachMessageInput[] = [];

    if (Array.isArray(body?.messages)) {
      incomingMessages = body.messages;
    } else if (typeof body?.message === 'string') {
      const history = Array.isArray(body?.history) ? body.history : [];
      incomingMessages = [...history, { role: 'user', content: body.message }];
    }

    if (!incomingMessages || incomingMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Gather personalized context safely from database
    const { data: goalProfile } = await adminClient
      .from('goal_profiles')
      .select('goal, daily_calorie_target, protein_grams, carbs_grams, fat_grams, weekly_rate_kg')
      .eq('user_id', userId)
      .maybeSingle();

    const todayUtc = new Date().toISOString().split('T')[0];
    const { data: todaySummary } = await adminClient
      .from('daily_summaries')
      .select('total_calories, total_protein, total_carbs, total_fat, water_ml')
      .eq('user_id', userId)
      .eq('day', todayUtc)
      .maybeSingle();

    // 6. Build System Prompt with full conversational freedom & evidence-based fitness guidance
    const targetCalories = goalProfile?.daily_calorie_target ?? 2000;
    const targetProtein = goalProfile?.protein_grams ?? 140;
    const goalType = goalProfile?.goal ?? 'maintain';
    const consumedCalories = todaySummary?.total_calories ?? 0;
    const consumedProtein = todaySummary?.total_protein ?? 0;
    const waterMl = todaySummary?.water_ml ?? 0;

    const systemPrompt = `You are the CaliPartner AI Coach, an expert fitness, calisthenics, and nutrition coach.

CRITICAL DIRECTIVES:
1. STRAIGHT TO THE POINT: Never beat around the bush. Start directly with the answer on the very first word. Never use greetings, filler, preambles, or pleasantries (e.g. no "Hello", "Sure", "Great question", "Certainly", "I would be happy to help").
2. TOKEN-EFFICIENT & SHORT: Keep answers concise, high-density, and short to save tokens. No sugarcoating, no fluff, no conversational padding. Get right to the actionable facts.
3. COMPLETENESS: Every answer must still be 100% complete, actionable, and conclude its thought cleanly. Never leave sentences unfinished.
4. MEAL IDEAS: ONLY suggest specific recipes or meals if the user explicitly asks for recipes, meal ideas, or what to cook/eat.
5. CALORIE FLOORS & SAFETY: Never encourage eating below 1200 kcal/day for women or 1500 kcal/day for men. Do not prescribe medical drugs.
6. NO MARKDOWN FORMATTING: Do NOT use markdown bold asterisks (**), headers (## or ###), or em dashes (—). Use plain, readable sentences and clean punctuation like colons, commas, and hyphens.

USER METRICS & CONTEXT:
- Fitness Goal: ${goalType}
- Daily Calorie Target: ${targetCalories} kcal
- Daily Protein Target: ${targetProtein} g
- Today's Consumed Calories: ${consumedCalories} kcal (Remaining: ${Math.max(0, targetCalories - consumedCalories)} kcal)
- Today's Consumed Protein: ${consumedProtein} g (Remaining: ${Math.max(0, targetProtein - consumedProtein)} g)
- Today's Hydration: ${waterMl} ml`;

    const groqKey = Deno.env.get('GROQ_API_KEY');
    const groqFallbackKey = Deno.env.get('GROQ_API_KEY_FALLBACK');
    const groqModel = Deno.env.get('GROQ_MODEL') || 'qwen/qwen3.8-27b';
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const claudeModel = Deno.env.get('CLAUDE_MODEL') || 'claude-3-5-sonnet-20241022';
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    const openRouterModel = Deno.env.get('OPENROUTER_MODEL') || DEFAULT_COACH_MODEL;

    let assistantResponseText = '';
    let tokensUsed = DEFAULT_ESTIMATED_TOKENS;
    let costUsd = DEFAULT_ESTIMATED_COST_USD;
    let modelUsed = groqModel;

    // 1. Primary: Groq with primary key (qwen/qwen3.8-27b or openai/gpt-oss-120b)
    if (groqKey && groqKey.trim().length > 0) {
      const groqRes = await callGroqChat(groqKey.trim(), groqModel, systemPrompt, incomingMessages);
      if (groqRes) {
        assistantResponseText = groqRes.text;
        tokensUsed = groqRes.tokens;
        costUsd = 0;
        modelUsed = `groq:${groqModel}`;
      }
    }

    // 2. Fallback 1: Groq with fallback key
    if (!assistantResponseText && groqFallbackKey && groqFallbackKey.trim().length > 0) {
      console.warn('Groq primary key unavailable or rate limited. Trying Groq fallback key...');
      const groqRes = await callGroqChat(groqFallbackKey.trim(), groqModel, systemPrompt, incomingMessages);
      if (groqRes) {
        assistantResponseText = groqRes.text;
        tokensUsed = groqRes.tokens;
        costUsd = 0;
        modelUsed = `groq:${groqModel}:fallback`;
      }
    }

    // 3. Fallback 2: Google Gemini (gemini-2.5-flash)
    if (!assistantResponseText && geminiKey && geminiKey.trim().length > 0) {
      console.warn('Groq unavailable or rate limited. Trying Gemini fallback...');
      const geminiRes = await callGeminiChat(geminiKey.trim(), systemPrompt, incomingMessages);
      if (geminiRes) {
        assistantResponseText = geminiRes.text;
        tokensUsed = geminiRes.tokens;
        costUsd = 0;
        modelUsed = 'gemini-2.5-flash';
      }
    }

    // 4. Fallback 3: OpenRouter (if configured)
    if (!assistantResponseText && openRouterApiKey && openRouterApiKey.trim().length > 0) {
      console.warn('Trying OpenRouter fallback...');
      try {
        const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
        const response = await fetch(openRouterUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://calipartner.app',
            'X-Title': 'CaliPartner AI Dietitian',
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...incomingMessages.slice(-8),
            ],
            temperature: 0.7,
            max_tokens: 2500,
          }),
        });

        if (response.ok) {
          const responseData = await response.json();
          assistantResponseText = responseData?.choices?.[0]?.message?.content || '';
          tokensUsed = responseData?.usage?.total_tokens || DEFAULT_ESTIMATED_TOKENS;
          costUsd = 0;
          modelUsed = openRouterModel;
        }
      } catch (orErr) {
        console.warn('OpenRouter fallback failed:', orErr);
      }
    }

    // 5. Ultimate Fallback: Claude (Anthropic API)
    if (!assistantResponseText && anthropicKey && anthropicKey.trim().length > 0) {
      console.warn('All previous providers unavailable. Trying ultimate Claude fallback...');
      const claudeRes = await callClaudeChat(anthropicKey.trim(), claudeModel, systemPrompt, incomingMessages);
      if (claudeRes) {
        assistantResponseText = claudeRes.text;
        tokensUsed = claudeRes.tokens;
        costUsd = 0.0015;
        modelUsed = `claude:${claudeModel}`;
      }
    }

    // 6. Built-in rule-based heuristic fallback if all AI APIs are exhausted
    if (!assistantResponseText) {
      const latestUserMessage =
        incomingMessages[incomingMessages.length - 1]?.content?.toLowerCase() || '';

      // Workouts / Calisthenics / Training
      if (
        latestUserMessage.includes('workout') ||
        latestUserMessage.includes('calisthenic') ||
        latestUserMessage.includes('push up') ||
        latestUserMessage.includes('pull up') ||
        latestUserMessage.includes('routine') ||
        latestUserMessage.includes('exercise') ||
        latestUserMessage.includes('chest') ||
        latestUserMessage.includes('legs') ||
        latestUserMessage.includes('arms') ||
        latestUserMessage.includes('bench')
      ) {
        assistantResponseText = `For optimal strength and physique development, prioritize compound movements with progressive overload:
• Push: Push-ups, diamond push-ups, dips, and overhead pressing.
• Pull: Pull-ups, chin-ups, and Australian horizontal rows.
• Legs: Deep bodyweight squats, lunges, Bulgarian split squats, and calf raises.
• Core: Hanging knee raises, planks, and hollow body holds.

Aim for 3 to 4 challenging sets per exercise within 1 to 2 reps in reserve. Rest 90-120 seconds between sets to maximize motor unit recruitment.`;
      }
      // Fasting
      else if (
        /\b(fasting|fast|16:8|intermittent fasting|eating window)\b/i.test(latestUserMessage) &&
        !latestUserMessage.includes('faster')
      ) {
        assistantResponseText = `Intermittent fasting (such as 16:8 or 14:10) is a meal-timing schedule where you consume your daily calories within an 8 to 10 hour window. 

Key points to know:
• Fasting helps with appetite regulation and managing calorie intake.
• If your goal is weight gain or bulking, fasting is generally NOT recommended because eating sufficient surplus calories in a short window is difficult.
• During the fasting window, drink plenty of water, black coffee, or plain green tea without added sugar or milk.`;
      }
      // Protein
      else if (
        latestUserMessage.includes('protein') ||
        latestUserMessage.includes('shake') ||
        latestUserMessage.includes('creatine')
      ) {
        assistantResponseText = `Your daily protein target is ${targetProtein}g. Distributing this across 3 to 4 meals (roughly 30-40g per meal) maximizes muscle protein synthesis throughout the day.
Great protein sources:
• Non-veg: Chicken breast (31g/100g), eggs (6g each), fish, turkey.
• Dairy/Veg: Paneer (18g/100g), Greek yogurt / curd, whey protein.
• Plant-based: Soya chunks (52g/100g dry), tofu, lentils, chickpeas.`;
      }
      // Explicit meal / recipe request
      else if (
        latestUserMessage.includes('recipe') ||
        latestUserMessage.includes('meal idea') ||
        latestUserMessage.includes('what should i eat') ||
        latestUserMessage.includes('what to eat') ||
        latestUserMessage.includes('what to cook')
      ) {
        assistantResponseText = `Here are nutritious, balanced meal ideas tailored to fit your daily ${targetCalories} kcal allowance and ${targetProtein}g protein target:
1. High-Protein Masala Paneer / Tofu Scramble with whole-wheat toast (420 kcal, 32g protein).
2. Herb Grilled Chicken Breast with steamed broccoli and brown rice (480 kcal, 44g protein).
3. Mass-Builder Banana Oat Smoothie with peanut butter, milk, and protein powder (550 kcal, 36g protein).`;
      }
      // General conversation
      else {
        assistantResponseText = `I am here to support you freely with whatever you need, including workouts, calisthenics routines, nutrition guidance, bulking, fat loss, or daily habit tracking. With your targets set to ${targetCalories} kcal and ${targetProtein}g protein daily, steady consistency will get you the best results. What would you like to explore today?`;
      }
    }

    const cleanResponseText = assistantResponseText
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/\s*—\s*/g, ', ')
      .replace(/\s*–\s*/g, ' - ')
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      .replace(/\s*--\s*/g, ', ')
      .trim();

    // 7. Record AI Usage via atomic RPC
    try {
      await adminClient.rpc('record_ai_usage', {
        p_user_id: userId,
        p_feature: 'coach',
        p_tokens: tokensUsed,
        p_cost: costUsd,
      });
    } catch (usageErr) {
      console.warn('Failed to record AI coach usage:', usageErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: {
          role: 'assistant',
          content: cleanResponseText,
        },
        model: modelUsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('AI Coach handler error:', msg);
    return new Response(
      JSON.stringify({
        error: 'Failed to process AI Coach request. Please try again.',
        details: msg,
        code: 'COACH_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAiCoach);
}
