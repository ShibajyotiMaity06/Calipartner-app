import type { WeightLog } from './types';

export function isValidWeightDate(date: string, today: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date &&
    date <= today
  );
}

/** One actual weigh-in per seven-day window, anchored to today. Never invent missing weeks. */
export function weeklyWeightHistory(logs: WeightLog[], today: string): WeightLog[] {
  const cutoff = new Date(today + 'T00:00:00Z');
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
  const earliest = cutoff.toISOString().slice(0, 10);
  const byDate = [...logs]
    .filter((log) => !log.deleted_at && log.local_date <= today && log.local_date >= earliest)
    .sort(
      (a, b) => b.local_date.localeCompare(a.local_date) || b.logged_at.localeCompare(a.logged_at),
    );
  const result: WeightLog[] = [];
  const used = new Set<string>();
  for (let days = 0; days <= 1099; days += 7) {
    const anchor = new Date(today + 'T00:00:00Z');
    anchor.setUTCDate(anchor.getUTCDate() - days);
    const end = anchor.toISOString().slice(0, 10);
    anchor.setUTCDate(anchor.getUTCDate() - 6);
    const start = anchor.toISOString().slice(0, 10);
    const entry = byDate.find(
      (log) => log.local_date <= end && log.local_date >= start && !used.has(log.id),
    );
    if (entry) {
      result.push(entry);
      used.add(entry.id);
    }
    if (start < earliest) break;
  }
  return result;
}

export function weightChange(currentKg: number | null, baselineKg: number | null) {
  return currentKg == null || baselineKg == null
    ? null
    : Math.round((currentKg - baselineKg) * 100) / 100;
}
