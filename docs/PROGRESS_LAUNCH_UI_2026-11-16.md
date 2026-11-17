# Progress and launch UI delivery ? 16 November 2026

## Built

- Progress has a weight/goal hero, 7D/30D/90D/All ranges and focused Weight, Nutrition, Workouts, Photos and Habits tabs. It uses recorded weights, nutrition, workouts and stored-zone day boundaries; missing measurements stay unknown. Weight logging/editing retains acknowledged saves.
- Added food-day calorie/protein averages, protein-goal hit rate, weight averages/change, strength-set totals, estimated 1RM through the existing core formula, workout frequency bars and a readable records table. Fixed workout counts inflated by a join to sets. All-history includes weight/workout-only dates. Range/account request races cannot replace current results.
- Embedded the private device photo vault with its existing comparison, camera/gallery and saved-photo management. Plus/Pro access remains checked. No cloud-backup promise.
- Challenges, trophies and badges are deferred by owner decision. Removed Home, Progress, Account and Squad launch entries and current-plan claims; paywall and prepared store copy say Coming soon. Retained challenge components now resolve their card styles from the active theme, including the badge shelf. Existing challenge/scoring/badge automated coverage passes; this is not a claim of full production launch acceptance.
- Added SubscriptionPill to shared main headers: Free ? plans, Plus/trial ? Pro plans, Pro ? Account. Loading/error status uses neutral Plans. The paywall honours the requested Pro tier.
- Account plan details sit immediately below the profile, with readable status and provider-correct management. Dodo opens its portal; Razorpay opens web billing management; Apple/Google subscriptions use their original store. Cardless trials are not described as auto-renewing subscriptions.
- Theme switching appears only on Home. Reduced the coach reply logo and its container. Shared segmented controls now cover Friends, Chat, Progress, account-related tabs, workouts, cardio, requests, legal and authentication. Friends Invite is compact; common buttons share a 44px minimum size and Add actions gain a plus icon.
- New social details default to visible through authenticated privacy-filtered projections. Explicit existing opt-outs, discoverability, blocking and health-log sharing remain enforced. The social editor explains the default and provides the opt-out.

## Validation

All required gates passed. Local browser tests use isolated contract fixtures and do not send real payments or messages.

- Workspace suites: 956 app + 653 core + 66 UI = **1,675 passed**.
- Edge suites: **149 passed, 0 failed**.
- Database: **120 migrations passed**, all suites passed, including new session/set counts, stored-zone ranges, owner isolation, public defaults and explicit opt-out regressions.
- Typecheck, ESLint/token lint, Prettier and production web export: passed. Existing unrelated lint warnings remain; no lint errors or new token violations.
- Browser: 375px layouts, both supported appearances, large-text stress check, focused categories, four ranges, paid photo-vault visibility, Free/Plus/Pro routes, Home-only theme controls and compact Friends tabs/buttons passed. Screenshots: `.artifacts/progress-launch/browser/` (local, not committed).
- Migration `20261116000002_progress_and_social_defaults.sql` was applied and recorded on the linked Supabase project. A read-only hosted check passed for the new projection, empty-account counts, All range, private-helper denial and anonymous denial.
- No real charge or physical Android/iOS device run was performed for this change.

## Assumptions

- ?Public social details? means visible to signed-in users through the existing safe projection, not public health data or unauthenticated indexing. Explicit privacy choices are preserved.
- Protein hit rate compares logged food days against the current saved protein target; the UI says current goal. Missing intake/steps/water days are excluded from measurement averages, not fabricated as zeros.
- All standard buttons share sizing and typography; destructive actions retain their meaningful danger treatment. The requested header upgrade action is an explicit exception to the older one-apricot-action-per-screen rule; it follows the current theme tokens.
- Existing Light/Yellow appearances are retained; no new theme palette was introduced.

## Manual and later work

