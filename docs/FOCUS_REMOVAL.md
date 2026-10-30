# Focus removal — 29 October 2026

## Delivered

- Removed the Focus route, personal/shared timer components, settings, hooks, service and feature-specific core functions/types.
- Removed Focus from the Log menu, room progress metrics/totals, privacy schema, daily-goal props, notifications copy, plan promises, legal copy and component gallery. Current plan documentation and owner scope records now mark Focus retired.
- Removed Focus challenge tasks/templates and stopped scoring, access, reminders and pushes for retired challenges. Existing Focus challenges are cancelled and omitted from current views; their historical rows remain private.
- Deleted the deployed `cron-focus-maintenance` Edge Function, removed its local configuration and unscheduled the database job. Retired session RPCs, table access and Realtime publication access are revoked for clients/workers.
- Cancelled old on-device timer notifications and routed old notification taps to Today. Native migrations remove retired uploads; sync discards legacy timer writes. Cached challenge templates/instances and their queued actions are filtered without affecting current actions or other accounts.
- Kept `getLocalDateString` as a shared local-day helper, preserving its public API and time-zone behavior after deleting the timer module.

## Files

Created:

- `app/src/components/navigation/LogHubRetirement.test.tsx`
- `packages/core/src/activityRetirement.test.ts`
- `scripts/activity_retirement_cases.mjs`
- `supabase/migrations/20261029000031_retire_focus_time.sql`
- `docs/FOCUS_REMOVAL.md`

Deleted:

- `app/src/app/focus.tsx`
- All files under `app/src/components/focus/`.
- `app/src/hooks/useFocusStats.ts`, `usePersonalFocus.ts`, `useRoomFocus.ts`, `useRoomFocus.test.ts`.
- `app/src/services/focusService.ts`, `focusService.test.ts`.
- `packages/core/src/focus.ts`, `focus.test.ts`, `focus_attack.test.ts`.
- `supabase/functions/cron-focus-maintenance/index.ts` and obsolete `supabase/tests/focus_attack.test.sql`.

Changed:

- App initialization/gallery: `app/src/app/_layout.tsx`, `app/src/app/dev/gallery.tsx`.
- Components: legal `TermsOfServiceModal.tsx`; navigation `navigationUI.test.ts`; notifications `NotificationSettingsScreen.tsx`; profile `DailyGoalsModal.tsx`, `profileUI10.test.ts`; rooms `RoomProgressView.tsx`, `paywallUI.test.ts`, `roomsUI.test.ts`.
- Storage/copy: `app/src/db/migrations.ts`, `app/src/i18n/en.ts`, `app/src/i18n/challengeMessages.ts`.
- Compatibility and tests: `app/src/lib/deepLinks.ts`, `deepLinks.test.ts`; services `challengeService.ts`, `challengeService.test.ts`, `localNotificationService.ts`, `localNotificationService.test.ts`, `syncService.ts`, `syncService.test.ts`.
- Core: `packages/core/src/index.ts`, `types.ts`, `localDay.ts`, `rooms.ts`, `notifications.ts`, `challengeEngine.ts`, `challengeViewModel.ts`, `__fixtures__/challengeConfig.json`.
- UI package: `packages/ui/src/components/LogHubView.tsx`, `Icons.tsx`, `TimerDisplay.tsx`, `TabBar.tsx`, `navigation.test.ts`.
- Audits/runner: `scripts/challenges_browser_audit.mjs`, `challenges_hosted_audit.mjs`, `logging_settings_hosted_audit.mjs`, `test_rooms_v3.mjs`.
- Backend: `supabase/config.toml` and obsolete timer import-map entries in the nine `deno.json` files for ai-coach, ai-food-photo, calculate-targets, chat-signed-url, chat-upload-url, dodo-checkout, dodo-webhook, food-lookup and revenuecat-webhook.
- Requirements/history: `docs/prd.md`, `docs/BUILD_PLAN.md`, `docs/PLANS_AND_FEATURES.md`, `docs/LOGGING_SETTINGS_REPAIRS.md`.

## Checks and regressions

All required checks passed:

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 75 existing warnings
Token lint: No new style violations detected (289 grandfathered violations).
TypeScript: app, core and UI passed
App: Test Files 89 passed (89); Tests 690 passed (690)
Core: Test Files 41 passed (41); Tests 497 passed (497)
UI: Test Files 5 passed (5); Tests 52 passed (52)
Database migrations: 81 passed
Activity retirement database tests: 5 passed, 0 failed
```

Every existing database and Edge Function suite passed. Obsolete timer tests were replaced with regressions for unavailable client APIs, preserved historical records, skipped pushes, disabled scoring, private archives, removed privacy aliases, cached templates and queued actions, notification cancellation, legacy deep links, and the rendered Log menu with/without fasting.

Android, iOS and web Expo exports passed. These verify bundling; physical-device testing and signed store builds are separate release steps.

The live browser audit passed for weight logging, friends, invitations and macro keep/override/reload, plus Focus absence in the Log menu, challenge chooser, room tabs/progress and notification settings. It also verified that the old timer API cannot start a session. Disposable fixture accounts, rooms, challenges and owned records were removed afterward.

The retirement migration was deployed with the Supabase CLI after a dry run listed only `20261029000031_retire_focus_time.sql`. No committed migration was edited. The deployed maintenance worker was deleted.

## Assumptions

Focus means the study/work timer feature. Keyboard focus, camera autofocus and screen-navigation focus remain platform behavior. Historical records are retained privately; removal does not erase unrelated tracking data.

## Manual follow-up

Reload the web app or install a native build from this commit. No new keys, accounts or console settings are required. Existing older installed binaries need updating to remove their old UI.

## Later work

No future feature was built. The previously recorded mismatch between hosted and local historical migration entries remains separate maintenance; this deployment applied only the new retirement migration.
