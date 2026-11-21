import type { TargetsDb } from './targetsService';
import type { Profile } from '@calipartner/core';
import { OnboardingStateMachine, type OnboardingState } from './onboardingStateMachine';

export function resumeOnboardingDraft(
  draft: Partial<OnboardingState> | null,
  profile: Profile | null,
  fromGuest = false,
): OnboardingStateMachine {
  const goal = draft?.goal === 'bulk' ? 'bulk' : 'cut';
  const machine = new OnboardingStateMachine({
    ...draft,
    goal,
    goalSelected: draft?.goalSelected === true && draft.goal !== 'maintain',
    currentStep: 'goal',
    heightCm: draft?.heightCm ?? 0,
    weightKg: draft?.weightKg ?? 0,
    nickname: draft?.nickname || profile?.nickname || '',
    sex: profile?.sex ?? draft?.sex ?? 'male',
    dateOfBirth:
      profile?.date_of_birth ??
      (fromGuest && String(draft?.currentStep) === 'completed' ? '' : (draft?.dateOfBirth ?? '')),
    weeklyRateKg: draft?.goal === 'maintain' ? 0.5 : (draft?.weeklyRateKg ?? 0.5),
    errors: {},
  });
  const savedStep = draft?.currentStep;
  if (savedStep)
    machine.goToStep(fromGuest && profile && savedStep === 'reveal' ? 'paywall' : savedStep);
  return machine;
}

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
