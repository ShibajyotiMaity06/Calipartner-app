import { isIP } from 'node:net';
import { BILLING_COUNTRY_CODES } from '@calipartner/core';

/** Location is a billing routing hint, never proof of identity or entitlement. */
export async function detectBillingCountry(
  req: Request,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip || !isIP(ip)) throw new Error('BILLING_COUNTRY_REQUIRED');
  // One bounded retry absorbs temporary upstream/network failures without guessing a country.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const response = await fetcher(`https://api.country.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
        break;
      }
      const result = await response.json();
      if (typeof result.country !== 'string' || !BILLING_COUNTRY_CODES.includes(result.country))
        break;
      // Store only the country; do not persist or log the IP or provider payload.
      return result.country;
    } catch {
      if (attempt === 1) break;
    }
  }
  throw new Error('BILLING_COUNTRY_REQUIRED');
}
