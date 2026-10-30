# Room and logging repair report - 30 October 2026

## Built

- Durable IndexedDB browser storage, legacy diary/outbox migration, rollback on failed saves, deduplicated chat caching and stable message ordering.
- Multi-member room comparison, immediate own-diary projection, accurate food-activity wording, static Plus Jakarta Sans in room/chat/workout views, typed recipient-selected nudges, and partner-selected shared-meal copying.
- Signed image/video previews with renewal/retry and an attachment icon; removed the redundant Open chat action.
- Independent privacy patches/switches; removed partner-preview entry points. Challenge reads survive unavailable scoring or replaceable cache failures with a delayed-results notice.
- Real offline workout logs: category -> exercise -> entered sets, atomic outbox persistence, and optional selection of a room for sharing after sync.
- Tab/section/sheet Back navigation, explicit shared-meal modal visibility for Close, and consistent home meal prompt/highlight.

## Tests and checks

```text
 Test Files  93 passed (93)
      Tests  711 passed (711)
 Test Files  43 passed (43)
      Tests  507 passed (507)
 Test Files  5 passed (5)
      Tests  52 passed (52)
```

Format and TypeScript checks passed. Lint: 0 errors and 74 existing warnings; no new token violations. All SQL/RLS suites passed against 82 migrations. Edge suites: billing 9, food/photo 17, push/media 16, coach 9, challenges 7 passed; 0 failed. Web and Android/iOS Hermes bundle exports passed.

New regression coverage includes storage quota migration/reopen/rollback, queue retry behavior, workout persistence, chat deduplication and ordering, recipient/meal selection, five/ten/nineteen partner comparisons, private media preview/retry, challenge fallback, privacy patches, consent/access denial and browser history.

Hosted disposable-account checks passed for independent privacy, today's partner meals, duplicate-safe copying and custom nudges. Chromium verified the own diary, computed Plus Jakarta family, Close/browser Back, and 20-member fixture comparison at 320/390/1024 px without horizontal overflow. Every disposable account and room was deleted.

## Assumptions

Selected members means selected partners plus your own card. Existing capacities, entitlements, privacy, safety and media/nudge limits remain authoritative. Meal copying requires current consent and nutrition sharing; SQL authorizes it online and immediately mirrors your independent entry locally. Each person's stored time zone defines their day.

## Deployment and manual steps

Migration 20261030000032_room_privacy_and_meal_copy.sql was applied to the existing linked CaliPartner project. Its CLI deployment workspace contained already-recorded remote migrations plus this repair; dry run and application listed only this new migration. No historical migrations were replayed or marked as applied.

Reload the delivered web app. Native users need an updated EAS build installed. No new accounts, keys or console settings are required. Native validation used bundle exports; physical-device image/video upload/playback was not repeated. Signing, access and preview/player paths have automated coverage.

## Later work noticed, not built

Reconcile the pre-existing remote migration-history gaps before a future blanket database push. Legacy workout progress/weekly-plan demo behavior remains outside the requested workout logging repair.

## Files created or changed

Existing room/chat/workout font changes use the shared token-backed Text component and input family. Edge import-map edits let Deno resolve the new shared core exports.

