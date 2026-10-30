import { getWeeklyRateCap, isBmiTooLowForCut } from './targets';
import type { ChallengeSummary } from './challengeTypes';

export const CHALLENGE_FORMATS = [
  'streak',
  'total',
  'weekly_rhythm',
  'checklist',
  'duel',
  'coop',
] as const;
export const CHALLENGE_METRICS = [
  'steps',
  'distance',
  'workouts_count',
  'workout_minutes',
  'food_log_days',
  'protein_in_range',
  'water_ml',
  'weigh_in_days',
  'partner_actions',
] as const;
export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];
export type ChallengeDayStatus =
  'pass' | 'partial' | 'miss' | 'shield' | 'covered' | 'paused' | 'rest' | 'pending' | 'upcoming';
export interface ChallengeMetricConfig {
  min: number;
  max: number;
  plausible_max: number;
  fallback: Record<string, number>;
}
export interface ChallengeRules {
  format: ChallengeFormat;
  tasks: ChallengeMetric[];
  duration_days: number;
  pass_days: number;
  weekly_days: number;
  rest_weekdays: number[];
  daily_cap_pct: number;
  finalize_delay_hours: number;
  minimum_meals: number;
  protein_min_pct: number;
  protein_max_pct: number;
  shield_every: number;
  shield_max: number;
  pause_max: number;
  cover_max: number;
  allow_manual: boolean;
  stretch_pct: number;
  min_history_days: number;
  target_adjust_pct: number;
  metrics: Record<ChallengeMetric, ChallengeMetricConfig>;
  event_date?: string;
  event_week_days?: number;
  event_week_factor?: number;
  recovery_days?: number;
}
export interface ChallengeSourceDay {
  local_date: string;
  values: Partial<Record<ChallengeMetric, number>>;
  sources: Partial<Record<ChallengeMetric, string>>;
}
export function challengeHistoryValues(
  history: ChallengeSourceDay[],
  metric: ChallengeMetric,
  rules: ChallengeRules,
): number[] {
  return history
    .filter((day) => {
      const value = day.values[metric];
      const source = day.sources[metric] ?? 'none';
      if (
        value === undefined ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > rules.metrics[metric].plausible_max ||
        (source === 'manual' && !rules.allow_manual)
      )
        return false;
      return value > 0 || (['steps', 'distance'].includes(metric) && source !== 'none');
    })
    .map((day) => day.values[metric]!);
}
export interface ChallengeDayResult {
  local_date: string;
  day_index: number;
  value: number;
  target: number;
  percent: number;
  status: ChallengeDayStatus;
  verified: boolean;
  finalized: boolean;
  tasks: Array<{
    metric: ChallengeMetric;
    value: number;
    target: number;
    percent: number;
    source: string;
  }>;
}
export function challengeLocalDate(now: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function challengeDateAdd(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function challengeDateDiff(first: string, second: string): number {
  return Math.round(
    (Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000,
  );
}
/** Resolve local midnight iteratively; elapsed-time arithmetic would break at DST boundaries. */
export function challengeMidnight(date: string, zone: string): number {
  const nominal = Date.parse(`${date}T00:00:00Z`);
  let guess = nominal;
  for (let iteration = 0; iteration < 4; iteration++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value]),
    );
    const rendered = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
    guess += nominal - rendered;
  }
  return guess;
}
export function personalChallengeTarget(
  history: number[],
  metric: ChallengeMetricConfig,
  activity: string,
  rules: Pick<ChallengeRules, 'stretch_pct' | 'min_history_days'>,
): { target: number; based_on_history: boolean } {
  const valid = history.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  const based = valid.length >= rules.min_history_days;
  const middle = Math.floor(valid.length / 2);
  const median = valid.length % 2 ? valid[middle]! : (valid[middle - 1]! + valid[middle]!) / 2;
  const baseline = based ? median : (metric.fallback[activity] ?? metric.fallback.default);
  if (!Number.isFinite(baseline)) throw new Error('INVALID_METRIC_CONFIG');
  return {
    target: Math.round(
      Math.max(
        metric.min,
        Math.min(metric.max, baseline! * (based ? 1 + rules.stretch_pct / 100 : 1)),
      ),
    ),
    based_on_history: based,
  };
}
export function evaluateChallengeDays(input: {
  rules: ChallengeRules;
  targets: Partial<Record<ChallengeMetric, number>>;
  start_date: string;
  tz: string;
  now: Date;
  source_days: ChallengeSourceDay[];
  existing?: ChallengeDayResult[];
  pauses?: string[];
  covered?: string[];
  cover_spent?: number;
}): {
  days: ChallengeDayResult[];
  percent: number;
  passed: number;
  eligible: number;
  longest_streak: number;
  shields: number;
  outcome: 'running' | 'completed' | 'finished';
  day: number;
} {
  const { rules } = input;
  if (
    !CHALLENGE_FORMATS.includes(rules.format) ||
    !rules.tasks.length ||
    rules.tasks.some((m) => !CHALLENGE_METRICS.includes(m)) ||
    rules.duration_days <= 0
  )
    throw new Error('INVALID_CHALLENGE_RULES');
  const today = challengeLocalDate(input.now, input.tz);
  const days: ChallengeDayResult[] = [];
  let shieldBalance = -(input.cover_spent ?? 0);
  let passes = 0;
  let streak = 0;
  let longest = 0;
  for (let index = 0; index < rules.duration_days; index++) {
    const date = challengeDateAdd(input.start_date, index);
    const frozen = input.existing?.find((day) => day.local_date === date && day.finalized);
    const raw = input.source_days.find((day) => day.local_date === date);
    const tasks = rules.tasks.map((metric) => {
      const source = raw?.sources[metric] ?? 'none';
      const value =
        rules.allow_manual || source !== 'manual'
          ? Math.max(0, Number(raw?.values[metric]) || 0)
          : 0;
      const baseTarget = input.targets[metric];
      const untilEvent = rules.event_date ? challengeDateDiff(date, rules.event_date) : null;
      const factor =
        untilEvent !== null &&
        untilEvent < (rules.event_week_days ?? 0) &&
        untilEvent >= -(rules.recovery_days ?? 0)
          ? (rules.event_week_factor ?? 1)
          : 1;
      const target =
        baseTarget === undefined
          ? undefined
          : Math.max(rules.metrics[metric].min, Math.round(baseTarget * factor));
      if (
        !target ||
        !Number.isFinite(target) ||
        target < rules.metrics[metric].min ||
        target > rules.metrics[metric].max
      )
        throw new Error('INVALID_CHALLENGE_TARGET');
      return {
        metric,
        value,
        target,
        percent: Math.min(rules.daily_cap_pct, (value / target) * 100),
        source,
      };
    });
    const percent = tasks.reduce((sum, task) => sum + task.percent, 0) / tasks.length;
    const finalized =
      input.now.getTime() >=
      challengeMidnight(challengeDateAdd(date, 1), input.tz) + rules.finalize_delay_hours * 3600000;
    let status: ChallengeDayStatus =
      date > today
        ? 'upcoming'
        : input.pauses?.includes(date)
          ? 'paused'
          : rules.rest_weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
            ? 'rest'
            : tasks.every((task) => task.percent >= 100)
              ? 'pass'
              : finalized
                ? 'miss'
                : date < today || !percent
                  ? 'pending'
                  : 'partial';
    if (status === 'miss' && input.covered?.includes(date)) status = 'covered';
    if (status === 'miss' && shieldBalance > 0) {
      status = 'shield';
      shieldBalance--;
    }
    const day: ChallengeDayResult = frozen ?? {
      local_date: date,
      day_index: index + 1,
      value: tasks.reduce((sum, task) => sum + Math.min(task.value, task.target), 0),
      target: tasks.reduce((sum, task) => sum + task.target, 0),
      percent,
      status,
      verified: tasks.every(
        (task) =>
          task.value <= rules.metrics[task.metric].plausible_max &&
          (rules.allow_manual || task.source !== 'manual'),
      ),
      finalized,
      tasks,
    };
    if (frozen?.status === 'shield') shieldBalance--;
    if (day.status === 'pass' && day.finalized) {
      passes++;
      if (rules.shield_every > 0 && passes % rules.shield_every === 0)
        shieldBalance = Math.min(rules.shield_max, shieldBalance + 1);
    }
    if (['pass', 'shield', 'covered'].includes(day.status)) {
      streak++;
      longest = Math.max(longest, streak);
    } else if (!['rest', 'paused'].includes(day.status)) streak = 0;
    days.push(day);
  }
  const eligible = days.filter((day) => !['rest', 'paused'].includes(day.status));
  const passed = eligible.filter((day) =>
    ['pass', 'shield', 'covered'].includes(day.status),
  ).length;
  const score = eligible.length
    ? eligible.reduce(
        (sum, day) => sum + (['shield', 'covered'].includes(day.status) ? 100 : day.percent),
        0,
      ) / eligible.length
    : 0;
  const ended = days.every((day) => day.finalized);
  let completed = passed >= Math.min(rules.pass_days, eligible.length) && eligible.length > 0;
  if (rules.format === 'total' || rules.format === 'coop')
    completed = eligible.length > 0 && score >= 100;
  if (rules.format === 'weekly_rhythm')
    completed =
      eligible.length > 0 &&
      Array.from({ length: Math.ceil(rules.duration_days / 7) }, (_, week) =>
        eligible.filter((day) => Math.floor((day.day_index - 1) / 7) === week),
      ).every(
        (week) =>
          week.filter((day) => ['pass', 'shield', 'covered'].includes(day.status)).length >=
          Math.min(rules.weekly_days, week.length),
      );
  return {
    days,
    percent: Math.min(100, score),
    passed,
    eligible: eligible.length,
    longest_streak: longest,
    shields: Math.max(0, shieldBalance),
    outcome: ended ? (completed ? 'completed' : 'finished') : 'running',
    day: Math.max(0, Math.min(rules.duration_days, challengeDateDiff(input.start_date, today) + 1)),
  };
}

