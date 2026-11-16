import { calculateClaudeUsage } from '@calipartner/core';
// Owner-selected fallback models for planning, coach chat and food-photo analysis.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const CLAUDE_MODEL = 'claude-haiku-5-5';
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Cache reusable instructions only. Dynamic preferences/diary data and questions stay fresh. */
export function cachedClaudeText(prompt: string) {
  const boundary = prompt.search(
    /\n(?:Current local date:| {0,2}Preferences:|Training preferences:)/,
  );
  const prefix = boundary < 0 ? prompt : prompt.slice(0, boundary);
  return [
    {
      type: 'text' as const,
      text: prefix,
      cache_control: { type: 'ephemeral' as const, ttl: '5m' as const },
    },
    ...(boundary < 0 ? [] : [{ type: 'text' as const, text: prompt.slice(boundary) }]),
  ];
}

export function claudeUsage(usage: Parameters<typeof calculateClaudeUsage>[0], feature: string) {
  const result = calculateClaudeUsage(usage);
  console.info(
    JSON.stringify({
      event: 'claude_usage',
      feature,
      input_tokens: result.input,
      output_tokens: result.output,
      cache_read_input_tokens: result.read,
      cache_creation_input_tokens: result.write,
      tokens: result.tokens,
      cost_usd: result.cost,
    }),
  );
  return { tokens: result.tokens, cost: result.cost };
}

export function claudeHeaders(apiKey: string, workspaceId?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    ...(workspaceId?.trim() ? { 'anthropic-workspace-id': workspaceId.trim() } : {}),
  };
}

export function claudeText(data: {
  stop_reason?: string;
  content?: Array<{ type?: string; text?: string }>;
}): string {
  if (data.stop_reason && data.stop_reason !== 'end_turn') return '';
  return (data.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

export function geminiText(data: {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  const candidate = data.candidates?.[0];
  // Partial, blocked and reasoning-only responses cannot become a reply or saved estimate.
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') return '';
  return (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
}
