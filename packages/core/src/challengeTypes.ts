import type {
  ChallengeDayResult,
  ChallengeFormat,
  ChallengeMetric,
  ChallengeRules,
} from './challengeEngine';
export interface ChallengeBenefits {
  solo_limit: number;
  pair_limit: number;
  room_limit: number;
  season_limit: number;
  duration_max: number;
  custom: boolean;
  forfeits: boolean;
  shield_max: number;
  pause_max: number;
  cover_max: number;
}
export interface ChallengeTemplate {
  id: string;
  slug: string;
  format: ChallengeFormat;
  tasks: ChallengeMetric[];
  scope_options: string[];
  duration_options: number[];
  rule_overrides: Partial<ChallengeRules>;
  plan_required: string;
  season_id: string | null;
  icon_key: string;
  title_key: string;
  desc_key: string;
  allow_manual: boolean;
  chapters: Array<{ day: number; text_key: string }>;
  version: number;
  joined_count: number;
  completed_count: number;
  state?: 'open' | 'upcoming' | 'ended';
  starts_in?: number;
  public_count?: number | null;
}
export interface ChallengeConfig {
  plans: Record<string, ChallengeBenefits>;
  rules: Omit<
    ChallengeRules,
    | 'format'
    | 'tasks'
    | 'duration_days'
    | 'pass_days'
    | 'weekly_days'
    | 'shield_max'
    | 'pause_max'
    | 'cover_max'
    | 'allow_manual'
  >;
  history_days: number;
  invite_expiry_hours: number;
  max_start_delay_days: number;
  min_public_count: number;
  creation_hourly_limit: number;
  action_hourly_limit: number;
  nudge_daily_limit: number;
  adjust_first_days: number;
  board_bands: number;
  board_limit: number;
  worker_batch: number;
  poll_seconds: number;
  occasion_max_days: number;
  occasion_event_types: string[];
  event_week_days: number;
  event_week_factor: number;
  recovery_days: number;
  checklist_min: number;
  checklist_max: number;
  title_max_length: number;
  rest_weekday_options: string[];
}
export interface ChallengeSeason {
  id: string;
  slug: string;
  name_key: string;
  starts_at: string;
  ends_at: string;
  visible_from: string;
  sort: number;
}
export interface ChallengeCatalog {
  now: string;
  plan: string;
  limits: ChallengeBenefits;
  config: ChallengeConfig;
  texts: Record<string, { en: string; hi?: string | null }>;
  templates: ChallengeTemplate[];
  seasons: ChallengeSeason[];
  forfeits: Array<{ id: string; text_key: string }>;
  badges: Array<{
    id: string;
    text_key: string;
    icon_key: string;
    earned: number;
    plan_required: string;
  }>;
  screened: boolean;
  partners: Array<{ id: string; nickname: string; username: string; avatar_url: string | null }>;
  rooms: Array<{ id: string; name: string; host: boolean; count: number; member_ids: string[] }>;
}
export interface ChallengeSummary {
  percent: number;
  today_percent: number;
  passed: number;
  eligible: number;
  longest_streak: number;
  shields: number;
  outcome: string;
  day: number;
  verified_days: number;
  public_percent: number;
  scored_at: string;
  today_tasks: ChallengeDayResult['tasks'];
  chapters: string[];
}
export interface ChallengeParticipantView {
  id: string | null;
  self: boolean;
  name: string | null;
  avatar_url: string | null;
  status: string;
  percent: number | 'locked';
  overall_percent: number | 'locked';
  summary: ChallengeSummary | null;
  days: Array<Partial<ChallengeDayResult>> | null;
}
export interface ChallengeSnapshot {
  now: string;
  today_date: string;
  challenge: {
    id: string;
    template_id: string;
    template_version: number;
    rules_snapshot: ChallengeRules & {
      title_key: string;
      desc_key: string;
      icon_key: string;
      season_id: string | null;
      chapters: Array<{ day: number; text_key: string }>;
    };
    scope: string;
    room_id: string | null;
    start_date: string | null;
    end_date: string | null;
    duration_days: number;
    status: string;
    custom_title: string | null;
    invite_expires_at: string;
    forfeit_id: string | null;
  };
  participants: ChallengeParticipantView[];
  self: {
    status: string;
    targets: Partial<Record<ChallengeMetric, number>>;
    benefits: ChallengeBenefits;
    start_date: string | null;
    tz: string;
    shields: number;
    pause_days_used: number;
    cover_used: number;
    target_adjusted: boolean;
    comparison_opt_out: boolean;
    board_opt_in: boolean;
    muted: boolean;
    notify_partner: boolean;
  };
  details_locked: boolean;
  day: number;
  team_percent: number | 'locked';
  forfeit_key: string | null;
  events: Array<{
    id: string;
    type: string;
    actor: string | null;
    at: string;
    params: Record<string, string>;
  }>;
  occasion: null | {
    event_type: string;
    event_date: string;
    private_plan: Record<string, unknown> | null;
    milestones: Array<{
      week: number;
      date: string;
      habit_factor: number;
      status: string;
      weight: number | null;
    }>;
  };
}
export interface ChallengeHome {
  due?: Array<{
    id: string;
    metric: ChallengeMetric;
    value: number;
    target: number;
    percent: number;
    source: string;
  }>;
  catalog: ChallengeCatalog;
  items: ChallengeSnapshot[];
  reminders: string[];
}
export interface ChallengeCreateRequest {
  action: 'create';
  id: string;
  template_id: string;
  scope: string;
  duration: number;
  partners: string[];
  room_id?: string;
  title?: string;
  forfeit_id?: string;
  start_date?: string;
  targets?: Partial<Record<ChallengeMetric, number>>;
  tasks?: ChallengeMetric[];
  board_opt_in?: boolean;
  same_target?: boolean;
  rest_weekdays?: number[];
  allow_manual?: boolean;
}
export interface ChallengeOccasionRequest {
  action: 'occasion';
  id: string;
  template_id: string;
  partner_id: string;
  event_type: string;
  event_date: string;
  target_weight?: number;
  tasks?: ChallengeMetric[];
}
export type ChallengeMutation =
  | ChallengeCreateRequest
  | ChallengeOccasionRequest
  | { action: 'track'; request_id: string; event: string; id?: string }
  | { action: 'respond'; id: string; accept: boolean }
  | {
      action: 'social';
      id: string;
      request_id: string;
      kind: string;
      target?: string;
      date?: string;
      value?: Record<string, unknown>;
    }
  | { action: 'remind'; template_id: string; enabled: boolean }
  | { action: 'notify'; id: string; enabled: boolean };
