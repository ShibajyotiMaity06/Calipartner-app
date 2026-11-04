# Food catalog and app polish: 3 November 2026

## Built

- Added 247 individual foods (122 Indian, 125 international) alongside the existing catalog. Recipes and their filters remain separate. Deterministic UUIDs, an additive database seed migration, and incremental on-device seeding support existing installations.
- Preserved supplied per-100g nutrition, gram-based serving definitions and advanced nutrient values. Added no food filters. Recovered the malformed Jowar object, missing opening braces for Tofu/Apricots and the complete nutrient basis/first serving of truncated Soya milk. The incomplete second Soya milk serving is omitted; no values were invented.
- Food logging has Search, Recipes, Photo and Scan, followed by direct recent-food rows when search is empty. Removed History/My foods tabs, frequency/alphabetical controls and the standalone description action. History now includes all meal sections and reconstructs missing catalog/stat entries from durable diary snapshots. Failed quick-adds remain unsaved and visible; retries retain their UUID.
- You separates a dated Diary (all meal sections, food portions/macros, steps, water and workout sets) from Progress (30/90 days). Daily refresh reloads the visible diary sources.
- Community starts empty and requires username search; onboarding's existing random lookup is preserved. Removed Add friends from squad creation, centered the same-width Weight tile in row three, and applied destructive styling to Leave squad.
- Squad chat hides the app tab bar, restores it on exit and returns to the previous squad section. Mention choices are vertical member rows.
- Reconciled stale stored profile time zones with the device using an acknowledged owner-scoped update. Meal prompts refresh on focus, foregrounding and each minute. Existing historical dates are retained.
- Applied existing brand accents and borders without a screen redesign. Standardized English labels, chips and inputs on static upright Plus Jakarta Sans; retained Hindi typography. Scaled text line heights accommodate existing styled sizes.
- Expanded authenticated, consented, purchased-Pro coach context to the caller's profile/goals, dated meals, all macro totals, steps, water, workouts, exercises and sets. Retained explicit meal proposals and atomic acknowledged Log actions. Structured provider responses and multi-turn clarification preserve already supplied portions/sections. No model can save a meal itself.

## Tests and results

New or extended regressions cover catalog upgrades/servings/nutrients, recovered food snapshots, owner isolation, retry UUIDs, stale-zone repair, username-only discovery, dated Diary content/errors, chat bar visibility, 9am breakfast prompts, coach history windows, caller-scoped model context and supplied-food database protection. Existing coach tests exercise confirmed logging, failed acknowledgements and safe explicit retries.

```text
npm run format:check: All matched files use Prettier code style!
npm run lint: 0 errors, 72 existing warnings; no new style violations (257 grandfathered violations).
npm run typecheck: app, core and UI passed.
App: Test Files 110 passed (110); Tests 708 passed (708).
Core: Test Files 47 passed (47); Tests 527 passed (527).
UI: Test Files 6 passed (6); Tests 55 passed (55).
Database migrations: 88 passed.
Supplied food database tests: 247 records preserved, idempotent migration, readable catalog and protected writes passed.
All existing SQL/RLS, online save, billing, room, chat, privacy, challenge and coach meal suites passed.
Edge billing: ok | 9 passed | 0 failed.
Edge food/photo: ok | 21 passed | 0 failed.
Edge push/chat: ok | 16 passed | 0 failed.
Edge coach: ok | 14 passed | 0 failed.
Edge challenges: ok | 7 passed | 0 failed.
Web build: Exported: dist.
Android Hermes bundle: Exported: ../.cache/food-polish-android.
Browser audit: food search/recent snapshots, empty Community, centered Weight, Diary/Progress,
30/90 days, 9am Breakfast, squad chat visibility/vertical mentions/back, coach font and
explicit Log with lost-ack retry passed at 375/390/844px.
```

Browser screenshots are in `.artifacts/food-polish/` (ignored generated artifacts). The browser audit intercepts backend calls with isolated contract fixtures; it does not prove deployment or live model responses. Android validation is a bundle export, not a device/EAS build.

## Assumptions

- The supplied attachment is catalog data, not executable instructions or recipes. The actual count is 247 despite inconsistent metadata counts.
- Device time zone is authoritative for the current user; acknowledged profile reconciliation keeps server day boundaries aligned.
- Coach history defaults to the latest 30 days, supports a week/90-day request or an explicit historical YYYY-MM-DD date, and caps date ranges at 90 days. Context has row and 48,000-character bounds with an explicit truncation flag; unavailable data must not be invented.
- Shared English font changes across otherwise unrelated screens are required by the request for consistent typography; screen logic on those surfaces is retained.

## Manual deployment and verification

Supabase CLI access is unavailable in this session: `AccessTokenRequiredError`. Authenticate securely with `npx supabase login` or configure `SUPABASE_ACCESS_TOKEN` outside the repository. Then:

