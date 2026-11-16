interface AllowanceClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data?: unknown; error: unknown }>;
}
interface AllowanceResult {
  lease_id?: string;
  code?: string;
  replay?: { body: unknown; status: number };
  saved?: boolean;
}

type Feature = 'coach' | 'food_photo';
export function aiAccessResponse(code: string, feature: Feature, headers: HeadersInit): Response {
  const error =
    code === 'MONTHLY_LIMIT_REACHED' || code === 'DAILY_LIMIT_REACHED'
      ? feature === 'coach'
        ? 'To support reliable, responsible use, AI chat is paused until next month. You can still view your diary and log entries manually.'
        : 'To support reliable, responsible use, photo analysis is paused until next month. You can still add food manually.'
      : code === 'REQUEST_IN_PROGRESS'
        ? 'Your request is still being prepared. Wait a moment and try again.'
        : code === 'REQUEST_EXPIRED'
          ? 'Please start a new request.'
          : code === 'REQUEST_CONFLICT'
            ? 'Start a new request for the updated details.'
            : 'AI support is temporarily unavailable. Please try again.';
  const status = /LIMIT_REACHED$/.test(code)
    ? 429
    : code.startsWith('REQUEST_')
      ? 409
      : ['CONSENT_REQUIRED', 'UPGRADE_REQUIRED'].includes(code)
        ? 403
        : 503;
  return Response.json({ code, error }, { status, headers });
}

/** A short database lease protects provider spend and makes explicit retries replayable. */
export class AiAllowance {
  private lease: string | null = null;
  private complete = false;
  private tokens = 0;
  private cost = 0;
  private requestId: string;
  constructor(
    private client: AllowanceClient,
    private owner: string,
    private feature: Feature,
    requestId: unknown,
    private headers: HeadersInit,
  ) {
    this.requestId = typeof requestId === 'string' ? requestId : crypto.randomUUID();
  }
  async begin(payload: unknown): Promise<Response | null> {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(this.requestId))
      return Response.json(
        { code: 'INVALID_REQUEST', error: 'Start a new AI request.' },
        { status: 400, headers: this.headers },
      );
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const { data: raw, error } = await this.client.rpc('begin_ai_request', {
      p_user_id: this.owner,
      p_request_id: this.requestId,
      p_feature: this.feature,
      p_input_hash: hash,
    });
    const data = raw as AllowanceResult | null;
    if (error || !data)
      return aiAccessResponse('ALLOWANCE_UNAVAILABLE', this.feature, this.headers);
    if (data.replay)
      return Response.json(data.replay.body, { status: data.replay.status, headers: this.headers });
    if (!data.lease_id)
      return aiAccessResponse(data.code ?? 'ALLOWANCE_UNAVAILABLE', this.feature, this.headers);
    this.lease = data.lease_id;
    return null;
  }
  async finish(body: unknown, tokens: number, cost: number, status = 200): Promise<Response> {
    this.tokens = tokens;
    this.cost = cost;
    const { data: raw, error } = await this.client.rpc('finish_ai_request', {
      p_user_id: this.owner,
      p_request_id: this.requestId,
      p_lease_id: this.lease,
      p_response: { body, status },
      p_tokens: tokens,
      p_cost: cost,
    });
    const data = raw as AllowanceResult | null;
    if (error || !data?.saved)
      return aiAccessResponse(data?.code ?? 'ALLOWANCE_UNAVAILABLE', this.feature, this.headers);
    this.complete = true;
    return Response.json(body, { status, headers: this.headers });
  }
  account(tokens: number, cost: number) {
    this.tokens = tokens;
    this.cost = cost;
  }
  async release(): Promise<void> {
    if (!this.lease || this.complete) return;
    await this.client.rpc('finish_ai_request', {
      p_user_id: this.owner,
      p_request_id: this.requestId,
      p_lease_id: this.lease,
      p_response: null,
      p_tokens: this.tokens,
      p_cost: this.cost,
    });
  }
}
