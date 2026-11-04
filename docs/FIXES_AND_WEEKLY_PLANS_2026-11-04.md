# Food, navigation, Squad and weekly plans - 4 November 2026

## Built

- Fixed USDA energy import: supports energy IDs 1008, 2048, 2047 and kJ 1062. A protein/fat entry with missing energy cannot be saved as a misleading zero-calorie meal. Public cache upgrades restore known bundled energy values. Older affected USDA logs request an authenticated upstream repair using an exact food name, brand and macro match; SQL repairs only matching portion snapshots. Unresolvable nutrition shows an actionable unavailable state rather than inventing calories.
- Installed the 2,351 bundled catalog records through a new migration, preserving existing private foods and nonzero historical nutrition. This removes the separate-seed dependency that can cause food/stat foreign-key failures. Sodium storage precision accommodates the supplied catalog without guessing unit conversions. The earlier 247-food migration remains unchanged.
- Back follows complete tab history, including repeat visits. Squad yields to the navigator after its section history ends. Log subflows return to the Log hub, and closing the hub returns to its actual origin. Nested sheets and the food-planning questionnaire preserve their previous steps. Android stays on the current screen when there is no previous page.
- Removed idle 30-second Squad/Compare polling. Reads refresh on focus, date changes, acknowledged local diary actions and explicit pull/retry. Compare retains loaded details during a refresh. Styled each food as a card with a peer-only Log action, destination meal selection, stable retry UUID and server acknowledgement. The new SQL copy endpoint rechecks joined membership, usable room, Plus detail access, blocks and source ownership; it never grants base-table peer access.
- Added a single-member dropdown below Compare on Squad Overview. It uses the same person panel as a leaderboard tap, including macros, steps, meals, workouts and optional measurement privacy.
- After acknowledged onboarding goals, offered a weekly workout and diet setup. Inputs include actual workout days, home/basic/advanced gym, available equipment, experience, session time, movement limitations, country, cuisine, dietary pattern, allergies, exclusions, meals, cooking time and budget, with explicit AI consent. Preparation uses contextual static content and a standard busy indicator, with no fake progress or generated demo plan.
- Added the authenticated `weekly-plan` Edge Function, pure core validation, private plan storage and a gated SQL read. Free and every trial receive Monday only, without later days or tips in the response. Active database `paid` Plus/Pro receives all seven days and personal tips. Expired access returns to Monday; direct table reads and client-generated full-plan writes are denied. The existing Pro coach/photo rules are unchanged.
- Saved plans are available from You and inside Workout. The current local day's accessible preferred exercises prefill a new workout as uncompleted draft sets, with no invented weight or logged activity. Paid users can edit the preferred routine with revision checks and retry-safe acknowledged saves. The weekly-plan purchase screen explicitly excludes trial access, and nested workout purchases remain above their parent modal.

## Tests and results

New coverage exercises actual Expo tab/stack reducers, Android Back dispatch, questionnaire Back with retained inputs, peer-only copy controls and failed acknowledgements, retry UUID persistence, food energy parsing/recovery, equipment/diet/calorie validation, owner isolation and server-side trial/expiry gates. Database tests save chicken and eggs through the real atomic tracking RPC and assert exact Squad calorie totals.

```text
npm run format:check: All matched files use Prettier code style!
npm run lint: 0 errors, 72 existing warnings; no new style violations.
npm run typecheck: app, core and UI passed.
App: Test Files 118 passed (118); Tests 725 passed (725).
Core: Test Files 49 passed (49); Tests 546 passed (546).
UI: Test Files 6 passed (6); Tests 55 passed (55).
Database migrations: 93 passed; all SQL/RLS suites passed.
Edge billing: ok | 9 passed | 0 failed.
Edge food/photo and energy recovery: ok | 24 passed | 0 failed.
Edge push/chat: ok | 16 passed | 0 failed.
Edge coach: ok | 14 passed | 0 failed.
Edge weekly planning: ok | 5 passed | 0 failed.
Edge challenges: ok | 7 passed | 0 failed.
Web build: Exported: dist.
Android Hermes bundle: Exported: ../.cache/nov4-android.
Browser audit: chronological nested/tab/Log Back, inline member selection,
stable idle Compare, acknowledged peer-food copying, Monday-only Free/trial,
full paid week/tips, trial paywall Back and persisted routine editing passed
at 375/390/844px, alongside the preceding food/polish regression flows.
```

Browser screenshots are in `.artifacts/nov4-repairs/` (ignored generated artifacts). The audit intercepts backend calls with isolated fixtures; it does not prove hosted deployment, live billing or live model output. Native verification covers Android Back handlers and the actual Expo navigation reducers plus an Android bundle export; it is not a physical Android/iOS or EAS build test.

## Assumptions

- "Friend" in the Compare request means another joined Squad member. Your own foods never show the Log action. Existing paid Squad-detail access, including eligible Plus trials, still applies to copying; the new purchased-only restriction applies to weekly planning.
- Pro inherits purchased Plus weekly-plan access. Full access requires the entitlement row's active `paid` status; trial, free and expired rows never unlock it. No client-only flag or checkout success can unlock hidden days.
- Planning is optional after saved goals and can be opened later from You or Workout. It never replaces saved calorie/macro targets or automatically logs meals/workouts. Diet nutrition is explicitly estimated.
- Planning allows one to six workout days, three to five meals, sessions of 15 to 90 minutes and cooking preferences of 5 to 90 minutes. Limits are two distinct plan requests per stored-zone day and at most three attempts per request; duplicate completed retries do not call the provider again. The existing AI kill switch applies.
- Country/cuisine and limitations are provided by the user. Missing health screening, age under 18 or positive screening flags block generated planning. AI suggestions cannot guarantee allergen safety or assess injuries.
- No previous screen means stay in the app. Normal completion actions can close their finished flow; phone/browser Back preserves the preceding view.
- Extension maps in existing Edge configurations are updated because their shared core entry point now exports the new pure module. The user's pre-existing `app/.env.example` change is excluded.

