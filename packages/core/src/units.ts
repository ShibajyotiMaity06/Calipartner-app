/**
 * Unit conversion utilities between Metric and Imperial systems.
 * Pure deterministic functions.
 */

// Standard conversion constants
export const KG_TO_LB = 2.2046226218487757;
export const LB_TO_KG = 0.45359237;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

/**
 * Converts kilograms to pounds.
 */
export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

/**
 * Converts pounds to kilograms.
 */
export function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

/**
 * Converts centimeters to total inches.
 */
export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

/**
 * Converts inches to centimeters.
 */
export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/**
 * Converts feet and inches to centimeters.
 */
export function ftInToCm(feet: number, inches: number = 0): number {
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
}

/**
 * Converts centimeters to feet and rounded inches.
 */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return { feet, inches };
}
