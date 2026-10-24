# Fresh start preparation and deployment

Date: 24 October 2026.

## Built and verified

The steps, persisted macro targets, encrypted sessions and 30-day offline window from the preceding session are included in this change. The additional account-reset check clears stale SQLite/browser tracking and outboxes once, before upload, without deleting login tokens. Existing identities return to goal setup when no saved targets exist; they do not repeat account signup. Network-check failures retain local target saves and queues. Normal foreground checks do not reset a running walking screen.

Two new migrations are applied to the hosted Calipartner project (`ipxsziqwrowxblwalnqj`):

- `20261024035839_fix_saved_target_queries.sql` fixes nonexistent `goal_profiles.target_calories` references in summary/progress/room functions, using the stored `daily_calorie_target` and the same local day's boundary. Existing function ACLs, safety formulas, privacy and entitlement checks remain.
- `20261024040216_reject_stale_tracking_after_reset.sql` prevents pre-reset queued tracking records from being restored by older app installations after an administrative reset marker is present. Shared catalog rows and account/membership/billing tables are excluded.

The requested cleanup is a separate, explicit maintenance script, `supabase/maintenance/fresh_start_20261023.sql`. It was tested in a rollback-only transaction: full account/room/member/entitlement snapshots stay equal; cleanup clears personal tracking; repeating the same epoch preserves subsequently inserted data. It is not an automatically applied data-wiping migration.

## Actual deployment and reset status

Automatic approval review rejected the live all-account cleanup command with **blocked by policy**, without a more specific reason. The command did not start. A subsequent read-only check confirmed **reset_applied=false**, with 3 accounts, 3 rooms, 3 room-membership records, 2 entitlement records and 2 existing health-screening records. No live fresh-start deletion has been performed.

A verified recovery backup of 43 application tables exists outside git at:
`C:/Users/debajyothi.m/AppData/Local/CaliPartner/private-backups/before-fresh-start-20261024T035804Z.json`.
The backup contains private data and must not be committed or uploaded publicly. No access token is stored in repository files.

The Supabase hosting project is on Free. The attempted session-settings update returned HTTP 402, saying session limits require Pro or above. Read-back confirms existing settings remain: JWT 3600 seconds, no fixed timebox, no single-session restriction, refresh-token rotation enabled, no hosted inactivity limit. The app's sliding 30-day offline window remains implemented. CaliPartner users' Pro memberships are separate from the Supabase hosting plan, and the 2 entitlement records are preserved.

The live ledger lacks several older repository migrations. In particular, `20261021000003_fix_progress_target_calories_and_leave_room.sql` deletes room memberships. It was deliberately not applied because the user explicitly required preserving memberships. Do not use an indiscriminate `db push --include-all` without reviewing that history.

## Checks

```text
Format check: All matched files use Prettier code style!
Lint: 0 errors, 110 pre-existing warnings
Token lint: PASS; no new style violations
TypeScript: PASS for app, core, UI
App: Test Files 57 passed (57); Tests 535 passed (535)
Core: Test Files 33 passed (33); Tests 441 passed (441)
UI: Test Files 5 passed (5); Tests 50 passed (50)
Total automated tests: 1,026 passed
Web build: Exported: dist; exit 0
Live SQL regression: 5 checks passed with fixtures rolled back
Maintenance dry run: preservation and idempotence checks passed, all changes rolled back
```

New coverage includes one-time reset receipts, preserving credentials, discard-before-sync ordering, cache/queue clearing in real native SQLite and persistent browser storage, failure recovery, server-outage local saves, normal foreground behavior, and returning a reset account to goal setup. The SQL regression verifies same-day custom calories/protein, rejecting old queued writes, and accepting new data.

Native sensor validation on an actual Android/iOS development build remains manual. Automatic counting uses hardware events during an active walking session; browser/unsupported/denied sensors cannot measure steps. Full Health Connect/HealthKit background history remains outside this fix.

## Assumptions and manual actions

- Preserve both paid/Pro subscriptions and room memberships, as explicitly confirmed by the user. Preserve account identities, login sessions, rooms, catalog content, billing/webhook/trial-abuse/security records.
- The reset covers personal tracking/targets/preferences/consents and room activity/chat content. Basic identity/profile fields are retained. The destructive action remains pending because of the automatic rejection.
- An administrator must review and execute the maintenance SQL in the Supabase SQL editor to finish the requested global reset. On the updated app's next online check, the resulting marker clears stale local records once and opens goal setup.
- Save fresh targets after that reset. Successful saves persist through restarts and reauthentication; an unavailable target is still possible when data genuinely has not been saved/restored, rather than substituting made-up values.
- Reload/install the updated app. Git push publishes source; it does not install a native build on a phone.
- No hosting-plan upgrade, subscription change or membership removal was performed. No future-phase features were added.

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
- `app/src/services/syncService.ts`
- `app/src/services/targetsService.test.ts`
- `app/src/services/targetsService.ts`
- `app/src/services/trackersService.test.ts`
- `package-lock.json`
- `supabase/config.toml`

## Files created

- `app/src/components/AccountDataResetGate.test.tsx`
- `app/src/components/AccountDataResetGate.tsx`
- `app/src/components/SessionNavigationGuard.test.tsx`
- `app/src/components/SessionNavigationGuard.tsx`
- `app/src/components/cardio/CardioTrackerModal.test.tsx`
- `app/src/contexts/AuthContext.test.tsx`
- `app/src/hooks/useTargets.test.tsx`
- `app/src/lib/secureStore.test.ts`
- `app/src/services/accountDataReset.test.ts`
- `app/src/services/accountDataReset.ts`
- `app/src/services/accountSyncGate.ts`
- `app/src/services/sessionPersistence.test.ts`
- `app/src/services/sessionPersistence.ts`
- `app/src/services/stepIntegrationService.test.ts`
- `app/src/services/targetsPersistence.test.ts`
- `docs/notes/2026-10-23-steps-targets-sessions.md`
- `docs/notes/2026-10-24-fresh-start-deployment.md`
- `supabase/maintenance/fresh_start_20261023.sql`
- `supabase/migrations/20261024035839_fix_saved_target_queries.sql`
- `supabase/migrations/20261024040216_reject_stale_tracking_after_reset.sql`
- `supabase/tests/saved_target_queries.test.sql`
