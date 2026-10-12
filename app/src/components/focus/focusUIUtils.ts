/**
 * Helper utilities for Focus Time UI formatting and accessibility.
 */

/**
 * Formats seconds into MM:SS or HH:MM:SS string.
 */
export function formatTimeDigits(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);
  const seconds = safeSec % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours);
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Formats seconds into a human-readable screen reader announcement string.
 */
export function formatTimeAccessible(
  totalSeconds: number,
  isRemaining = false,
): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);
  const seconds = safeSec % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  }

  const durationText = parts.join(' and ');
  return isRemaining
    ? `${durationText} remaining`
    : `${durationText} elapsed`;
}

/**
 * Formats minutes into "Xh Ym" or "Ym".
 */
export function formatMinutesDisplay(minutes: number): string {
  const safeMin = Math.max(0, Math.round(minutes));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  return `${m}m`;
}
