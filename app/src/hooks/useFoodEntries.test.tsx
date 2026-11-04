import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import type { Food } from '@calipartner/core';
const state = vi.hoisted(() => ({ save: vi.fn(), emit: vi.fn(), id: 0 }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/diaryEvents', () => ({ diaryEvents: { emitChange: state.emit } }));
vi.mock('@/services/foodService', () => ({
  logFoodEntry: state.save,
  generateClientUuid: () => 'client-' + ++state.id,
}));
import { useAddEntry } from './useFoodEntries';
it('keeps the same entry ID after a failed acknowledgement and reports success only on an acknowledged retry', async () => {
  state.save
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockImplementationOnce(async (_db, input) => ({ id: input.id }));
  let hook!: ReturnType<typeof useAddEntry>;
  function Harness() {
    hook = useAddEntry();
    return null;
  }
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Harness />);
  });
  const input = {
    food: { id: 'banana' } as Food,
    quantity: 80,
    unit: 'g',
    mealSection: 'breakfast' as const,
    localDate: '2026-11-03',
  };
  await act(async () => {
    expect(await hook.addEntry(input)).toBeNull();
  });
  expect(hook.error).toBe('Connection lost');
  expect(state.emit).not.toHaveBeenCalled();
  await act(async () => {
    expect(await hook.addEntry(input)).toEqual({ id: state.save.mock.calls[0]![1].id });
  });
  expect(state.save.mock.calls[0]![1].id).toBe(state.save.mock.calls[1]![1].id);
  expect(hook.error).toBeNull();
  expect(state.emit).toHaveBeenCalledOnce();
  await act(async () => tree.unmount());
});
