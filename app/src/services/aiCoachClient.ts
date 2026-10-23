import Constants from 'expo-constants';
import { getSupabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import type { CoachSuggestion } from '@/components/coach/types';

const log = createLogger('aiCoachClient');

export interface CoachContextMetrics {
  calorieTarget: number;
  proteinTarget: number;
  goal: string;
  consumedCalories?: number;
  consumedProtein?: number;
  waterMl?: number;
}

export interface AiCoachCallResult {
  content: string;
  suggestions?: CoachSuggestion[];
  source: 'edge_function' | 'gemini_direct';
}

/**
 * Strips markdown asterisks (**), headers (##), and em dashes (—) from AI responses
 * to ensure clean, human-readable plain text without formatting clutter.
 */
export function cleanCoachResponse(text: string): string {
  if (!text) return text;
  return (
    text
      // Remove markdown headers: e.g. "### Core Principles" -> "Core Principles"
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown bold: "**Bold Text**" -> "Bold Text"
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // Remove markdown italics: "*Italic Text*" -> "Italic Text"
      .replace(/\*(.*?)\*/g, '$1')
      // Remove any remaining stray asterisks
      .replace(/\*\*/g, '')
      // Replace em dashes (—) and en dashes (–) with standard comma or hyphen
      .replace(/\s*—\s*/g, ', ')
      .replace(/\s*–\s*/g, ' - ')
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      // Replace double hyphens "--" used as em dash
      .replace(/\s*--\s*/g, ', ')
      .trim()
  );
}

/**
 * Robust AI coach caller:
 * 1. Tries Supabase Edge Function 'ai-coach'
 * 2. Falls back to Gemini 2.5 Flash if Edge Function is 404 / undeployed
 * 3. Never returns fake canned hardcoded responses on errors
 */
export async function queryAiCoach(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  context: CoachContextMetrics,
  conversationId?: string,
): Promise<AiCoachCallResult> {
  const supabase = getSupabase();

  // 1. Try Supabase Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: {
        messages,
        conversation_id: conversationId,
      },
    });

    if (!error && data?.message?.content) {
      return {
        content: cleanCoachResponse(data.message.content),
        suggestions: data.suggestions,
        source: 'edge_function',
      };
    }

    if (error) {
      // Re-throw if it's an explicit consent or upgrade refusal
      const errObj = error as { code?: string; message?: string };
      if (
        errObj.code === 'CONSENT_REQUIRED' ||
        errObj.code === 'UPGRADE_REQUIRED' ||
        error.message?.includes('CONSENT') ||
        error.message?.includes('UPGRADE')
      ) {
        throw error;
      }
      log.info(
        'Supabase ai-coach edge function unavailable, trying direct Gemini fallback:',
        error,
      );
    }
  } catch (edgeErr: any) {
    if (
      edgeErr?.code === 'CONSENT_REQUIRED' ||
      edgeErr?.code === 'UPGRADE_REQUIRED' ||
      edgeErr?.message?.includes('CONSENT') ||
      edgeErr?.message?.includes('UPGRADE')
    ) {
      throw edgeErr;
    }
    log.info('Supabase ai-coach invoke failed, trying direct Gemini fallback:', edgeErr);
  }

  // 2. Direct Gemini 2.5 Flash Fallback
  const extra = Constants.expoConfig?.extra;
  const geminiKey = extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

  if (!geminiKey) {
    throw new Error('AI Coach service is temporarily unavailable. Please try again later.');
  }

  const systemInstruction = `You are the CaliPartner AI Coach, an expert fitness, calisthenics, and nutrition coach.

CRITICAL DIRECTIVES:
1. STRAIGHT TO THE POINT: Never beat around the bush. Start directly with the answer on the very first word. Never use greetings, filler, preambles, or pleasantries (e.g. no "Hello", "Sure", "Great question", "Certainly", "I would be happy to help").
2. TOKEN-EFFICIENT & SHORT: Keep answers concise, high-density, and short to save tokens. No sugarcoating, no fluff, no conversational padding. Get right to the actionable facts.
3. COMPLETENESS: Every answer must still be 100% complete, actionable, and conclude its thought cleanly. Never leave sentences unfinished.
4. MEAL IDEAS: ONLY suggest specific recipes or meals if the user explicitly asks for recipes, meal ideas, or what to cook/eat.
5. CALORIE FLOORS & SAFETY: Never encourage eating below 1200 kcal/day for women or 1500 kcal/day for men. Do not prescribe medical drugs.
6. NO MARKDOWN FORMATTING: Do NOT use markdown bold asterisks (**), headers (## or ###), or em dashes (—). Use plain, readable sentences and clean punctuation like colons, commas, and hyphens.

USER METRICS & CONTEXT:
- Fitness Goal: ${context.goal}
- Daily Calorie Target: ${context.calorieTarget} kcal
- Daily Protein Target: ${context.proteinTarget} g
- Today's Consumed Calories: ${context.consumedCalories ?? 0} kcal (Remaining: ${Math.max(0, context.calorieTarget - (context.consumedCalories ?? 0))} kcal)
- Today's Consumed Protein: ${context.consumedProtein ?? 0} g
- Today's Hydration: ${context.waterMl ?? 0} ml`;

  // Format Gemini messages
  const contents = messages.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

  const res = await fetch(geminiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    log.error(`Gemini direct call failed (${res.status}): ${errorText}`);
    throw new Error(`AI Coach service error (${res.status}). Please try again.`);
  }

  const geminiData = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  const rawReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawReply) {
    throw new Error('AI Coach returned an empty response. Please try again.');
  }

  const cleanedReply = cleanCoachResponse(rawReply);

  return {
    content: cleanedReply,
    source: 'gemini_direct',
  };
}
