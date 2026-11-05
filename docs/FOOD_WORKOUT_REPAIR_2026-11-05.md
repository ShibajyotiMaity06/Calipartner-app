# Food favourites, recent foods and Workout repair — 5 November 2026

## 1. What changed

- Recipe favourites now use the real hosted catalogue. The 93 older offline templates used non-UUID IDs such as `recipe-r0001`; the server could never save those as favourites. Browsing now uses the 267 supplied recipes already hosted under valid UUIDs. Legacy assets/cache records and diary entries were not deleted. The ten Free starter IDs match the hosted seed and its existing access rules.
- Fixed favourite reads to order by the table's actual `created_at` column and hydrate its composite-key cache records. The web database now reads/updates/removes cached recipe favourites with account filtering. Heart actions no longer fetch/cache recipe details unnecessarily; their acknowledged state updates in both browsing and the combined Favourites tab. A failed heart action keeps the list visible with a save error, rather than replacing it with a recipe-load failure.
- Food plus actions open the portion and meal picker with the previous portion prefilled. Breakfast/lunch/dinner/snacks/extra choices appear near the top. Saving requires a deliberate meal selection. Search, barcode and favourite-food portion sheets use the same guard; batch selections choose their meal too. Existing acknowledged saves, macro editing and retry behaviour remain.
- Removed Recent searches and query recording from Food. Recent foods now has **Clear recent foods**. A private, server-timed reset clears those suggestions across reloads/devices while preserving diary entries, food/recipe favourites and the catalogue. A later food log can appear again, including a newly saved entry dated earlier in the diary. Explicit retries reuse the same reset UUID/cutoff.
- Restored the existing Workout hub as Log > Workout. Log workout opens exercise/sets logging. New workouts no longer show cardio/walk/run/sports type chips; timer/duration controls are behind Workout details. Existing non-strength records retain their stored type when edited.
- The hub's Weekly plan action opens the same private saved plan created during onboarding, using its existing Free/trial/paid projection. Exercise logging prefills the selected local weekday's exercises, sets, reps and planned duration without automatically logging them. Progress opens the real You progress view; History reads saved workouts. The old in-memory weekly-plan/progress demos are not used by these hub actions.
- Embedded Challenges now uses the parent's horizontal inset, removing the duplicate inner side padding in loading, error and content states.

No ranking, nutrition target, AI-generation, membership, consent, privacy or entitlement rules were weakened. Applied and recorded only the new `20261105000000_recent_food_resets.sql` migration on the linked project; no historical migrations were replayed.

## 2. Files created/changed

The manifest below lists this delivery. Primary changes are the recipe/account/web-cache services, food library/history hooks and reset migration, Food/Quantity sheets, restored Workout hub/logger, embedded Challenges layout and regressions. Scope notes and the UI source describe the owner's correction. The pre-existing `app/.env.example` whitespace edit is excluded.

## 3. Tests and results

Seven added automated regressions cover favourite timestamp/cache hydration, valid recipe IDs, reset acknowledgement/retry identity, preserved diary and newly logged backdated foods, hook reset failures/favourite retention, required meal selection, and account-isolated web favourite reads/removal. Existing batch-food tests now select the meal explicitly. SQL tests cover reset idempotency, own-read permissions, denied cross-account/anonymous writes and preserved favourites.

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 72 existing warnings; no new style violations (252 grandfathered violations).
Typecheck: app, core and UI passed.
App: Test Files 126 passed (126); Tests 772 passed (772).
Core: Test Files 51 passed (51); Tests 567 passed (567).
UI: Test Files 7 passed (7); Tests 61 passed (61).
Database migrations: 97 passed; all SQL/RLS suites passed.
Edge: billing 29, food/photo 24, push/media 17, coach 14, weekly-plan 16, challenges 7 passed; 0 failed.
Web production export, Android export and iOS export passed.
Browser audit passed at 375/390/844px, including recipe favourite save/load/remove, explicit meal selection, recent-food clearing, the restored exercise Workout hub/plan connection and Challenges spacing.
Hosted recipe and recent-food checks passed: real Free starter favourite/save/remove retries, stable recent-food reset timestamp, preserved diary and food favourites.
Hosted food fixture cleanup completed.
```

Hosted verification used a temporary private synthetic account and removed it afterward. Browser requests are intercepted fixtures; no real users are messaged or payment accounts charged. Native checks are Expo production exports, not installed-device tests. The connected weekly-plan test reads a saved plan fixture; no new AI plan was generated as part of this repair.

## 4. Assumptions

- Clear recent foods means clearing suggestions, not erasing nutrition history. Search-history UI/recording is removed; the older private search RPC/table remains for compatibility and is not exposed in Food.
- “Previous Workout UI” means the existing hub with exercise/sets logging, weekly planning and history. The restored hub connects those actions to real account data. Timer/duration controls remain available as secondary details.
- New logs retain the chosen meal and portion; a plus action no longer silently adds to the current default meal. Existing entry edits retain their saved meal.
- Free users keep the existing starter allowance and Monday-only weekly preview; paid access remains enforced server-side. No entitlement was created for a real account.

## 5. Manual steps

Reload the updated frontend/development app, or publish/install the normal refreshed web/native release. The reset migration is already hosted. No new keys, accounts or console settings are needed. Physical-device keyboard/camera/gesture checks were not performed in this Windows session.

## 6. Later-phase observations

No future feature phase was built. Older demo workout utilities outside the restored primary flow and existing unrelated warnings remain untouched. This repair does not change the previously reported AI-provider generation availability.

## File manifest

- `AGENT_RULES.md`
- `app/src/app/(tabs)/log.tsx`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/components/diary/FoodCapture.test.tsx`
- `app/src/components/diary/FoodLogModal.tsx`
- `app/src/components/diary/NutritionCorrection.test.tsx`
- `app/src/components/diary/QuantityModal.tsx`
- `app/src/components/diary/ScanRepairs.test.tsx`
- `app/src/components/progress/ChallengesView.tsx`
- `app/src/components/recipes/RecipeAccess.test.tsx`
- `app/src/components/recipes/RecipeBrowseView.tsx`
- `app/src/components/workouts/WorkoutHubModal.tsx`
- `app/src/components/workouts/WorkoutLoggerModal.tsx`
- `app/src/db/webQueries.ts`
- `app/src/db/webStorage.test.ts`
- `app/src/hooks/useFoodLibrary.test.tsx`
- `app/src/hooks/useFoodLibrary.ts`
- `app/src/hooks/usePreviouslyLogged.ts`
- `app/src/i18n/foodPolish.ts`
- `app/src/services/accountDataService.test.ts`
- `app/src/services/accountDataService.ts`
- `app/src/services/foodLibraryService.test.ts`
- `app/src/services/foodLibraryService.ts`
- `app/src/services/foodService.test.ts`
- `app/src/services/foodService.ts`
- `app/src/services/recipeFavoritesRecovery.test.ts`
- `app/src/services/recipeService.ts`
- `docs/BUILD_PLAN.md`
- `docs/FOOD_WORKOUT_REPAIR_2026-11-05.md`
- `docs/prd.md`
- `docs/ui/food-polish-2026-11-04.md`
- `scripts/food_library_cases.mjs`
- `scripts/nov4_browser_audit.mjs`
- `scripts/verify_food_workout_followup_hosted.ps1`
- `supabase/migrations/20261105000000_recent_food_resets.sql`
