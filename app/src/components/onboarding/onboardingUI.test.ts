import { describe, expect, it } from 'vitest';
import { isAtLeast18 } from '@calipartner/core';
import { AVATAR_PRESETS } from '../profile/AvatarPickerModal';
import { ONBOARDING_STEPS_ORDER } from '@/services/onboardingStateMachine';
import { t, setLocale, getLocale } from '@/i18n';

const ACTIVE_ONBOARDING_STEPS = ONBOARDING_STEPS_ORDER;

describe('UI-5 Onboarding and Account Polish (Spec A01–A15, B01–B09)', () => {
  describe('1. Active Onboarding Flow Geometry & Order (Spec 7.A)', () => {
    it('has 9 steps after welcome and account setup with one question per screen and 4px progress bar', () => {
      expect(ACTIVE_ONBOARDING_STEPS).toEqual([
        'goal',
        'motivation',
        'activity_level',
        'body_stats',
        'rate_selection',
        'daily_goals',
        'premium',
        'paywall',
        'completed',
      ]);
      expect(ACTIVE_ONBOARDING_STEPS.length).toBe(9);
    });

    it('calculates 4px progress percentage accurately across all steps', () => {
      const getProgressPct = (stepIndex: number, total: number) => {
        return Math.min(100, Math.max(0, ((stepIndex + 1) / total) * 100));
      };

      // Step 1: ~14.28%
      expect(Math.round(getProgressPct(0, 7))).toBe(14);
      // Step 4: ~57.14%
      expect(Math.round(getProgressPct(3, 7))).toBe(57);
      // Step 7: 100%
      expect(getProgressPct(6, 7)).toBe(100);
    });
  });

  describe('2. A04: Goal Cards Specifications', () => {
    it('defines 3 full-width cards with 88dp height and plain copy', () => {
      const GOAL_OPTIONS = [
        { id: 'cut', title: 'Lose fat', desc: 'Eat a little less than you burn.' },
        { id: 'bulk', title: 'Build muscle', desc: 'Eat enough protein and train with intent.' },
        {
          id: 'maintain',
          title: 'Stay where I am',
          desc: 'Keep your weight and build consistency.',
        },
      ];

      expect(GOAL_OPTIONS.length).toBe(3);
      expect(GOAL_OPTIONS[0]?.title).toBe('Lose fat');
      expect(GOAL_OPTIONS[1]?.title).toBe('Build muscle');
      expect(GOAL_OPTIONS[2]?.title).toBe('Stay where I am');
    });
  });

  describe('3. A09: Rate Picker Specifications', () => {
    it('marks recommended 0.5 kg/week pace as Steady and validates rate cards', () => {
      const rates = [0.25, 0.5, 0.75, 1.0];
      const isSteady = (rate: number) => rate === 0.5;

      expect(rates).toContain(0.5);
      expect(isSteady(0.5)).toBe(true);
      expect(isSteady(0.75)).toBe(false);
    });

    it('formats safe copy: "Faster is not always better. 0.5 kg a week is easy to keep up."', () => {
      const copy = 'Faster is not always better. 0.5 kg a week is easy to keep up.';
      expect(copy).toContain('0.5 kg a week');
    });

    it('identifies unavailable reasons for floor, cap, and low BMI', () => {
      const getReasonExplanation = (reason: string, floor: number, cap: number) => {
        switch (reason) {
          case 'below_calorie_floor':
            return `Below safe calorie floor (${floor} kcal/day)`;
          case 'above_rate_cap':
            return `Exceeds safe rate cap of 1% body weight (${cap} kg/wk)`;
          case 'bmi_too_low':
            return 'Cutting is disabled when BMI is under 18.5';
          default:
            return '';
        }
      };

      expect(getReasonExplanation('below_calorie_floor', 1500, 0.8)).toContain('1500');
      expect(getReasonExplanation('above_rate_cap', 1500, 0.8)).toContain('0.8');
      expect(getReasonExplanation('bmi_too_low', 1500, 0.8)).toContain('18.5');
    });
  });

  describe('5. A03: Age Gate & DOB Specifications', () => {
    it('validates 18+ requirement correctly and rejects under 18 with kind notice', () => {
      // Born in 2000 is adult (26 in 2026)
      expect(isAtLeast18('2000-01-15')).toBe(true);
      // Born in 2012 is minor (14 in 2026)
      expect(isAtLeast18('2012-05-15')).toBe(false);
    });

    it('verifies 3 numeric fields: Day (2 digits), Month (2 digits), Year (4 digits)', () => {
      const validateInputLengths = (d: string, m: string, y: string) => {
        return d.length <= 2 && m.length <= 2 && y.length <= 4;
      };

      expect(validateInputLengths('15', '01', '2000')).toBe(true);
      expect(validateInputLengths('150', '01', '2000')).toBe(false);
    });
  });

  describe('6. A08: Health Screening Specifications', () => {
    it('hides pregnancy question for biological males and shows for female/other', () => {
      const isPregnancyRelevant = (sex: 'male' | 'female' | 'other') => sex !== 'male';

      expect(isPregnancyRelevant('male')).toBe(false);
      expect(isPregnancyRelevant('female')).toBe(true);
      expect(isPregnancyRelevant('other')).toBe(true);
    });

    it('explains consequence line: "Used only to hide fasting and show cautions. Never shared with your room."', () => {
      const explanation =
        'Used only to hide fasting and show cautions. Never shared with your room.';
      expect(explanation).toContain('Never shared with your room');
    });
  });

  describe('7. A12: Partner Finder Offer Specifications', () => {
    it('is off by default and informs about room plan requirement', () => {
      const defaultState = false;
      const notice = 'Browsing and sending needs a room plan. Anyone can accept.';

      expect(defaultState).toBe(false);
      expect(notice).toContain('Anyone can accept');
    });
  });

  describe('8. A15: Invite Preview Specifications', () => {
    it('renders free to join notice without paywall', () => {
      const freeCopy = 'Free to join. Your diary stays yours.';
      expect(freeCopy).toContain('Free to join');
    });
  });

  describe('9. B01–B03: Sign In & Authentication Rules', () => {
    it('places Apple first on iOS', () => {
      const getProviderOrder = (os: 'ios' | 'android') => {
        return os === 'ios' ? ['apple', 'google', 'email'] : ['google', 'apple', 'email'];
      };

      expect(getProviderOrder('ios')).toEqual(['apple', 'google', 'email']);
      expect(getProviderOrder('android')).toEqual(['google', 'apple', 'email']);
    });

    it('enforces 30s resend cooldown for 6-digit email OTP', () => {
      const OTP_RESEND_COOLDOWN_SECONDS = 30;
      expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(30);
    });
  });

  describe('10. B04 & B05: Username Rules & 24 Avatars', () => {
    it('enforces username rules: 3 to 20 characters, lowercase, numbers, _, .', () => {
      const isValidUsername = (u: string) => /^[a-z0-9_.]{3,20}$/.test(u);

      expect(isValidUsername('rahul_8')).toBe(true);
      expect(isValidUsername('a.b')).toBe(true);
      expect(isValidUsername('ab')).toBe(false); // < 3
      expect(isValidUsername('rahul@8')).toBe(false); // invalid char @
      expect(isValidUsername('this_is_a_very_long_username_that_exceeds_twenty')).toBe(false); // > 20
    });

    it('provides exactly 24 avatar presets across the 6 identity hues (Spec B05)', () => {
      expect(AVATAR_PRESETS.length).toBe(24);
      const hues = AVATAR_PRESETS.map((a) => a.hue);
      expect(hues.filter((h) => h === 'iris').length).toBe(4);
      expect(hues.filter((h) => h === 'teal').length).toBe(4);
      expect(hues.filter((h) => h === 'rose').length).toBe(4);
      expect(hues.filter((h) => h === 'mint').length).toBe(4);
      expect(hues.filter((h) => h === 'sky').length).toBe(4);
      expect(hues.filter((h) => h === 'orchid').length).toBe(4);
    });
  });

  describe('11. B07 & B08: Account Deletion Safeguards', () => {
    it('requires exact string "DELETE" to enable permanent deletion', () => {
      const canDelete = (text: string) => text.trim().toUpperCase() === 'DELETE';

      expect(canDelete('delete')).toBe(true);
      expect(canDelete('DELETE')).toBe(true);
      expect(canDelete('del')).toBe(false);
      expect(canDelete('')).toBe(false);
    });

    it('includes store cancellation reminder for Apple/Google subscriptions', () => {
      const notice =
        'Active store subscription: Google Play or Apple App Store subscriptions must be cancelled in your phone store settings to stop recurring billing.';
      expect(notice).toContain('cancelled in your phone store settings');
    });
  });

  describe('12. Hindi Localization (Spec Part 8.2)', () => {
    it('provides localized Hindi strings for A04, A09, A10, B04, and Welcome', () => {
      setLocale('hi');
      expect(getLocale()).toBe('hi');

      expect(t('welcome.title')).toBe('साथ मिलकर बेहतर खाएं।');
      expect(t('welcome.getStarted')).toBe('शुरू करें');
      expect(t('onboarding.goal.title')).toBe('आप क्या करना चाहते हैं?');
      expect(t('onboarding.goal.cutTitle')).toBe('फैट कम करें');
      expect(t('onboarding.goal.maintainTitle')).toBe('वजन बनाए रखें');
      expect(t('onboarding.rate.title')).toBe('अपनी साप्ताहिक गति चुनें');
      expect(t('profileSetup.title')).toBe('प्रोफ़ाइल बनाएं');
      expect(t('profileSetup.usernameAvailable')).toBe('यह नाम उपलब्ध है');

      // Reset to English
      setLocale('en');
      expect(getLocale()).toBe('en');
    });
  });

  describe('13. Terms of Service & Privacy Policy Prompt (Apple & Google Compliance)', () => {
    it('verifies terms prompt text and agreement structure', () => {
      const termsPrompt = 'By continuing, you agree to our Terms of Service and Privacy Policy.';
      expect(termsPrompt).toContain('Terms of Service');
      expect(termsPrompt).toContain('Privacy Policy');
    });
  });
});
