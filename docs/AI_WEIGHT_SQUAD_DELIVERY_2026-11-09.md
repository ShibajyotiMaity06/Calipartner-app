# AI, weight, Squad and offline delivery ? 9 November 2026

## 1. What changed

- Claude Haiku 5.5 is the primary for coach answers and scope classification, meal drafts/descriptions, photo logging, weekly/workout plans and media moderation. Existing Groq credentials and Gemini remain fallbacks; moderation uses the same Gemini 3.5 Flash-Lite fallback. Consent, health safeguards, quotas and purchased access remain enforced. Unsafe moderation decisions never fall through to another provider for approval.
- Identity questions receive the CaliPartner health-coach introduction without a model/vendor name. The system instruction and output guard reinforce this, and the public response model marker is now `calipartner-coach`.
- Log ? Weight preserves the starting baseline and compares edits with preceding weigh-ins. Late cache hydration cannot overwrite a typed date/weight. Date edits retain the original UUID, future dates are rejected in the stored zone by the UI and a database trigger, and failed saves stay open with retry feedback and a stable request UUID.
- Weight progress is available in the actual logging sheet. It shows real weekly samples, their actual dates, and edit/delete actions, for at most three calendar years. Loading, empty and retry states are included.
- Squad chat has one header row with circular Back, squad name and direct settings, plus the conversation/composer. Tabs, member counts, dropdown, code and rename are hidden there. Overview and settings retain host renaming. Squad tabs reuse You's exact segmented control. The duplicate leaderboard shortcut is removed.
- Home has no squad pencil. Native snapping and explicit clamping limit each swipe to one card; web horizontal wheel/trackpad bursts also advance one card. Circular Back arrows and Close crosses replace navigation text across existing screens using shared glyphs and accessible action names.
- Settings no longer exposes AI coach history, units/language, appearance/accessibility or Data & storage. Existing export remains under Privacy. Stored units, English localisation and system accessibility support remain intact.
- Previously authorized reads persist per account, including squads/leaderboards/member details, chat, personal progress, tracking preferences, challenges and saved plans. Observed access failures, missing memberships and locked/archived rooms invalidate relevant cached data. Cached chat reads use the current local records so deletions/blocks remain reflected. The browser shell caches only public app assets for offline startup; API responses are never put in the service-worker cache. Targets can render their existing offline cache without a false network error.
- The new migration was applied and recorded with the existing targeted deployment runner. `ai-coach`, `ai-food-photo`, `weekly-plan`, `workout-plan` and `chat-image-moderation` were deployed to the linked Supabase project.

## 2. Files created/changed

Core contains the tested date/history helpers. UI contains the shared navigation glyph and Button rendering. App views/hooks/services contain the scoped fixes and caches. Edge provider chains, tests and import maps were updated; the import-map entries are required because the shared core index now exports the weight helper. One new SQL migration and database regression runner were added. The owner request is recorded ahead of superseded requirements in the repo rules, PRD and build plan.

Existing compact chat composer/read-receipt ticks, workout cards/date controls and onboarding picker sheets are preserved. A type-only icon import in the upstream weekly-plan form was corrected to satisfy the mandatory lint check, and its inherited header assertions now match the requested chat controls. Day/month navigation keeps its existing directional chevrons.

The pre-existing `app/.env.example` edit and untracked `scripts/live_feature_audit.mjs` were preserved outside this delivery.

Changed file manifest:

