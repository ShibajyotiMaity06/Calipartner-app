# Entry screens, automatic billing country and request cleanup — 4 November 2026

## 1. What changed

- Replaced Welcome, Create account and Log in using the supplied PDF’s layout, retaining the owner-supplied CaliPartner logo and upright Jakarta fonts. Email is directly visible, with Google and Apple on iOS; email authentication remains a six-digit code. Legal links, autofill, loading and actionable error states remain available.
- Replaced only onboarding Why it works and Plus/Pro. The journey is explicitly illustrative; the week preview is labelled as an example. Live server/store prices, Plus/Pro selection, Plus-only trial copy, price retry and a visible Free action are included. Plan choices remain visible at 200% text size. Existing calculator, safety and purchased-plan gates are preserved.
- Removed the payment-country dropdown. Web catalog loading first detects the caller’s IP country in the authenticated Edge Function and waits for the country save acknowledgement. India selects Razorpay/INR; other detected countries select Dodo/USD. Detection failure shows retry and blocks new checkout. Existing subscriptions retain their management provider; native purchases remain on their app stores. No IP is stored or logged by the implementation.
- Squad requests include only pending, unexpired items. Acknowledged responses/cancellations remove the row immediately even if the following refresh fails. Mounted inboxes invalidate together and focused inboxes poll every five seconds for actions on another device. Older overlapping reads cannot restore a resolved row; duplicate submissions are guarded. Friend inboxes receive the same acknowledgement/invalidation behavior. Stale requests refresh quietly instead of showing raw request errors.
- Overview, Leaderboard and Chat use a yellow selected top border and retain semantic selected state.

## 2. Files created or changed

- Requirements/design: `AGENT_RULES.md`, `docs/prd.md`, `docs/BUILD_PLAN.md`, `docs/ui/screens-A-B.md`; new `docs/ui/entry-refresh-2026-11-04.md` and this report.
- Entry/onboarding: `app/src/app/welcome.tsx`, `app/src/app/auth/sign-in.tsx`, `app/src/app/onboarding/index.tsx`, `app/src/components/onboarding/MotivationStep.tsx`, `PremiumStep.tsx`; new `app/src/components/brand/EntryTerms.tsx` and `app/src/components/onboarding/EntryRefresh.test.tsx`.
- Squad/inboxes: `app/src/components/rooms/RoomHeader.tsx`, `RequestsInboxModal.tsx`, `app/src/hooks/useRoomRequests.ts`, `useFriends.ts`, `app/src/services/roomService.ts`, `roomService.test.ts`, `friendsService.ts`, `friendsService.test.ts`; new `app/src/services/requestInboxEvents.ts`, `app/src/hooks/useRoomRequests.test.tsx` and `useFriends.test.tsx`.
- Billing: `app/src/components/rooms/PaywallModal.tsx`, `app/src/services/webBillingService.ts`, `webBillingService.test.ts`, `supabase/functions/web-billing/index.ts`, `index.test.ts`; new `supabase/functions/web-billing/country.ts`. Removed `app/src/components/rooms/BillingCountrySelect.tsx` and its obsolete selector tests; replaced that coverage with automatic-detection tests.
- Tokens/i18n: `packages/ui/src/tokens/colors.ts`, `onboarding.ts`, `app/src/i18n/en.ts`; new `app/src/i18n/entryRefresh.ts`.
- Verification: new `scripts/entry_refresh_browser_audit.mjs`; updated `scripts/nov4_browser_audit.mjs` and `scripts/verify_web_billing_hosted.ps1`.
- The owner’s pre-existing whitespace edit in `app/.env.example` is excluded from the commit.

## 3. Tests and results

New regression coverage verifies six-digit signup versus login semantics, OTP autofill, actionable failures, real INR/USD catalogs, Pro without a trial, Free/retry after price failure, pending-only room projections, acknowledged request responses, cross-inbox invalidation, failed refreshes, remote acceptance and duplicate-action guards. Billing tests cover country lookup validation/failure, ignored client country overrides, acknowledged persistence and provider isolation.

- Format: `All matched files use Prettier code style!`
- Lint: `72 problems (0 errors, 72 warnings)`; existing warnings only. Token check: `No new style violations detected (252 grandfathered violations).`
- Typecheck: app, core and UI passed.
- App: `Test Files 122 passed (122)` / `Tests 752 passed (752)`.
- Core: `Test Files 50 passed (50)` / `Tests 552 passed (552)`.
- UI: `Test Files 6 passed (6)` / `Tests 55 passed (55)`.
- SQL/RLS: `Database migrations: 95 passed`; every database suite passed. No migration or RLS change was needed for these fixes.
- Billing Edge: `ok | 29 passed | 0 failed`. Remaining Edge suites: food/photo 24, chat/push 17, Coach 14, weekly planning 11, challenges 7; all passed. Total: 1,359 app/core/UI tests and 102 Edge tests, plus SQL/RLS suites.
- Web, Android Hermes and iOS Hermes exports passed. These are bundle checks, not installed-device payment tests.
- Browser entry audit passed Welcome/signup/login at 375px and 844px landscape, both onboarding previews, live-format INR/USD fixture pricing, Pro without trial, no country dropdown, and premium at 200% text size with Free visible. Screenshots are local under `.artifacts/entry-refresh/`.
- The broader browser audit passed existing food/navigation/Squad/weekly-plan flows, the yellow selected border, Razorpay dismissal/pending/webhook-confirmed access/renewal cancellation fixtures and international Dodo routing. No real payment was attempted.
- Deployed only the updated `web-billing` Edge Function to the linked Supabase project using the existing OS credential helper. Hosted verification passed actual automatic country detection and profile persistence (`US / dodo`), an actual valid Razorpay INR catalog (HTTP 200), direct Indian Dodo denial and all four actual Dodo USD products. No checkout/subscription was created; the temporary synthetic user was deleted. Both providers’ catalogs are configured; the older Razorpay setup warning is outdated.

## 4. Assumptions

- The PDF supplies visual references. Its password controls do not replace the project’s explicit email-code authentication requirement, and its example people/scores are not real user data.
- “Delete accepted requests” means remove resolved requests from actionable inboxes. Accepted friendships, room membership and private request history remain intact.
- IP location selects a billing region, not nationality or identity. VPNs/proxies can affect IP location. This hint never grants entitlements. Country lookup uses [Country’s documented IP endpoint](https://country.is/); checkout providers and signed webhooks retain payment verification.

## 5. Manual steps

- Reload the development frontend or release the updated web/native app to receive the UI changes. The billing Edge Function is already deployed. No new API key is required for country detection.
- Physical Android/iOS text scaling, Apple/Google sign-in and real provider payment/mandate flows still require device/account testing. This delivery intentionally performed no charge, refund or subscription cancellation against a real customer.

## 6. Later work noticed

The previously documented migration-ledger gaps and scheduled Razorpay tier/period changes remain separate maintenance/features. They were not changed. No future onboarding or authentication feature was added.
