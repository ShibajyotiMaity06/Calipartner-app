# Nutrition, Squad and food logging delivery — 4 November 2026

## 1. Built

- Shared nutrition text colours: protein green, carbs white, calories yellow and fat red. Nutrient labels retain text meaning; person identity colours, errors and on-brand action contrast keep their existing roles.
- Full-width empty Squad card on Home, green Squad See all action, percentage-only Squad summaries, yellow selected tab text without the added top border, stable member selection and smaller name-only Compare selectors.
- Discover shows at most five real profiles sharing the viewer's current cut/bulk/maintain goal through the existing privacy-enforcing database function. Username search remains available.
- You contains Diary, Progress and the existing Challenges system, with refresh and challenge deep links.
- Food logging includes combined food/recipe Favourites, acknowledged heart actions, directly accessible custom food and clearable submitted search history. Fixed recipe favourite recovery when a fresh device has not cached bundled recipes.
- Editable per-portion calories, protein, carbs and fat for search, barcode and AI results. Corrections survive AI portion adjustments and save through the existing acknowledged diary transaction. Catalog nutrition remains unchanged. Custom food converts entered serving nutrition correctly. Large-portion confirmation works on web and native.
- Private food favourites/search tables and authenticated RPCs are protected by RLS. The single new migration was applied and recorded on the linked project; historical migration gaps were not replayed.

## 2. Files

The file manifest below lists this delivery's changes. The pre-existing `app/.env.example` whitespace edit is excluded from this delivery. Shared tokens/Text and explicit nutrient annotations account for most screen files. New food components, service/hook, core helpers, SQL migration and regressions implement the requested persistence and editing behaviour. Scope notes in the three repository source-of-truth documents record the owner's follow-up.

Design details: [food-polish-2026-11-04.md](ui/food-polish-2026-11-04.md).

## 3. Tests and results

Added regressions for nutrient colours and action/error contrast, custom food conversion, per-portion corrections and confirmation, AI correction scaling/saving, food library acknowledgements and account isolation, fresh-device recipe favourites, full-width empty Squad, initial suggestions and member-sheet navigation. Added SQL ownership, retry and history-clearing checks and expanded the mobile browser audit.

