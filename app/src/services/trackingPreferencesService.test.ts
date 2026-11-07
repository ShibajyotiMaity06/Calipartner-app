import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_TRACKING } from '@calipartner/core';
const state = vi.hoisted(() => ({
  actor: 'owner',
  read: vi.fn(),
  write: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.actor } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: state.read }) }),
      upsert: (payload: unknown) => {
        state.upsert(payload);
        return { select: () => ({ single: state.write }) };
      },
    }),
  }),
}));
import { readTrackingPreferences, saveTrackingPreferences } from './trackingPreferencesService';
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = 'owner';
});
it('loads calculated defaults only when the acknowledged server read has no preferences', async () => {
  state.read.mockResolvedValueOnce({ data: null, error: null });
  expect(await readTrackingPreferences('owner')).toEqual(DEFAULT_TRACKING);
  state.read.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(readTrackingPreferences('owner')).rejects.toThrow('offline');
});
it('confirms only the matching acknowledged upsert and supports identical explicit retries', async () => {
  const enabled = { ...DEFAULT_TRACKING, water: true };
  state.write
    .mockResolvedValueOnce({ data: null, error: new Error('offline') })
    .mockResolvedValueOnce({ data: { request_id: 'retry', enabled }, error: null });
  await expect(saveTrackingPreferences('owner', enabled, 'retry')).rejects.toThrow('offline');
  expect(await saveTrackingPreferences('owner', enabled, 'retry')).toEqual(enabled);
  expect(state.upsert.mock.calls[0]).toEqual(state.upsert.mock.calls[1]);
  state.write.mockResolvedValueOnce({ data: { request_id: 'other', enabled }, error: null });
  await expect(saveTrackingPreferences('owner', enabled, 'retry')).rejects.toThrow(
    'TRACKING_NOT_SAVED',
  );
});
it('rejects account changes before reading or saving', async () => {
  state.actor = 'stranger';
  await expect(saveTrackingPreferences('owner', DEFAULT_TRACKING, 'retry')).rejects.toThrow(
    'ACCOUNT_CHANGED',
  );
  expect(state.upsert).not.toHaveBeenCalled();
});
