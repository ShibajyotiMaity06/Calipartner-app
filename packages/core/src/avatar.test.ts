import { describe, it, expect } from 'vitest';
import {
  avatarProgress,
  avatarPurchasePrice,
  avatarSpend,
  avatarLayers,
  type AvatarProduct,
} from './avatar';
describe('avatar economy', () => {
  it('banks XP above the configured cap without selling forms', () => {
    const levels = [
      { level: 1, xp_required: 0, form: 1 },
      { level: 3, xp_required: 1200, form: 2 },
      { level: 6, xp_required: 5200, form: 3 },
      { level: 7, xp_required: 8000, form: 4 },
    ];
    expect(avatarProgress(10000, levels, 6)).toMatchObject({ level: 6, form: 3, fraction: 1 });
    expect(avatarProgress(600, levels, 6).fraction).toBe(0.5);
  });
  it('rounds the complete bundle up once', () =>
    expect(avatarPurchasePrice([45, 60], 1, 0, 15)).toBe(90));
  it('supports both spend orders and blocks debt', () => {
    expect(avatarSpend(30, 50, 60)).toEqual({ earned: 30, purchased: 30 });
    expect(avatarSpend(30, 50, 60, 'purchased_first')).toEqual({ earned: 10, purchased: 50 });
    expect(() => avatarSpend(100, -1, 1)).toThrow('PURCHASED_BALANCE_NEGATIVE');
    expect(() => avatarSpend(0, 0, 1)).toThrow('INSUFFICIENT_CC');
  });
  it('resolves the exact form and hides bottoms underneath dresses', () => {
    const products = [
      {
        id: 'dress',
        slot: 'top',
        genders: ['f'],
        hides: ['bottom'],
        layer_order: 40,
        assets: { 'f:2': 'dress2.webp' },
      },
      {
        id: 'pants',
        slot: 'bottom',
        genders: ['f'],
        hides: [],
        layer_order: 30,
        assets: { 'f:2': 'pants2.webp' },
      },
    ] as unknown as AvatarProduct[];
    expect(
      avatarLayers(
        { gender: 'f', form: 2, slots: { top: 'dress', bottom: 'pants' } },
        products,
      ).map((l) => l.path),
    ).toEqual(['dress2.webp']);
  });
});
