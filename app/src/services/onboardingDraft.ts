import type { TargetsDb } from './targetsService';
import type { OnboardingState } from './onboardingStateMachine';

export async function loadOnboardingDraft(
  db: TargetsDb,
  userId: string,
): Promise<Partial<OnboardingState> | null> {
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM local_onboarding_drafts WHERE user_id = ?',
    [userId],
  );
  if (!row) return null;
  const draft = JSON.parse(row.payload) as Partial<OnboardingState>;
  // Derived values are always recalculated using the current shared calculator.
  delete draft.calculatedTargets;
  delete draft.errors;
  return draft;
}

export async function saveOnboardingDraft(
  db: TargetsDb,
  userId: string,
  state: OnboardingState,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_onboarding_drafts (user_id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    [userId, JSON.stringify(state), new Date().toISOString()],
  );
}

export async function clearOnboardingDraft(db: TargetsDb, userId: string): Promise<void> {
  await db.runAsync('DELETE FROM local_onboarding_drafts WHERE user_id = ?', [userId]);
}
