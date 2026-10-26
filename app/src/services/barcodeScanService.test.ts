import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncDb } from './syncService';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke } }) }));
vi.mock('@/db', () => ({ getDb: vi.fn() }));
import { lookupBarcode } from './barcodeScanService';
const product = {
  id: 'f0000000-0000-4000-8000-000000000001',
  source: 'off',
  name: 'Packaged food',
  barcode: '4006381333931',
  calories_per_100g: 200,
  protein_per_100g: 5,
  carbs_per_100g: 30,
  fat_per_100g: 7,
  serving_units: [{ unit: 'g', grams: 1 }],
};
const db = {
  getFirstAsync: vi.fn(async () => null),
  runAsync: vi.fn(async () => ({})),
} as unknown as SyncDb;
beforeEach(() => {
  vi.clearAllMocks();
});
describe('barcode product lookup', () => {
  it('consumes the actual Edge Function food field and caches its nutrition offline', async () => {
    invoke.mockResolvedValue({ data: { found: true, food: product }, error: null });
    expect(await lookupBarcode(product.barcode, db, true, 'owner')).toEqual({
      food: product,
      source: 'remote',
    });
    expect(invoke).toHaveBeenCalledWith('food-lookup', {
      body: { barcode: product.barcode, query: undefined },
    });
    expect(db.runAsync).toHaveBeenCalledOnce();
    expect(db.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('owner_id'), [
      product.barcode,
      'owner',
      'owner',
    ]);
  });
  it('distinguishes an unknown product from a provider/network failure', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 404 } } });
    expect((await lookupBarcode(product.barcode, db)).source).toBe('not_found');
    invoke.mockResolvedValueOnce({
      data: null,
      error: { context: { status: 502 }, message: 'Provider down' },
    });
    await expect(lookupBarcode(product.barcode, db)).rejects.toThrow('connection');
  });
  it('keeps offline manual fallback available and rejects QR links as product codes', async () => {
    expect((await lookupBarcode(product.barcode, db, false)).source).toBe('not_found');
    expect(invoke).not.toHaveBeenCalled();
    await expect(lookupBarcode('https://example.com', db)).rejects.toThrow('valid product barcode');
  });
});
