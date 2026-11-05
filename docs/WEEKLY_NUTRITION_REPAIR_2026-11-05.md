# Onboarding weekly-plan nutrition repair — 5 November 2026

## 1. What changed and why

An aggregate-only hosted audit confirmed the report: the existing saved plan contained 28 meals, with identical calorie/protein/carbs/fat tuples across different measured recipes on all seven days. The audit returned counts only; no names, account identifiers, ingredients, goals or health inputs left the database.

The app already rendered each saved meal's own values; it did not substitute the daily target or a hardcoded nutrition constant. Generation had a fixed numeric meal example in its prompt, and validation checked arithmetic and daily targets but did not reject copied nutrition. Consequently a provider could spread the same tuple across different dishes and still pass every numerical check. The numeric prompt example was an avoidable source of anchoring; this audit cannot establish the provider's internal reasoning.

- Removed the fixed nutrition example. The prompt now specifies field types and requires estimates from each meal's measured ingredients, including oils/sauces, followed by daily sum checks. It explicitly forbids dividing daily targets equally between meals or inventing tiny differences to conceal copied values.
- Added shared core validation for blanket copied estimates: reject a whole day of identical tuples across different recipes, or the same tuple reused across three distinct recipes within the week. One failed draft receives the existing bounded provider repair with an ingredient-specific explanation; persistent failures are never saved.
- Improved arithmetic repair after a real-provider verification rejected inconsistent meal calories and daily macro totals: the retry now receives the rejected JSON and the exact failing day/meal, actual sum and allowed bound. Previously it received only a reason code without its own prior draft. These details stay inside the existing provider request; logs still contain only constant diagnostic categories. Safety limits and the existing retry/deadline bounds are unchanged.
- Weekly planning defaults to its existing `openai/gpt-oss-120b` reasoning model rather than inheriting `GROQ_MODEL` from general chat. An explicit `WEEKLY_PLAN_MODEL` still takes precedence, and the general chat model remains a fallback. No provider keys or project secrets were changed.
- Identical repeated recipes/portions remain allowed for batch cooking. Renaming a dish or reordering its ingredient list does not turn it into a different recipe. An isolated coincidental match remains allowed.
- Existing affected plans hide their copied daily/per-meal nutrition amounts and show **Rebuild your week**. The action reuses saved preferences and explains that it replaces both workouts and meals. A failed save keeps the previous plan and workout edits; explicit retries keep the same request ID. Only acknowledged success replaces the saved plan.
- Valid plans show the actual meal values and summed daily nutrition through the shared nutrient-colour component. Calorie floors, macro/energy bounds, privacy, AI consent, daily build limits, subscription projections and workout editing remain unchanged.
- Deployed the updated `weekly-plan` Edge Function. No schema migration was required. Existing user plans were neither deleted nor silently regenerated.

## 2. Files created/changed

- `packages/core/src/weeklyPlan.ts`, `weeklyPlan.test.ts`: copied-estimate detection and regressions.
- `supabase/functions/weekly-plan/index.ts`, `index.test.ts`: typed prompt, targeted repair and rejection-before-save tests.
- `app/src/app/weekly-plan.tsx`: affected-plan recovery and correct per-meal/day display.
- `app/src/i18n/fixNovember.ts`: recovery copy; `app/src/services/weeklyPlanService.ts`: consent/rebuild call-site comment.
- `scripts/nov4_browser_audit.mjs`: realistic distinct meal fixtures, hidden copied totals, failed-save preservation and stable retry/recovery checks at 375px.
- New `scripts/audit_weekly_nutrition_hosted.ps1`: read-only aggregate quality audit.
- New `scripts/verify_weekly_nutrition_hosted.ps1`: real-provider verification with a private temporary synthetic account and unconditional cleanup.
- `AGENT_RULES.md`, `docs/prd.md`, `docs/BUILD_PLAN.md`: this owner-requested repair scope; this delivery report.

The pre-existing `app/.env.example` whitespace edit is excluded.

## 3. Tests added and results

Six core regressions cover copied daily tuples, cross-day copied tuples, legitimate batch/renamed/reordered meals, an isolated match, independent meal estimates with correct daily sums and a precise meal-energy repair diagnostic. Five Edge regressions check the prompt, rejection before storage, bounded repair/fail-closed behaviour, delivery of the rejected draft with the exact arithmetic error and the dedicated planning-model default. The browser audit covers recovery of an already-saved affected plan, preserved workout edits on failure, the same retry UUID/preferences and distinct displayed meal estimates after success.

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 72 existing warnings; no new style violations (252 grandfathered violations).
Typecheck: app, core and UI passed.
App: Test Files 126 passed (126); Tests 765 passed (765).
Core: Test Files 51 passed (51); Tests 567 passed (567).
UI: Test Files 7 passed (7); Tests 61 passed (61).
Database migrations: 96 passed; all SQL/RLS suites passed.
Edge: billing 29, food/photo 24, push/media 17, coach 14, weekly-plan 16, challenges 7 passed; 0 failed.
Browser audit: copied weekly nutrition hidden with retry-safe rebuild and failed-save preservation passed, alongside existing flows at 375/390/844px.
Web production export, Android export and iOS export passed.
```

Browser requests are intercepted fixtures, with no real charges or messages. Native checks are Expo production exports rather than installed-device tests.

Hosted status is separate from those passing automated checks. The aggregate audit confirmed the original defect. Fresh real-provider generation did not produce a verified replacement during this session: candidates failed the unchanged meal-energy/daily-nutrition constraints, correction requests hit provider rate limits, and fallback routes were unavailable or timed out. Invalid candidates were rejected rather than stored. The temporary synthetic accounts were cleaned up. A successful new live plan remains unverified; no user's saved plan was replaced by these checks.

Operational diagnostics read only constant weekly-plan failure categories through the bounded [Supabase logs API](https://supabase.com/docs/guides/observability/advanced-log-filtering). No generated food, goals, health inputs, provider bodies or credentials were added to logs.

## 4. Assumptions and limits

The report concerns individual meal nutrition, rather than repeated daily goals: daily targets are expected to stay constant. Identical nutrition is legitimate for the same recipe and portion. This repair checks systematic copied estimates without forcing artificial numeric differences. AI meal nutrition remains an estimate; this change does not claim laboratory or ingredient-database verification.

A previously generated plan cannot acquire corrected numbers just by changing generation code. Its owner explicitly rebuilds it; existing preferences and normal safety/consent/quota checks apply. A successful rebuild also replaces the workout routine, as the action explains.

## 5. Manual steps

Reload the updated frontend/development build, open your weekly plan, and select **Rebuild your week**. Review the replacement before using it. Provider rate limits/availability may require trying again later; a failed rebuild keeps the existing plan and normal daily request limits still apply. Use the normal frontend release/device installation process for published clients; the server function is already deployed. No new keys, accounts or console settings are required.

## 6. Later-phase observations

No additional feature phase was built. Existing unrelated lint/style warnings and the previously documented historical migration-ledger gaps remain untouched. Physical-device layout/camera checks remain outside this Windows verification session.
