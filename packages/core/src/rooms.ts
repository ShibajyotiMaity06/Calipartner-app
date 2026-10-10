import type {
  DailySummary,
  Entitlement,
  Goal,
  LockedMetric,
  Room,
  RoomMember,
  RoomMemberSnapshot,
  RoomMemberSnapshotMetrics,
  RoomPrivacySettings,
  RoomState,
  RoomTier,
} from './types';

export const DEFAULT_PRIVACY_SETTINGS: RoomPrivacySettings = Object.freeze({
  share_streak: true,
  share_goal_completion: true,
  share_steps: true,
  share_water: true,
  share_workouts: true,
  share_workout_details: false,
  share_calories_macros: false,
  share_meals: 'never',
  share_weight_number: false,
  share_weight_progress: false,
  share_fasting: false,
});

export function getDefaultPrivacySettings(): RoomPrivacySettings {
  return { ...DEFAULT_PRIVACY_SETTINGS };
}

export function sanitizePrivacySettings(
  input?: Partial<RoomPrivacySettings> | null,
): RoomPrivacySettings {
  if (!input) {
    return getDefaultPrivacySettings();
  }

  let meals: 'never' | 'per_meal' | 'always' = 'never';
  if (
    input.share_meals === 'per_meal' ||
    input.share_meals === 'always' ||
    input.share_meals === 'never'
  ) {
    meals = input.share_meals;
  }

  return {
    share_streak: input.share_streak ?? DEFAULT_PRIVACY_SETTINGS.share_streak,
    share_goal_completion:
      input.share_goal_completion ??
      DEFAULT_PRIVACY_SETTINGS.share_goal_completion,
    share_steps: input.share_steps ?? DEFAULT_PRIVACY_SETTINGS.share_steps,
    share_water: input.share_water ?? DEFAULT_PRIVACY_SETTINGS.share_water,
    share_workouts:
      input.share_workouts ?? DEFAULT_PRIVACY_SETTINGS.share_workouts,
    share_workout_details:
      input.share_workout_details ??
      DEFAULT_PRIVACY_SETTINGS.share_workout_details,
    share_calories_macros:
      input.share_calories_macros ??
      DEFAULT_PRIVACY_SETTINGS.share_calories_macros,
    share_meals: meals,
    share_weight_number:
      input.share_weight_number ??
      DEFAULT_PRIVACY_SETTINGS.share_weight_number,
    share_weight_progress:
      input.share_weight_progress ??
      DEFAULT_PRIVACY_SETTINGS.share_weight_progress,
    share_fasting:
      input.share_fasting ?? DEFAULT_PRIVACY_SETTINGS.share_fasting,
  };
}

export const ROOM_TIER_CAPS: Record<RoomTier, number> = Object.freeze({
  basic: 5,
  plus: 20,
  pro: 50,
  community: 100,
});

export function roomCap(tier?: RoomTier | null): number {
  if (!tier) return 5;
  return ROOM_TIER_CAPS[tier] ?? 5;
}

export function hasPlan(
  entitlement?: Entitlement | null,
  now: Date = new Date(),
): boolean {
  if (!entitlement) return false;
  if (entitlement.status !== 'paid' && entitlement.status !== 'grace') {
    return false;
  }
  if (!entitlement.period_end) return true;
  return new Date(entitlement.period_end) > now;
}

export function canCreateRoom(
  entitlement?: Entitlement | null,
  hostedActiveRoomCount = 0,
  now: Date = new Date(),
): boolean {
  if (!entitlement) return true; // new user eligible for trial
  if (hasPlan(entitlement, now)) {
    return hostedActiveRoomCount === 0;
  }
  if (entitlement.status === 'trial') {
    const active = entitlement.period_end
      ? new Date(entitlement.period_end) > now
      : true;
    return active && hostedActiveRoomCount === 0;
  }
  // Eligible if trial hasn't started yet
  return !entitlement.trial_started_at;
}

export function roomIsUsable(
  room: Pick<Room, 'state'>,
  planHolderEntitlement?: Entitlement | null,
  now: Date = new Date(),
): boolean {
  if (room.state === 'locked' || room.state === 'archived') {
    return false;
  }
  if (!planHolderEntitlement) return false;
  if (hasPlan(planHolderEntitlement, now)) return true;
  if (planHolderEntitlement.status === 'trial') {
    if (!planHolderEntitlement.period_end) return true;
    return new Date(planHolderEntitlement.period_end) > now;
  }
  return false;
}

/** @deprecated use hasPlan */
export function hasPremium(
  entitlement?: Entitlement | null,
  now: Date = new Date(),
): boolean {
  return hasPlan(entitlement, now);
}

/** @deprecated use roomIsUsable or canCreateRoom */
export function hasRoomAccess(
  entitlement?: Entitlement | null,
  now: Date = new Date(),
): boolean {
  if (!entitlement) return false;
  if (hasPlan(entitlement, now)) return true;
  if (entitlement.status === 'trial') {
    if (!entitlement.period_end) return true;
    return new Date(entitlement.period_end) > now;
  }
  return false;
}

export function isTrialEligible(
  entitlement?: Entitlement | null,
  deviceTrialOwnerId?: string | null,
  userId?: string,
): boolean {
  if (!userId) return false;
  if (entitlement && entitlement.trial_started_at) {
    return false;
  }
  if (deviceTrialOwnerId && deviceTrialOwnerId !== userId) {
    return false;
  }
  return true;
}

export interface EvaluateRoomStateParams {
  hasActivePlan: boolean;
  activeMemberCount: number;
  memberCap: number;
  dormantSince?: Date | null;
  overCapacitySince?: Date | null;
  lockedSince?: Date | null;
  now?: Date;
}