- `app/package.json`
- `app/src/app/(tabs)/_layout.tsx`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/_layout.tsx`
- `app/src/components/chat/ChatActions.test.tsx`
- `app/src/components/chat/ChatAttachmentPreview.test.tsx`
- `app/src/components/chat/ChatAttachmentPreview.tsx`
- `app/src/components/chat/ChatComposer.tsx`
- `app/src/components/chat/ChatEmptyState.tsx`
- `app/src/components/chat/ChatImageViewerModal.tsx`
- `app/src/components/chat/ChatMediaPickerModal.tsx`
- `app/src/components/chat/ChatMessageBubble.tsx`
- `app/src/components/chat/ChatMessageMenuModal.tsx`
- `app/src/components/chat/ChatReportModal.tsx`
- `app/src/components/chat/ChatTermsModal.tsx`
- `app/src/components/chat/ChatVideo.tsx`
- `app/src/components/chat/ChatView.tsx`
- `app/src/components/progress/ChallengesView.tsx`
- `app/src/components/rooms/BasicRoomCard.tsx`
- `app/src/components/rooms/BlockUserModal.tsx`
- `app/src/components/rooms/CreateRoomModal.tsx`
- `app/src/components/rooms/InviteUserModal.tsx`
- `app/src/components/rooms/JoinByCodeModal.tsx`
- `app/src/components/rooms/LockedFeaturePreviewCards.tsx`
- `app/src/components/rooms/LockedRoomPausedState.tsx`
- `app/src/components/rooms/MemberComparison.tsx`
- `app/src/components/rooms/MembersTab.tsx`
- `app/src/components/rooms/NudgeModal.tsx`
- `app/src/components/rooms/OverCapacityBanner.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/PlaceholderSegment.tsx`
- `app/src/components/rooms/PrivacySettingsModal.tsx`
- `app/src/components/rooms/ReactionModal.tsx`
- `app/src/components/rooms/ReportModal.tsx`
- `app/src/components/rooms/RequestsInboxModal.test.tsx`
- `app/src/components/rooms/RequestsInboxModal.tsx`
- `app/src/components/rooms/RoomAccess.test.tsx`
- `app/src/components/rooms/RoomFullNotice.tsx`
- `app/src/components/rooms/RoomHeader.tsx`
- `app/src/components/rooms/RoomMemberPicker.tsx`
- `app/src/components/rooms/RoomOverviewRow.tsx`
- `app/src/components/rooms/RoomPrivacy.test.tsx`
- `app/src/components/rooms/RoomProgressView.tsx`
- `app/src/components/rooms/RoomSettingsModal.tsx`
- `app/src/components/rooms/ShareLoggedMealModal.tsx`
- `app/src/components/rooms/SharedMealCard.tsx`
- `app/src/components/rooms/SideBySideCard.tsx`
- `app/src/components/rooms/TrialBanner.tsx`
- `app/src/components/rooms/UsabilityFlows.test.tsx`
- `app/src/components/workouts/AddExercisePickerModal.tsx`
- `app/src/components/workouts/CardioForm.tsx`
- `app/src/components/workouts/ExerciseDetailModal.tsx`
- `app/src/components/workouts/ExercisePickerModal.tsx`
- `app/src/components/workouts/RestTimerModal.tsx`
- `app/src/components/workouts/RunningTimerBar.tsx`
- `app/src/components/workouts/TodayWorkoutCard.tsx`
- `app/src/components/workouts/WorkoutDetailModal.tsx`
- `app/src/components/workouts/WorkoutFinishSummaryModal.tsx`
- `app/src/components/workouts/WorkoutHistoryCalendarModal.tsx`
- `app/src/components/workouts/WorkoutHubModal.tsx`
- `app/src/components/workouts/WorkoutLogModal.tsx`
- `app/src/components/workouts/WorkoutLoggerModal.tsx`
- `app/src/components/workouts/WorkoutRoutinesModal.tsx`
- `app/src/db/index.ts`
- `app/src/db/webQueries.ts`
- `app/src/db/webStorage.test.ts`
- `app/src/db/webStorage.ts`
- `app/src/hooks/useBrowserModalBack.test.tsx`
- `app/src/hooks/useBrowserModalBack.ts`
- `app/src/hooks/useChallenges.ts`
- `app/src/hooks/useWorkouts.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/repairs.ts`
- `app/src/services/challengeService.test.ts`
- `app/src/services/challengeService.ts`
- `app/src/services/chatService.ts`
- `app/src/services/roomMealService.ts`
- `app/src/services/syncService.ts`
- `app/src/services/workoutLogService.ts`
- `app/src/theme/fontLoader.ts`
- `docs/prd.md`
- `docs/ui/03-type.md`
- `package-lock.json`
- `packages/core/src/challengeTypes.ts`
- `packages/core/src/index.ts`
- `packages/core/src/roomDiary.test.ts`
- `packages/core/src/roomDiary.ts`
- `packages/core/src/workoutLog.test.ts`
- `packages/core/src/workoutLog.ts`
- `packages/ui/src/components/PairedCard.tsx`
- `packages/ui/src/components/Text.tsx`
- `packages/ui/src/tokens/type.ts`
- `scripts/room_usability_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/migrations/20261030000032_room_privacy_and_meal_copy.sql`
- `docs/ROOM_USABILITY_REPAIRS_2026-10-30.md` (this report)
