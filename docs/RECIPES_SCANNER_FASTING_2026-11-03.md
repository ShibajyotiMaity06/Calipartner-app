# Recipes, scanner and fasting - 3 November 2026

## What changed

- Recipes now expose exactly High protein, High carb and Indian. Indian can combine with either nutrition focus; tapping a selected chip clears it. Search is retained. Filtering uses existing catalog nutrition tags and Indian regions, including legacy high_protein tags.
- Barcode scanning has a short camera prompt, a single framing hint and Enter barcode. Take photo and Choose photo remain available under More options.
- Settings > Fasting opens the existing tracker as a usable standalone flow: enable, choose 12:12/14:10/16:8/18:6/20:4 or custom 1-20 hours, set eating times, start/end, edit active times, and view private history/stats. A selected 18:6 now actually starts an 18-hour fast.
- Real profile age, health answers and latest low-intake state replace the old hardcoded healthy age. Missing answers have an explicit acknowledged three-question screening form; no answer is preselected. Screening and plan checks also run in the database on direct writes and tracking upserts.
- UTC saves and profile-zone eating windows/editing handle overnight windows and DST. Browser fasting caches now persist and reload correctly. Failed online saves roll back; explicit start/end retries retain identifiers/timestamps.
- New activity/configuration requires Plus or Pro, including eligible Plus trials. Free cannot start or extend a fast. An existing fast can still be safely ended after expiry; the server also permits disabling existing settings.
- Fasting reminders use the existing notification preferences, pause and quiet hours; start/window-closing reminders are restored and end reminders link to /fasting. Timers require an explicit End action and never auto-save completion. The existing 20/24-hour safety prompts remain.

Targeted core/hook/service/database repairs were necessary because the old view depended on hardcoded screening, a 16-hour default and inaccessible navigation. The owner scope notes in AGENT_RULES, PRD and BUILD_PLAN record this request over the older conflicting free-fasting/filter requirements. The user's pre-existing app/.env.example edit is untouched and excluded from delivery.

## Files created or changed

- `AGENT_RULES.md`
- `app/src/app/(tabs)/me.tsx`
- `app/src/components/diary/BarcodeScannerModal.tsx`
- `app/src/components/diary/ScanRepairs.test.tsx`
- `app/src/components/fasting/FastingCard.tsx`
- `app/src/components/fasting/FastingEditTimesModal.tsx`
- `app/src/components/fasting/FastingProtocolModal.tsx`
- `app/src/components/fasting/FastingTimerModal.tsx`
- `app/src/components/recipes/RecipeBrowseView.tsx`
- `app/src/components/recipes/RecipeFilterBar.tsx`
- `app/src/db/webQueries.ts`
- `app/src/hooks/useFasting.ts`
- `app/src/i18n/en.ts`
- `app/src/services/fastingService.ts`
- `app/src/services/localNotificationService.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `packages/core/src/fasting.test.ts`
- `packages/core/src/fasting.ts`
- `packages/core/src/recipes.ts`
- `packages/core/src/types.ts`
- `scripts/paid_feature_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `app/src/app/fasting.tsx`
- `app/src/components/recipes/RecipeFilterBar.test.tsx`
- `app/src/hooks/useFastingFlow.test.tsx`
- `app/src/i18n/fastingRefresh.ts`
- `app/src/services/fastingOnlineSave.test.ts`
- `packages/core/src/fastingRefresh.test.ts`
- `scripts/fasting_access_cases.mjs`
- `scripts/fasting_refresh_browser_audit.mjs`
- `supabase/migrations/20261103150000_fasting_access_and_safety.sql`
- `docs/RECIPES_SCANNER_FASTING_2026-11-03.md` (this report).

## Tests and results

New tests cover all three filter controls and actual catalog selection, collapsed scanner options, stored-zone/overnight/DST windows, protocol validation, reminder quiet hours, real online-save rollback/reopen/owner isolation, hook retry identifiers and Free recovery, and SQL plan/safety/privacy/idempotency enforcement.

```text
npm run format:check: All matched files use Prettier code style!
npm run lint: 0 errors, 72 existing warnings; no new style violations (254 grandfathered violations).
npm run typecheck: app, core and UI passed.
App: Test Files 113 passed (113); Tests 713 passed (713).
Core: Test Files 48 passed (48); Tests 531 passed (531).
UI: Test Files 6 passed (6); Tests 55 passed (55).
Database migrations: 89 passed.
Fasting access/safety SQL tests: Free denial, Plus/Pro/Plus trial, expiry recovery,
private histories, age/screening/low-intake gates, time/window validation and
idempotent tracking saves passed.
All existing SQL/RLS, online save, billing, room, chat, privacy and challenge suites passed.
Edge billing: ok | 9 passed | 0 failed.
Edge food/photo: ok | 21 passed | 0 failed.
Edge push/chat: ok | 16 passed | 0 failed.
Edge coach: ok | 14 passed | 0 failed.
Edge challenges: ok | 7 passed | 0 failed.
Final hook regression after owner-state reset: Tests 2 passed (2).
Web: Exported: dist.
Android Hermes: Exported: ../.cache/fasting-android.
Browser: three recipe filters at 375/390/844px, simple scanner, Free gate,
Plus enable/protocol, failed-save rollback and same-ID retry, active timer reload,
expired-plan end, history and acknowledged health screening/safety passed.
```

Browser screenshots are in `.artifacts/fasting-refresh/` (ignored). This audit uses intercepted backend fixtures, not hosted account writes. Android validation is a bundle export, not a device or EAS install.

## Assumptions

- High protein/carbohydrate use the supplied catalog's labels, rather than invented nutrient thresholds. Indian includes the catalog's Indian regional cuisine labels.
- Eligible Plus trials follow the existing server entitlement rules. Pro trial access remains governed by those rules.
- Fasting stays in Settings because the requested Log hub has only food, workout, water, steps and weight. No extra Log tile or navigation redesign was added.
- Histories and personal stats remain private and do not contribute to squad rankings.

## Deployment and manual checks

Applied `20261103150000_fasting_access_and_safety.sql` to the linked Supabase project. The dry run included only this migration. A read-only remote check confirmed the migration, paid/screening/retry guards and fasting-table RLS. No Edge Function deployment or new account/key setup was required. Credentials were supplied only to the deployment process, not saved in source.

Install/reload the updated app. Native camera permissions and notification delivery/background/resume should still be checked on physical Android/iOS devices. Daily recurring reminders use the device notification clock; keep the device and profile time zones aligned. End reminders and timer/edit calculations use the profile zone. Existing notification settings control delivery.

## Later scope

No unrelated features were added. Cross-device delivery and recurring notifications across differing device/profile time zones require a dedicated native-device follow-up.
