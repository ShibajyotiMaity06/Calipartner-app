# Logging and settings repairs — 29 October 2026

## What changed

- Fixed the Log menu passing weight notes and date in the wrong order. Weight logging uses the authenticated owner before goals hydrate, uses the stored time zone, rejects invalid dates/weights and prevents repeated submission. Recoverable local rows affected by the swapped fields are repaired and requeued under their existing UUID. Browser weight editing/deletion now handles multiline SQL and UUID lookups correctly.
- Friend sends reuse the pending request UUID when retried. Friend search, sending, recipient inbox and acceptance passed against disposable hosted accounts.
- Invitation names come through a sender/recipient-only SQL projection, with block checks. The inbox prefers the person's name and falls back to a real username or neutral copy.
- Goal and challenge reads proceed when the upload/reset check is temporarily unavailable; writes retain the existing reset gate. A cached goal no longer displays the generic failed-refresh warning on Account.
- Added Custom macros in Account settings. Active Plus/Pro, including eligible Plus trial, can enter whole grams, review the derived calorie goal, then choose **Override current goals** or **Keep current goals**. Keeping performs no save. Overrides preserve history, persist locally, sync idempotently and restore after reload. The database enforces access even when the custom marker is omitted; existing saved overrides survive expiry. Floors, goal direction, low-BMI cut protection and the 1% weekly-change limit remain enforced for overrides.
- Reused the existing skeleton components in the common loading state and affected Account, Today, Room, Community, weight and challenge views. Abbreviated height units to cm, ft and inch. Removed the duplicate Focus-sharing section from privacy while keeping the Log timer.

## Files created

- `app/src/components/profile/CustomMacrosModal.tsx`
- `app/src/hooks/useChallenges.test.tsx`
- `app/src/hooks/useWeight.test.tsx`
- `app/src/services/weightWebPersistence.test.ts`
- `packages/core/src/customMacros.test.ts`
- `scripts/logging_settings_cases.mjs`
- `scripts/logging_settings_hosted_audit.mjs`
- `supabase/migrations/20261029000029_logging_settings_repairs.sql`
- `supabase/migrations/20261029000030_goal_override_owner_guard.sql`
- `docs/LOGGING_SETTINGS_REPAIRS.md`

## Files changed

- Screens: `app/src/app/(tabs)/log.tsx`, `me.tsx`, `room.tsx`, `today.tsx`; `app/src/app/friends.tsx`.
- Components: `app/src/components/LoadingState.tsx`, `friends/CommunityPanel.tsx`, `onboarding/HeightField.tsx`, `progress/ChallengesView.tsx`, `rooms/PrivacySettingsModal.tsx`, `rooms/RequestsInboxModal.tsx`, `rooms/RequestsInboxModal.test.tsx`, `trackers/WeightCard.tsx`, `trackers/WeightEntryModal.tsx`.
- Storage: `app/src/db/index.ts`, `app/src/db/migrations.ts`.
- Hooks: `app/src/hooks/useChallenges.ts`, `useTargets.ts`, `useTargets.test.tsx`, `useWeight.ts`.
- Copy: `app/src/i18n/en.ts`.
- Services/tests: `app/src/services/friendsService.ts`, `friendsService.test.ts`, `roomService.ts`, `roomService.test.ts`, `targetsService.ts`, `targetsPersistence.test.ts`, `trackersService.test.ts`, `weightService.ts`.
- Core: `packages/core/src/targets.ts`, `packages/core/src/types.ts`.
- Database test runner/fixtures: `scripts/test_rooms_v3.mjs`, `scripts/billing_goal_cases.mjs`. The existing billing fixture now supplies the calculated carbohydrate amount instead of an unrelated hard-coded value, preserving its original custom-pace test.
- Scope record: `docs/prd.md`.

## Verification

Commands completed successfully:

- `npm run format:check`: `All matched files use Prettier code style!`
- `npm run lint`: `0 errors, 75 warnings`; existing warnings retained. Token lint: `No new style violations detected (300 grandfathered violations).`
- `npm run typecheck`: app, core and UI passed.
- `npm test`: every workspace, database and Edge Function suite passed. Summary lines:

```text
App:  Test Files 91 passed (91); Tests 719 passed (719)
Core: Test Files 42 passed (42); Tests 525 passed (525)
UI:   Test Files 5 passed (5); Tests 52 passed (52)
Database migrations: 80 passed
Logging/settings database tests: 3 passed, 0 failed
```

All 18 database suites passed (105 cases total). Edge suites: billing `9 passed | 0 failed`, food/photo `17 passed | 0 failed`, push/media `16 passed | 0 failed`, coach `9 passed | 0 failed`, challenges `7 passed | 0 failed`.

New regressions cover invalid and swapped weight dates, UUID-based browser edit/delete and ownership, recovered outbox payloads, authenticated logging without cached goals, local-day boundaries, duplicate friend retries, challenge/goal reads during upload-check failure, custom-target persistence, macro safety, Free/expired and marker-bypass rejection, Plus/Pro/trial access, retaining saved overrides after expiry, and private invitation identity projections.

`npx expo export --platform all --output-dir ../.cache/repair-web-export` passed for web, iOS and Android. These are bundle/export checks, not signed store builds or physical-device tests.

`npx tsx scripts/logging_settings_hosted_audit.mjs` passed against the exported app and live Supabase: weight with notes/date, friend request and acceptance, empty/active challenges, goals modal back navigation, Free macro gate, Plus keep/override/reload and invitation sender names. Disposable Auth accounts, rooms, challenges and owned records were removed in `finally`. The original generic friend/challenge failures did not reproduce with new accounts; the retry and blocked-read paths have automated regressions.

The migrations above were deployed with the Supabase CLI. An isolated staging directory omitted only older files absent from hosted migration history; dry runs listed only these new repair migrations. A follow-up owner guard checks identity before private plan validation to prevent probing peers through validation errors. No older migration or hosted history entry was rewritten.

## Assumptions

- Keep Focus in the +/Log menu and remove the duplicate privacy section. Existing stored sharing values are unchanged.
- Custom macros means protein, carbohydrate and fat grams, with calories derived from those values. New overrides apply from confirmation time; historical targets remain intact.
- Free users can see the locked settings entry. Eligible Plus trials follow existing Plus entitlements.

## Manual follow-up

Load the updated web app or install a native build from this commit. No new keys, accounts or console settings are required. Native physical-device smoke testing remains a manual release check.

## Later maintenance noticed

Hosted migration history lacks ten older local migration entries. Reconcile that history separately after auditing the deployed definitions; do not blindly apply the old migrations, some of which contain historical plan grants. No later-phase features were built.
