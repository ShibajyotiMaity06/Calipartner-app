import { describe, expect, it } from 'vitest';
import { isHealthResponse } from './health';

describe('isHealthResponse', () => {
  it('accepts a valid response', () => {
    expect(isHealthResponse({ status: 'ok', time: '2026-10-07T00:00:00.000Z' })).toBe(true);
  });

  it('rejects wrong status, bad time and non-objects', () => {
    expect(isHealthResponse({ status: 'down', time: '2026-10-07T00:00:00.000Z' })).toBe(false);
    expect(isHealthResponse({ status: 'ok', time: 'nope' })).toBe(false);
    expect(isHealthResponse(null)).toBe(false);
    expect(isHealthResponse('ok')).toBe(false);
  });
});
