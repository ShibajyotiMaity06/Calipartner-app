import { describe, expect, it } from 'vitest';
import { extractEmailDomain, isDisposableEmail } from './email';

describe('extractEmailDomain', () => {
  it('extracts domain correctly', () => {
    expect(extractEmailDomain('user@example.com')).toBe('example.com');
    expect(extractEmailDomain('User.Name+tag@GMAIL.COM')).toBe('gmail.com');
  });

  it('returns null on invalid emails', () => {
    expect(extractEmailDomain('invalid-email')).toBeNull();
    expect(extractEmailDomain('')).toBeNull();
  });
});

describe('isDisposableEmail', () => {
  it('identifies disposable email domains', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
    expect(isDisposableEmail('temp@10minutemail.com')).toBe(true);
    expect(isDisposableEmail('anon@guerrillamail.com')).toBe(true);
    expect(isDisposableEmail('throwaway@yopmail.com')).toBe(true);
  });

  it('allows reputable standard email domains', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
    expect(isDisposableEmail('user@outlook.com')).toBe(false);
    expect(isDisposableEmail('user@icloud.com')).toBe(false);
    expect(isDisposableEmail('user@mycompany.org')).toBe(false);
  });
});
