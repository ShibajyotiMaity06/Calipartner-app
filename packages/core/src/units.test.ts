import { describe, expect, it } from 'vitest';
import { cmToFtIn, cmToInches, ftInToCm, inchesToCm, kgToLb, lbToKg } from './units';

describe('units conversion', () => {
  it('converts kg to lb and back accurately', () => {
    const kg = 70;
    const lb = kgToLb(kg);
    expect(lb).toBeCloseTo(154.32, 1);
    expect(lbToKg(lb)).toBeCloseTo(70, 4);
  });

  it('converts inches to cm and back', () => {
    const inches = 68.8976;
    const cm = inchesToCm(inches);
    expect(cm).toBeCloseTo(175, 1);
    expect(cmToInches(cm)).toBeCloseTo(68.8976, 2);
  });

  it('converts feet and inches to cm', () => {
    // 5 feet 9 inches = 69 inches = 175.26 cm
    expect(ftInToCm(5, 9)).toBeCloseTo(175.26, 2);
    expect(ftInToCm(6, 0)).toBe(182.88);
  });

  it('converts cm to feet and inches tuple', () => {
    const res = cmToFtIn(175.26);
    expect(res).toEqual({ feet: 5, inches: 9 });
  });
});
