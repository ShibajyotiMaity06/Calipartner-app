import type { SupabaseClient } from '@supabase/supabase-js';
import { secureStoreAdapter } from '@/lib/secureStore';

export const ACCOUNT_RESET_RECEIPT = 'calipartner.account-data-reset';

export class ResetCheckUnavailableError extends Error {
  readonly code = 'RESET_CHECK_UNAVAILABLE';
}

/** Check before mounting any hooks that can flush an old offline queue. Never touches auth storage. */
export async function applyAccountDataReset(
  supabase: SupabaseClient,
  clearData: () => Promise<void>,
  storage: Pick<typeof secureStoreAdapter, 'getItem' | 'setItem'> = secureStoreAdapter,
): Promise<boolean> {
  let response;
  try {
    response = await supabase
      .from('remote_config')
      .select('value')
      .eq('key', 'account_tracking_reset')
      .maybeSingle();
  } catch (error) {
    throw new ResetCheckUnavailableError(error instanceof Error ? error.message : String(error));
  }
  const { data, error } = response;
  if (error) throw new ResetCheckUnavailableError(error.message);
  if (!data) return false;
  const value = data.value as { epoch?: unknown; reset_at?: unknown };
  if (
    typeof value.epoch !== 'string' ||
    !value.epoch ||
    typeof value.reset_at !== 'string' ||
    !Number.isFinite(Date.parse(value.reset_at))
  ) {
    throw new Error('Invalid account reset marker');
  }
  if ((await storage.getItem(ACCOUNT_RESET_RECEIPT)) === value.epoch) return false;
  await clearData();
  // Persist only after clearing every table successfully; interrupted resets retry before syncing.
  await storage.setItem(ACCOUNT_RESET_RECEIPT, value.epoch);
  return true;
}
