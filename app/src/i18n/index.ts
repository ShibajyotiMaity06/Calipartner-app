import { en, type Messages } from '@/i18n/en';

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Paths<Messages>;

const catalogs: Record<string, Messages> = { en };
let locale = 'en';

export function setLocale(next: string): void {
  if (catalogs[next]) locale = next;
}

/** Look up a user-facing string. Supports `{name}` interpolation. */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let node: unknown = catalogs[locale] ?? en;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  const text = typeof node === 'string' ? node : key;
  if (!params) return text;
  return text.replace(/%?\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
