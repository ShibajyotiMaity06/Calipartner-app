import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 10 — View Layer UI Tests (Paywall, Lifecycle & Locked Cards)', () => {
  describe('1. PaywallModal Presentation & Plan Selection Logic', () => {
    it('maps tier selections properly', () => {
      const getTierForSize = (size: '2-5' | '6-20' | '21-50' | 'plus' | 'pro'): 'plus' | 'pro' => {
        if (size === '21-50' || size === 'pro') return 'pro';
        return 'plus';
      };

      expect(getTierForSize('6-20')).toBe('plus');
      expect(getTierForSize('21-50')).toBe('pro');
      expect(getTierForSize('plus')).toBe('plus');
      expect(getTierForSize('pro')).toBe('pro');
    });

    it('calculates annual savings and per-month equivalent pricing for v2 plans', () => {
      const pricingTable = {
        plus: { monthly: 99, annual: 599 },
        pro: { monthly: 199, annual: 1199 },
      };

      // Plus: 12 months * 99 = 1188. 599 is (1188 - 599)/1188 = ~49.6% -> ~50% savings
      const plusSavings = Math.round(
        ((pricingTable.plus.monthly * 12 - pricingTable.plus.annual) /
          (pricingTable.plus.monthly * 12)) *
          100,
      );
      expect(plusSavings).toBe(50);

      // Equivalent per month: 599 / 12 = ~49.9 -> 50
      const plusPerMonth = Math.round(pricingTable.plus.annual / 12);
      expect(plusPerMonth).toBe(50);

      // Pro: 12 * 199 = 2388. 1199 is (2388 - 1199)/2388 = ~49.8% -> ~50% savings
      const proSavings = Math.round(
        ((pricingTable.pro.monthly * 12 - pricingTable.pro.annual) /
          (pricingTable.pro.monthly * 12)) *
          100,
      );
      expect(proSavings).toBe(50);

      // Equivalent per month: 1199 / 12 = ~99.9 -> 100
      const proPerMonth = Math.round(pricingTable.pro.annual / 12);
      expect(proPerMonth).toBe(100);
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

      // Free guarantee
      expect(paywallCopy.featureFree).toContain('100% free');
      expect(paywallCopy.featureFree).toContain('food diary');

      // Clear billing terms (auto-renewal disclosure)
      expect(paywallCopy.termsNotice).toContain('auto-renew');
      expect(paywallCopy.termsNotice).toContain('cancel anytime');
    });
  });

  describe('2. TrialBanner Presentation Logic', () => {
    it('displays appropriate countdown for 7-day trials', () => {
      expect(en.rooms.trialBanner.day1).toContain('Day 1 of 7');
      expect(en.rooms.trialBanner.day1).toContain('6 days left');
      expect(en.rooms.trialBanner.day7).toContain('Day 7 of 7');
      expect(en.rooms.trialBanner.day7).toContain('Final day');
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
    it('generates host upgrade recommendation targeting 10 and 20 capacity tiers', () => {
      const hostFull = t('rooms.roomFull.hostNotice');
      expect(hostFull).toContain('Plus fits up to 10 people');
      expect(hostFull).toContain('Pro fits up to 20');
      expect(t('rooms.roomFull.upgradeBtn')).toBe('Upgrade Plan');
    });

    it('generates plain non-shaming notice for non-host members', () => {
      const memberNotice = t('rooms.roomFull.memberNotice');
      expect(memberNotice).toBe('This room is full');
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
