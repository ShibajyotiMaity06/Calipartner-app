/**
 * Computes age in full completed years given a date of birth (YYYY-MM-DD or Date object).
 * Evaluated relative to referenceDate (defaulting to current UTC date).
 */
export function calculateAge(dob: string | Date, referenceDate: Date = new Date()): number {
  const birthDate = typeof dob === 'string' ? new Date(dob + 'T00:00:00Z') : dob;
  if (isNaN(birthDate.getTime())) {
    return -1;
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--;
  }

  return age;
}

/**
 * Checks if the user is at least 18 years old.
 * PRD AUTH-3: Users under 18 are blocked.
 */
export function isAtLeast18(dob: string | Date, referenceDate: Date = new Date()): boolean {
  const age = calculateAge(dob, referenceDate);
  return age >= 18;
}
