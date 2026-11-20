import { posthog } from '@/lib/posthog';

type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

type AiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: JsonValue;
};

/**
 * Records the client-visible boundary of a generation executed by a Supabase Edge Function.
 * The provider and model remain unknown to this app; instrument them server-side when that code
 * becomes available for token and provider-level observability.
 */
function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function startAiGeneration(params: {
  spanName: string;
  sessionId?: string | null;
  input: AiMessage[];
}) {
  const traceId = generateTraceId();
  const startedAt = Date.now();

  return {
    captureSuccess(output: AiMessage[]) {
      try {
        posthog?.capture('$ai_generation', {
          $ai_trace_id: traceId,
          $ai_session_id: params.sessionId ?? null,
          $ai_span_name: params.spanName,
          $ai_model: 'unknown',
          $ai_provider: 'unknown',
          $ai_input: params.input,
          $ai_output_choices: output,
          $ai_latency: (Date.now() - startedAt) / 1000,
        });
      } catch {
        // Observability must never interfere with the AI result shown to the user.
      }
    },
  };
}
