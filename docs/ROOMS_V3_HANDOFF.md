# Rooms v3 implementation handoff

Built the owner-requested free pair model, individual chat/workout/media permissions, Plus and Pro host quotas, mutual seven-day challenges, 30-day freeze/takeover/deletion lifecycle, monthly Pro plan reviews, and onboarding/UI changes described in [the approved revision](ROOMS_V3.md).

Existing subscription amounts and AI allowances are retained. Assumptions: Free hosts one two-person room, Plus hosts two five-person rooms, and Pro hosts five 20-person rooms. A normal free pair stays available when a member's paid features lapse. Sharing nutrition remains opt-in. The removed weekly-limit wording does not remove calculator or database safety caps.

The obsolete room-billing simulations were replaced with shared-helper tests and actual PostgreSQL integration tests replaying the entire migration chain. Two new compatibility migrations repair historical fresh-install failures without editing committed migrations. Metadata notifications refresh private room summaries without exposing base health tables. Height edits in Me now save a new validated plan through the existing offline outbox.

## Validation

Run `npm run check`, `npm run format:check`, and `npm run build:web` before every push. The database test runner is part of `npm test`; it needs no Docker or cloud credentials. It tests real PostgreSQL functions and RLS with Supabase-compatible auth roles. Supabase Realtime delivery, RevenueCat store checkout, Cloudflare R2 uploads, native media permissions and device accessibility still need environment/device smoke tests.

Expected suite summaries for this change: app 545 tests, core 446 tests, UI 52 tests; database 17 scenarios and 33 migrations. Existing unrelated lint warnings remain; no new token violations are allowed.

## Deployment / manual work

1. Apply migrations before releasing the new app. The two compatibility migrations precede existing migration versions, so use `npx supabase db push --include-all` against the intended project. Their guards leave already-upgraded RPCs/views unchanged. No production database was changed during this coding session.
2. Deploy the changed `chat-upload-url` Edge Function. Existing Supabase, RevenueCat and private R2 configuration is reused; no new secrets belong in the app.
3. Verify the `rooms_v3_lifecycle` pg_cron job runs every 15 minutes. The migration schedules it when pg_cron is installed. If the project lacks pg_cron, enable it and schedule `select public.process_room_lifecycle_cron()` with that interval. Access expires at the deadline; physical cleanup happens at the next maintenance run.
4. Build new Android/iOS EAS development builds for the added Expo image picker, video and file-system modules. Expo Go is not supported. Test photo/video selection, upload, playback, subscription refresh and takeover on both platforms.
5. Keep the existing RevenueCat product IDs and amounts. Update subscription feature descriptions to the new room limits and per-person benefits as needed.
6. Smoke-test 200% text, screen readers, a small phone, offline target edits and account switching. Trial availability comes from the store and the server entitlement, not the preview text.

## Later work observed, not built

Broader replacement of existing sample-only Partner Finder/seasonal challenge content, unrelated lint-warning cleanup, and general legacy billing helpers are outside this request. This change implements the requested pair challenge and workout-sharing paths; it does not redesign those other products. Native-device and live-service smoke tests are required before release.

## Files created or changed

- `AGENTS.md`
- `AGENT_RULES.md`
- `app/app.config.ts`
- `app/package.json`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/app/plan-review.tsx`
- `app/src/components/chat/ChatComposer.tsx`
- `app/src/components/chat/ChatImageViewerModal.tsx`
- `app/src/components/chat/ChatMediaPickerModal.tsx`
- `app/src/components/chat/ChatMessageBubble.tsx`
- `app/src/components/chat/ChatVideo.tsx`
- `app/src/components/chat/ChatView.tsx`
- `app/src/components/onboarding/HeightField.test.tsx`
- `app/src/components/onboarding/HeightField.tsx`
- `app/src/components/onboarding/PlanPrimitives.tsx`
- `app/src/components/onboarding/PlanReviewStep.tsx`
- `app/src/components/onboarding/PremiumStep.tsx`
- `app/src/components/onboarding/TrainingStep.tsx`
- `app/src/components/onboarding/onboarding.test.ts`
- `app/src/components/onboarding/onboardingUI.test.ts`
- `app/src/components/profile/GoalsAndBodyModal.tsx`
- `app/src/components/profile/MonthlyPlanCheckIn.tsx`
- `app/src/components/profile/profileUI10.test.ts`
- `app/src/components/rooms/BasicRoomCard.tsx`
- `app/src/components/rooms/CreateRoomModal.tsx`
- `app/src/components/rooms/LockedRoomPausedState.tsx`
- `app/src/components/rooms/MeRoomPlanCard.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/RequestsInboxModal.test.tsx`
- `app/src/components/rooms/RequestsInboxModal.tsx`
- `app/src/components/rooms/RoomExtras.tsx`
- `app/src/components/rooms/SquadConnectFlow.test.tsx`
- `app/src/components/rooms/SquadConnectFlow.tsx`
- `app/src/components/rooms/paywallUI.test.ts`
- `app/src/components/rooms/roomsUI.test.ts`
- `app/src/hooks/usePaywall.ts`
- `app/src/hooks/useRoomChat.ts`
- `app/src/hooks/useRooms.ts`
- `app/src/hooks/useSubscription.ts`
- `app/src/i18n/en.ts`
- `app/src/services/chatImageService.ts`
- `app/src/services/chatService.ts`
- `app/src/services/onboardingStateMachine.test.ts`
- `app/src/services/onboardingStateMachine.ts`
- `app/src/services/roomExtrasService.ts`
- `app/src/services/roomService.test.ts`
- `app/src/services/roomService.ts`
- `app/src/types/chat.ts`
- `app/src/types/rooms.ts`
- `docs/BUILD_PLAN.md`
- `docs/ROOMS_V3.md`
- `docs/ROOMS_V3_HANDOFF.md`
- `docs/prd.md`
- `package-lock.json`
- `package.json`
- `packages/core/src/chat.ts`
- `packages/core/src/index.ts`
- `packages/core/src/monthlyReview.test.ts`
- `packages/core/src/monthlyReview.ts`
- `packages/core/src/rooms.ts`
- `packages/core/src/rooms_attack.test.ts`
- `packages/core/src/subscriptions.test.ts`
- `packages/core/src/subscriptions.ts`
- `packages/core/src/subscriptions_attack.test.ts`
- `packages/core/src/types.ts`
- `packages/ui/src/components/Card.tsx`
- `packages/ui/src/tokens/onboarding.ts`
- `packages/ui/src/tokens/type.ts`
- `scripts/rooms_v3_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `supabase/functions/chat-upload-url/index.ts`
- `supabase/migrations/20261020000000_prepare_access_rpc_return_types.sql`
- `supabase/migrations/20261020235959_prepare_current_goal_view_columns.sql`
- `supabase/migrations/20261024060000_rooms_v3_free_pairs_individual_features.sql`
- `supabase/migrations/20261024060001_room_workout_shares_pair_challenges.sql`
