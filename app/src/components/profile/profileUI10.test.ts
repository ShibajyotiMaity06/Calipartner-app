import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';
import { TIER_CONFIG } from '@/components/rooms/PaywallModal';

describe('UI-10 · Me, Privacy, Plans, and Paywall (Screens N01–N16, O01–O10)', () => {
  describe('1. N01: Me Screen Layout & Information Architecture', () => {
    it('defines all required grouped sections for Me settings', () => {
      const sections = en.me.sections;
      expect(sections.myGoals).toBe('My goals');
      expect(sections.privacy).toBe('Privacy & visibility');
      expect(sections.features).toBe('Features');
      expect(sections.preferences).toBe('Preferences');
      expect(sections.syncStorage).toBe('Data & storage');
      expect(sections.helpFeedback).toBe('Help & feedback');
      expect(sections.aboutLegal).toBe('About & legal');
      expect(sections.account).toBe('Account');
    });

    it('contains plain consequence text for guest mode banner', () => {
      expect(t('auth.guestNotice')).toContain('explore local logging');
    });
  });

  describe('2. N02: Edit Profile & Username Hold', () => {
    it('discloses the 30-day username change hold notice', () => {
      expect(en.profileEdit.changeUsernameNotice).toContain('once every 30 days');
      expect(en.profileEdit.changeUsernameNotice).toContain('held for 30 days');
    });
  });

  describe('3. N03: Goals & Body Measurements', () => {
    it('includes calorie floor metabolism notice and history non-rewriting rule', () => {
      expect(en.me.goalsAndBody.subtitle).toContain(
        'Changes apply from today; history is not rewritten',
      );
      expect(en.me.goalsAndBody.calorieFloorNotice).toContain(
        'Calorie floors protect your metabolism',
      );
    });
  });

  describe('4. N04: Daily Goals with Steppers', () => {
    it('defines daily goals for steps (default 8,000), water, and focus', () => {
      expect(en.me.dailyGoals.stepGoal).toBe('Daily Step Goal');
      expect(en.me.dailyGoals.waterGoal).toBe('Daily Water Goal');
      expect(en.me.dailyGoals.focusGoal).toBe('Daily Focus Goal');
      expect(en.me.dailyGoals.stepUnit).toBe('steps');
      expect(en.me.dailyGoals.waterUnit).toBe('ml');
      expect(en.me.dailyGoals.focusUnit).toBe('minutes');
    });
  });

  describe('5. N05: Privacy Settings with Consequence Lines Under Every Switch', () => {
    it('contains one-line consequence text under every switch (Spec N05 / PRV-1 / PRV-2)', () => {
      const p = en.rooms.privacyModal;

      expect(p.intro).toBe('You decide what people in your room see.');
      expect(p.immediateNote).toContain('Changes apply immediately and retroactively hide');

      // Meal items
      expect(p.mealItems).toBe('Partners can see my meal items');
      expect(p.mealItemsConsequence).toBe(
        'Partners see names and quantities of foods logged in your diary.',
      );

      // Weight
      expect(p.weight).toBe('Partners can see my weight');
      expect(p.weightConsequence).toBe('Partners see your weight logs and weigh-in dates.');

      // Workouts
      expect(p.workouts).toBe('Partners can see my workouts');
      expect(p.workoutsConsequence).toBe(
        'Partners see when you complete a workout and exercise types.',
      );

      // Focusing
      expect(p.focusing).toBe("Show that I'm focusing");
      expect(p.focusingConsequence).toBe('Shows the live focus beacon when your timer is running.');

      // Focus labels
      expect(p.focusLabels).toBe('Show my focus labels');
      expect(p.focusLabelsConsequence).toBe(
        'Partners see the specific task or tag you are focusing on.',
      );

      // Fasting
      expect(p.fasting).toBe('Share fasting status');
      expect(p.fastingConsequence).toBe('Shows your active fast and elapsed hours in the room.');

      // Discoverable
      expect(p.discoverable).toBe('Who can find me by username');
      expect(p.discoverableConsequence).toBe(
        'Anyone can send a partner invitation by typing your username.',
      );

      // Leaderboard
      expect(p.leaderboard).toBe('Appear on leaderboards');
      expect(p.leaderboardConsequence).toBe(
        'Your username and streak appear on public community boards.',
      );

      // Navigation links
      expect(p.perRoomLink).toBe('Per-room visibility');
      expect(p.previewPartnerLink).toBe('Preview what my partner sees');
    });
  });

  describe('6. N06 & N07: Per-Room Visibility & Read-Only Partner Preview', () => {
    it('documents that defaults inherit from global privacy settings', () => {
      expect(en.me.perRoomVisibility.defaultNotice).toContain('inherited from your global privacy');
    });

    it('enforces that partners only see percentage of goal and never raw calories', () => {
      expect(en.me.previewPartner.goalCompletionOnly).toContain('percentage, never raw calories');
      expect(en.me.previewPartner.readOnlyNotice).toContain(
        'Private metrics are hidden behind a lock',
      );
    });
  });

  describe('7. N08 to N12: Discoverability, Language, Appearance, Health Sync', () => {
    it('defines discoverability options with everyone vs nobody', () => {
      expect(en.me.discoverability.findLabel).toBe('Who can find me by username');
      expect(en.me.discoverability.everyone).toContain('Everyone');
      expect(en.me.discoverability.nobody).toContain('Nobody');
    });

    it('states that language switches take effect instantly', () => {
      expect(en.me.unitsLanguage.instantNotice).toContain('immediately');
    });

    it('supports Dark, Light, System themes, Reduce Motion override, and Haptics', () => {
      expect(en.me.appearance.themeDark).toContain('Apricot on Espresso');
      expect(en.me.appearance.reduceMotionLabel).toContain('Reduce motion');
      expect(en.me.appearance.hapticsLabel).toContain('Haptic feedback');
    });

    it('lists all health permissions and step counting fix (E04)', () => {
      expect(en.me.healthSync.readSteps).toContain('Steps');
      expect(en.me.healthSync.readEnergy).toContain('Active energy');
      expect(en.me.healthSync.readWorkouts).toContain('workouts');
      expect(en.me.healthSync.fixStepsBtn).toContain('Fix Step Counting');
    });
  });

  describe('8. N13 to N16: Help, Universal Report, Legal, Sign Out Confirm', () => {
    it('provides universal report sheet categories (P04)', () => {
      expect(en.me.reportFeedback.typeBug).toBe('Report a problem');
      expect(en.me.reportFeedback.typeFood).toBe('Wrong food entry');
      expect(en.me.reportFeedback.typeGeneral).toBe('Send feedback');
      expect(en.me.reportFeedback.includeLogsLabel).toBe('Include diagnostic logs');
    });

    it('includes health disclaimer and food composition attributions (N15)', () => {
      expect(en.me.aboutLegal.disclaimerBody).toContain('CaliPartner is an accountability tool');
      expect(en.me.aboutLegal.openFoodFacts).toContain('Open Food Facts');
      expect(en.me.aboutLegal.ifct).toContain('Indian Food Composition Tables');
    });

    it('provides plain consequence text and account deletion link on sign out (N16 / AUTH-5)', () => {
      expect(en.me.signOutSheet.consequence).toContain(
        'pause notifications until you sign back in',
      );
      expect(en.me.signOutSheet.consequence).toContain('diary data is safe on this device');
      expect(en.me.signOutSheet.deleteAccountLink).toBe('Delete account instead');
    });
  });

  describe('9. O01: Plan Overview on Me Screen (SUB-14)', () => {
    it('defines quiet free tracking forever notice when user has no active plan', () => {
      expect(en.me.roomPlan.freePlanTitle).toBe('No plan. Free tracking is yours forever.');
      expect(en.me.roomPlan.seePlansBtn).toBe('See plans');
      expect(en.me.roomPlan.restoreBtn).toBe('Restore Purchases');
    });
  });

  describe('10. O02: Paywall Contextual Titles, Sizing & Durations (SUB-9, SUB-10)', () => {
    it('contains all required contextual titles for every entry point', () => {
      const titles = en.rooms.paywall.titleContextual;
      expect(titles.room).toBe('Keep your room with {name}');
      expect(titles.keepGoing).toBe('Keep your room going');
      expect(titles.keepGoingSubtitle).toBe("You'll become the plan holder.");
      expect(titles.addPeople).toBe('Add more people');
      expect(titles.coach).toBe('Ask your coach');
      expect(titles.partnerFinder).toBe('Find a workout partner');
      expect(titles.general).toBe('Choose your CaliPartner plan');
    });

    it('configures the three room size tiers: Basic (2-5), Plus (6-20), Pro (21-50)', () => {
      expect(TIER_CONFIG.basic.sizeRange).toBe('2 to 5');
      expect(TIER_CONFIG.basic.cap).toBe(5);

      expect(TIER_CONFIG.plus.sizeRange).toBe('6 to 20');
      expect(TIER_CONFIG.plus.cap).toBe(20);

      expect(TIER_CONFIG.pro.sizeRange).toBe('21 to 50');
      expect(TIER_CONFIG.pro.cap).toBe(50);
    });

    it('enforces 7-day free trial on Plus and NO trial on Pro as per Pricing Plan v2', () => {
      expect(TIER_CONFIG.plus.hasTrial).toBe(true);
      expect(TIER_CONFIG.plus.trialDays).toBe(7);

      expect(TIER_CONFIG.pro.hasTrial).toBe(false);
      expect(TIER_CONFIG.pro.trialDays).toBe(0);
    });

    it('displays quiet savings badges without shouting badges', () => {
      expect(en.rooms.paywall.durationQuarterlySaving).toBe('Save 20%');
      expect(en.rooms.paywall.durationAnnualSaving).toBe('Save 50%');
    });

    it('includes the three what-you-get inclusions and free tracking guarantee', () => {
      const pw = en.rooms.paywall;
      expect(pw.whatYouGetRow1).toBe('Room, chat, progress and focus for everyone');
      expect(pw.whatYouGetRow2).toBe('AI coach and Partner Finder for you');
      expect(pw.whatYouGetRow3).toBe('Bigger photo allowance');
      expect(pw.freeSentence).toBe('Logging, your diary and your streak stay free.');
    });

    it('includes one-line renewal sentence and store cancel disclosure', () => {
      expect(en.rooms.paywall.renewalSentence).toContain('Renews at {price} every {period}');
      expect(en.rooms.paywall.renewalSentence).toContain('Cancel any time in your store settings');
    });

    it('includes O04 success moment, O07 grace, O08 store cancel, O09 restore, O10 promo', () => {
      const pw = en.rooms.paywall;
      expect(pw.successTitle).toBe('Plan Unlocked');
      expect(pw.graceTitle).toBe('Payment Problem');
      expect(pw.manageCancelTitle).toBe('Manage Subscription');
      expect(pw.restoreSuccessTitle).toBe('We found your plan');
      expect(pw.promoTitle).toBe('Redeem Partner Code');
    });
  });
});
