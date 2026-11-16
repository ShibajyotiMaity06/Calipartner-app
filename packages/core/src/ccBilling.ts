export interface CCPackQuote {
  id: string;
  cc: number;
  amount: number;
  currency: 'INR' | 'USD';
}

/** Provider prices are in minor units. Never substitute an estimated store price. */
export function verifiedCCPrice(product: unknown, currency: 'INR' | 'USD'): number {
  const p = product as {
    is_recurring?: boolean;
    archived?: boolean;
    price?: {
      type?: string;
      currency?: string;
      price?: number;
      pay_what_you_want?: boolean;
      discount?: number;
      discount_bps?: number;
      purchasing_power_parity?: boolean;
    };
  } | null;
  const price = p?.price;
  if (
    !p ||
    p.is_recurring ||
    p.archived ||
    price?.type !== 'one_time_price' ||
    price.currency !== currency ||
    !Number.isSafeInteger(price.price) ||
    (price.price ?? 0) <= 0 ||
    price.pay_what_you_want ||
    price.purchasing_power_parity ||
    price.discount ||
    price.discount_bps
  )
    throw new Error('CC_PRODUCT_MISMATCH');
  return price.price!;
}
