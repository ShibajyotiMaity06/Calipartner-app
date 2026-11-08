# Setup, macro safety, coach and workout delivery

Date: 7 November 2026.

## 1. Built

- Plan review starts with Go on with this plan and Build my own macros. Calculation help is a text link. Custom entry shows calculated values as placeholders, fills blanks, balances an unfilled macro to retain calories, and reports short, specific validation errors.
- Stable database adjustment limits surround calculator recommendations: calories +/-500 kcal, protein +/-50 g, carbs +/-125 g and fat +/-55 g. The database derives its reference from profile/planning inputs, so a forged TDEE or repeated custom saves cannot move it. Existing floors, rate caps, goal direction, paid gates, historical retries and habit-only changes remain enforced.
- Compact selectors replace sex, activity, training-day, gym/equipment and food preference boxes. Blank allergies/exclusions and explicit None both mean none. Preparation has a continuing indeterminate progress bar without tips or input chips, with a Reduce Motion fallback.
- Coach scope is checked before loading diary data. Unrelated and disguised mixed requests receive a fixed health redirect. Recognized health requests receive private dated meals, workouts and individual sets, with a default seven-day window. Malformed classification falls back or fails closed. Provider input is capped at 40,000 UTF-8 bytes, conversation content at 8,000 bytes and diary context at 20,000 bytes. General answers have a 600-token ceiling; structured meal JSON retains its existing 2,200-token allowance and normal content is instructed to stay within 120 words.
- Workout logging opens at today's plan. Basic has a concealed preview and Plus action; manual exercise logging remains available. Search reads the actual catalogue, offers five category suggestions, and asks for a set count and separate reps per set. Weights are optional and disclosed on request. Paid single-day plans work without imposing a weekday. Plan entries remain uncompleted until the user marks them; confirmed manual sets preserve entered reps. New session saves retain the acknowledged, idempotent service.
- The web exercise cache now supports the existing owner/public, deleted-row and case-insensitive search queries. This repair was necessary because the previous picker could return an empty list despite a populated server catalogue.

## 2. Files created or changed

- `AGENT_RULES.md`
- `app/src/app/auth/profile-setup.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/components/CompactSelect.tsx`
- `app/src/components/onboarding/ActivityStep.tsx`
- `app/src/components/onboarding/PlanPrimitives.tsx`
- `app/src/components/onboarding/PlanReviewStep.tsx`
- `app/src/components/onboarding/PlanReviewTargets.test.tsx`
- `app/src/components/onboarding/TrainingStep.tsx`
- `app/src/components/onboarding/WeeklyPlanForm.test.tsx`
- `app/src/components/onboarding/WeeklyPlanForm.tsx`
- `app/src/components/onboarding/WeeklyPlanPreparing.tsx`
- `app/src/components/profile/CustomMacrosModal.tsx`
- `app/src/components/workouts/ExercisePickerFlow.test.tsx`
- `app/src/components/workouts/ExercisePickerModal.tsx`
- `app/src/components/workouts/ExerciseSetsForm.test.tsx`
- `app/src/components/workouts/ExerciseSetsForm.tsx`
- `app/src/components/workouts/WorkoutHubModal.tsx`
- `app/src/components/workouts/WorkoutLoggerModal.tsx`
- `app/src/components/workouts/WorkoutPlanToday.test.tsx`
- `app/src/components/workouts/WorkoutPlanToday.tsx`
- `app/src/db/webQueries.ts`
- `app/src/db/webStorage.test.ts`
- `app/src/i18n/macroErrors.ts`
- `app/src/i18n/personalDay.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `packages/core/src/coachHistory.test.ts`
- `packages/core/src/coachHistory.ts`
- `packages/core/src/macroBounds.test.ts`
- `packages/core/src/personalTracking.test.ts`
- `packages/core/src/personalTracking.ts`
- `packages/core/src/targets.ts`
- `scripts/logging_settings_cases.mjs`
- `scripts/macro_bounds_cases.mjs`
- `scripts/nov4_browser_audit.mjs`
- `scripts/personalised_day_browser_audit.mjs`
- `scripts/personalised_day_cases.mjs`
- `scripts/setup_workout_browser_audit.mjs`
- `scripts/test_rooms_v3.mjs`
- `scripts/verify_setup_workout_hosted.ps1`
- `supabase/functions/ai-coach/context.ts`
- `supabase/functions/ai-coach/index.test.ts`
- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/ai-coach/scope.ts`
- `supabase/migrations/20261107000300_macro_adjustment_bounds.sql`

The unrelated existing `app/.env.example` edit and `scripts/live_feature_audit.mjs` were left untouched and excluded from delivery.

- `docs/SETUP_WORKOUT_DELIVERY_2026-11-07.md`

## 3. Tests and verification

Workspace summaries:

```text
App:  Test Files 148 passed (148); Tests 858 passed (858)
Core: Test Files 60 passed (60); Tests 619 passed (619)
UI:   Test Files 7 passed (7); Tests 62 passed (62)
Database migrations: 108 passed; all SQL/RLS suites passed
Edge suites: billing 31, food/photo 27, push/media 17, coach 20,
             weekly plan 23, challenges 7, adaptive review 4 passed; 0 failed
```

New coverage includes inclusive macro limits and repeated-edit/forged-TDEE attempts, protein-only maintenance entry, blank/None preferences, two review actions and text help, per-set 10/8/6 reps, catalogue search/filtering, owner-filtered web cache reads, concealed Basic plans, single-day paid plans, scope rejection, classifier fallback and input budgets. Existing online-save and idempotency suites pass.

Format check, lint and typecheck passed. Lint retains 72 existing warnings and reports no new token violations. Expo export passed for Android, iOS and web; these are bundle checks, not installed-device tests.

Local browser audits passed at 375px and 844px, including large text and Reduce Motion, compact setup, custom macros, Basic locking, catalogue search and individual sets. The existing personalised-day/paywall audit also passed. Screenshots are in `.artifacts/setup-workout/browser/` and `.artifacts/personalised-day/browser/`.

Hosted verification used a disposable private synthetic account and cleaned it up. It confirmed the 50 g protein limit, unchanged targets after failed saves, the independent 500 kcal anchor, three real-provider unrelated/disguised request refusals, a real reply using the six-day-old food and 10/8/6 workout sets, and HTTP 413 with INPUT_TOO_LONG for oversized input.

The new migration was applied and recorded using the repository's existing targeted migration runner. The ai-coach Edge Function was deployed to the linked project. Secrets remained in the OS credential store/process memory.

## 4. Assumptions

- The requested calorie/protein ranges are inclusive around the calculator recommendation. Carb/fat bounds were taken as roughly 500 kcal of each nutrient: 125 g carbs and 55 g fat. Older accepted targets can still be replayed without silently changing them.
- A blank macro starts from the calculated target and may be balanced to keep entered protein and the intended calorie total consistent. Fully supplied conflicting totals still receive a short corrective message.
- Health, nutrition, hydration, training, recovery, sleep and habit questions are allowed; unrelated tasks remain outside coach scope.
- Workout plans require purchased Plus/Pro; existing trial restrictions remain. Basic can always enter its own exercises.

## 5. Manual work

No new accounts, keys or console settings are required. Smoke-test the updated EAS development build on physical Android/iOS devices, particularly keyboard, font scaling and modal/back behaviour. Apply the normal app release process for installed builds.

## 6. Later work noticed

The ordinary Supabase CLI dry run found pre-existing historical migration-record gaps. Those files were not replayed or marked as applied; the existing targeted runner applied only this new migration. Broad migration-history reconciliation belongs to separate maintenance work.
