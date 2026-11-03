import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), reset: vi.fn(), emit: vi.fn(), count: 0 }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: state.rpc }) }));
vi.mock('./accountDataGate', () => ({ beforeAccountWrite: state.reset }));
vi.mock('./diaryEvents', () => ({ diaryEvents: { emitChange: state.emit } }));
vi.mock('./foodService', () => ({ generateClientUuid: () => 'client-' + ++state.count }));
import { prepareCoachMealSave, saveCoachMeal } from './coachMealService';
const draft = {
  description: 'Eggs',
  mealSection: 'lunch' as const,
  localDate: '2026-11-03',
  items: [
    {
      name: 'Eggs',
      quantity: 2,
      unit: 'eggs',
      calories: 156,
      protein: 13,
      carbs: 1,
      fat: 11,
      fiber: 0,
      sugar: 0,
      sodium_mg: 124,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  state.reset.mockResolvedValue(false);
});
it('uses the same client IDs after lost acknowledgement and announces only a verified save', async () => {
  const entries = prepareCoachMealSave(draft);
  state.rpc
    .mockResolvedValueOnce({ error: new Error('network lost'), data: null })
    .mockResolvedValueOnce({ error: null, data: entries });
  await expect(saveCoachMeal(entries)).rejects.toThrow();
  expect(state.emit).not.toHaveBeenCalled();
  await saveCoachMeal(entries);
  expect(state.rpc.mock.calls[0]).toEqual(state.rpc.mock.calls[1]);
  expect(state.emit).toHaveBeenCalledOnce();
});
it('rejects partial acknowledgement and never announces the meal saved', async () => {
  state.rpc.mockResolvedValue({ error: null, data: [] });
  await expect(saveCoachMeal(prepareCoachMealSave(draft))).rejects.toThrow('SAVE_NOT_ACKNOWLEDGED');
  expect(state.emit).not.toHaveBeenCalled();
});
it('rechecks account reset before any remote write', async () => {
  state.reset.mockResolvedValue(true);
  await expect(saveCoachMeal(prepareCoachMealSave(draft))).rejects.toThrow('ACCOUNT_DATA_RESET');
  expect(state.rpc).not.toHaveBeenCalled();
});
