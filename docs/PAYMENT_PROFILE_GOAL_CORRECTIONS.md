# Payment, profile and goal corrections - 25 October 2026

The owner requested these corrections explicitly. This revision supersedes conflicting phase restrictions, ONB-4, the mandatory version-2 rate cap/floor/BMI save restrictions, and SUB-12/SUB-19 for browser purchases only. It authorizes the necessary shared calculator, persistence, billing service, webhook and migration changes alongside the views.

- Real purchases use RevenueCat on iOS/Android and Dodo Payments in browsers. Checkout must collect payment or confirm an eligible store trial; the app never grants access itself. Supabase entitlements remain the only access authority. Missing billing configuration produces an unavailable state. Never show successful activation before server confirmation. Remove client email grants and fabricated discounts. Existing intentional server-issued complimentary entitlements are retained.
- On version-2 plans, recommendations stay conservative, with calorie-floor, BMI, large-deficit and high-gain cautions. Users can select presets or enter a custom weekly pace/daily adjustment above recommendations. These are estimates, not promised results. Reject non-finite/negative inputs, non-positive calories and targets that cannot fit the specified protein/fat allocation. The legacy version-1 calculator is unchanged.
- Do not put near-duplicate recommendation/preset rates within 0.05 kg/week in the pace list. Custom entry remains available.
- Show the existing circular loading indicator without startup skeletons. Compact and space the social-profile, friends and profile buttons while retaining accessible touch targets.
- Open social editing directly. Social details contain a bio and optional bulk/cut choice plus the existing privacy control; remove website and Instagram controls/links. Store the optional goal in the existing training-style field for compatibility. Friends retains explicit loading, empty, cached and actionable error states.
- Highlight selected gym days without a checkmark. Show exact stored step counts and targets consistently on Home and Me, including 6,099.

Live billing requires configured RevenueCat products/offerings, store accounts and public native SDK keys, plus Dodo products, an API key, a webhook signing secret and a configured return URL for browser checkout. Keep payment secrets in Supabase secrets. Never claim a live charge was tested without one.

## Session delivery report

Built: Dodo hosted checkout and verified subscription webhooks for browsers; native RevenueCat confirmation fixes; removal of client-side and automatic email-based plan grants; direct bio/bulk/cut social editing; compact profile actions; spinner-only startup; exact step values; advisory pace/surplus recommendations with custom input.

The five missing/new migrations were applied to the linked Supabase project in one transaction and recorded in its migration history. The live Friends inbox and own social profile RPCs passed an owner-scoped smoke test in a rolled-back transaction. `dodo-checkout`, `dodo-webhook`, `calculate-targets` and `revenuecat-webhook` were deployed. Dodo preflight returns 200; unconfigured checkout and webhook return 503, with no entitlement granted.

Validation summary:

```text
Formatting: All matched files use Prettier code style!
Lint: 0 errors, 104 existing warnings; no new token violations.
Typecheck: app, core and UI passed.
App: Test Files 65 passed (65); Tests 576 passed (576).
Core: Test Files 38 passed (38); Tests 466 passed (466).
UI: Test Files 5 passed (5); Tests 52 passed (52).
Database migrations: 37 passed.
Database tests: 17 passed, 0 failed.
Friends database tests: 13 passed, 0 failed.
Billing and goal database tests: 5 passed, 0 failed.
Dodo Edge tests: ok | 5 passed | 0 failed.
Dodo Edge Function typechecks: passed.
Web build: Exported: dist.
```

Added regression coverage for unsupported/missing checkout configuration, cancellation, webhook verification pending, exact product selection, restore without an entitlement, Dodo URL validation, invalid signatures, account-bound retry reuse, unsupported products, subscription lifecycle mapping, RLS, event replay, automatic grant removal and custom goal persistence. The original PRD calculator tests remain unchanged.

Assumptions: bio plus an optional bulk/cut label reuses the existing training-style field; the public/private control stays. Numeric sanity and consistent macro totals remain required. Existing server-issued complimentary plans are retained, so use a free account when testing checkout. Test-store keys and simulated purchase events do not activate production access.

Manual work: finish the [Dodo setup](DODO_SETUP.md), including live account verification, four recurring products and server secrets. A live charge, native store purchase, real-device accessibility and browser return flow with an actual provider transaction remain untested. Rebuild/redeploy the app from this commit to receive the UI changes.

Later-phase observations: none built beyond the explicitly requested payment/profile/goal corrections. Native account/product configuration remains environment setup, not an additional feature.

Files created or changed:

- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/friends.tsx`
- `app/src/app/onboarding/index.tsx`
- `app/src/app/paywall.tsx`
- `app/src/app/profile/social.tsx`
- `app/src/components/LoadingState.tsx`
- `app/src/components/friends/FriendsProfiles.test.tsx`
- `app/src/components/friends/PublicSocialProfile.tsx`
- `app/src/components/friends/SocialProfileEditor.tsx`
- `app/src/components/onboarding/PlanReviewStep.tsx`
- `app/src/components/onboarding/TrainingStep.tsx`
- `app/src/components/profile/GoalsAndBodyModal.tsx`
- `app/src/components/rooms/MeRoomPlanCard.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/hooks/useFriends.ts`
- `app/src/hooks/useRooms.ts`
- `app/src/hooks/useSubscription.test.tsx`
- `app/src/hooks/useSubscription.ts`
- `app/src/i18n/en.ts`
- `app/src/services/dodoService.test.ts`
- `app/src/services/dodoService.ts`
- `app/src/services/friendsService.ts`
- `app/src/services/onboardingStateMachine.test.ts`
- `app/src/services/onboardingStateMachine.ts`
- `app/src/services/subscriptionPackages.test.ts`
- `app/src/services/subscriptionPackages.ts`
- `app/src/services/subscriptionService.test.ts`
- `app/src/services/subscriptionService.ts`
- `docs/BUILD_PLAN.md`
- `docs/DODO_SETUP.md`
- `docs/PAYMENT_PROFILE_GOAL_CORRECTIONS.md`
- `docs/prd.md`
- `package.json`
- `packages/core/src/billingEnvironment.test.ts`
- `packages/core/src/dodoBilling.test.ts`
- `packages/core/src/dodoBilling.ts`
- `packages/core/src/gymTargets.test.ts`
- `packages/core/src/gymTargets.ts`
- `packages/core/src/index.ts`
- `packages/core/src/subscriptions.ts`
- `scripts/billing_goal_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `supabase/.env.example`
- `supabase/config.toml`
- `supabase/functions/_shared/dodo.ts`
- `supabase/functions/_shared/dodoHandlers.test.ts`
- `supabase/functions/_shared/dodoHandlers.ts`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-checkout/deno.lock`
- `supabase/functions/dodo-checkout/index.ts`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/dodo-webhook/index.ts`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/migrations/20261025000000_custom_plan_recommendations.sql`
- `supabase/migrations/20261025000001_dodo_web_checkout.sql`
- `supabase/migrations/20261025000002_remove_automatic_plan_grants.sql`
