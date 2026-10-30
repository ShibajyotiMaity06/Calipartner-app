import type { DiaryDaySummary, RoomMemberSnapshot } from './types';
import { evaluateLoggedDay } from './progress';

/** Only the caller's local diary may overlay the server's privacy-filtered room snapshot. */
export function withLocalRoomDiary(
  member: RoomMemberSnapshot,
  callerId: string,
  diary: DiaryDaySummary,
  target: number,
): RoomMemberSnapshot {
  if (member.user_id !== callerId || !member.is_self || !diary.totals.entryCount) return member;
  return {
    ...member,
    metrics: {
      ...member.metrics,
      calories: diary.totals.calories,
      macros: {
        protein: diary.totals.protein,
        carbs: diary.totals.carbs,
        fat: diary.totals.fat,
        fiber: diary.totals.fiber,
      },
      goal_completion:
        target > 0
          ? Math.round((diary.totals.calories / target) * 100)
          : member.metrics.goal_completion,
      logged_today:
        target > 0
          ? evaluateLoggedDay(diary.totals.entryCount, diary.totals.calories, target)
          : member.metrics.logged_today,
      meal_checklist: Object.fromEntries(
        Object.entries(diary.sections).map(([key, value]) => [key, value.count > 0]),
      ),
    },
  };
}
