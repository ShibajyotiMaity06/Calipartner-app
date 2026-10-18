import { describe, it, expect } from 'vitest';
import { type, typeHindi, getTypeStyle } from '../tokens/type';

describe('Typography Scale (Phase UI-1)', () => {
  it('includes all required type scale variants', () => {
    const requiredVariants = [
      'numeralXL',
      'numeralL',
      'numeralM',
      'title1',
      'title2',
      'heading',
      'body',
      'bodyS',
      'label',
      'micro',
      'button',
    ] as const;

    for (const v of requiredVariants) {
      expect(type[v]).toBeDefined();
      expect(type[v].fontSize).toBeGreaterThan(0);
      expect(type[v].lineHeight).toBeGreaterThan(0);
      expect(type[v].fontFamily).toBeDefined();
    }
  });

  it('configures tabular-nums on all numeral variants', () => {
    expect(type.numeralXL.fontVariant).toContain('tabular-nums');
    expect(type.numeralL.fontVariant).toContain('tabular-nums');
    expect(type.numeralM.fontVariant).toContain('tabular-nums');
  });

  it('uses Bricolage for titles and numerals', () => {
    expect(type.numeralXL.fontFamily).toBe('Bricolage_700');
    expect(type.numeralL.fontFamily).toBe('Bricolage_600');
    expect(type.numeralM.fontFamily).toBe('Bricolage_600');
    expect(type.title1.fontFamily).toBe('Bricolage_600');
    expect(type.title2.fontFamily).toBe('Bricolage_600');
  });

  it('uses Figtree for interface text', () => {
    expect(type.heading.fontFamily).toBe('Figtree_600');
    expect(type.body.fontFamily).toBe('Figtree_400');
    expect(type.bodyS.fontFamily).toBe('Figtree_400');
    expect(type.label.fontFamily).toBe('Figtree_500');
    expect(type.micro.fontFamily).toBe('Figtree_500');
    expect(type.button.fontFamily).toBe('Figtree_600');
  });

  it('scales Hindi line height by 1.15 to avoid clipping matras', () => {
    expect(typeHindi.body.lineHeight).toBe(Math.round(type.body.lineHeight * 1.15));
    expect(typeHindi.heading.lineHeight).toBe(Math.round(type.heading.lineHeight * 1.15));
    expect(typeHindi.body.fontFamily).toBe('AnekDevanagari_400');
    expect(typeHindi.heading.fontFamily).toBe('AnekDevanagari_600');
    // Numerals stay Bricolage
    expect(typeHindi.numeralXL.fontFamily).toBe('Bricolage_700');
  });

  it('getTypeStyle correctly switches for Hindi', () => {
    expect(getTypeStyle('body', false).fontFamily).toBe('Figtree_400');
    expect(getTypeStyle('body', true).fontFamily).toBe('AnekDevanagari_400');
  });
});
