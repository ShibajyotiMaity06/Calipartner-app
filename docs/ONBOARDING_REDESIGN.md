# Approved onboarding redesign - 24 October 2026

This change records the owner-approved override to the onboarding flow, calculator and subscription references in PRD v0.4 and the UI screen inventory. Scope: onboarding, the existing paywall, shared calculations, and the storage needed for these inputs. The owner explicitly authorised changes beyond the view layer.

## Journey

1. Welcome: official CaliPartner logo, motto, create account and existing account actions.
2. Signup uses the existing email-code, Google and Apple flow. Profile setup collects name, unique username, date of birth (18+), sex and private city/region. Date of birth provides an accurate age. Height is collected in step 6; the existing account schema temporarily requires its historical default until the user's measurements are synced.
3. Personal greeting and bulk, cut or maintain.
4. Goal-specific encouragement, light copy and a relevant explanatory fact.
5. Typical activity level.
6. Current weight, height and 0-7 training days, with beginner-friendly wording for low activity. Zero days is a valid choice.
7. Optional goal weight and weekly pace. Unsafe choices are disabled with a reason.
8. Plus and Pro feature preview. Try now opens pricing; it does not start a purchase. A close control continues to the plan review.
9. Existing pricing page. Basic is free; Plus has a 7-day trial (subject to store eligibility); Pro has no trial. Its close and purchase-complete actions continue to the plan review. Only a real store purchase can produce success.
10. Personal plan: calorie target, BMR, maintenance, estimated monthly change, macro chart with text summary, editable body weight/training days/daily surplus or deficit, recommendation, and separate buttons for the recommendation and the user's safe plan. A quiet text action opens the actual calculation. The optional private health check remains available here. After saving, the existing optional Partner Finder offer precedes Today.

Drafts stay on the device, keyed to the authenticated account. Each draft retains its client-generated goal UUID for idempotent retries. Actual measurements and gym days persist in SQLite and the outbox; syncing updates profile height before its dependent goal. No account's draft is migrated to another account or uploaded as guest data.

## Formula version 2

The existing version-1 calculator and PRD 7.2 golden tests remain for historical plans. New onboarding plans use `calculateGymTargets` from the shared pure TypeScript package. The same implementation is exposed by the calculate-targets Edge Function when `gymDays` is present.

- Mifflin-St Jeor: 10 * kg + 6.25 * cm - 5 * age + sex offset (male 5, female -161, other -78).
- Activity multiplier: 1.35 + 0.04 * training days. Activity level adjusts question wording; it is not an additional multiplier and workout calories are not added again.
- Maintenance: unrounded BMR * activity multiplier.
- Daily adjustment: weekly kg * 7,700 / 7. A custom surplus/deficit can be entered in review.
- Target: unrounded maintenance plus the surplus, minus the deficit, or unchanged for maintain.
- Monthly change estimate: signed daily adjustment * 30 / 7,700.
- Protein: 2.2 g/kg, 4 kcal/g. Fat: 1.2 g/kg, 9 kcal/g. Carbs: remaining unrounded calories / 4.
- Round displayed calories and grams at the end. Total macro grams sums rounded gram targets. Percentage labels use the actual energy shares; they need not sum to exactly 100 after rounding.
- The supplied example yields BMR 1,349; maintenance 2,092; intake 2,392; monthly +1.17 kg; protein 103 g, fat 56 g, carbs 368 g; total 527 g. Protein energy is 17% after rounding, rather than the reference's arithmetically incorrect 18%.

Safety remains mandatory: per-sex calorie floors (1,500/1,200/1,350), a strict 1% body-weight weekly cap, no cuts below BMI 18.5, and enough calories to fit the protein and fat allocation. A bulk recommendation uses up to 0.5% body weight/week; a cut recommendation uses up to 0.5 kg/week, reduced to respect the floors and cap. No predicted outcome is guaranteed. Existing historical rows are not recalculated.

## Deployment and review

Apply `20261024050000_onboarding_gym_plans.sql` and redeploy `calculate-targets` before releasing the client. SQLite migration 12 runs automatically. Existing RLS and explicit public/room projections protect the new private columns. The migration adds a server-side safety trigger for new gym plans.

Validate the real 7-day Plus introductory offer and Pro's absence of an introductory offer in RevenueCat/App Store Connect/Play Console. Native VoiceOver/TalkBack, 200% text, reduced motion, purchases and restore need a development-build device pass. Local SQL tests require a running Supabase/Postgres instance with pgTAP.

## Session validation

- `npm run check`: passed. Lint: 0 errors, 104 existing warnings; token lint: no new style violations; all workspace typechecks passed.
- App: `Test Files 57 passed (57)` / `Tests 541 passed (541)`.
- Core: `Test Files 34 passed (34)` / `Tests 462 passed (462)`.
- UI: `Test Files 5 passed (5)` / `Tests 52 passed (52)`.
- `npm run format:check`: `All matched files use Prettier code style!`.
- Expo web export passed. A browser walkthrough with an isolated fake backend covered profile signup, name interpolation, goal-specific encouragement, training input, unavailable rates, both premium close paths, exact reference totals, calculation details, draft recovery after reload, a 320px viewport, simulated 200% text, unsafe-plan blocking, offline completion and one queued goal UUID. No browser page errors occurred.
- Added 12 pgTAP assertions covering the private columns and database safety trigger. These were not run: this machine has no Docker/Postgres instance. Run `supabase test db` after applying the migrations to a local Supabase stack.

Changed areas: welcome/auth/profile views; onboarding components, state and local drafts; the core version-2 calculator and tests; SQLite migration 12, target persistence and sync tests; onboarding typography/layout tokens and opt-in text/button scaling; the calculate-targets Edge Function; the new SQL migration and pgTAP tests; PRD and UI override notes. Account settings read the saved input height so it is accurate before an offline plan syncs.

Later scope remains unchanged: the app-wide light theme is still a stub, and the existing account goals/body settings modal needs its save handler wired separately. No later-phase feature was built.