export function evaluateRoomState(
  paramsOrCount: EvaluateRoomStateParams | number,
  dormantSince?: Date | null,
  now: Date = new Date(),
): RoomState {
  if (typeof paramsOrCount === 'number') {
    const memberCount = paramsOrCount;
    if (memberCount >= 2) return 'active';
    if (dormantSince) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (now.getTime() - dormantSince.getTime() > thirtyDaysMs) {
        return 'archived';
      }
    }
    return 'dormant';
  }

  const p = paramsOrCount;
  const currentNow = p.now ?? now;

  if (!p.hasActivePlan) {
    if (p.lockedSince) {
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      if (currentNow.getTime() - p.lockedSince.getTime() > ninetyDaysMs) {
        return 'archived';
      }
    }
    return 'locked';
  }

  if (p.activeMemberCount > p.memberCap) {
    if (p.overCapacitySince) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (currentNow.getTime() - p.overCapacitySince.getTime() > sevenDaysMs) {
        return 'locked';
      }
    }
    return 'over_capacity';
  }

  if (p.activeMemberCount >= 2) {
    return 'active';
  }

  if (p.dormantSince) {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (currentNow.getTime() - p.dormantSince.getTime() > thirtyDaysMs) {
      return 'archived';
    }
  }
  return 'dormant';
}

export function evaluateLoggedDay(
  entryCount: number,
  calories: number,
  targetKcal: number,
): boolean {
  return entryCount >= 2 && calories >= 0.5 * targetKcal;
}

export function evaluateGoalDay(
  isLoggedDay: boolean,
  goal: Goal,
  calories: number,
  targetKcal: number,
): boolean {
  if (!isLoggedDay) return false;
  if (goal === 'cut') {
    return calories >= 0.85 * targetKcal && calories <= 1.05 * targetKcal;
  }
  if (goal === 'bulk') {
    return calories >= 0.95 * targetKcal && calories <= 1.15 * targetKcal;
  }
  // maintain
  return calories >= 0.9 * targetKcal && calories <= 1.1 * targetKcal;
}

const LOCKED: LockedMetric = 'locked';

export function maskMemberSnapshot(
  member: RoomMember,
  profile: { nickname: string; username: string; avatar_url: string | null },
  summary: DailySummary | null,
  mealChecklist: Record<string, boolean>,
  targetKcal: number,
  isSelf: boolean,
  isOverview = false,
): RoomMemberSnapshot {
  const calories = summary?.calories ?? 0;
  const goalCompletion =
    targetKcal > 0 ? Math.round((calories / targetKcal) * 1000) / 10 : 0;

  let metrics: RoomMemberSnapshotMetrics;

  if (isOverview && !isSelf) {
    const p = sanitizePrivacySettings(member.privacy_settings);
    metrics = {
      status: member.status,
      logged_today: p.share_streak ? (summary?.logged_day ?? false) : LOCKED,
      goal_completion: p.share_goal_completion ? goalCompletion : LOCKED,
      steps: p.share_steps ? (summary?.steps ?? 0) : LOCKED,
      water_ml: LOCKED,
      workout_status: p.share_workouts
        ? {
            worked_out: (summary?.workout_minutes ?? 0) > 0,
            duration_minutes: summary?.workout_minutes ?? 0,
          }
        : LOCKED,
      calories: LOCKED,
      macros: LOCKED,
      weight_kg: LOCKED,
      weight_progress: LOCKED,
      fasting_status: LOCKED,
      meal_checklist: LOCKED,
    };
  } else if (isSelf) {
    metrics = {
      status: member.status,
      logged_today: summary?.logged_day ?? false,
      goal_completion: goalCompletion,
      steps: summary?.steps ?? 0,
      water_ml: summary?.water_ml ?? 0,
      workout_status: {
        worked_out: (summary?.workout_minutes ?? 0) > 0,
        duration_minutes: summary?.workout_minutes ?? 0,
      },
      calories,
      macros: {
        protein: summary?.protein ?? 0,
        carbs: summary?.carbs ?? 0,
        fat: summary?.fat ?? 0,
      },
      weight_kg: summary?.weight_kg ?? null,
      weight_progress: 0,
      fasting_status: 'none',
      meal_checklist: { ...mealChecklist },
    };
  } else {
    const p = sanitizePrivacySettings(member.privacy_settings);

    metrics = {
      status: member.status,
      logged_today: p.share_streak ? (summary?.logged_day ?? false) : LOCKED,
      goal_completion: p.share_goal_completion ? goalCompletion : LOCKED,
      steps: p.share_steps ? (summary?.steps ?? 0) : LOCKED,
      water_ml: p.share_water ? (summary?.water_ml ?? 0) : LOCKED,
      workout_status: p.share_workouts
        ? {
            worked_out: (summary?.workout_minutes ?? 0) > 0,
            duration_minutes: summary?.workout_minutes ?? 0,
          }
        : LOCKED,
      calories: p.share_calories_macros ? calories : LOCKED,
      macros: p.share_calories_macros
        ? {
            protein: summary?.protein ?? 0,
            carbs: summary?.carbs ?? 0,
            fat: summary?.fat ?? 0,
          }
        : LOCKED,
      weight_kg: p.share_weight_number ? (summary?.weight_kg ?? null) : LOCKED,
      weight_progress: p.share_weight_progress ? 0 : LOCKED,
      fasting_status: p.share_fasting ? 'none' : LOCKED,
      meal_checklist: p.share_meals !== 'never' ? { ...mealChecklist } : LOCKED,
    };
  }

  return {
    user_id: member.user_id,
    username: profile.username,
    nickname: profile.nickname,
    avatar_url: profile.avatar_url,
    role: member.role,
    status: member.status,
    is_self: isSelf,
    metrics,
  };
}
