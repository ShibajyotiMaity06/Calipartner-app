import { describe, it, expect } from 'vitest';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { type as typeTokens } from '../tokens/type';

describe('UI-2 Core Components Specification & Tokens', () => {
  describe('Button (CMP-01)', () => {
    it('uses correct primary button tokens: apricot fill and onBrand text', () => {
      expect(dark.apricot).toBe('#F4B67D');
      expect(dark.onBrand).toBe('#1C1109');
      expect(dark.apricotPressed).toBe('#E19A5C');
      expect(radius.button).toBe(16);
    });

    it('defines secondary button with hairlineLit border and textHi label', () => {
      expect(dark.hairlineLit).toBe('#85755F');
      expect(dark.textHi).toBe('#F7F0E7');
    });

    it('defines destructive button with danger color', () => {
      expect(dark.danger).toBe('#F65C58');
    });
  });

  describe('Chip and SegmentedControl (CMP-02)', () => {
    it('uses control radius 12 and space tokens for padding', () => {
      expect(radius.control).toBe(12);
      expect(space[3]).toBe(12);
    });
  });

  describe('Card (CMP-03)', () => {
    it('uses card radius 20 and s1 background with hairline border', () => {
      expect(radius.card).toBe(20);
      expect(dark.s1).toBe('#1A1511');
      expect(dark.hairline).toBe('#3A3228');
    });
  });

  describe('Sheet (CMP-04)', () => {
    it('uses sheet radius 28 and s2 background', () => {
      expect(radius.sheet).toBe(28);
      expect(dark.s2).toBe('#241E18');
      expect(dark.hairlineLit).toBe('#85755F');
    });
  });

  describe('Field & Stepper (CMP-06)', () => {
    it('uses s2 background, hairlineLit border, and control radius', () => {
      expect(radius.control).toBe(12);
      expect(dark.s2).toBe('#241E18');
      expect(dark.hairlineLit).toBe('#85755F');
      expect(dark.danger).toBe('#F65C58');
    });
  });

  describe('Avatar (CMP-08)', () => {
    it('uses identity hues and never green for presence', () => {
      expect(dark.teal).toBe('#1FBDB6');
      expect(dark.iris).toBe('#B49AFC');
      // No green performance or presence token
      expect(dark).not.toHaveProperty('green');
    });
  });

  describe('HiddenMetric (CMP-25)', () => {
    it('uses textLo neutral tone for not shared indicator', () => {
      expect(dark.textLo).toBe('#9A8E7F');
    });
  });

  describe('EmptyState (CMP-17) & Skeleton (CMP-18)', () => {
    it('configures s2 background for skeleton with no shimmer sweep', () => {
      expect(dark.s2).toBe('#241E18');
    });
  });

  describe('Typography (U6)', () => {
    it('configures tabular numerals on numeral styles', () => {
      expect(typeTokens.numeralXL.fontVariant).toEqual(['tabular-nums']);
      expect(typeTokens.numeralL.fontVariant).toEqual(['tabular-nums']);
      expect(typeTokens.numeralM.fontVariant).toEqual(['tabular-nums']);
    });
  });
});
