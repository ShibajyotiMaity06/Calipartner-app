import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('returns English strings by key', () => {
    expect(t('tabs.today')).toBe('Today');
    expect(t('connection.connected')).toBe('Connected');
  });

  it('falls back to the key when missing', () => {
    expect(t('nope.missing' as never)).toBe('nope.missing');
  });
});
