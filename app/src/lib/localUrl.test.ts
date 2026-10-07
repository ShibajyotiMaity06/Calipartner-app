import { describe, expect, it } from 'vitest';
import { resolveLocalUrl } from './localUrl';

describe('resolveLocalUrl', () => {
  it('maps localhost to 10.0.2.2 on android', () => {
    expect(resolveLocalUrl('http://127.0.0.1:54321', 'android')).toBe('http://10.0.2.2:54321');
    expect(resolveLocalUrl('http://localhost:54321', 'android')).toBe('http://10.0.2.2:54321');
  });
  it('leaves other platforms and hosted urls alone', () => {
    expect(resolveLocalUrl('http://127.0.0.1:54321', 'ios')).toBe('http://127.0.0.1:54321');
    expect(resolveLocalUrl('https://abc.supabase.co', 'android')).toBe('https://abc.supabase.co');
  });
});
