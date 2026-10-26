import { getLocalDateString } from './focus';
import { addDaysToDateString } from './trackers';

/** UTC instants delimiting a calendar day in the stored user time zone (DST safe). */
export function getLocalDayBounds(localDate: string, timeZone: string): { start: Date; end: Date } {
  const nominal = Date.parse(`${localDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 10) !== localDate
  )
    throw new Error('INVALID_LOCAL_DATE');
  new Intl.DateTimeFormat('en', { timeZone }); // Reject invalid zones instead of changing the day.
  const boundary = (key: string, center: number) => {
    let low = center - 36 * 3600000;
    let high = center + 36 * 3600000;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (getLocalDateString(new Date(mid), timeZone) < key) low = mid;
      else high = mid;
    }
    return new Date(high);
  };
  const start = boundary(localDate, nominal);
  const end = boundary(addDaysToDateString(localDate, 1), nominal + 86400000);
  if (getLocalDateString(start, timeZone) !== localDate) throw new Error('INVALID_LOCAL_DATE');
  return { start, end };
}

export function getCalendarWeek(localDate: string): string[] {
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  const monday = addDaysToDateString(localDate, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(monday, index));
}

export function formatCalendarDate(localDate: string): string {
  return new Date(`${localDate}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
