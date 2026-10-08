import { describe, expect, it } from 'vitest';
import { normalizeUsername, validateUsername } from './username';

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('rahul_99')).toEqual({ isValid: true });
    expect(validateUsername('john.doe')).toEqual({ isValid: true });
    expect(validateUsername('alex123')).toEqual({ isValid: true });
    expect(validateUsername('abc')).toEqual({ isValid: true }); // exactly 3 chars
    expect(validateUsername('a_12345678901234567z')).toEqual({ isValid: true }); // 20 chars
  });

  it('rejects usernames that are too short or too long', () => {
    expect(validateUsername('ab')).toEqual({ isValid: false, error: 'TOO_SHORT' });
    expect(validateUsername('')).toEqual({ isValid: false, error: 'TOO_SHORT' });
    expect(validateUsername('a'.repeat(21))).toEqual({ isValid: false, error: 'TOO_LONG' });
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('john@doe')).toEqual({ isValid: false, error: 'INVALID_CHARACTERS' });
    expect(validateUsername('john doe')).toEqual({ isValid: false, error: 'INVALID_CHARACTERS' });
    expect(validateUsername('john-doe')).toEqual({ isValid: false, error: 'INVALID_CHARACTERS' });
    expect(validateUsername('user!name')).toEqual({ isValid: false, error: 'INVALID_CHARACTERS' });
  });

  it('rejects leading or trailing periods and underscores', () => {
    expect(validateUsername('.johndoe')).toEqual({
      isValid: false,
      error: 'LEADING_TRAILING_SEPARATOR',
    });
    expect(validateUsername('johndoe.')).toEqual({
      isValid: false,
      error: 'LEADING_TRAILING_SEPARATOR',
    });
    expect(validateUsername('_johndoe')).toEqual({
      isValid: false,
      error: 'LEADING_TRAILING_SEPARATOR',
    });
    expect(validateUsername('johndoe_')).toEqual({
      isValid: false,
      error: 'LEADING_TRAILING_SEPARATOR',
    });
  });

  it('rejects consecutive periods', () => {
    expect(validateUsername('john..doe')).toEqual({ isValid: false, error: 'CONSECUTIVE_PERIODS' });
  });

  it('rejects reserved words (case-insensitive)', () => {
    expect(validateUsername('admin')).toEqual({ isValid: false, error: 'RESERVED_WORD' });
    expect(validateUsername('Admin')).toEqual({ isValid: false, error: 'RESERVED_WORD' });
    expect(validateUsername('CALIPARTNER')).toEqual({ isValid: false, error: 'RESERVED_WORD' });
    expect(validateUsername('support')).toEqual({ isValid: false, error: 'RESERVED_WORD' });
    expect(validateUsername('official')).toEqual({ isValid: false, error: 'RESERVED_WORD' });
  });
});

describe('normalizeUsername', () => {
  it('converts to lowercase and trims whitespace', () => {
    expect(normalizeUsername('  Rahul_99 ')).toBe('rahul_99');
  });
});
