/** Cosmetic economy helpers. All mutations and authorization remain server-side. */
export type AvatarGender = 'm' | 'f';
export type AvatarSlot =
  | 'backdrop'
  | 'aura'
  | 'bottom'
  | 'top'
  | 'shoes'
  | 'wrist'
  | 'neck'
  | 'facial'
  | 'ears'
  | 'hair'
  | 'headwear'
  | 'eyewear'
  | 'frame';
export interface AvatarLevel {
  level: number;
  xp_required: number;
  form: number;
}
export interface AvatarProduct {
  id: string;
  name: string;
  slot: AvatarSlot | 'finish';
  kind: 'item' | 'finish';
  genders: AvatarGender[];
  rarity: string;
  price_cc: number;
  collection_id: string;
  starter: boolean;
  earn_only: boolean;
  tintable: boolean;
  hides: AvatarSlot[];
  assets: Record<string, string>;
  active: boolean;
  per_form: boolean;
  layer_order: number;
  finish?: string;
  owned?: boolean;
  accessible?: boolean;
  effective_price?: number;
}
export interface AvatarLoadout {
  slots: Partial<Record<AvatarSlot, string>>;
  tints: Record<string, string>;
  hash?: string;
}
export interface AvatarProfile extends AvatarLoadout {
  user_id: string;
  gender: AvatarGender;
  skin_tone_id: string;
  xp: number;
  level: number;
  form: number;
}
export function avatarProgress(xp: number, levels: AvatarLevel[], cap: number) {
  const active = levels.filter((l) => l.level <= cap).sort((a, b) => a.xp_required - b.xp_required);
  const current = [...active].reverse().find((l) => xp >= l.xp_required) ?? active[0];
  if (!current) throw new Error('INVALID_LEVEL_CONFIG');
  const next = active.find((l) => l.level > current.level);
  return {
    level: current.level,
    form: current.form,
    next,
    fraction: next
      ? Math.max(
          0,
          Math.min(1, (xp - current.xp_required) / (next.xp_required - current.xp_required)),
        )
      : 1,
  };
}
export function avatarPurchasePrice(
  prices: number[],
  multiplier: number,
  tierDiscount: number,
  bundleDiscount = 0,
): number {
  return Math.ceil(
    prices.reduce((sum, p) => sum + p, 0) *
      multiplier *
      (1 - tierDiscount / 100) *
      (1 - bundleDiscount / 100),
  );
}
export function avatarSpend(
  earned: number,
  purchased: number,
  price: number,
  order = 'earned_first',
) {
  if (purchased < 0) throw new Error('PURCHASED_BALANCE_NEGATIVE');
  if (price < 0 || earned + purchased < price) throw new Error('INSUFFICIENT_CC');
  const first = Math.min(order === 'earned_first' ? earned : purchased, price);
  return order === 'earned_first'
    ? { earned: first, purchased: price - first }
    : { earned: price - first, purchased: first };
}
export function avatarLayers(
  profile: Pick<AvatarProfile, 'gender' | 'form' | 'slots'>,
  products: AvatarProduct[],
) {
  const equipped = Object.entries(profile.slots)
    .map(([slot, id]) =>
      products.find((p) => p.id === id && p.slot === slot && p.genders.includes(profile.gender)),
    )
    .filter((p): p is AvatarProduct => !!p);
  const hidden = new Set(equipped.flatMap((p) => p.hides));
  return equipped
    .filter((p) => !hidden.has(p.slot as AvatarSlot))
    .sort((a, b) => a.layer_order - b.layer_order)
    .map((product) => ({ product, path: product.assets[`${profile.gender}:${profile.form}`] }))
    .filter((layer) => !!layer.path);
}