export function challengeTeamScore(scores: number[]): number {
  return scores.length
    ? scores.reduce((sum, score) => sum + Math.max(0, Math.min(100, score)), 0) / scores.length
    : 0;
}
export function summarizeChallenge(input: {
  result: ReturnType<typeof evaluateChallengeDays>;
  rules: ChallengeRules & { chapters?: Array<{ day: number; text_key: string }> };
  benefits: { custom: boolean };
  now: Date;
  tz: string;
}): ChallengeSummary {
  const { result } = input;
  const today = challengeLocalDate(input.now, input.tz);
  const day = result.days.find((d) => d.local_date === today);
  const verified = result.days.filter(
    (d) => d.finalized && d.verified && !['paused', 'rest'].includes(d.status),
  );
  const settled = result.days.filter((d) => d.finalized && !['paused', 'rest'].includes(d.status));
  return {
    percent: result.percent,
    today_percent: day?.percent ?? 0,
    passed: result.passed,
    eligible: result.eligible,
    longest_streak: result.longest_streak,
    shields: result.shields,
    outcome: result.outcome,
    day: result.day,
    verified_days: verified.length,
    public_percent: settled.length
      ? (verified.filter((d) => d.status === 'pass').length / settled.length) * 100
      : 0,
    scored_at: input.now.toISOString(),
    today_tasks: day && !['paused', 'rest', 'upcoming'].includes(day.status) ? day.tasks : [],
    chapters: input.benefits.custom
      ? (input.rules.chapters ?? []).filter((c) => result.passed >= c.day).map((c) => c.text_key)
      : [],
  };
}
export function gentlerChallengeTargets(
  targets: Partial<Record<ChallengeMetric, number>>,
  rules: ChallengeRules,
) {
  return Object.fromEntries(
    rules.tasks.map((metric) => [
      metric,
      Math.max(
        rules.metrics[metric].min,
        Math.ceil(
          (targets[metric] ?? rules.metrics[metric].min) * (1 - rules.target_adjust_pct / 100),
        ),
      ),
    ]),
  ) as Partial<Record<ChallengeMetric, number>>;
}
export function safeOccasionMilestones(input: {
  current_weight: number;
  target_weight: number;
  height_cm: number;
  start_date: string;
  event_date: string;
  event_week_days: number;
  event_week_factor: number;
  screened: boolean;
}) {
  if (input.screened) throw new Error('HEALTH_SCREENING_RESTRICTED');
  const days = challengeDateDiff(input.start_date, input.event_date);
  if (
    !Number.isFinite(days) ||
    days <= 0 ||
    ![input.current_weight, input.target_weight, input.height_cm].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error('INVALID_OCCASION');
  const weeks = Math.ceil(days / 7);
  const change = input.target_weight - input.current_weight;
  if (
    change < 0 &&
    (isBmiTooLowForCut(input.current_weight, input.height_cm) ||
      isBmiTooLowForCut(input.target_weight, input.height_cm))
  )
    throw new Error('UNSAFE_OCCASION_TARGET');
  const cap = getWeeklyRateCap(input.current_weight);
  if (Math.abs(change) / (days / 7) > cap) throw new Error('UNSAFE_OCCASION_TARGET');
  return Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    date: challengeDateAdd(input.start_date, Math.min(days, (i + 1) * 7)),
    weight: input.current_weight + (change * Math.min(days, (i + 1) * 7)) / days,
    habit_factor: days - (i + 1) * 7 < input.event_week_days ? input.event_week_factor : 1,
  }));
}
