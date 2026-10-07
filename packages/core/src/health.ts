/** Contract of the `health` Edge Function response. Shared by app and function. */
export interface HealthResponse {
  status: 'ok';
  time: string;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.status === 'ok' && typeof v.time === 'string' && !Number.isNaN(Date.parse(v.time));
}
