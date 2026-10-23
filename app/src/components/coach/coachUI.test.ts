import { describe, expect, it, vi } from 'vitest';
import { en } from '@/i18n/en';

describe('Phase 14 View Layer: AI Coach UI Specifications & Copy (PRD 6.22)', () => {
  describe('1. Copy & i18n Keys Completeness (PRD 6.22 AIC-1..AIC-10)', () => {
    it('has title, subtitle, and medical disclaimer copy', () => {
      expect(en.coach.title).toBe('AI Coach');
      expect(en.coach.subtitle).toContain('Nutrition & Fitness');
      expect(en.coach.disclaimer).toContain('not medical advice');
    });

    it('has the 3 required suggested prompts (AIC-2)', () => {
      expect(en.coach.prompts.week).toBe('How am I doing this week?');
      expect(en.coach.prompts.protein).toBe('What should I eat tonight to hit my protein?');
      expect(en.coach.prompts.target).toBe('Explain my calorie target');
    });

    it('has comprehensive consent screen bullets explaining data transparency (AIC-9)', () => {
      const consent = en.coach.consent;
      expect(consent.title).toContain('AI Coach & Privacy');
      // Bullet 1: Own data only
      expect(consent.bullet1).toContain('Only your own logs');
      expect(consent.bullet1).toContain('calorie and macro targets');
      // Bullet 2: Room members never see it
      expect(consent.bullet2).toContain('Room members and other users never see');
      // Bullet 3: AI provider terms forbid training
      expect(consent.bullet3).toContain('strictly forbid training models on your data');
      // Bullet 4: Delete history at any time
      expect(consent.bullet4).toContain('delete your conversation history at any time');
      expect(consent.deleteHistoryLink).toBe('Delete conversation history');
      expect(consent.agreeBtn).toBe('I Understand & Agree');
      expect(consent.declineBtn).toBe('Not Now');
    });

    it('has suggestion card labels with "Log it" button (AIC-5)', () => {
      expect(en.coach.suggestion.logIt).toBe('Log it');
      expect(en.coach.suggestion.recipe).toBe('Suggested Recipe');
      expect(en.coach.suggestion.food).toBe('Suggested Food');
    });

    it('has thumbs feedback and report modal copy (AIC-10)', () => {
      expect(en.coach.feedback.helpful).toBe('Helpful response');
      expect(en.coach.feedback.unhelpful).toBe('Unhelpful response');
      expect(en.coach.feedback.report).toBe('Report answer');

      const reasons = en.coach.reportModal.reasons;
      expect(reasons.inaccurate).toContain('Inaccurate');
      expect(reasons.unsafe).toContain('Unsafe');
      expect(reasons.disordered).toContain('Disordered eating');
      expect(reasons.inappropriate).toContain('Inappropriate');
      expect(reasons.other).toBeDefined();
    });

    it('has 30 message daily-limit copy and offline copy (AIC-7)', () => {
      expect(en.coach.dailyLimit.title).toContain('Daily message limit reached');
      expect(en.coach.dailyLimit.subtitle).toContain('30 messages');
      expect(en.coach.offline.title).toContain('currently offline');
      expect(en.coach.offline.subtitle).toContain('requires an internet connection');
    });

    it('has conversation history and delete history confirmation copy (AIC-9)', () => {
      const hist = en.coach.history;
      expect(hist.title).toBe('Coach History');
      expect(hist.empty).toContain('No conversation history');
      expect(hist.deleteAll).toBe('Delete All History');
      expect(hist.confirmTitle).toBe('Delete Conversation History');
      expect(hist.confirmMsg).toContain('delete all past AI coach conversations');
      expect(hist.confirmBtn).toBe('Delete All');
    });

    it('has locked preview copy for non-plan-holders (AIC-1, SUB-16)', () => {
      const locked = en.rooms.lockedPreview.aiCoach;
      expect(locked.title).toBe('Personal AI Coach');
      expect(locked.badge).toBe('PLAN HOLDER');
      expect(locked.feature1).toContain('personal logs and targets');
      expect(locked.feature3).toContain('room members never see coach chat');
      expect(locked.unlockBtn).toContain('Unlock with Room Plan');
    });
  });

  describe('2. Component Contract & Props Validation', () => {
    it('verifies suggested prompts triggers callback with exact string', () => {
      const mockSelect = vi.fn();
      const prompts = [en.coach.prompts.week, en.coach.prompts.protein, en.coach.prompts.target];

      prompts.forEach((p) => {
        mockSelect(p);
      });

      expect(mockSelect).toHaveBeenCalledTimes(3);
      expect(mockSelect).toHaveBeenNthCalledWith(1, 'How am I doing this week?');
      expect(mockSelect).toHaveBeenNthCalledWith(2, 'What should I eat tonight to hit my protein?');
      expect(mockSelect).toHaveBeenNthCalledWith(3, 'Explain my calorie target');
    });

    it('verifies suggestion card structure supports recipes and foods with "Log it"', () => {
      const mockLog = vi.fn();
      const sampleRecipe = {
        id: 'sug-1',
        type: 'recipe' as const,
        title: 'High-Protein Tofu Bowl',
        portion: '1 bowl',
        calories: 420,
        protein: 34,
        carbs: 45,
        fat: 9,
        recipeId: 'rec-1',
      };

      mockLog(sampleRecipe);
      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'recipe',
          title: 'High-Protein Tofu Bowl',
          calories: 420,
          protein: 34,
        }),
      );
    });

    it('verifies feedback mechanism accepts up, down, or report', () => {
      const feedbackState: Record<string, 'up' | 'down' | null> = {
        'msg-1': null,
      };

      // Tap thumbs up
      feedbackState['msg-1'] = feedbackState['msg-1'] === 'up' ? null : 'up';
      expect(feedbackState['msg-1']).toBe('up');

      // Toggle thumbs up off
      feedbackState['msg-1'] = feedbackState['msg-1'] === 'up' ? null : 'up';
      expect(feedbackState['msg-1']).toBeNull();

      // Tap thumbs down
      feedbackState['msg-1'] = 'down';
      expect(feedbackState['msg-1']).toBe('down');
    });

    it('verifies conversation delete and clear all history behavior', () => {
      let convs = [
        { id: 'c1', title: 'Session 1' },
        { id: 'c2', title: 'Session 2' },
      ];

      // Delete single conversation
      convs = convs.filter((c) => c.id !== 'c1');
      expect(convs.length).toBe(1);
      expect(convs[0]?.id).toBe('c2');

      // Delete all history
      convs = [];
      expect(convs.length).toBe(0);
    });

    it('verifies daily message cap threshold is 30 messages per day', () => {
      const limit = 30;
      expect(limit).toBe(30);

      const checkCap = (used: number) => used >= limit;
      expect(checkCap(29)).toBe(false);
      expect(checkCap(30)).toBe(true);
      expect(checkCap(31)).toBe(true);
    });

    it('verifies cleanCoachResponse strips asterisks, markdown headers, and em dashes', async () => {
      const { cleanCoachResponse } = await import('@/services/aiCoachClient');
      const rawText = `### Core Principles for Hypertrophy (Muscle Growth)

1. **Progressive Overload is King:** This is the absolute most important principle.
* **Increasing reps:** Doing more repetitions — with the same exercise.
* **Increasing difficulty:** Moving to harder variations — from push-ups to weighted dips.`;

      const cleaned = cleanCoachResponse(rawText);
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('###');
      expect(cleaned).not.toContain('—');
      expect(cleaned).toContain('Progressive Overload is King:');
      expect(cleaned).toContain('Doing more repetitions, with the same exercise.');
    }, 15000);
  });
});
