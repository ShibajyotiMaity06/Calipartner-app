// Owner-selected fallback models for planning, coach chat and food-photo analysis.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const CLAUDE_MODEL = 'claude-haiku-5-5';
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