- No new account or secret is required for this implementation.
- Apple/Google developer accounts, store submission and final physical-device acceptance remain pending from the earlier launch checklist.
- Challenges/trophies/badges will need a separate launch decision and acceptance review. No release date is promised.
- Other paywall items already labelled Coming soon remain future work.

## Files created or changed

- `AGENT_RULES.md`
- `app/src/app/(tabs)/chat.tsx`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/_layout.tsx`
- `app/src/app/auth/sign-in.tsx`
- `app/src/app/dev/challenges.tsx`
- `app/src/app/paywall.tsx`
- `app/src/components/HeaderActions.tsx`
- `app/src/components/cardio/CardioTrackerModal.test.tsx`
- `app/src/components/cardio/CardioTrackerModal.tsx`
- `app/src/components/coach/CoachMessageBubble.tsx`
- `app/src/components/friends/CommunityPanel.tsx`
- `app/src/components/friends/SocialProfileEditor.tsx`
- `app/src/components/friends/socialFlows.test.tsx`
- `app/src/components/legal/TermsOfServiceModal.tsx`
- `app/src/components/onboarding/EntryRefresh.test.tsx`
- `app/src/components/progress/BadgeShelf.test.tsx`
- `app/src/components/progress/BadgeShelf.tsx`
- `app/src/components/progress/ChallengeDetailModal.tsx`
- `app/src/components/progress/ChallengeResultModal.tsx`
- `app/src/components/progress/ChallengeShareCard.tsx`
- `app/src/components/progress/ChallengesView.tsx`
- `app/src/components/progress/CreateChallengeModal.tsx`
- `app/src/components/progress/OccasionPlanModal.tsx`
- `app/src/components/progress/ProgressOverview.tsx`
- `app/src/components/progress/ProgressPhotosView.tsx`
- `app/src/components/progress/RangeSelector.tsx`
- `app/src/components/progress/TodayChallengeCard.tsx`
- `app/src/components/progress/WeightGoalHeroCard.tsx`
- `app/src/components/progress/WorkoutsChart.tsx`
- `app/src/components/rooms/MeRoomPlanCard.tsx`
- `app/src/components/rooms/PaywallCheckout.test.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/RequestsInboxModal.test.tsx`
- `app/src/components/rooms/RequestsInboxModal.tsx`
- `app/src/components/rooms/RoomExtras.tsx`
- `app/src/components/subscription/SubscriptionPill.test.tsx`
- `app/src/components/subscription/SubscriptionPill.tsx`
- `app/src/components/trackers/ProgressPhotosModal.tsx`
- `app/src/components/workouts/WorkoutHistoryCalendarModal.tsx`
- `app/src/components/workouts/WorkoutProgressModal.tsx`
- `app/src/hooks/useIndividualProgress.test.tsx`
- `app/src/hooks/useIndividualProgress.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/progressRefresh.ts`
- `app/src/services/progressService.test.ts`
- `app/src/services/progressService.ts`
- `app/src/test/SegmentedControlStub.tsx`
- `docs/BUILD_PLAN.md`
- `docs/PROGRESS_LAUNCH_UI_2026-11-16.md`
- `docs/prd.md`
- `packages/core/src/index.ts`
- `packages/core/src/progressSummary.test.ts`
- `packages/core/src/progressSummary.ts`
- `packages/core/src/types.ts`
- `packages/ui/src/components/AddIcon.tsx`
- `packages/ui/src/components/Button.tsx`
- `packages/ui/src/components/SegmentedControl.tsx`
- `packages/ui/src/tokens/controls.ts`
- `packages/ui/src/tokens/index.ts`
- `scripts/progress_launch_browser_audit.mjs`
- `scripts/progress_launch_cases.mjs`
- `scripts/site/pages.ts`
- `scripts/site/store-listing.json`
- `scripts/test_rooms_v3.mjs`
- `supabase/migrations/20261116000002_progress_and_social_defaults.sql`
