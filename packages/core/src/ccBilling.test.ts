import { describe, expect, it } from 'vitest';
import { verifiedCCPrice } from './ccBilling';
const product = {
  is_recurring: false,
  price: { type: 'one_time_price', currency: 'USD', price: 99 },
};
describe('CC one-time prices', () => {
  it('uses the provider minor-unit quote', () => expect(verifiedCCPrice(product, 'USD')).toBe(99));
  it.each([
    { ...product, is_recurring: true },
    { ...product, archived: true },
    { ...product, price: { ...product.price, currency: 'INR' } },
    { ...product, price: { ...product.price, price: 0 } },
    { ...product, price: { ...product.price, price: 1.5 } },
    { ...product, price: { ...product.price, pay_what_you_want: true } },
    { ...product, price: { ...product.price, discount: 10 } },
    { ...product, price: { ...product.price, purchasing_power_parity: true } },
  ])('rejects recurring, ambiguous, discounted and mismatched prices', (value) => {
    expect(() => verifiedCCPrice(value, 'USD')).toThrow('CC_PRODUCT_MISMATCH');
  });
});
