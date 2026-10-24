# Steps, saved targets, and returning-user sessions

Date: 23 October 2026.

Historical session snapshot. See [the deployment follow-up](2026-10-24-fresh-start-deployment.md) for current checks, hosted repairs, and the pending administrator-only reset.

## What changed

- Removed timer-generated walking steps and manual increment buttons from the hardware walking tracker. Counts now come from sensor events; unavailable sensors do not manufacture activity. Pausing, closing, and finishing remove the sensor subscription. Session saves use the pedometer source and avoid adding a session to an iOS daily total twice.
- Replaced fabricated seven-day step history and fixed sync timestamps with owner-scoped recorded data and actual update times. Missing historical readings remain unknown. Step goal edits now persist without replacing macro targets.
- Replaced fallback calorie and macro targets in Today, the detail sheet, progress defaults, and coach requests. Missing targets show an unavailable state. Account settings receive saved goals and body values.
- Fixed onboarding IDs to use UUIDs accepted by Postgres. Existing cached targets with invalid IDs are repaired once, preserving their exact values. Target/outbox writes are transactional and precede network requests. Failed syncs remain queued. Restore reads account-specific server targets without overwriting unsynced local edits.
- Shared target state across screens and prevented account/guest fallback from selecting another user's goals. Repaired browser persistence for SQL literals, target history, sync status updates, and queue deletions.
- Persisted large native auth sessions using encrypted SecureStore chunks, retained compatibility with existing sessions, and removed silent memory-only persistence. Serialized chunk access prevents concurrent rotation/read races.
- Made auth listeners synchronous to avoid blocking refresh, connected native refresh to foreground/background state, and restored cached identity/profile for temporary offline failures. Server-rejected sessions are not restored.
- Added a sliding 30-day offline window based on successful sign-in/token refresh. Cached reads do not extend it. Expiry/sign-out route to sign in; email login only creates an account when signup is explicitly selected. Existing targets and logs survive reauthentication.
- Added local Supabase inactivity configuration and documented hosted setup. No schema or RLS changes were required.

## Verification

`npm run check`: passed, exit 0.

```text
Lint: 0 errors, 110 existing warnings
[PASS] No new style violations detected (386 grandfathered violations).
App: Test Files 55 passed (55); Tests 522 passed (522)
Core: Test Files 33 passed (33); Tests 441 passed (441)
UI: Test Files 5 passed (5); Tests 50 passed (50)
Total: 1,013 tests passed; 49 added regression tests
Typecheck: passed for app, core, and UI
npm run build:web: Exported: dist; exit 0
```

Regressions cover stationary/unsupported/denied sensors, pause/resume, historical steps, large persisted sessions and interrupted storage writes, offline/revoked auth, the exact 30-day boundary, continuing daily activity for 60 days, login versus signup, account switching, UUID repair, offline outbox retries/rollback, target restoration, and preserving macros when changing daily goals. The existing PRD worked-example tests also pass.

Native device acceptance testing and live hosted settings could not be verified in this session.

## Assumptions

- "Hardcoded values" means fabricated personal activity and fallback personal nutrition targets. Product defaults, valid user-entered totals, and safety limits remain.
- Inactivity means no successful sign-in/token refresh for 30 consecutive days. Opening cached data offline does not restart that clock.
- Historical step entries are preserved because old simulated totals cannot be reliably distinguished from valid manual entries.
- Changes are local and have not been committed, pushed, or deployed during this fix.

## Manual follow-up

- Reload/install the updated app and verify a stationary phone, a short measured walk, permission denial, pause/resume, offline restart, and unchanged onboarding macros after signing in again.
- Apply hosted Auth session settings from README: 30-day inactivity, no fixed session timebox, and no single-session restriction. Keep the one-hour access token expiry. Hosted session limits depend on the Supabase plan: https://supabase.com/docs/guides/auth/sessions . The supplied management token was rejected as invalid, so no hosted changes or migrations were performed. The token was not saved to repository files.
- Existing cached targets can be repaired; values already lost from both device and server cannot be reconstructed.

## Outside this fix

No future-phase features were added. Full Health Connect/HealthKit background history and unrelated settings placeholders still need their own work; Android's Expo Pedometer historical query is unsupported, so these changes use measured live walking-session events and retain manual entry. The broader Goals/body editor still lacks a save callback from the Me screen; its displayed fields now use saved user data, but wiring goal recalculation is separate from this persistence repair.

## Files changed

- `README.md`
- `app/package.json`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/_layout.tsx`
- `app/src/app/auth/sign-in.tsx`
- `app/src/app/auth/welcome-celebration.tsx`
- `app/src/app/index.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/components/cardio/CardioTrackerModal.tsx`
- `app/src/components/coach/CoachChatView.tsx`
- `app/src/components/diary/CaloriesDetailSheet.tsx`
- `app/src/components/onboarding/SummaryStep.tsx`
- `app/src/components/progress/CaloriesChart.tsx`
- `app/src/components/trackers/StepsCard.tsx`
- `app/src/contexts/AuthContext.tsx`
- `app/src/db/index.ts`
- `app/src/hooks/useSteps.ts`
- `app/src/hooks/useTargets.ts`
- `app/src/i18n/en.ts`
- `app/src/lib/secureStore.ts`
- `app/src/lib/supabase.ts`
- `app/src/services/activityService.ts`
- `app/src/services/aiCoachEngine.ts`
- `app/src/services/onboardingStateMachine.test.ts`
- `app/src/services/onboardingStateMachine.ts`
- `app/src/services/onboardingStatus.test.ts`
- `app/src/services/onboardingStatus.ts`
- `app/src/services/progressService.ts`
- `app/src/services/stepIntegrationService.ts`
- `app/src/services/targetsService.test.ts`
- `app/src/services/targetsService.ts`
- `app/src/services/trackersService.test.ts`
- `package-lock.json`
- `supabase/config.toml`

## Files created

- `app/src/components/SessionNavigationGuard.test.tsx`
- `app/src/components/SessionNavigationGuard.tsx`
- `app/src/components/cardio/CardioTrackerModal.test.tsx`
- `app/src/contexts/AuthContext.test.tsx`
- `app/src/hooks/useTargets.test.tsx`
- `app/src/lib/secureStore.test.ts`
- `app/src/services/sessionPersistence.test.ts`
- `app/src/services/sessionPersistence.ts`
- `app/src/services/stepIntegrationService.test.ts`
- `app/src/services/targetsPersistence.test.ts`
- `docs/notes/2026-10-23-steps-targets-sessions.md`
