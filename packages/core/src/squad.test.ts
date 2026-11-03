import { describe, expect, it } from 'vitest';
import { rankSquadMembers, squadGoalCompletion, type SquadMember } from './squad';
const targets = { calories: 2000, protein: 100, carbs: 250, fat: 60 };
describe('squad goal completion', () => {
  it('averages all four goals, capping each before averaging', () => {
    expect(squadGoalCompletion({ calories: 3000, protein: 50, carbs: 125, fat: 30 }, targets)).toBe(
      62.5,
    );
    expect(
      squadGoalCompletion({ calories: 4000, protein: 200, carbs: 500, fat: 120 }, targets),
    ).toBe(100);
  });
  it('uses each person’s targets so cutting and bulking are comparable', () => {
    expect(squadGoalCompletion({ calories: 1000, protein: 50, carbs: 125, fat: 30 }, targets)).toBe(
      50,
    );
    expect(
      squadGoalCompletion(
        { calories: 1500, protein: 100, carbs: 200, fat: 45 },
        { calories: 3000, protein: 200, carbs: 400, fat: 90 },
      ),
    ).toBe(50);
  });
  it('leaves unknown goals unranked and rejects invalid data without treating it as zero', () => {
    expect(squadGoalCompletion(targets, null)).toBeNull();
    for (const value of [-1, NaN, Infinity])
      expect(squadGoalCompletion({ ...targets, protein: value }, targets)).toBeNull();
    expect(squadGoalCompletion(targets, { ...targets, calories: 0 })).toBeNull();
    expect(squadGoalCompletion({ ...targets, carbs: 0 }, { ...targets, carbs: 0 })).toBe(100);
  });
  it('shares tied ranks and keeps missing goals at the end without mutating input', () => {
    const members = [
      { user_id: 'b', ...targets, targets },
      { user_id: 'a', ...targets, targets },
      { user_id: 'c', ...targets, targets: null },
    ] as SquadMember[];
    const result = rankSquadMembers(members);
    expect(result.map((m) => [m.user_id, m.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', null],
    ]);
    expect(members[0]!.user_id).toBe('b');
  });
});
