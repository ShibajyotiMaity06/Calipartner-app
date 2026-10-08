export const RESERVED_USERNAMES = new Set([
  // System and brand reserved
  'admin',
  'administrator',
  'calipartner',
  'official',
  'root',
  'support',
  'help',
  'mod',
  'moderator',
  'system',
  'api',
  'test',
  'security',
  'info',
  'team',
  'staff',
  'billing',
  'null',
  'undefined',
  'bot',
  'welcome',
  'feedback',
  'terms',
  'privacy',
  'everyone',
  'nobody',
  // Common abusive / offensive words
  'abuse',
  'asshole',
  'bitch',
  'bastard',
  'cunt',
  'dick',
  'fuck',
  'fucker',
  'fucking',
  'nigger',
  'nigga',
  'pussy',
  'shit',
  'slut',
  'whore',
  'twat',
  'fag',
  'faggot',
]);

export interface UsernameValidationResult {
  isValid: boolean;
  error?:
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'INVALID_CHARACTERS'
    | 'LEADING_TRAILING_SEPARATOR'
    | 'CONSECUTIVE_PERIODS'
    | 'RESERVED_WORD';
}

const ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9_.]+$/;

/**
 * Validates a username according to PRD USR-1 rules:
 * - 3 to 20 characters
 * - Letters, numbers, underscore, period
 * - Cannot start or end with a period or underscore
 * - No consecutive periods (..)
 * - Reserved and offensive words blocked (case-insensitive)
 */
export function validateUsername(username: string): UsernameValidationResult {
  if (!username || username.length < 3) {
    return { isValid: false, error: 'TOO_SHORT' };
  }

  if (username.length > 20) {
    return { isValid: false, error: 'TOO_LONG' };
  }

  if (!ALLOWED_CHARS_REGEX.test(username)) {
    return { isValid: false, error: 'INVALID_CHARACTERS' };
  }

  if (
    username.startsWith('.') ||
    username.startsWith('_') ||
    username.endsWith('.') ||
    username.endsWith('_')
  ) {
    return { isValid: false, error: 'LEADING_TRAILING_SEPARATOR' };
  }

  if (username.includes('..')) {
    return { isValid: false, error: 'CONSECUTIVE_PERIODS' };
  }

  const normalized = username.toLowerCase();
  if (RESERVED_USERNAMES.has(normalized)) {
    return { isValid: false, error: 'RESERVED_WORD' };
  }

  return { isValid: true };
}

/**
 * Normalizes username to lowercase.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
