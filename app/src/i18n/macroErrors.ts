import { t, type TranslationKey } from './index';

export function macroErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  const keys: Record<string, TranslationKey> = {
    MACRO_RANGE_CALORIES: 'personalDay.rangeCalories',
    MACRO_RANGE_PROTEIN: 'personalDay.rangeProtein',
    MACRO_RANGE_CARBS: 'personalDay.rangeCarbs',
    MACRO_RANGE_FAT: 'personalDay.rangeFat',
    INVALID_MACROS: 'personalDay.wholeNumbers',
    INCONSISTENT_TARGETS: 'personalDay.inconsistent',
    UNSAFE_MACROS: 'personalDay.safety',
    INVALID_DAILY_TARGETS: 'personalDay.invalidTargets',
  };
  return t(keys[code] ?? 'common.errorBody');
}
