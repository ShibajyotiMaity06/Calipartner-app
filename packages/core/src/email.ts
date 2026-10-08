export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'mailinator.com',
  'mailin8r.com',
  'dispostable.com',
  'yopmail.com',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'tempmail.com',
  'temp-mail.org',
  'tempail.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'getairmail.com',
  'nada.ltd',
  'mohmal.com',
  'crazymailing.com',
  'mytemp.email',
  'burnermail.io',
  'inboxkitten.com',
]);

/**
 * Extracts normalized domain from an email address.
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1];
}

/**
 * Checks if the email belongs to a known disposable email provider.
 * PRD AUTH-7: Block disposable email domains at sign-up.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
