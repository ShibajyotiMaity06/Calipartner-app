import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('expo-sqlite', () => ({}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    rpc: state.rpc,
  }),
}));
vi.mock('./accountDataGate', () => ({ beforeAccountWrite: async () => false }));
vi.mock('./localNotificationService', () => ({
  scheduleFastingReminder: vi.fn(async () => {}),
  cancelFastingReminder: vi.fn(async () => {}),
  rescheduleAllFastingReminders: vi.fn(async () => {}),
}));
import { createWebDb } from '@/db';
import {
  startFast,
  endFast,
  getActiveFastingSession,
  getFastingHistory,
  saveFastingSettings,
  getLocalFastingSettings,
} from './fastingService';
import { DEFAULT_FASTING_SETTINGS } from '@calipartner/core';
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());
it('rolls back failed settings and start saves, then retries with the same ID and survives reopen', async () => {
  const db = createWebDb();
  state.rpc.mockResolvedValueOnce({ error: new Error('offline') });
  await expect(
    saveFastingSettings(db, null, { ...DEFAULT_FASTING_SETTINGS, user_id: 'owner', enabled: true }),
  ).rejects.toThrow('offline');
  expect((await getLocalFastingSettings(db, 'owner')).enabled).toBe(false);
  const request = {
    id: 'f0031500-0000-4000-8000-000000000001',
    userId: 'owner',
    plannedMinutes: 1080,
    timezone: 'Asia/Kolkata',
    startAt: '2026-11-03T00:00:00Z',
  };
  state.rpc
    .mockResolvedValueOnce({ error: new Error('lost acknowledgement') })
    .mockResolvedValueOnce({ error: null, data: { saved: 1 } });
  await expect(startFast(db, null, request)).rejects.toThrow();
  expect(await getActiveFastingSession(db, 'owner')).toBeNull();
  const saved = await startFast(db, null, request);
  expect(saved.id).toBe(request.id);
  expect(state.rpc.mock.calls.at(-1)?.[1].p_changes[0].id).toBe(
    state.rpc.mock.calls.at(-2)?.[1].p_changes[0].id,
  );
  expect(await getActiveFastingSession(createWebDb(), 'owner')).toMatchObject({
    id: request.id,
    planned_minutes: 1080,
  });
  state.rpc.mockResolvedValue({ error: null, data: { saved: 1 } });
  await endFast(db, null, {
    sessionId: request.id,
    userId: 'owner',
    endAt: '2026-11-03T19:00:00Z',
  });
  expect(await getActiveFastingSession(createWebDb(), 'owner')).toBeNull();
  expect((await getFastingHistory(createWebDb(), 'owner'))[0]?.status).toBe('completed');
  expect(await getFastingHistory(createWebDb(), 'outsider')).toEqual([]);
});
