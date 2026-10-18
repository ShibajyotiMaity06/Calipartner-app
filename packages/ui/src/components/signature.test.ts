import { describe, it, expect } from 'vitest';
import { dark } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { allowedPairs, isPairAllowed } from '../tokens/pairs';

describe('UI-3 Signature Components Specification & Tokens', () => {
  describe('PairRing (CMP-09 & Spec 5.2)', () => {
    it('uses correct identity colors without green or red performance colors', () => {
      expect(dark.iris).toBe('#B49AFC');
      expect(dark.teal).toBe('#1FBDB6');
      expect(dark.cream).toBe('#F7F0E7');
      expect(dark.s2).toBe('#241E18');
      expect(dark.hairlineLit).toBe('#85755F');
    });

    it('enforces allowed identity color pairs', () => {
      expect(allowedPairs.length).toBe(5);
      expect(isPairAllowed('iris', 'teal')).toBe(true);
      expect(isPairAllowed('iris', 'rose')).toBe(true);
      expect(isPairAllowed('iris', 'mint')).toBe(true);
      expect(isPairAllowed('sky', 'rose')).toBe(true);
      expect(isPairAllowed('mint', 'orchid')).toBe(true);
      // Red or unapproved pairs are not allowed
      expect(isPairAllowed('danger', 'teal')).toBe(false);
      expect(isPairAllowed('apricot', 'teal')).toBe(false);
    });

    it('specifies ring motion easing duration of 680ms', () => {
      expect(motion.ring.duration).toBe(680);
      expect(motion.ring.easing).toEqual([0.32, 0, 0.1, 1]);
    });

    it('uses cream second lap token past 100%', () => {
      expect(dark.cream).toBe('#F7F0E7');
    });
  });

  describe('Seam (CMP-10 & Spec 5.3)', () => {
    it('defines 900ms seam motion token for day-complete fuse', () => {
      expect(motion.seam.duration).toBe(900);
      expect(motion.seam.easing).toEqual([0.4, 0, 0.2, 1]);
    });

    it('defines 120ms fast motion token for reduce-motion crossfade', () => {
      expect(motion.fast.duration).toBe(120);
    });

    it('uses hairlineLit for broken dashed seam', () => {
      expect(dark.hairlineLit).toBe('#85755F');
    });
  });

  describe('PersonColumn (CMP-11 & Spec 5.4)', () => {
    it('uses neutral styling for not-logged status (open circle, never cross or red)', () => {
      expect(dark.hairlineLit).toBe('#85755F');
      expect(dark.textLo).toBe('#9A8E7F');
    });
  });

  describe('NudgeButton (CMP-12 & Spec 5.5)', () => {
    it('uses s2 fill, hairlineLit edge, and 44px hit area', () => {
      expect(dark.s2).toBe('#241E18');
      expect(dark.hairlineLit).toBe('#85755F');
    });
  });

  describe('CalorieRing & MacroBar (CMP-13)', () => {
    it('prohibits apricot for person performance ring (owner identity hue only)', () => {
      // Apricot is the app brand, never a person
      expect(dark.apricot).toBe('#F4B67D');
      expect(dark.iris).toBe('#B49AFC');
      expect(dark.teal).toBe('#1FBDB6');
    });

    it('defines cream second lap and over state', () => {
      expect(dark.cream).toBe('#F7F0E7');
    });
  });

  describe('TimerDisplay (CMP-21)', () => {
    it('uses tabular numeral styling and 6px progress ring geometry', () => {
      expect(dark.s2).toBe('#241E18');
      expect(dark.apricot).toBe('#F4B67D');
    });
  });
});
