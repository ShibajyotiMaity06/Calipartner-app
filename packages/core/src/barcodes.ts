export function normalizeProductBarcode(value: string): string | null {
  const clean = value.trim();
  return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(clean) ? clean : null;
}