- `AGENT_RULES.md`
- `app/public/sw.js`
- `app/src/app/(tabs)/_layout.tsx`
- `app/src/app/(tabs)/log.tsx`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/_layout.tsx`
- `app/src/app/auth/sign-in.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/app/squad/compare.tsx`
- `app/src/app/squad/person.tsx`
- `app/src/components/cardio/CardioTrackerModal.test.tsx`
- `app/src/components/cardio/CardioTrackerModal.tsx`
- `app/src/components/chat/ChatTicks.test.tsx`
- `app/src/components/coach/CoachChatView.tsx`
- `app/src/components/fasting/FastingHistoryModal.tsx`
- `app/src/components/navigation/ChatTabBar.test.tsx`
- `app/src/components/notifications/NotificationSettingsScreen.tsx`
- `app/src/components/onboarding/EntryRefresh.test.tsx`
- `app/src/components/onboarding/InvitePreviewModal.tsx`
- `app/src/components/onboarding/StepHeader.tsx`
- `app/src/components/onboarding/WeeklyPlanForm.tsx`
- `app/src/components/profile/AboutLegalModal.tsx`
- `app/src/components/profile/AppearanceModal.tsx`
- `app/src/components/profile/AvatarPickerModal.tsx`
- `app/src/components/profile/DailyGoalsModal.tsx`
- `app/src/components/profile/DeleteAccountModal.tsx`
- `app/src/components/profile/DiscoverabilityModal.tsx`
- `app/src/components/profile/ExportDataModal.tsx`
- `app/src/components/profile/GoalsAndBodyModal.tsx`
- `app/src/components/profile/HealthSyncModal.tsx`
- `app/src/components/profile/HelpCentreModal.tsx`
- `app/src/components/profile/ReportFeedbackModal.tsx`
- `app/src/components/profile/StorageCacheModal.tsx`
- `app/src/components/profile/UnitsLanguageModal.tsx`
- `app/src/components/progress/ChallengeUI.tsx`
- `app/src/components/progress/DayDetailModal.tsx`
- `app/src/components/progress/LeaderboardView.tsx`
- `app/src/components/progress/PersonalDiaryView.test.tsx`
- `app/src/components/progress/PersonalDiaryView.tsx`
- `app/src/components/recipes/RecipeBrowseView.tsx`
- `app/src/components/rooms/EditSquadName.test.tsx`
- `app/src/components/rooms/HomeSquads.test.tsx`
- `app/src/components/rooms/HomeSquads.tsx`
- `app/src/components/rooms/RoomAccess.test.tsx`
- `app/src/components/rooms/RoomHeader.tsx`
- `app/src/components/rooms/RoomOverviewRow.tsx`
- `app/src/components/trackers/HealthPermissionModal.tsx`
- `app/src/components/trackers/StepsCard.tsx`
- `app/src/components/trackers/WeightCard.tsx`
- `app/src/components/trackers/WeightEntryModal.test.tsx`
- `app/src/components/trackers/WeightEntryModal.tsx`
- `app/src/components/trackers/WeightHistoryModal.tsx`
- `app/src/components/workouts/CardioHub.test.tsx`
- `app/src/components/workouts/CardioHub.tsx`
- `app/src/components/workouts/ExerciseDetailModal.tsx`
- `app/src/components/workouts/WeeklyPlanModal.tsx`
- `app/src/components/workouts/WorkoutDayModal.test.tsx`
- `app/src/components/workouts/WorkoutHistoryCalendarModal.tsx`
- `app/src/components/workouts/WorkoutProgressModal.tsx`
- `app/src/components/workouts/WorkoutRoutinesModal.tsx`
- `app/src/db/index.ts`
- `app/src/hooks/useChallenges.ts`
- `app/src/hooks/useTargets.ts`
- `app/src/hooks/useWeight.test.tsx`
- `app/src/hooks/useWeight.ts`
- `app/src/i18n/en.ts`
- `app/src/services/accountDataService.ts`
- `app/src/services/challengeService.ts`
- `app/src/services/chatService.ts`
- `app/src/services/networkService.ts`
- `app/src/services/offlineReadService.test.ts`
- `app/src/services/offlineReadService.ts`
- `app/src/services/progressService.ts`
- `app/src/services/roomService.ts`
- `app/src/services/squadService.ts`
- `app/src/services/trackersService.test.ts`
- `app/src/services/trackingPreferencesService.ts`
- `app/src/services/webCachePersistence.test.ts`
- `app/src/services/weeklyPlanService.ts`
- `app/src/services/weightService.ts`
- `app/src/services/weightWebPersistence.test.ts`
- `app/src/services/workoutRoutineService.test.ts`
- `app/src/services/workoutRoutineService.ts`
- `docs/AI_WEIGHT_SQUAD_DELIVERY_2026-11-09.md`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `packages/core/src/index.ts`
- `packages/core/src/weightHistory.test.ts`
- `packages/core/src/weightHistory.ts`
- `packages/ui/src/components/Button.tsx`
- `packages/ui/src/components/NavigationIcon.tsx`
- `packages/ui/src/index.ts`
- `scripts/ai_weight_squad_browser_audit.mjs`
- `scripts/test_rooms_v3.mjs`
- `scripts/verify_ai_features_hosted.mjs`
- `scripts/weight_history_cases.mjs`
- `supabase/functions/adaptive-review/deno.json`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-coach/index.test.ts`
- `supabase/functions/ai-coach/index.ts`
- `supabase/functions/ai-coach/scope.ts`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/ai-food-photo/index.test.ts`
- `supabase/functions/ai-food-photo/index.ts`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/chat-image-moderation/index.ts`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-signed-url/media.test.ts`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/razorpay-checkout/deno.json`
- `supabase/functions/razorpay-webhook/deno.json`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/functions/web-billing/deno.json`
- `supabase/functions/weekly-plan/deno.json`
- `supabase/functions/weekly-plan/index.test.ts`
- `supabase/functions/weekly-plan/index.ts`
- `supabase/functions/workout-plan/deno.json`
- `supabase/migrations/20261109000000_weight_date_and_baseline.sql`

## 3. Tests and results

Added/expanded coverage includes stored-zone future dates and retries at the database boundary, stable baselines, weekly sampling/missing weeks/three-year limits, independent weight/date edits, late form hydration, acknowledged retries, one-card flings and wheel bursts, simplified chat/settings, account/cache-key isolation, web restart persistence, observed access revocation, room removal, Claude-first provider chains and moderation, and private coach identity.

Final automated summaries:

```text
App:   Test Files 157 passed (157); Tests 894 passed (894)
Core:  Test Files 62 passed (62); Tests 629 passed (629)
UI:    Test Files 7 passed (7); Tests 62 passed (62)
Database migrations: 113 passed; all SQL/RLS suites passed
Edge: 139 passed, 0 failed across all eight suites
Format: All matched files use Prettier code style!
Lint: 0 errors; 74 existing warnings; no new style violations
Typecheck: all workspaces passed
Build: web, Android Hermes and iOS Hermes exports passed
```

Browser audit: `node scripts/ai_weight_squad_browser_audit.mjs` passed at 375px and 844px, including long horizontal wheel paging, actual weekly dates, large text/Reduce Motion, future-date rejection, historical date edits, and an offline reload that retains cached squad leaders. Screenshots and navigation hit-area measurements are under `.artifacts/ai-weight-squad/browser/`. Circular Back has a 44?44 target and an uncompressed 32?32 glyph.

The live audit used only disposable private synthetic accounts and cleaned them up. It passed real coach replies, identity wording, consent/Free denial, reviewable meal drafts, acknowledged duplicate-free meal/weight/photo saves, future-date rejection, apple-photo analysis, cross-account privacy and human-chat reply/deletion checks. Credentials stayed in the OS credential store/process memory.

## 4. Assumptions

- Each weekly anchor uses its exact day or the nearest earlier entry within that seven-day window. Weeks without a weigh-in are omitted; dates and durations are never invented. The maximum is three calendar years, and shorter histories stay shorter.
- Fallbacks run when the primary is unavailable, including exhausted credit/quota or unsupported media, as well as provider errors. No additional providers were added.
- Offline means read-only access to previously loaded data. Signed-in macro/food/weight logging still requires server acknowledgement, following the existing product rule and the owner's conditional allowance. Nothing is presented as saved offline or queued silently.
- Removing settings entries does not erase the user's stored preferences, history, export rights or system accessibility behaviour.

## 5. Manual work

- No new accounts, keys or console settings are required; the existing hosted Anthropic key was already configured.
- Use the normal app release/update process for installed builds. Smoke-test on physical Android/iOS devices, especially swipe momentum, modal/back behaviour, keyboard and system font scaling.
- Offline web startup requires a prior online visit so the app shell and data can be cached. Unvisited or never-loaded data cannot be displayed offline.

## 6. Later work noticed

The pre-existing Supabase migration-history gaps remain separate maintenance work. Only the new migration was applied; historical files were neither replayed nor falsely marked as applied. A durable offline-write queue would require a separate product decision and was not built.
