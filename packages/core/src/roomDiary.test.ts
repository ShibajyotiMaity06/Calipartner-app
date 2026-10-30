import { describe, expect, it } from 'vitest';
import type { DiaryDaySummary, RoomMemberSnapshot } from './types';
import { withLocalRoomDiary } from './roomDiary';
const member = {
  user_id: 'self',
  is_self: true,
  metrics: { calories: 0, goal_completion: 0, steps: 1000, logged_today: false },
} as RoomMemberSnapshot;
const diary = {
  totals: { calories: 900, protein: 40, carbs: 100, fat: 30, fiber: 12, entryCount: 2 },
  sections: {
    breakfast: { count: 1 },
    lunch: { count: 1 },
    dinner: { count: 0 },
    snacks: { count: 0 },
    extra: { count: 0 },
  },
} as DiaryDaySummary;
describe('room self diary projection', () => {
  it('shows breakfast/lunch and their totals before sync without marking a completed day prematurely', () => {
    const result = withLocalRoomDiary(member, 'self', diary, 2000);
    expect(result.metrics).toMatchObject({
      calories: 900,
      goal_completion: 45,
      logged_today: false,
      steps: 1000,
      meal_checklist: { breakfast: true, lunch: true, dinner: false },
    });
    expect(
      withLocalRoomDiary(
        member,
        'self',
        { ...diary, totals: { ...diary.totals, calories: 1000 } },
        2000,
      ).metrics.logged_today,
    ).toBe(true);
  });
  it('never overlays another member’s privacy-filtered values or fabricates data from an empty local cache', () => {
    const peer = { ...member, user_id: 'peer', is_self: false };
    expect(withLocalRoomDiary(peer, 'self', diary, 2000)).toBe(peer);
    expect(withLocalRoomDiary(member, 'other-account', diary, 2000)).toBe(member);
    expect(
      withLocalRoomDiary(
        member,
        'self',
        { ...diary, totals: { ...diary.totals, entryCount: 0 } },
        2000,
      ),
    ).toBe(member);
  });
});
