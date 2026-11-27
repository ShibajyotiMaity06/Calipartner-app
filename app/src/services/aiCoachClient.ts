import { aiRequestKey } from './aiRequestKey';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import type { CoachSuggestion } from '@/components/coach/types';
import { validateCoachMealDraft, type CoachMealDraft } from '@calipartner/core';

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
  mealDraft?: CoachMealDraft | null;
  card?: {
    eyebrow?: string;
    points: Array<{ kind: 'positive' | 'note'; lead: string; detail?: string }>;
    actions?: Array<{ label: string; prompt: string; primary?: boolean }>;
  } | null;
  quickReplies?: string[];
  source: 'edge_function';
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

/** All model calls go through the authenticated server entitlement/consent boundary. */
export async function queryAiCoach(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  _context: CoachContextMetrics,
  conversationId?: string,
  options?: { mealLogging?: boolean },
): Promise<AiCoachCallResult> {
  const client = getSupabase();
  const body = {
    messages,
    conversation_id: conversationId,
    ...(options?.mealLogging ? { meal_logging: true } : {}),
  };
  const request = aiRequestKey(client, 'coach', {
    messages,
    meal_logging: options?.mealLogging === true,
  });
  const { data, error } = await client.functions.invoke('ai-coach', {
    body: { ...body, request_id: request.id },
  });
  if (error) {
    let body: Record<string, unknown> = {};
    try {
      body = (await error.context?.json?.()) ?? {};
    } catch {
      /* No response body. */
    }
    const code = typeof body.code === 'string' ? body.code : 'COACH_UNAVAILABLE';
    if (['REQUEST_EXPIRED', 'REQUEST_CONFLICT'].includes(code)) request.acknowledge();
    const message = typeof body.error === 'string' ? body.error : t('brandRepair.coachUnavailable');
    throw Object.assign(new Error(message), { code });
  }
  if (typeof data?.message?.content !== 'string' || !data.message.content.trim())
    throw new Error(t('brandRepair.coachUnavailable'));
  request.acknowledge();
  return {
    content: cleanCoachResponse(data.message.content),
    suggestions: data.suggestions,
    mealDraft: data.meal_draft ? validateCoachMealDraft(data.meal_draft) : null,
    card:
      data.card && Array.isArray(data.card.points) && data.card.points.length > 0
        ? data.card
        : null,
    quickReplies: Array.isArray(data.quick_replies) ? data.quick_replies : [],
    source: 'edge_function',
  };
}
