# Razorpay web billing delivery - 4 November 2026

## What was built

- New Indian web checkouts use Razorpay in INR. International web uses the existing Dodo USD products. Native Android/iOS still use RevenueCat and their respective app stores. No native Razorpay package or public payment secret was added.
- The web paywall saves an explicitly selected billing country before changing its quoted catalog. Missing countries do not default to India. Existing subscriptions keep their original provider and management flow.
- Server-verified pricing for four plans, account-bound checkout reservations shared between web providers, stable retry IDs, browser Standard Checkout, server receipt verification, raw-body HMAC webhook verification and the existing private entitlement source of truth.
- Eligible Plus-only seven-day trials remain trials; captured, verified recurring invoices produce paid access. Pro has no trial. Trial badges reflect server eligibility. Nominal mandate-verification payments and their refunds do not count as a purchased billing cycle.
- Explicitly confirmed renewal cancellation retains current paid/trial access until expiry. Full current-period refunds/lost disputes revoke that period, older refunds cannot revoke newer renewals, and late events cannot restore refunded access. Open Razorpay subscriptions remain manageable even after access lapses.

## Files created or changed

- `AGENT_RULES.md`
- `app/src/components/rooms/BillingCountrySelect.test.tsx`
- `app/src/components/rooms/BillingCountrySelect.tsx`
- `app/src/components/rooms/MeRoomPlanCard.tsx`
- `app/src/components/rooms/PaywallCheckout.test.tsx`
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/i18n/en.ts`
- `app/src/services/webBillingService.test.ts`
- `app/src/services/webBillingService.ts`
- `docs/BUILD_PLAN.md`
- `docs/DODO_SETUP.md`
- `docs/RAZORPAY_DELIVERY_2026-11-04.md`
- `docs/RAZORPAY_SETUP.md`
- `docs/prd.md`
- `package.json`
- `packages/core/src/index.ts`
- `packages/core/src/types.ts`
- `packages/core/src/webBilling.test.ts`
- `packages/core/src/webBilling.ts`
- `scripts/nov4_browser_audit.mjs`
- `scripts/razorpay_billing_cases.mjs`
- `scripts/test_rooms_v3.mjs`
- `scripts/verify_web_billing_hosted.ps1`
- `supabase/.env.example`
- `supabase/config.toml`
- `supabase/functions/_shared/dodoHandlers.test.ts`
- `supabase/functions/_shared/dodoHandlers.ts`
- `supabase/functions/_shared/razorpay.ts`
- `supabase/functions/_shared/razorpayHandlers.test.ts`
- `supabase/functions/_shared/razorpayHandlers.ts`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-checkout/deno.lock`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/razorpay-checkout/deno.json`
- `supabase/functions/razorpay-checkout/index.ts`
- `supabase/functions/razorpay-webhook/deno.json`
- `supabase/functions/razorpay-webhook/index.ts`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/functions/web-billing/deno.json`
- `supabase/functions/web-billing/index.test.ts`
- `supabase/functions/web-billing/index.ts`
- `supabase/functions/weekly-plan/deno.json`
- `supabase/migrations/20261104000500_india_web_razorpay.sql`

The existing owner edit in `app/.env.example` was preserved and excluded. Function-local import maps were extended because the shared core index exports the new billing module; these updates are required for existing Edge Functions to continue importing core. The Dodo test lockfile records the additional pinned Supabase dependency used by the new handlers.

## Tests and results

- Format: `All matched files use Prettier code style!`
- Lint: `0 errors, 72 warnings`; no new token violations, 254 grandfathered violations.
- Typecheck: app, core and UI passed.
- App: `Test Files 120 passed (120)` / `Tests 738 passed (738)`.
- Core: `Test Files 50 passed (50)` / `Tests 552 passed (552)`.
- UI: `Test Files 6 passed (6)` / `Tests 55 passed (55)`.
- Database: `Database migrations: 95 passed`; all SQL/RLS suites passed. New billing suite: `Razorpay billing database tests: 3 passed, 0 failed`.
- Billing Edge tests: `ok | 26 passed | 0 failed`; remaining Edge suites: food/photo 24, chat/push 17, Coach 14, weekly plans 11, challenges 7; all passed. Total: 1,345 app/core/UI tests and 99 Edge tests, plus SQL suites.
- Web, Android and iOS exports passed using `expo export --platform all`. This checks bundles, not physical-device store transactions.
- Chrome audit passed the existing food/navigation/Squad/weekly-plan coverage and new Indian Razorpay dismissal, pending state, server-confirmed access and confirmed cancellation, plus billing-country changes and international Dodo routing at mobile/desktop widths. Provider payment dialogs/responses were fixtures; no charge occurred.
- Hosted read-only billing smoke passed: India routes to Razorpay and cannot bypass into Dodo; international catalog verifies all four actual USD products. Missing Razorpay configuration returned HTTP 503. No checkout/subscription was created. Exact migration source was verified against the hosted ledger; zero temporary billing users remain.

## Deployment

Applied `20261104000500_india_web_razorpay.sql` and deployed `web-billing`, `razorpay-checkout`, `razorpay-webhook`, `dodo-checkout` and `dodo-webhook` to the linked Supabase project. The existing audited migration-file deployment script recorded the exact source atomically without replaying or falsely marking the older missing migration versions.

## Assumptions

- Indian means the account's explicitly selected billing country `IN`, not citizenship or device language. Country routing is checked server-side, including direct provider endpoints.
- Approved prices remain Plus INR 249/month or 1499/year and Pro INR 499/month or 2499/year. Existing Dodo USD prices and native store offerings are unchanged.
- A Razorpay trial's first-charge date is fixed when its checkout is reserved, seven days after reservation; retries never restart it. Mandate authentication is required before trial access. Provider authorization/first-charge terms remain visible in Checkout.
- An unknown provider creation outcome remains pending for investigation instead of risking a second subscription. Checkout callbacks are never proof of paid access.

## Manual steps and later work

- Add the real Razorpay credentials, four plan IDs, matching web origin and webhook configuration using [the setup guide](RAZORPAY_SETUP.md) and the server-only `supabase/.env.example` template. Until then, Indian web checkout deliberately stays unavailable; it does not fall back to Dodo. Keep existing Dodo and RevenueCat credentials.
- Use an isolated test backend for real test-mode mandate/payment verification before accepting live Razorpay payments. Real Razorpay account/mandate/charge tests were not possible without the owner's credentials and dashboard setup. No live charge or refund was performed by this delivery.
- Build/redeploy or reload the web frontend to receive the selector and Checkout UI. Native store settings/offerings need no changes. Installed-device purchase testing remains a device/account check.
- Later scope: scheduled Razorpay tier/period changes are not implemented; management currently stops renewal and a new plan can be purchased after existing access expires. Historical migration-ledger gaps still require a separate audit. No other future feature was built.