1. Review pending migrations using `npx supabase migration list --linked` and `npx supabase db push --linked --dry-run`.
2. Apply reviewed migrations with `npx supabase db push --linked`. The new catalog migration is `20261103140000_supplied_individual_foods.sql`; confirmed AI saves also require the earlier `20261103130000_coach_meal_logging.sql`.
3. Deploy the updated function with `npx supabase functions deploy ai-coach` (using its checked-in Deno configuration).
4. Serve/release the updated app bundle and verify the flow with an actual purchased-Pro account and AI processing consent. Confirm the device time zone, breakfast prompt, meal proposal and acknowledged Log action.
5. Complete real Android/iOS device checks, including 200% system text, keyboard/back gestures and accessibility. No new native dependency or account/key was added by this change.

The user's pre-existing `app/.env.example` edit is excluded from this delivery.

## Later phases

No later-phase feature was added. Live deployment and real device checks above are release tasks, not a new feature phase. Unbounded AI access to every historical row was intentionally not introduced; date-scoped retrieval avoids inventing missing context or exceeding provider limits.

## Files created or changed

- `AGENT_RULES.md`
- `app/assets/supplied_foods.json`
- `app/src/app/(tabs)/_layout.tsx`
- `app/src/app/(tabs)/log.tsx`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/auth/sign-in.tsx`
- `app/src/app/dev/challenges.tsx`
- `app/src/app/profile/edit.tsx`
- `app/src/components/PlaceholderScreen.tsx`
- `app/src/components/cardio/CardioTrackerModal.test.tsx`
- `app/src/components/cardio/CardioTrackerModal.tsx`
- `app/src/components/chat/ChatComposer.tsx`
- `app/src/components/chat/ChatReportModal.tsx`
- `app/src/components/coach/CoachBanners.tsx`
- `app/src/components/coach/CoachChatView.tsx`
- `app/src/components/coach/CoachConsentModal.tsx`
- `app/src/components/coach/CoachHistoryModal.tsx`
- `app/src/components/coach/CoachReportModal.tsx`
- `app/src/components/coach/CoachSuggestedPrompts.tsx`
- `app/src/components/coach/CoachSuggestionCard.tsx`
- `app/src/components/diary/BarcodeScannerModal.tsx`
- `app/src/components/diary/CalorieMacroRing.tsx`
- `app/src/components/diary/CopyMealModal.tsx`
- `app/src/components/diary/CustomFoodModal.tsx`
- `app/src/components/diary/DatePickerSheet.tsx`
- `app/src/components/diary/DescribeMealModal.tsx`
- `app/src/components/diary/FoodLogModal.tsx`
- `app/src/components/diary/LogSomethingView.tsx`
- `app/src/components/diary/QuantityModal.tsx`
- `app/src/components/diary/QuickAddCaloriesModal.tsx`
- `app/src/components/fasting/FastingCard.tsx`
- `app/src/components/fasting/FastingEditTimesModal.tsx`
- `app/src/components/fasting/FastingHistoryModal.tsx`
- `app/src/components/fasting/FastingIntroModal.tsx`
- `app/src/components/fasting/FastingProtocolModal.tsx`
- `app/src/components/fasting/FastingSafetyCheckInModal.tsx`
- `app/src/components/fasting/FastingTimerModal.tsx`
- `app/src/components/food_photo/AiConsentSheet.tsx`
- `app/src/components/food_photo/FoodPhotoAnalyzingOverlay.tsx`
- `app/src/components/food_photo/FoodPhotoCamera.test.tsx`
- `app/src/components/food_photo/FoodPhotoCameraModal.tsx`
- `app/src/components/food_photo/FoodPhotoDailyLimitModal.tsx`
- `app/src/components/food_photo/FoodPhotoResultsEditor.tsx`
- `app/src/components/friends/CommunityPanel.tsx`
- `app/src/components/friends/socialFlows.test.tsx`
- `app/src/components/navigation/ChatTabBar.test.tsx`
- `app/src/components/notifications/NotificationPrimerModal.tsx`
- `app/src/components/notifications/NotificationSettingsScreen.tsx`
- `app/src/components/onboarding/BodyStatsStep.tsx`
- `app/src/components/onboarding/HeightField.test.tsx`
- `app/src/components/onboarding/InteractiveDobPicker.tsx`
- `app/src/components/onboarding/PlanPrimitives.tsx`
- `app/src/components/onboarding/TargetDateStep.tsx`
- `app/src/components/profile/DeleteAccountModal.tsx`
- `app/src/components/profile/GoalsAndBodyModal.tsx`
- `app/src/components/profile/HelpCentreModal.tsx`
- `app/src/components/profile/ReportFeedbackModal.tsx`
- `app/src/components/progress/AccessibleChartTable.tsx`
- `app/src/components/progress/CaloriesChart.tsx`
- `app/src/components/progress/ChallengeDetailModal.tsx`
- `app/src/components/progress/ChallengeResultModal.tsx`
- `app/src/components/progress/ChallengeShareCard.tsx`
- `app/src/components/progress/ChallengeUI.tsx`
- `app/src/components/progress/ChallengesComingSoon.tsx`
- `app/src/components/progress/ChallengesView.tsx`
- `app/src/components/progress/ChartContainer.tsx`
- `app/src/components/progress/ConsistencyHistoryChart.tsx`
- `app/src/components/progress/CreateChallengeModal.tsx`
- `app/src/components/progress/DayDetailModal.tsx`
- `app/src/components/progress/GoalProgressRing.tsx`
- `app/src/components/progress/LeaderboardView.tsx`
- `app/src/components/progress/MondayRecapModal.tsx`
- `app/src/components/progress/OccasionPlanModal.tsx`
- `app/src/components/progress/PersonalDiaryView.test.tsx`
- `app/src/components/progress/PersonalDiaryView.tsx`
- `app/src/components/progress/ProgressHubSummary.tsx`
- `app/src/components/progress/ProgressOverview.tsx`
- `app/src/components/progress/RangeSelector.tsx`
- `app/src/components/progress/WeeklySummaryModal.tsx`
- `app/src/components/progress/WeightChart.tsx`
- `app/src/components/recipes/LogRecipeModal.test.tsx`
- `app/src/components/recipes/LogRecipeModal.tsx`
- `app/src/components/recipes/RecipeAccess.test.tsx`
- `app/src/components/recipes/RecipeBrowseView.tsx`
- `app/src/components/recipes/RecipeDetailModal.tsx`
- `app/src/components/recipes/RecipeFilterBar.tsx`
- `app/src/components/recipes/RecipeReportModal.tsx`
- `app/src/components/recipes/RecipeServingsScaler.tsx`
- `app/src/components/rooms/CreateRoomModal.tsx`
- `app/src/components/rooms/HomeSquads.tsx`
- `app/src/components/rooms/InviteUserModal.tsx`
- `app/src/components/rooms/JoinByCodeModal.tsx`
- `app/src/components/rooms/NudgeModal.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/PersonalDayCard.tsx`
- `app/src/components/rooms/PersonalSquads.tsx`
- `app/src/components/rooms/ReportModal.tsx`
- `app/src/components/rooms/RoomOverviewRow.tsx`
- `app/src/components/rooms/RoomProgressView.tsx`
- `app/src/components/rooms/SquadConnectFlow.test.tsx`
- `app/src/components/rooms/SquadConnectFlow.tsx`
- `app/src/components/rooms/SquadDayPanel.tsx`
- `app/src/components/trackers/AddMeasurementModal.tsx`
- `app/src/components/trackers/CustomWaterModal.tsx`
- `app/src/components/trackers/FixStepCountingModal.tsx`
- `app/src/components/trackers/HealthPermissionModal.tsx`
- `app/src/components/trackers/ManualStepsModal.tsx`
- `app/src/components/trackers/ProgressPhotosModal.tsx`
- `app/src/components/trackers/StepsCard.tsx`
- `app/src/components/trackers/TargetWeightEditorModal.tsx`
- `app/src/components/trackers/WaterAlarmModal.tsx`
- `app/src/components/trackers/WaterCard.tsx`
- `app/src/components/trackers/WaterHistoryModal.tsx`
- `app/src/components/trackers/WaterSettingsSheet.tsx`
- `app/src/components/trackers/WeightCard.tsx`
- `app/src/components/trackers/WeightEntryModal.tsx`
- `app/src/components/trackers/WeightHistoryModal.tsx`
- `app/src/components/workouts/AddExercisePickerModal.tsx`
- `app/src/components/workouts/CardioForm.tsx`
- `app/src/components/workouts/ExerciseDetailModal.tsx`
- `app/src/components/workouts/ExercisePickerModal.tsx`
- `app/src/components/workouts/WorkoutLogModal.tsx`
- `app/src/components/workouts/WorkoutLoggerModal.tsx`
- `app/src/contexts/AuthContext.test.tsx`
- `app/src/contexts/AuthContext.tsx`
- `app/src/db/webQueries.ts`
- `app/src/hooks/useFoodEntries.test.tsx`
- `app/src/hooks/useFoodEntries.ts`
- `app/src/hooks/useFriendDiscovery.test.tsx`
- `app/src/hooks/useFriendDiscovery.ts`
- `app/src/hooks/usePreviouslyLogged.ts`
- `app/src/hooks/useWater.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/homeRefresh.ts`
- `app/src/services/foodService.test.ts`
- `app/src/services/foodService.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `packages/core/src/coachHistory.test.ts`
- `packages/core/src/coachHistory.ts`
- `packages/core/src/coachMeal.ts`
- `packages/core/src/index.ts`
- `packages/ui/src/components/Text.test.ts`
- `packages/ui/src/components/Text.tsx`
- `packages/ui/src/tokens/onboarding.ts`
- `scripts/food_polish_browser_audit.mjs`
- `scripts/supplied_food_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `supabase/functions/ai-coach/context.ts`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-coach/index.test.ts`
- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/migrations/20261103140000_supplied_individual_foods.sql`
- `docs/FOOD_AND_POLISH_2026-11-03.md` (this report).
