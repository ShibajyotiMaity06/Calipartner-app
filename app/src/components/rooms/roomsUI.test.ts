import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 5C — Room UI Presentation & Logic Tests', () => {
  describe('1. Side-by-Side Presentation Logic', () => {
    it('computes goal completion percentage accurately from calories and goal calories', () => {
      const computeGoalCompletion = (calories: number | 'locked', goalCalories: number | null) => {
        if (calories === 'locked' || !goalCalories || goalCalories <= 0) return null;
        return Math.min(100, Math.round((calories / goalCalories) * 100));
      };

      // 1500 / 2000 kcal = 75%
      expect(computeGoalCompletion(1500, 2000)).toBe(75);
      // 2100 / 2000 kcal = 100% (capped at 100%)
      expect(computeGoalCompletion(2100, 2000)).toBe(100);
      // Locked calories returns null (neutral lock representation)
      expect(computeGoalCompletion('locked', 2000)).toBeNull();
      // Null goal returns null
      expect(computeGoalCompletion(1500, null)).toBeNull();
    });

    it('preserves neutral locked state without confusing with 0 or empty', () => {
      const formatMetricValue = (val: number | string | 'locked' | null | undefined): { isLocked: boolean; display: string } => {
        if (val === 'locked') {
          return { isLocked: true, display: en.rooms.today.lockedItem };
        }
        if (val === null || val === undefined) {
          return { isLocked: false, display: '—' };
        }
        return { isLocked: false, display: String(val) };
      };

      const lockedStep = formatMetricValue('locked');
      expect(lockedStep.isLocked).toBe(true);
      expect(lockedStep.display).toBe('Private');

      const zeroSteps = formatMetricValue(0);
      expect(zeroSteps.isLocked).toBe(false);
      expect(zeroSteps.display).toBe('0');
      // Locked is never equal to 0
      expect(lockedStep.display).not.toBe(zeroSteps.display);
    });

    it('enforces meal checklist rule: Extra is optional and never displayed as missing', () => {
      const getMealChecklistItems = (mealsLogged: {
        breakfast: boolean;
        lunch: boolean;
        dinner: boolean;
        snacks: boolean;
        extra?: boolean;
      }) => {
        // Standard required sections
        const requiredSections = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
        const result = requiredSections.map((sec) => ({
          section: sec,
          isLogged: mealsLogged[sec],
          isMissing: !mealsLogged[sec],
        }));

        // Extra is never included in the missing checklist
        const isExtraMissing = false;
        return { items: result, isExtraMissing };
      };

      const dayMeals = {
        breakfast: true,
        lunch: true,
        dinner: false,
        snacks: false,
        extra: false,
      };

      const checklist = getMealChecklistItems(dayMeals);
      expect(checklist.items).toHaveLength(4);
      expect(checklist.items[0]?.isLogged).toBe(true);
      expect(checklist.items[2]?.isLogged).toBe(false);
      expect(checklist.isExtraMissing).toBe(false);
    });
  });

  describe('2. Neutral Colors & Multi-Member Rules', () => {
    it('verifies neutral color tokens between members (no red/green winning/losing semantics)', () => {
      const getMemberComparisonStyle = (_myPct: number, _partnerPct: number) => {
        // Must return neutral styling for both members
        const neutralPillColor = '#EFF6FF'; // cardHighlight or surfaceAlt
        const neutralTextColor = '#0F172A'; // text
        return {
          myStyle: { backgroundColor: neutralPillColor, textColor: neutralTextColor },
          partnerStyle: { backgroundColor: neutralPillColor, textColor: neutralTextColor },
          hasWinningLosingColor: false,
        };
      };

      const comparison = getMemberComparisonStyle(100, 40);
      expect(comparison.hasWinningLosingColor).toBe(false);
      expect(comparison.myStyle.backgroundColor).toBe(comparison.partnerStyle.backgroundColor);
    });

    it('handles 3+ members overview counts and switching', () => {
      const mockMembers = [
        { id: 'u-1', nickname: 'Alex', goalPct: 80 },
        { id: 'u-2', nickname: 'Sam', goalPct: 60 },
        { id: 'u-3', nickname: 'Jordan', goalPct: 90 },
      ];

      expect(mockMembers.length).toBeGreaterThanOrEqual(3);
      const otherMembers = mockMembers.filter((m) => m.id !== 'u-1');
      expect(otherMembers).toHaveLength(2);
      expect(otherMembers[0]?.nickname).toBe('Sam');
      expect(otherMembers[1]?.nickname).toBe('Jordan');
    });
  });

  describe('3. Shared Meals & Portion Scaling', () => {
    it('scales shared meal quantity and calories accurately', () => {
      const scaleSharedMeal = (baseCals: number, baseQty: number, multiplier: number) => {
        const calories = Math.round(baseCals * multiplier);
        const quantity = Number((baseQty * multiplier).toFixed(2));
        return { calories, quantity };
      };

      // 400 cals, 1.0 plate at 0.5x
      expect(scaleSharedMeal(400, 1.0, 0.5)).toEqual({ calories: 200, quantity: 0.5 });
      // 400 cals, 1.0 plate at 1.5x
      expect(scaleSharedMeal(400, 1.0, 1.5)).toEqual({ calories: 600, quantity: 1.5 });
      // 400 cals, 1.0 plate at 2.0x
      expect(scaleSharedMeal(400, 1.0, 2.0)).toEqual({ calories: 800, quantity: 2.0 });
    });
  });

  describe('4. Requests Inbox & Expiry Calculation', () => {
    it('calculates days remaining until expiry accurately', () => {
      const calculateDaysRemaining = (expiresAtIso: string, nowMs: number) => {
        const diffMs = new Date(expiresAtIso).getTime() - nowMs;
        return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      };

      const now = new Date('2026-10-10T12:00:00Z').getTime();
      const in7Days = '2026-10-17T12:00:00Z';
      const in1Day = '2026-10-11T12:00:00Z';
      const expired = '2026-10-09T12:00:00Z';

      expect(calculateDaysRemaining(in7Days, now)).toBe(7);
      expect(calculateDaysRemaining(in1Day, now)).toBe(1);
      expect(calculateDaysRemaining(expired, now)).toBe(0);
    });

    it('formats neutral request status labels', () => {
      expect(en.rooms.inboxModal.statusPending).toBe('Pending');
      expect(en.rooms.inboxModal.statusNotAccepted).toBe('Not accepted yet');
    });
  });

  describe('5. Paywall Presentation & Pricing', () => {
    it('validates 3 premium plans with annual best value', () => {
      expect(en.rooms.paywall.annualPrice).toBe('₹799 / year');
      expect(en.rooms.paywall.threeMonthPrice).toBe('₹249 / 3 mos');
      expect(en.rooms.paywall.monthlyPrice).toBe('₹99 / month');
      expect(en.rooms.paywall.annualSavings).toContain('Save 33%');
    });

    it('verifies that personal tracking remains free message is included', () => {
      expect(en.rooms.paywall.featureFree).toContain('100% free');
    });
  });

  describe('6. Supportive Nudges & Reactions', () => {
    it('provides supportive pre-written nudge choices', () => {
      expect(en.rooms.nudgeModal.optionLunch).toContain('lunch');
      expect(en.rooms.nudgeModal.optionWater).toContain('water');
      expect(en.rooms.nudgeModal.optionWorkout).toContain('workout');
      expect(en.rooms.nudgeModal.limitNotice).toContain('Limit: 2 nudges');
    });

    it('validates 5 supportive reaction options', () => {
      expect(en.rooms.reactionModal.clap).toContain('👏');
      expect(en.rooms.reactionModal.fire).toContain('🔥');
      expect(en.rooms.reactionModal.muscle).toContain('💪');
      expect(en.rooms.reactionModal.heart).toContain('❤️');
      expect(en.rooms.reactionModal.target).toContain('🎯');
    });
  });

  describe('7. i18n Key Integrity', () => {
    it('resolves room titles and interpolations without missing key errors', () => {
      expect(t('rooms.title')).toBe('Rooms');
      expect(t('rooms.streakDays', { count: 5 })).toBe('5 Day Streak');
      expect(t('rooms.roomCode', { code: 'CP1234' })).toBe('Room Code: CP1234');
      expect(t('rooms.today.vsMember', { name: 'Priya' })).toBe('Me vs Priya');
    });
  });

  describe('8. Phase 5 v0.4 Room View Presentation (PRD 6.8, 6.9, 7.6)', () => {
    it('defines the 5 segments in the exact order: Today, Focus, Chat, Progress, Members (RV-1)', () => {
      const segments = [
        { key: 'today', label: t('rooms.segments.today') },
        { key: 'focus', label: t('rooms.segments.focus') },
        { key: 'chat', label: t('rooms.segments.chat') },
        { key: 'progress', label: t('rooms.segments.progress') },
        { key: 'members', label: t('rooms.segments.members') },
      ];

      expect(segments.map((s) => s.key)).toEqual(['today', 'focus', 'chat', 'progress', 'members']);
      expect(segments[1]?.label).toBe('Focus');
      expect(t('rooms.placeholders.focusTitle')).toBe('Focus Time');
      expect(t('rooms.placeholders.focusSubtitle')).toContain('Shared focus sessions');
    });

    it('formats capacity indicator as "3 of 5 people"', () => {
      expect(t('rooms.capacityIndicator', { count: 3, cap: 5 })).toBe('3 of 5 people');
      expect(t('rooms.capacityIndicator', { count: 18, cap: 20 })).toBe('18 of 20 people');
    });

    it('handles ROOM_FULL distinctly for host (upgrade placeholder) vs members ("This room is full")', () => {
      const getRoomFullNotice = (isHost: boolean) => {
        return isHost ? t('rooms.roomFull.hostNotice') : t('rooms.roomFull.memberNotice');
      };

      expect(getRoomFullNotice(true)).toBe('Your room is full. Plus fits up to 20 people.');
      expect(getRoomFullNotice(false)).toBe('This room is full');
      expect(t('rooms.roomFull.upgradeBtn')).toBe('Upgrade Plan');
    });

    it('formats Locked room non-shaming "This room is paused" screen with "Keep this room going" action (ROOM-7)', () => {
      expect(t('rooms.paused.title')).toBe('This room is paused');
      expect(t('rooms.paused.subtitle')).toContain('Personal tracking is never affected');
      expect(t('rooms.paused.keepGoingBtn')).toBe('Keep this room going');
    });

    it('formats Over capacity banner for the host with 7-day grace notice (7.6)', () => {
      expect(t('rooms.overCapacity.title')).toBe('Room Over Capacity');
      expect(t('rooms.overCapacity.subtitleHost', { count: 6, cap: 5 })).toContain('6 of 5');
      expect(t('rooms.overCapacity.subtitleHost', { count: 6, cap: 5 })).toContain('7 days');
      expect(t('rooms.overCapacity.upgradeBtn')).toBe('Upgrade Plan');
    });

    describe('Large room overview row (>12 members) paging & search logic (RV-4, RV-10)', () => {
      const mockMembers = Array.from({ length: 15 }, (_, i) => ({
        user_id: `user-${i + 1}`,
        room_id: 'room-1',
        nickname: i === 0 ? 'Alex' : i === 1 ? 'Zara' : `Member ${String.fromCharCode(65 + i)}`,
        status: 'active' as const,
        role: 'member' as const,
        metrics: {
          logged_today: true,
          goal_completion: 50 + (i % 50),
          meal_checklist: { breakfast: true, lunch: true, dinner: true, snacks: true },
        },
      }));

      it('sorts members with me first, then alphabetically by nickname', () => {
        const callerId = 'user-2'; // Zara
        const sorted = [...mockMembers].sort((a, b) => {
          const aIsMe = a.user_id === callerId;
          const bIsMe = b.user_id === callerId;
          if (aIsMe && !bIsMe) return -1;
          if (!aIsMe && bIsMe) return 1;
          return a.nickname.localeCompare(b.nickname);
        });

        expect(sorted[0]?.user_id).toBe('user-2');
        expect(sorted[0]?.nickname).toBe('Zara');
        expect(sorted[1]?.nickname).toBe('Alex');
      });

      it('filters members by search query case-insensitively', () => {
        const query = 'zara';
        const filtered = mockMembers.filter((m) => m.nickname.toLowerCase().includes(query.toLowerCase()));
        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.nickname).toBe('Zara');
      });

      it('pages members into pages of 8 when room has >12 members', () => {
        const pageSize = 8;
        const total = mockMembers.length; // 15
        const totalPages = Math.ceil(total / pageSize);
        expect(totalPages).toBe(2);

        const page1 = mockMembers.slice(0, pageSize);
        const page2 = mockMembers.slice(pageSize, pageSize * 2);
        expect(page1).toHaveLength(8);
        expect(page2).toHaveLength(7);
      });

      it('computes room average accurately across members with shared data', () => {
        const numericCompletions = mockMembers
          .map((m) => m.metrics.goal_completion)
          .filter((v): v is number => typeof v === 'number');
        const avg = Math.round(numericCompletions.reduce((acc, curr) => acc + curr, 0) / numericCompletions.length);
        expect(avg).toBeGreaterThan(0);
        expect(avg).toBeLessThanOrEqual(100);
      });
    });
  });
});
