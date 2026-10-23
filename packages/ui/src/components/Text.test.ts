import { describe, it, expect } from 'vitest';
import { type, typeHindi, getTypeStyle } from '../tokens/type';

describe('Typography Scale (Plus Jakarta Sans & Apple Design)', () => {
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

  it('uses Plus Jakarta Sans for titles and numerals', () => {
    expect(type.numeralXL.fontFamily).toBe('PlusJakartaSans_700');
    expect(type.numeralL.fontFamily).toBe('PlusJakartaSans_700');
    expect(type.numeralM.fontFamily).toBe('PlusJakartaSans_600');
    expect(type.title1.fontFamily).toBe('PlusJakartaSans_700');
    expect(type.title2.fontFamily).toBe('PlusJakartaSans_600');
  });

  it('uses Plus Jakarta Sans for interface text', () => {
    expect(type.heading.fontFamily).toBe('PlusJakartaSans_600');
    expect(type.body.fontFamily).toBe('PlusJakartaSans_400');
    expect(type.bodyS.fontFamily).toBe('PlusJakartaSans_400');
    expect(type.label.fontFamily).toBe('PlusJakartaSans_500');
    expect(type.micro.fontFamily).toBe('PlusJakartaSans_500');
    expect(type.button.fontFamily).toBe('PlusJakartaSans_600');
  });

  it('scales Hindi line height by 1.15 to avoid clipping matras', () => {
    expect(typeHindi.body.lineHeight).toBe(Math.round(type.body.lineHeight * 1.15));
    expect(typeHindi.heading.lineHeight).toBe(Math.round(type.heading.lineHeight * 1.15));
    expect(typeHindi.body.fontFamily).toBe('AnekDevanagari_400');
    expect(typeHindi.heading.fontFamily).toBe('AnekDevanagari_600');
    // Numerals stay Plus Jakarta Sans
    expect(typeHindi.numeralXL.fontFamily).toBe('PlusJakartaSans_700');
  });

  it('getTypeStyle correctly switches for Hindi', () => {
    expect(getTypeStyle('body', false).fontFamily).toBe('PlusJakartaSans_400');
    expect(getTypeStyle('body', true).fontFamily).toBe('AnekDevanagari_400');
  });
});
