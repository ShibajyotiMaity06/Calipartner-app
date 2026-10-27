import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke } }) }));
import { queryAiCoach } from './aiCoachClient';
const messages = [{ role: 'user' as const, content: 'Help with training' }];
const context = { calorieTarget: 2200, proteinTarget: 140, goal: 'maintain' };
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
it.each(['UPGRADE_REQUIRED', 'CONSENT_REQUIRED', 'DAILY_LIMIT_REACHED'])(
  'preserves %s and never falls back to a client model',
  async (code) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Non-2xx response',
        context: { json: async () => ({ code, error: 'Access denied' }) },
      },
    });
    await expect(queryAiCoach(messages, context)).rejects.toMatchObject({ code });
    expect(fetch).not.toHaveBeenCalled();
  },
);
it('fails closed when the Edge Function is unavailable', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  invoke.mockRejectedValue(new Error('Network unavailable'));
  await expect(queryAiCoach(messages, context)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('returns a verified server response with clean text', async () => {
  invoke.mockResolvedValue({
    data: { message: { content: '**Train** consistently.' } },
    error: null,
  });
  expect(await queryAiCoach(messages, context)).toMatchObject({
    content: 'Train consistently.',
    source: 'edge_function',
  });
});
