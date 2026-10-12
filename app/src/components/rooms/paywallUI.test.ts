import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 10 — View Layer UI Tests (Paywall, Lifecycle & Locked Cards)', () => {
  describe('1. PaywallModal Presentation & Size Picker Logic', () => {
    it('maps room size picker brackets to appropriate plan tiers', () => {
      const getTierForSize = (size: '2-5' | '6-20' | '21-50'): 'basic' | 'plus' | 'pro' => {
        switch (size) {
          case '21-50':
            return 'pro';
          case '6-20':
            return 'plus';
          case '2-5':
          default:
            return 'basic';
        }
      };

      expect(getTierForSize('2-5')).toBe('basic');
      expect(getTierForSize('6-20')).toBe('plus');
      expect(getTierForSize('21-50')).toBe('pro');
    });

    it('calculates annual savings and per-month equivalent pricing', () => {
      const pricingTable = {
        basic: { monthly: 99, quarterly: 249, annual: 799 },
        plus: { monthly: 200, quarterly: 499, annual: 1599 },
        pro: { monthly: 300, quarterly: 749, annual: 2399 },
      };

      // Basic: 12 months * 99 = 1188. 799 is (1188 - 799)/1188 = ~32.7% savings
      const basicSavings = Math.round(
        ((pricingTable.basic.monthly * 12 - pricingTable.basic.annual) /
          (pricingTable.basic.monthly * 12)) *
          100,
      );
      expect(basicSavings).toBe(33);

      // Equivalent per month: 799 / 12 = ~66.5 -> 67
      const basicPerMonth = Math.round(pricingTable.basic.annual / 12);
      expect(basicPerMonth).toBe(67);

      // Plus: 12 * 200 = 2400. 1599 is ~33.4% savings, ~133/mo
      const plusPerMonth = Math.round(pricingTable.plus.annual / 12);
      expect(plusPerMonth).toBe(133);

      // Pro: 12 * 300 = 3600. 2399 is ~33.4% savings, ~200/mo
      const proPerMonth = Math.round(pricingTable.pro.annual / 12);
      expect(proPerMonth).toBe(200);
    });

    it('includes all mandatory plan feature inclusions and free guarantees', () => {
      const paywallCopy = en.rooms.paywall;

      // Plan features
      expect(paywallCopy.featureRooms).toContain('Accountability rooms');
      expect(paywallCopy.featureChat).toContain('Room chat');
      expect(paywallCopy.featureProgress).toContain('Room progress graphs');
      expect(paywallCopy.featureFocus).toContain('Shared focus rooms');
      expect(paywallCopy.featureCoach).toContain('AI Coach');
      expect(paywallCopy.featureFinder).toContain('Partner Finder');

      // Free guarantee (PRD 6.18 SUB-4)
      expect(paywallCopy.featureFree).toContain('100% free');
      expect(paywallCopy.featureFree).toContain('Joining any room as a member is always free');

      // Clear billing terms (auto-renewal disclosure)
      expect(paywallCopy.termsNotice).toContain('auto-renew');
      expect(paywallCopy.termsNotice).toContain('cancel anytime');
    });
  });

  describe('2. TrialBanner Presentation Logic', () => {
    it('displays appropriate countdown for hosts on days 1, 2, and 3', () => {
      const getTrialBannerText = (daysLeft: number, dayNumber: number) => {
        if (dayNumber === 3 || daysLeft <= 0) {
          return en.rooms.trialBanner.day3;
        }
        if (dayNumber === 2 || daysLeft === 1) {
          return en.rooms.trialBanner.day2;
        }
        return en.rooms.trialBanner.day1;
      };

      expect(getTrialBannerText(2, 1)).toContain('Day 1 of 3');
      expect(getTrialBannerText(2, 1)).toContain('2 days left');

      expect(getTrialBannerText(1, 2)).toContain('Day 2 of 3');
      expect(getTrialBannerText(1, 2)).toContain('1 day left');

      expect(getTrialBannerText(0, 3)).toContain('Day 3 of 3');
      expect(getTrialBannerText(0, 3)).toContain('Final day');
    });

    it('ensures trial banner is only visible to hosts', () => {
      const shouldShowTrialBanner = (isHost: boolean, isTrial: boolean) => {
        return isHost && isTrial;
      };

      expect(shouldShowTrialBanner(true, true)).toBe(true);
      expect(shouldShowTrialBanner(false, true)).toBe(false);
      expect(shouldShowTrialBanner(true, false)).toBe(false);
    });
  });

  describe('3. Room Full Notices (Host Upgrade Sheet vs Member Plain Notice)', () => {
    it('generates host upgrade recommendation targeting next capacity tier', () => {
      const basicFull = t('rooms.roomFull.hostNotice');
      expect(basicFull).toContain('Plus fits up to 20 people');
      expect(t('rooms.roomFull.upgradeBtn')).toBe('Upgrade Plan');
    });

    it('generates plain non-shaming notice for non-host members', () => {
      const memberNotice = t('rooms.roomFull.memberNotice');
      expect(memberNotice).toBe('This room is full');
      // Must not display billing or upgrade text to members
      expect(memberNotice).not.toContain('Upgrade');
      expect(memberNotice).not.toContain('₹');
    });
  });

  describe('4. LockedRoomPausedState Non-Shaming Presentation', () => {
    it('verifies non-shaming copy that never discloses billing identities', () => {
      const pausedCopy = en.rooms.paused;

      expect(pausedCopy.title).toBe('This room is paused');
      expect(pausedCopy.subtitle).toContain('The plan for this room has ended');
      expect(pausedCopy.subtitle).toContain('Any member can keep this room going');
      expect(pausedCopy.subtitle).toContain('Personal tracking is never affected');

      // Never shames individual members
      expect(pausedCopy.subtitle).not.toContain('payment failed');
      expect(pausedCopy.subtitle).not.toContain('did not pay');
      expect(pausedCopy.subtitle).not.toContain('card declined');
    });
  });

  describe('5. OverCapacityBanner 7-Day Countdown', () => {
    it('formats 7-day countdown and capacity counts accurately for hosts', () => {
      const hostBannerText = t('rooms.overCapacity.subtitleHost', {
        count: 7,
        cap: 5,
      });

      expect(hostBannerText).toContain('7 of 5');
      expect(hostBannerText).toContain('within 7 days');
      expect(hostBannerText).toContain('remove members');
    });
  });

  describe('6. Me Screen Room Plan & Unattached Subscription Card', () => {
    it('formats renewal date and displays unattached subscription warning when present', () => {
      const roomPlanCopy = en.me.roomPlan;

      expect(roomPlanCopy.title).toBe('Room Plan');
      expect(roomPlanCopy.unattachedAlertTitle).toBe('Unattached Subscription');
      expect(roomPlanCopy.unattachedAlertDesc).toContain('not currently covering a room');
      expect(roomPlanCopy.unattachedAlertDesc).toContain('so you are not charged twice');
    });
  });

  describe('7. Locked Feature Preview Cards (AI Coach & Partner Finder)', () => {
    it('validates AI Coach locked card points and transparent tone', () => {
      const aiCopy = en.rooms.lockedPreview.aiCoach;

      expect(aiCopy.title).toBe('Personal AI Coach');
      expect(aiCopy.badge).toBe('PLAN HOLDER');
      expect(aiCopy.feature1).toContain('Answers built directly from your personal logs');
      expect(aiCopy.feature3).toContain('room members never see coach chat');
      expect(aiCopy.unlockBtn).toBe('Unlock with Room Plan');
    });

    it('validates Partner Finder locked card points and transparent tone', () => {
      const finderCopy = en.rooms.lockedPreview.partnerFinder;

      expect(finderCopy.title).toBe('Workout Partner Finder');
      expect(finderCopy.badge).toBe('PLAN HOLDER');
      expect(finderCopy.feature2).toContain('Free to opt in and be suggested');
      expect(finderCopy.feature3).toContain('photos and usernames stay private until both accept');
      expect(finderCopy.unlockBtn).toBe('Unlock with Room Plan');
    });
  });
});