Final automated summaries:

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 72 existing warnings; no new style violations (252 grandfathered violations).
Typecheck: app, core and UI passed.
App: Test Files 126 passed (126); Tests 765 passed (765).
Core: Test Files 51 passed (51); Tests 561 passed (561).
UI: Test Files 7 passed (7); Tests 61 passed (61).
Database migrations: 96 passed.
Food library SQL/RLS: private favourites/searches, ownership, canonical retry keys, acknowledged removal and isolated history clearing passed.
All database/RLS suites passed.
Edge tests: 29 billing + 24 food/photo + 17 push/media + 14 coach + 11 weekly-plan + 7 challenges passed; 0 failed.
Web production export, Android export and iOS export passed.
Browser audit passed at 375/390/844px, including the new food/Squad/Challenges flows and existing billing/navigation regressions.
Hosted food library passed: acknowledged private favourites, retry-safe corrected 50g protein, unchanged 55g catalog, and isolated search clearing without deleting diary entries.
Hosted food fixture cleanup completed.
```

The browser audit intercepts network requests and never charges a payment account. Hosted verification used a temporary private synthetic account, then deleted it. Android/iOS checks are Expo production exports, not device installation or EAS binaries.

## 4. Assumptions

- Nutrition corrections apply to the selected logged portion, rather than changing public food data or a user's targets. All four primary nutrients can be corrected independently; invalid values block saving.
- Clear search history removes submitted queries only. Recent logged foods, diary entries and favourites remain.
- Suggestions require a stored goal and an eligible matching profile; zero matches stays honestly empty. No fabricated suggestions are shown.
- Nutrient colours apply to nutrition labels/amounts, not body-fat measurements, legal/privacy prose or performance judgements. Existing person-colour chart marks retain their identity role.
- Existing recipe/challenge subscription and privacy gates remain in force.

## 5. Manual work

No new accounts, keys or console settings are required. Publish the frontend through the normal release process and install a refreshed development/native build to use the new screens on devices. Physical-device camera, keyboard and system-font checks were not performed in this Windows session.

## 6. Later-phase observations

Existing unrelated lint/style warnings and historical migration-ledger gaps remain outside this scope. No additional phase or feature was built.

## File manifest

- `AGENT_RULES.md`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/auth/welcome-celebration.tsx`
- `app/src/app/dev/gallery.tsx`
- `app/src/app/squad/compare.tsx`
- `app/src/components/cardio/CardioTrackerModal.tsx`
- `app/src/components/coach/CoachMealDraftCard.tsx`
- `app/src/components/coach/CoachSuggestionCard.tsx`
- `app/src/components/diary/BarcodeScannerModal.tsx`
- `app/src/components/diary/CalorieMacroRing.tsx`
- `app/src/components/diary/CaloriesDetailSheet.tsx`
- `app/src/components/diary/CustomFoodModal.tsx`
- `app/src/components/diary/FoodCapture.test.tsx`
- `app/src/components/diary/FoodFavoriteButton.tsx`
- `app/src/components/diary/FoodFavoritesView.tsx`
- `app/src/components/diary/FoodLogModal.tsx`
- `app/src/components/diary/LogPresentation.test.tsx`
- `app/src/components/diary/MealDetailSheet.tsx`
- `app/src/components/diary/MealSectionCard.tsx`
- `app/src/components/diary/NutrientEditor.tsx`
- `app/src/components/diary/NutrientSummary.tsx`
- `app/src/components/diary/NutritionCorrection.test.tsx`
- `app/src/components/diary/QuantityModal.tsx`
- `app/src/components/diary/QuickAddCaloriesModal.tsx`
- `app/src/components/food_photo/FoodPhotoResultsEditor.tsx`
- `app/src/components/friends/CommunityPanel.tsx`
- `app/src/components/onboarding/HowCalculatedStep.tsx`
- `app/src/components/onboarding/PlanPrimitives.tsx`
- `app/src/components/onboarding/PlanReviewStep.tsx`
- `app/src/components/onboarding/RatePickerStep.tsx`
- `app/src/components/onboarding/SummaryStep.tsx`
- `app/src/components/profile/CustomMacrosModal.tsx`
- `app/src/components/progress/CaloriesChart.tsx`
- `app/src/components/progress/ChallengesView.tsx`
- `app/src/components/progress/DayDetailModal.tsx`
- `app/src/components/progress/MacrosChart.tsx`
- `app/src/components/progress/PersonalDiaryView.tsx`
- `app/src/components/progress/ProgressHubSummary.tsx`
- `app/src/components/progress/ProgressOverview.tsx`
- `app/src/components/recipes/LogRecipeModal.tsx`
- `app/src/components/recipes/RecipeBrowseView.tsx`
- `app/src/components/recipes/RecipeCard.tsx`
- `app/src/components/recipes/RecipeDetailModal.tsx`
- `app/src/components/recipes/RecipeFilterBar.tsx`
- `app/src/components/rooms/BasicRoomCard.tsx`
- `app/src/components/rooms/HomeSquadLeaderboard.tsx`
- `app/src/components/rooms/HomeSquads.test.tsx`
- `app/src/components/rooms/HomeSquads.tsx`
- `app/src/components/rooms/PartnerMealSheet.tsx`
- `app/src/components/rooms/PersonalDayCard.tsx`
- `app/src/components/rooms/RoomHeader.tsx`
- `app/src/components/rooms/RoomProgressView.tsx`
- `app/src/components/rooms/SharedMealCard.tsx`
- `app/src/components/rooms/SquadMemberPicker.tsx`
- `app/src/components/rooms/SquadViews.tsx`
- `app/src/components/trackers/StepsCard.tsx`
- `app/src/components/workouts/TodayWorkoutCard.tsx`
- `app/src/components/workouts/WorkoutDetailModal.tsx`
- `app/src/components/workouts/WorkoutFinishSummaryModal.tsx`
- `app/src/hooks/useBrowserModalBack.test.tsx`
- `app/src/hooks/useBrowserModalBack.ts`
- `app/src/hooks/useFoodEntries.ts`
- `app/src/hooks/useFoodLibrary.test.tsx`
- `app/src/hooks/useFoodLibrary.ts`
- `app/src/hooks/useFriendDiscovery.test.tsx`
- `app/src/hooks/useFriendDiscovery.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/foodPolish.ts`
- `app/src/services/accountDataService.test.ts`
- `app/src/services/aiFoodPhotoService.test.ts`
- `app/src/services/aiFoodPhotoService.ts`
- `app/src/services/foodLibraryService.test.ts`
- `app/src/services/foodLibraryService.ts`
- `app/src/services/foodService.ts`
- `app/src/services/recipeFavoritesRecovery.test.ts`
- `app/src/services/recipeService.ts`
- `app/src/theme/tokens.ts`
- `docs/BUILD_PLAN.md`
- `docs/FOOD_POLISH_2026-11-04.md`
- `docs/prd.md`
- `docs/ui/food-polish-2026-11-04.md`
- `packages/core/src/food.ts`
- `packages/core/src/foodCorrections.test.ts`
- `packages/core/src/types.ts`
- `packages/ui/src/components/Button.tsx`
- `packages/ui/src/components/CalorieRing.tsx`
- `packages/ui/src/components/MacroBar.tsx`
- `packages/ui/src/components/PairedCard.tsx`
- `packages/ui/src/components/SegmentedControl.tsx`
- `packages/ui/src/components/TargetRevealRing.tsx`
- `packages/ui/src/components/Text.tsx`
- `packages/ui/src/components/nutritionText.test.ts`
- `packages/ui/src/tokens/colors.ts`
- `scripts/food_library_cases.mjs`
- `scripts/nov4_browser_audit.mjs`
- `scripts/test_rooms_v3.mjs`
- `scripts/verify_food_library_hosted.ps1`
- `supabase/migrations/20261104000600_food_library.sql`