## Manual deployment and verification

Supabase CLI inspection returned `AccessTokenRequiredError`; no hosted migration or function was deployed in this session.

1. Authenticate securely with `npx supabase login` or configure `SUPABASE_ACCESS_TOKEN` outside the repository.
2. Review `npx supabase migration list --linked` and `npx supabase db push --linked --dry-run`, then apply reviewed migrations with `npx supabase db push --linked`. New migrations are:
   - `20261104000000_food_catalog_energy_repair.sql`
   - `20261104000100_squad_food_copy.sql`
   - `20261104000200_personal_weekly_plans.sql`
   - `20261104000300_recover_missing_food_energy.sql`
3. Deploy `npx supabase functions deploy food-lookup` and `npx supabase functions deploy weekly-plan`, using the checked-in function configurations. Do not bypass their in-handler authentication.
4. Verify existing server secrets: a configured Groq/model, OpenRouter/model or Gemini provider; the optional `WEEKLY_PLAN_MODEL` overrides the Groq model for this feature. USDA recovery uses the existing `USDA_API_KEY` configuration; the public demo fallback is rate limited. No AI key belongs in app configuration or git.
5. Release/serve the updated app. Open the affected friend's Home to request recovery of older USDA energy records. Confirm the same calories in their diary and the Squad projection. A source record that cannot be matched safely needs a verified replacement/custom nutrition entry.
6. Test on real Android and iOS devices: repeated tabs, Person/Compare, Food to quantity to Food to Log hub to origin, questionnaire steps, nested Workout to weekly plan to paywall and Back, keyboard/gesture Back, large system text and screen readers. Verify real Free, Plus trial, purchased Plus/Pro and expired entitlements, and validate a live generated plan.

## Later work noticed, not built

Some existing packaged-food source rows contain implausible sodium values. These were preserved rather than silently converted; source verification and broader catalog nutrition cleanup remain separate work. No unrelated future feature phase was implemented.

## Files created or changed

- `AGENT_RULES.md`
- `app/src/app/(tabs)/_layout.tsx`
- `app/src/app/(tabs)/log.tsx`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/_layout.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/app/paywall.tsx`
- `app/src/app/squad/compare.tsx`
- `app/src/app/squad/person.tsx`
- `app/src/app/weekly-plan.tsx`
- `app/src/components/diary/FoodLogModal.tsx`
- `app/src/components/diary/QuantityModal.tsx`
- `app/src/components/diary/ScanRepairs.test.tsx`
- `app/src/components/navigation/ChronologicalBack.test.ts`
- `app/src/components/navigation/HardwareBackHandler.test.tsx`
- `app/src/components/navigation/HardwareBackHandler.tsx`
- `app/src/components/onboarding/WeeklyPlanForm.test.tsx`
- `app/src/components/onboarding/WeeklyPlanForm.tsx`
- `app/src/components/onboarding/WeeklyPlanPreparing.tsx`
- `app/src/components/progress/PersonalDiaryView.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/PersonalDayCard.tsx`
- `app/src/components/rooms/RoomAccess.test.tsx`
- `app/src/components/rooms/RoomPrivacy.test.tsx`
- `app/src/components/rooms/SquadFoodItem.test.tsx`
- `app/src/components/rooms/SquadFoodItem.tsx`
- `app/src/components/rooms/SquadPersonPanel.tsx`
- `app/src/components/rooms/SquadViews.tsx`
- `app/src/components/workouts/WeeklyPlanEntry.tsx`
- `app/src/components/workouts/WeeklyPlanScreenModal.tsx`
- `app/src/components/workouts/WeeklyRoutineEditor.tsx`
- `app/src/components/workouts/WorkoutLoggerModal.tsx`
- `app/src/hooks/useBrowserModalBack.ts`
- `app/src/hooks/useDiary.ts`
- `app/src/hooks/useSquad.test.tsx`
- `app/src/hooks/useSquad.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/fixNovember.ts`
- `app/src/services/foodService.test.ts`
- `app/src/services/foodService.ts`
- `app/src/services/roomMealService.ts`
- `app/src/services/weeklyPlanService.test.ts`
- `app/src/services/weeklyPlanService.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `package.json`
- `packages/core/src/food_lookup.ts`
- `packages/core/src/food_lookup_mapping.test.ts`
- `packages/core/src/index.ts`
- `packages/core/src/weeklyPlan.test.ts`
- `packages/core/src/weeklyPlan.ts`
- `scripts/nov4_browser_audit.mjs`
- `scripts/test_rooms_v3.mjs`
- `scripts/weekly_plan_cases.mjs`
- `supabase/config.toml`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/challenges-api/deno.json`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/food-lookup/index.ts`
- `supabase/functions/food-lookup/recoverEnergy.test.ts`
- `supabase/functions/food-lookup/recoverEnergy.ts`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/functions/weekly-plan/deno.json`
- `supabase/functions/weekly-plan/deno.lock`
- `supabase/functions/weekly-plan/index.test.ts`
- `supabase/functions/weekly-plan/index.ts`
- `supabase/migrations/20261104000000_food_catalog_energy_repair.sql`
- `supabase/migrations/20261104000100_squad_food_copy.sql`
- `supabase/migrations/20261104000200_personal_weekly_plans.sql`
- `supabase/migrations/20261104000300_recover_missing_food_energy.sql`
- `docs/FIXES_AND_WEEKLY_PLANS_2026-11-04.md` (this report).
