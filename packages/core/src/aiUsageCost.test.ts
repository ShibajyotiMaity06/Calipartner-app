import { describe, expect, it } from 'vitest';
import { calculateClaudeUsage } from './ai_food_photo';
describe('Claude usage and cache pricing', () => {
  it('counts raw input, cache writes, cache reads and output without treating hits as free', () => {
    expect(
      calculateClaudeUsage({
        input_tokens: 1000,
        cache_creation_input_tokens: 2000,
        cache_read_input_tokens: 4000,
        output_tokens: 500,
      }),
    ).toMatchObject({ tokens: 7500, cost: 0.00064 });
  });
  it('accounts for the initial write premium and the lower cost of an identical cached prefix', () => {
    const write = calculateClaudeUsage({
      input_tokens: 1000,
      cache_creation_input_tokens: 2000,
      output_tokens: 500,
    });
    const hit = calculateClaudeUsage({
      input_tokens: 1000,
      cache_read_input_tokens: 2000,
      output_tokens: 500,
    });
    expect(write.tokens).toBe(hit.tokens);
    expect(write.cost).toBe(0.0006);
    expect(hit.cost).toBe(0.00037);
  });
  it('uses total input including cached tokens for the long-context price tier', () => {
    expect(
      calculateClaudeUsage({ input_tokens: 1, cache_read_input_tokens: 100000, output_tokens: 100 })
        .cost,
    ).toBe(0.005251);
    expect(calculateClaudeUsage(undefined)).toMatchObject({ tokens: 0, cost: 0 });
  });
});
