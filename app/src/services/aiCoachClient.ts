import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';
import type { CoachSuggestion } from '@/components/coach/types';

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
): Promise<AiCoachCallResult> {
  const { data, error } = await getSupabase().functions.invoke('ai-coach', {
    body: { messages, conversation_id: conversationId },
  });
  if (error) {
    let body: Record<string, unknown> = {};
    try {
      body = (await error.context?.json?.()) ?? {};
    } catch {
      /* No response body. */
    }
    const code = typeof body.code === 'string' ? body.code : 'COACH_UNAVAILABLE';
    const message = typeof body.error === 'string' ? body.error : t('brandRepair.coachUnavailable');
    throw Object.assign(new Error(message), { code });
  }
  if (typeof data?.message?.content !== 'string' || !data.message.content.trim())
    throw new Error(t('brandRepair.coachUnavailable'));
  return {
    content: cleanCoachResponse(data.message.content),
    suggestions: data.suggestions,
    source: 'edge_function',
  };
}
