import { getPreviousDateString } from './progress';

/** Resolve the caller's requested diary window without allowing a future or unbounded read. */
export function coachHistoryWindow(today: string, question: string) {
  const dates = [...question.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)]
    .map((match) => match[1]!)
    .filter((date) => {
      const parsed = new Date(date + 'T12:00:00Z');
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date &&
        date <= today
      );
    })
    .sort();
  if (dates.length) {
    const end = dates.at(-1)!;
    const earliest = getPreviousDateString(end, 89);
    return { start: dates[0]! < earliest ? earliest : dates[0]!, end };
  }
  if (/\byesterday\b/i.test(question)) {
    const date = getPreviousDateString(today, 1);
    return { start: date, end: date };
  }
  const days = /\b(90|three months|3 months)\b/i.test(question)
    ? 90
    : /\b(week|7 days)\b/i.test(question)
      ? 7
      : /\b(month|30 days)\b/i.test(question)
        ? 30
        : 7;
  return { start: getPreviousDateString(today, days - 1), end: today };
}
