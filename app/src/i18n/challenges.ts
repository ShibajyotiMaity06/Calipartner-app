import type { ChallengeCatalog } from '@calipartner/core';
import { getLocale, t } from './index';

import type { challengeMessages } from './challengeMessages';
export type ChallengeCopy = keyof typeof challengeMessages;
export function ct(key: ChallengeCopy, params?: Record<string, string | number>) {
  return t(`challengeHub.${key}`, params);
}
export function challengeText(catalog: ChallengeCatalog, key: string): string {
  const text = catalog.texts[key];
  return text?.[getLocale() as 'en' | 'hi'] ?? text?.en ?? ct('title');
}
export function challengeError(code: string): string {
  const keys: Record<string, ChallengeCopy> = {
    CHALLENGE_LIMIT: 'errorLimit',
    RATE_LIMITED: 'errorRate',
    ACCOUNT_CHANGED: 'errorAccount',
    PLUS_REQUIRED: 'upgrade',
    PRO_REQUIRED: 'upgrade',
    INVITE_EXPIRED: 'errorExpired',
    INVITE_UNAVAILABLE: 'errorExpired',
    INVALID_TARGET: 'errorTarget',
    INVALID_CHALLENGE_TARGET: 'errorTarget',
    USER_BLOCKED: 'errorBlocked',
    PARTNER_CONSENT_REQUIRED: 'errorBlocked',
    NETWORK_UNAVAILABLE: 'errorNetwork',
    NUDGE_LIMIT: 'errorNudge',
    CHEER_LIMIT: 'errorCheer',
    UNSAFE_OCCASION_TARGET: 'errorSafety',
    HEALTH_SCREENING_RESTRICTED: 'errorScreening',
    COVER_UNAVAILABLE: 'errorCover',
    PAUSE_LIMIT: 'errorPause',
    TARGET_ADJUSTMENT_CLOSED: 'errorAdjust',
    IDEMPOTENCY_CONFLICT: 'errorId',
  };
  return ct(keys[code] ?? 'error');
}
