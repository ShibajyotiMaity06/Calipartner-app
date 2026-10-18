import { describe, it, expect } from 'vitest';
import { dark } from './tokens/colors';
import { allowedPairs, isPairAllowed, getSelectablePairsData } from './tokens/pairs';
import { getContrastRatio } from './contrast';

describe('WCAG 2.1 Contrast Requirements (Phase UI-1)', () => {
  it('textHi on s1 >= 4.5 (passes normal text AA)', () => {
    const ratio = getContrastRatio(dark.textHi, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('textMid on s1 >= 4.5 (passes normal text AA)', () => {
    const ratio = getContrastRatio(dark.textMid, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('textLo on s1 >= 4.5 (passes AA for captions/placeholders)', () => {
    const ratio = getContrastRatio(dark.textLo, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('onBrand on apricot >= 7 (passes AAA enhanced contrast)', () => {
    const ratio = getContrastRatio(dark.onBrand, dark.apricot);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('hairlineLit on s1 >= 3 (passes non-text UI control contrast)', () => {
    const ratio = getContrastRatio(dark.hairlineLit, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('hairlineLit on s2 >= 3 (passes non-text UI control contrast on raised surfaces)', () => {
    const ratio = getContrastRatio(dark.hairlineLit, dark.s2);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('apricot on s1 >= 7 (passes high brand visibility on cards)', () => {
    const ratio = getContrastRatio(dark.apricot, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('iris on s1 >= 7 (passes AAA identity contrast on cards)', () => {
    const ratio = getContrastRatio(dark.iris, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('teal on s1 >= 7 (passes AAA identity contrast on cards)', () => {
    const ratio = getContrastRatio(dark.teal, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('danger on s1 >= 4.5 (passes AA error contrast)', () => {
    const ratio = getContrastRatio(dark.danger, dark.s1);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Colour-Blind Safe Allowed Pairs (Phase UI-1)', () => {
  it('every pair in allowedPairs is present and recognized', () => {
    expect(allowedPairs).toHaveLength(5);
    expect(isPairAllowed('iris', 'teal')).toBe(true);
    expect(isPairAllowed('iris', 'rose')).toBe(true);
    expect(isPairAllowed('iris', 'mint')).toBe(true);
    expect(isPairAllowed('sky', 'rose')).toBe(true);
    expect(isPairAllowed('mint', 'orchid')).toBe(true);
  });

  it('no other pair is selectable in the colour picker data', () => {
    const selectableData = getSelectablePairsData();
    // 6 identity hues -> 15 unique pairs
    expect(selectableData).toHaveLength(15);

    const allowedCount = selectableData.filter((item) => item.allowed).length;
    const disallowedCount = selectableData.filter((item) => !item.allowed).length;

    expect(allowedCount).toBe(5);
    expect(disallowedCount).toBe(10);

    // Verify forbidden pairs are rejected
    expect(isPairAllowed('teal', 'rose')).toBe(false);
    expect(isPairAllowed('teal', 'orchid')).toBe(false);
    expect(isPairAllowed('teal', 'mint')).toBe(false);
    expect(isPairAllowed('teal', 'sky')).toBe(false);
    expect(isPairAllowed('iris', 'sky')).toBe(false);
    expect(isPairAllowed('iris', 'orchid')).toBe(false);
    expect(isPairAllowed('rose', 'mint')).toBe(false);
    expect(isPairAllowed('rose', 'orchid')).toBe(false);
    expect(isPairAllowed('sky', 'mint')).toBe(false);
    expect(isPairAllowed('sky', 'orchid')).toBe(false);
  });
});
