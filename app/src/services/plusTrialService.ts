import type { PlusTrialOffer } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { getOrGenerateDeviceHash } from './deviceService';
const listeners = new Set<() => void>();
export const plusTrialEvents = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
function readOffer(data: unknown): PlusTrialOffer {
  const value = data as PlusTrialOffer | null;
  if (
    !value ||
    typeof value.eligible !== 'boolean' ||
    typeof value.active !== 'boolean' ||
    typeof value.expired !== 'boolean' ||
    !Number.isFinite(Date.parse(value.server_now)) ||
    (value.active && (!value.ends_at || !Number.isFinite(Date.parse(value.ends_at))))
  )
    throw new Error('TRIAL_NOT_CONFIRMED');
  return value;
}
export async function fetchPlusTrialOffer(): Promise<PlusTrialOffer> {
  const { data, error } = await getSupabase().rpc('get_plus_trial_offer', {
    p_device_hash: await getOrGenerateDeviceHash(),
  });
  if (error) throw error;
  return readOffer(data);
}
export async function claimPlusTrial(requestId: string): Promise<PlusTrialOffer> {
  const { data, error } = await getSupabase().rpc('claim_plus_trial', {
    p_client_id: requestId,
    p_device_hash: await getOrGenerateDeviceHash(),
  });
  if (error) throw error;
  const offer = readOffer(data);
  if (!offer.active) throw new Error('TRIAL_NOT_CONFIRMED');
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* Presentation listeners cannot undo the acknowledged claim. */
    }
  }
  return offer;
}
