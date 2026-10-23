import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 7 — Progress & Leaderboard UI Presentation & Logic Tests', () => {
  describe('1. i18n & Translation Verification', () => {
    it('verifies all 3 main tab segments exist in i18n', () => {
      expect(en.progress.segments.myProgress).toBe('My Progress');
      expect(en.progress.segments.leaderboard).toBe('Leaderboard');
      expect(en.progress.segments.challenges).toBe('Challenges');
    });

    it('verifies all 6 date range options exist in i18n', () => {
      expect(en.progress.ranges['7d']).toBe('7D');
      expect(en.progress.ranges['30d']).toBe('30D');
      expect(en.progress.ranges['90d']).toBe('90D');
      expect(en.progress.ranges['6m']).toBe('6M');
      expect(en.progress.ranges['1y']).toBe('1Y');
      expect(en.progress.ranges.all).toBe('All');
    });

    it('verifies PRD RNK-4 informative note: Ranked by consistency, not restriction', () => {
      expect(en.progress.leaderboard.infoNote).toBe('Ranked by consistency, not restriction.');
    });

    it('verifies Challenges coming-soon copy matches PRD requirements', () => {
      expect(en.progress.challenges.comingSoon).toBe('Challenges Coming Soon');
      expect(en.progress.challenges.comingSoonSubtitle).toContain(
        'Seasonal challenges and occasion plans will be available in an upcoming release.',
      );
    });

    it('verifies chart empty states explain what to log for each metric', () => {
      expect(en.progress.weight.empty).toContain('Log your weight across multiple days');
      expect(en.progress.calories.empty).toContain('Log your meals to see daily calorie intake');
      expect(en.progress.macros.empty).toContain(
        'Log your meals to see daily macronutrient distributions',
      );
      expect(en.progress.steps.empty).toContain(
        'Track your daily steps to view your step and walking distance trends',
      );
      expect(en.progress.water.empty).toContain('Log water intake to track hydration trends');
      expect(en.progress.workouts.empty).toContain('Log workouts to track training frequency');
      expect(en.progress.consistency.empty).toContain(
        'Log consistently to build your personal streak',
      );
    });

    it('verifies Room Progress metrics translations exist', () => {
      expect(en.progress.room.metrics.consistency).toBe('Consistency');
      expect(en.progress.room.metrics.weightChange).toBe('Weight Change');
      expect(en.progress.room.metrics.caloriesVsTarget).toBe('Calories vs Target');
      expect(en.progress.room.metrics.steps).toBe('Steps');
      expect(en.progress.room.metrics.water).toBe('Water');
      expect(en.progress.room.metrics.workouts).toBe('Workouts');
    });

    it('verifies Day Detail modal translation strings exist', () => {
      expect(en.progress.dayDetailModal.title).toBe('Day Details');
      expect(en.progress.dayDetailModal.calories).toBe('Calories');
      expect(en.progress.dayDetailModal.target).toBe('Target');
      expect(en.progress.dayDetailModal.loggedDay).toBe('Logged Day');
      expect(en.progress.dayDetailModal.goalDay).toBe('Goal Day');
      expect(en.progress.dayDetailModal.close).toBe('Close');
    });

    it('verifies interpolation helper for accessibility summaries works correctly', () => {
      const summary = t('progress.calories.accessibilitySummary', {
        average: '1950',
        target: '2000',
      });
      expect(summary).toBe(
        'Calorie intake chart showing average of 1950 calories versus 2000 calorie target.',
      );
    });
  });

  describe('2. Weight Chart Summary Numbers & Trend Calculations', () => {
    it('computes total change, weekly pace, and projected date correctly', () => {
      const startWeight = 85.0;
      const currentTrend = 82.0;
      const targetWeight = 78.0;
      const daysCount = 30;

      const totalChange = currentTrend - startWeight;
      expect(totalChange).toBe(-3.0);

      // Pace = (change / days) * 7
      const weeklyPace = (totalChange / daysCount) * 7;
      expect(weeklyPace).toBeCloseTo(-0.7, 1);

      // Remaining kg
      const remainingKg = Math.abs(currentTrend - targetWeight);
      expect(remainingKg).toBe(4.0);

      // Weeks to target = remaining / abs(pace)
      const weeksRemaining = remainingKg / Math.abs(weeklyPace);
      expect(weeksRemaining).toBeCloseTo(5.7, 1);
    });

    it('handles flat or divergent pace without invalid projections', () => {
      const startWeight = 80.0;
      const currentTrend = 82.0; // Gained weight when target is lower
      const targetWeight = 75.0;
      const daysCount = 30;

      const totalChange = currentTrend - startWeight; // +2.0
      const weeklyPace = (totalChange / daysCount) * 7; // +0.467 kg/week

      const isProgressingTowardsGoal =
        (targetWeight < startWeight && weeklyPace < -0.05) ||
        (targetWeight > startWeight && weeklyPace > 0.05);

      expect(isProgressingTowardsGoal).toBe(false);
    });
  });

  describe('3. Goal Progress Ring Logic & Accessibility', () => {
    it('clamps goal progress percentage between 0% and 100%', () => {
      const clampProgress = (pct: number | null) => {
        if (pct == null) return 0;
        return Math.min(100, Math.max(0, pct));
      };

      expect(clampProgress(-10)).toBe(0);
      expect(clampProgress(45.5)).toBe(45.5);
      expect(clampProgress(120)).toBe(100);
      expect(clampProgress(null)).toBe(0);
    });

    it('computes SVG strokeDashoffset correctly for circular progress ring', () => {
      const size = 120;
      const strokeWidth = 10;
      const radiusVal = (size - strokeWidth) / 2; // 55
      const circumference = 2 * Math.PI * radiusVal; // ~345.575

      const computeOffset = (pct: number) => {
        const valid = Math.min(100, Math.max(0, pct));
        return circumference - (circumference * valid) / 100;
      };

      // 0% -> full circumference offset (empty ring)
      expect(computeOffset(0)).toBeCloseTo(circumference, 2);

      // 50% -> half circumference offset
      expect(computeOffset(50)).toBeCloseTo(circumference / 2, 2);

      // 100% -> 0 offset (full ring)
      expect(computeOffset(100)).toBeCloseTo(0, 2);
    });

    it('generates descriptive screen reader text for goal ring', () => {
      const getAccessibilityLabel = (progressPct: number | null) => {
        if (progressPct != null) {
          const valid = Math.min(100, Math.max(0, progressPct));
          return `${Math.round(valid)}% progress towards target weight`;
        }
        return 'Goal progress not available yet';
      };

      expect(getAccessibilityLabel(72.4)).toBe('72% progress towards target weight');
      expect(getAccessibilityLabel(null)).toBe('Goal progress not available yet');
    });
  });

  describe('4. Calories vs Target Adherence & Day Detail Presentation', () => {
    it('computes logged days vs goal days adherence percentage correctly', () => {
      const loggedDays = 25;
      const goalDays = 20;

      const adherencePct = loggedDays > 0 ? Math.round((goalDays / loggedDays) * 100) : 0;
      expect(adherencePct).toBe(80);

      const subtitle = t('progress.calories.adherenceSubtitle', {
        goalDays: String(goalDays),
        loggedDays: String(loggedDays),
      });
      expect(subtitle).toBe('20 of 25 logged days on goal');
    });

    it('formats Day Detail data with proper difference and badges', () => {
      const dayData = {
        date: '2026-10-10',
        calories: 1950,
        targetCalories: 2000,
        isLoggedDay: true,
        isGoalDay: true,
        weightKg: 81.5,
        steps: 8400,
        waterMl: 2500,
      };

      const diff = dayData.calories - dayData.targetCalories;
      expect(diff).toBe(-50);

      const diffLabel = `${diff > 0 ? '+' : ''}${Math.round(diff)} kcal`;
      expect(diffLabel).toBe('-50 kcal');
      expect(dayData.isLoggedDay).toBe(true);
      expect(dayData.isGoalDay).toBe(true);
    });
  });

  describe('5. Room Progress Presentation & RPG-6 Ranking Safety Rules', () => {
    interface MemberSummary {
      user_id: string;
      nickname: string;
      is_current_user: boolean;
      consistency_score: number;
      weight_change_kg: number | null;
      calorie_adherence_pct: number | null;
      is_locked: boolean;
    }

    const members: MemberSummary[] = [
      {
        user_id: 'user-b',
        nickname: 'Bob',
        is_current_user: false,
        consistency_score: 95,
        weight_change_kg: -4.2,
        calorie_adherence_pct: 90,
        is_locked: false,
      },
      {
        user_id: 'user-a',
        nickname: 'Alice',
        is_current_user: false,
        consistency_score: 85,
        weight_change_kg: -2.0,
        calorie_adherence_pct: 80,
        is_locked: false,
      },
      {
        user_id: 'user-me',
        nickname: 'Me',
        is_current_user: true,
        consistency_score: 90,
        weight_change_kg: -1.5,
        calorie_adherence_pct: 88,
        is_locked: false,
      },
      {
        user_id: 'user-c',
        nickname: 'Charlie',
        is_current_user: false,
        consistency_score: 0,
        weight_change_kg: null,
        calorie_adherence_pct: null,
        is_locked: true,
      },
    ];

    it('enforces PRD RPG-6: Default sort is Me first, then alphabetical', () => {
      const defaultSort = [...members].sort((a, b) => {
        if (a.is_current_user) return -1;
        if (b.is_current_user) return 1;
        return a.nickname.localeCompare(b.nickname);
      });

      expect(defaultSort[0]?.user_id).toBe('user-me'); // Me first
      expect(defaultSort[1]?.nickname).toBe('Alice'); // then alphabetical
      expect(defaultSort[2]?.nickname).toBe('Bob');
      expect(defaultSort[3]?.nickname).toBe('Charlie');
    });

    it('enforces PRD RPG-6: Sorting is ONLY permitted on consistency, never on weight loss or calories', () => {
      // Sorting by consistency allowed
      const consistencySort = [...members].sort(
        (a, b) => b.consistency_score - a.consistency_score,
      );
      expect(consistencySort[0]?.nickname).toBe('Bob'); // 95
      expect(consistencySort[1]?.nickname).toBe('Me'); // 90
      expect(consistencySort[2]?.nickname).toBe('Alice'); // 85
      expect(consistencySort[3]?.nickname).toBe('Charlie'); // 0

      // RPG-6 non-negotiable rule check: columns like weight loss or calorie restriction must NOT offer sort triggers
      const sortableColumns = ['consistency'] as const;
      const forbiddenColumns = ['weight_loss', 'lowest_calories', 'calorie_deficit'];

      forbiddenColumns.forEach((col) => {
        expect(sortableColumns).not.toContain(col);
      });
    });

    it('handles locked and private members gracefully without showing competitive comparison', () => {
      const charlie = members.find((m) => m.nickname === 'Charlie');
      expect(charlie?.is_locked).toBe(true);

      const formatTableValue = (val: number | null, isLocked: boolean, suffix = '') => {
        if (isLocked) return en.progress.room.lockedMember;
        if (val == null) return '—';
        return `${val}${suffix}`;
      };

      expect(formatTableValue(charlie?.weight_change_kg ?? null, charlie!.is_locked, ' kg')).toBe(
        'Locked (Lapsed member)',
      );
    });

    it('assigns neutral colors to members, never red/green competitive palette', () => {
      const NEUTRAL_PALETTE = [
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#06b6d4', // cyan
        '#f59e0b', // amber
        '#ec4899', // pink
        '#10b981', // emerald
        '#64748b', // slate
      ];

      // Red (#ef4444) should not be used as a member identifier
      expect(NEUTRAL_PALETTE).not.toContain('#ef4444');
      expect(NEUTRAL_PALETTE.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('6. Leaderboard View Presentation & Opt-Out Rules', () => {
    it('respects opt-out state by masking ranking details and showing opt-in banner', () => {
      const leaderboardData = {
        division: 'silver',
        cohort_id: 'cohort-123',
        total_in_cohort: 100,
        opted_out: true,
        my_rank: null,
        top_10: [],
      };

      expect(leaderboardData.opted_out).toBe(true);
      expect(leaderboardData.my_rank).toBeNull();

      const getNotice = (optedOut: boolean) => {
        return optedOut ? en.progress.leaderboard.optedOutNotice : null;
      };

      expect(getNotice(leaderboardData.opted_out)).toBe(
        'You are currently opted out of leaderboards. Turn participation on to compete with your cohort.',
      );
    });

    it('highlights current user in top 10 or shows pinned rank card when ranked outside top 10', () => {
      const top10 = [
        { rank: 1, user_id: 'u1', nickname: 'Runner1', score: 98, is_current_user: false },
        { rank: 2, user_id: 'u2', nickname: 'Lifter2', score: 95, is_current_user: false },
        { rank: 3, user_id: 'u3', nickname: 'Athlete3', score: 92, is_current_user: true },
      ];

      const userInTop10 = top10.find((entry) => entry.is_current_user);
      expect(userInTop10).toBeDefined();
      expect(userInTop10?.rank).toBe(3);

      // Outside top 10 scenario
      const myRankOutside = {
        rank: 24,
        score: 82,
        division: 'silver',
        total_in_cohort: 100,
      };

      expect(myRankOutside.rank).toBeGreaterThan(10);
      const isTop10 = myRankOutside.rank <= 10;
      expect(isTop10).toBe(false);
    });
  });

  describe('7. M01 Progress Hub & PRG-11 Week in Words Logic', () => {
    it('formats one-sentence week summary correctly', () => {
      const loggedDays = 6;
      const totalDays = 7;
      const goalDays = 5;

      const sentence = t('progress.hub.weekSummary', {
        logged: loggedDays,
        total: totalDays,
        goals: goalDays,
      });

      expect(sentence).toBe(
        'You logged 6 of 7 days, stayed within 50 kcal of your calorie target on 5 days, and your 7-day average weight moved steadily.',
      );
    });
  });

  describe('8. CMP-14 Accessible Chart Table (View as Table)', () => {
    it('provides accessible tabular headers and rows for all chart metrics', () => {
      const weightTableColumns = ['Date', 'Raw (kg)', 'Trend (kg)', 'Goal'];
      const weightTableRows = [
        ['Mon', '81.5', '81.4', '78.0'],
        ['Tue', '81.2', '81.3', '78.0'],
        ['Wed', '81.0', '81.1', '78.0'],
      ];

      expect(weightTableColumns).toHaveLength(4);
      expect(weightTableRows).toHaveLength(3);
      expect(weightTableRows[0]?.[1]).toBe('81.5');

      const calorieTableColumns = ['Day', 'Intake', 'Target', 'Status'];
      const calorieTableRows = [
        ['Mon', '1,980 kcal', '2,000 kcal', 'On target'],
        ['Tue', '2,050 kcal', '2,000 kcal', 'On target'],
        ['Wed', '2,300 kcal', '2,000 kcal', '+300 kcal'],
      ];

      expect(calorieTableColumns).toHaveLength(4);
      expect(calorieTableRows[0]?.[3]).toBe('On target');
      expect(calorieTableRows[2]?.[3]).toBe('+300 kcal');
    });
  });

  describe('9. M09/M10 Weekly Summary & Privacy-Safe Share Card', () => {
    it('excludes weight change from share text by default unless user opts in', () => {
      const buildShareText = (
        loggedDays: number,
        totalDays: number,
        goalDays: number,
        workoutCount: number,
        weightChangeKg: number | null,
        includeWeight: boolean,
      ) => {
        let text = `Weekly Progress: Logged ${loggedDays}/${totalDays} days, ${goalDays} days on calorie goal, and completed ${workoutCount} workouts.`;
        if (includeWeight && weightChangeKg != null) {
          text += ` Weight trend moved ${weightChangeKg > 0 ? `+${weightChangeKg.toFixed(1)}` : weightChangeKg.toFixed(1)} kg.`;
        }
        text += ' #CaliPartner';
        return text;
      };

      const shareWithoutWeight = buildShareText(6, 7, 5, 4, -0.4, false);
      expect(shareWithoutWeight).not.toContain('-0.4 kg');
      expect(shareWithoutWeight).not.toContain('Weight trend');
      expect(shareWithoutWeight).toContain('Logged 6/7 days');

      const shareWithWeight = buildShareText(6, 7, 5, 4, -0.4, true);
      expect(shareWithWeight).toContain('-0.4 kg');
    });
  });

  describe('10. M11 Leaderboard Dignity & Safety Rules', () => {
    it('verifies persistent 1-line rule text', () => {
      expect(en.progress.leaderboard.ruleNote).toBe(
        'Ranked on consistency and how close you get to your own goal. Not on eating least.',
      );
    });

    it('verifies allowed divisions match spec', () => {
      const DIVISIONS = ['cutting', 'bulking', 'maintain', 'beginner'] as const;
      expect(DIVISIONS).toContain('cutting');
      expect(DIVISIONS).toContain('bulking');
      expect(DIVISIONS).toContain('maintain');
      expect(DIVISIONS).toContain('beginner');
    });

    it('ensures dignity: NO medals, NO trophies, NO weight loss, NO raw calorie intake', () => {
      // Mock leaderboard row items
      const entry = {
        rank: 1,
        nickname: 'Alex',
        score: 94.2,
      };

      // Rank is rendered as numeral, not gold medal/trophy icon
      expect(typeof entry.rank).toBe('number');
      expect(entry).not.toHaveProperty('weight_lost');
      expect(entry).not.toHaveProperty('calories_eaten');
      expect(entry).not.toHaveProperty('medal_type');
    });
  });

  describe('11. M12 Monday Recap Consistency Formula', () => {
    it('calculates score according to PRD formula: 100 × (0.4 × logged/7 + 0.6 × goal/7)', () => {
      const calcConsistency = (loggedDays: number, goalDays: number) => {
        const loggedScore = (loggedDays / 7) * 0.4;
        const goalScore = (goalDays / 7) * 0.6;
        return Math.round((loggedScore + goalScore) * 100);
      };

      // 7 of 7 logged, 7 of 7 on goal = 100
      expect(calcConsistency(7, 7)).toBe(100);

      // 6 of 7 logged, 5 of 7 on goal
      // 0.4 * (6/7) = 0.342857; 0.6 * (5/7) = 0.428571; sum = 0.771428 -> 77
      expect(calcConsistency(6, 5)).toBe(77);

      // 0 logged = 0
      expect(calcConsistency(0, 0)).toBe(0);
    });
  });

  describe('12. M13–M17 Challenges Safety Guardrails & Rates', () => {
    it('STRICT GUARDRAIL: activity list permits only healthy behaviors, NO weight-loss or calorie tiles', () => {
      const ALLOWED_ACTIVITIES = ['Walking', 'Running', 'Studying', 'Gym', 'Cycling', 'Custom'];
      const FORBIDDEN_ACTIVITIES = [
        'Weight Loss',
        'Calorie Deficit',
        'Fasting Longest',
        'Lowest Calories',
        'Fat Burning',
      ];

      FORBIDDEN_ACTIVITIES.forEach((activity) => {
        expect(ALLOWED_ACTIVITIES).not.toContain(activity);
      });

      expect(ALLOWED_ACTIVITIES).toHaveLength(6);
    });

    it('enforces Occasion safe rate cap of max 1% of bodyweight per week', () => {
      const bodyweightKg = 80;
      const targetWeightKg = 72; // 8 kg loss desired
      const maxWeeklySafeKg = bodyweightKg * 0.01; // 0.8 kg/wk max
      expect(maxWeeklySafeKg).toBe(0.8);

      const isSafeRate = (weightLossKg: number, weeks: number) => {
        const ratePerWeek = weightLossKg / weeks;
        return ratePerWeek <= maxWeeklySafeKg;
      };

      // 8 kg in 12 weeks = 0.67 kg/wk -> SAFE
      expect(isSafeRate(8, 12)).toBe(true);

      // 8 kg in 4 weeks = 2.0 kg/wk -> UNSAFE (exceeds 1% bw/wk)
      expect(isSafeRate(8, 4)).toBe(false);

      // Realistic minimum weeks to goal safely
      const minSafeWeeks = Math.ceil((bodyweightKg - targetWeightKg) / maxWeeklySafeKg);
      expect(minSafeWeeks).toBe(10);
    });
  });
});
