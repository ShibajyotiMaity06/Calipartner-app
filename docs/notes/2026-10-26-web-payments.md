# Chrome payment verification — 26 October 2026

## Built and repaired

- Repaired invalid live `DODO_PRODUCTS_JSON` using the approved INR registry. Verified the live Dodo key, all eight recurring products, the enabled CaliPartner webhook, and equality of its signing secret with the Supabase secret. Temporary audit functions required a random credential and were deleted after each audit; secret values were never printed or committed.
- Added the separate live `DODO_PRODUCTS_USD_JSON` registry. Corrected the case-sensitive USD Plus annual ID in the pricing document and setup guide to `pdt_0Np8JdWRcfrMJqyruTzkE`, as returned by Dodo's product catalog. The previously documented ID returned 404.
- Updated shared INR/USD prices and obsolete paywall translations. The browser now displays a server-verified catalog. A product with an incorrect price, currency, billing cadence or trial fails closed before checkout reservation. Both regional product registries resolve through the authenticated webhook into the existing entitlement system.
- Fixed static Expo web exports to use inlined public environment variables when the Expo manifest is absent. The old export crashed with `supabaseUrl is required`.
- Delayed initial navigation mounting until session restoration completes. Previously, startup reset checks remounted navigation and replaced `/paywall` with `/`, losing checkout returns.
- Fixed checkout currency to the quoted currency, added provider cancellation returns, and enabled immediate provider redirects after completion. Chrome initially converted the INR product into an exchange-rate USD amount instead of using the specified international product.
- Added automatic server-entitlement polling on checkout return, retained manual status checks, and returned cancellations to plan selection. Account management uses the same browser tab so an asynchronous portal request does not depend on popup permissions.

## Verification

The production Expo export was served locally and opened in installed Google Chrome, with a disposable account authenticated against the live Supabase backend and live Dodo checkout. Each of the following reached Dodo's real hosted checkout, displaying the expected amount and terms:

| Region | Plan | Monthly | Annual | Trial |
| --- | --- | --- | --- | --- |
| India | Plus | ₹249 | ₹1,499 | 7 days, ₹0 due today |
| India | Pro | ₹499 | ₹2,499 | None |
| International | Plus | $4.99 | $29.99 | 7 days, $0 due today |
| International | Pro | $9.99 | $49.99 | None |

No payment details were submitted, no charge or trial subscription was activated, and no entitlement was granted. The disposable Supabase account and its dependent test rows were deleted afterward. Browser screenshots and sanitized checkout summaries remain in the ignored local `.cache` directory. No existing customer's subscription or entitlement was altered.

A second Chrome run verified a retry against the live function returned the same checkout URL. Dodo's actual back arrow and cancellation confirmation returned to the configured cancellation URL, showing the cancellation message without activation. An unpaid return preserved `/paywall` and remained pending. For that return check, browser requests to the configured app origin served the new local export; this verifies the return flow, not publication of the frontend to Vercel. Its separate disposable account was also removed.

Automated coverage includes incorrect currency/price/cadence/trial rejection, international product and webhook mapping, exact checkout selection and retry reuse, signature rejection, account-bound webhook application/replay, unavailable catalog retry, cancellation, unverified return URLs, automatic confirmation from a matching server entitlement, startup navigation preservation, public build configuration, and same-tab portal navigation.

```text
Formatting: All matched files use Prettier code style!
Lint: 0 errors, 104 existing warnings; no new token violations.
Typecheck: app, core and UI passed.
App: Test Files 67 passed (67); Tests 589 passed (589).
Core: Test Files 38 passed (38); Tests 473 passed (473).
UI: Test Files 5 passed (5); Tests 52 passed (52).
Database migrations: 37 passed.
Database tests: 17 passed, 0 failed.
Friends database tests: 13 passed, 0 failed.
Billing and goal database tests: 5 passed, 0 failed.
Dodo Edge tests: ok | 9 passed | 0 failed.
Web build: Exported: dist.
Chrome: 8 live hosted checkout variants passed; no unpaid entitlement.
Chrome: provider checkout cancellation, unpaid return and live retry reuse passed.
```

## Assumptions

This task covers the existing payment flow and approved pricing, rather than implementing every feature listed in the comparison matrix. Accounts with a stored non-`IN` country use the USD registry; India and missing-country profiles use the INR registry. Taxes, discounts and payment-method availability remain controlled by Dodo's final checkout. The browser cannot choose a product ID, amount, user ID or entitlement.

## Deployment and manual validation

The checkout and webhook functions are deployed to `ipxsziqwrowxblwalnqj`. The repaired product secrets are live. The updated frontend must be published by the existing hosting deployment; a Git push alone is not evidence that Vercel has finished publishing it.

Implementation commit `38a6a6b` was pushed to `main` with the repository's configured CaliPartner deploy SSH identity after all checks passed. A subsequent public-host check still returned the previous bundle. Vercel is not connected in this session; publishing from here requires installing and connecting that integration, or deploying the pushed source through the existing Vercel account.

A real customer must complete a purchase or eligible Plus trial, then confirm Dodo webhook delivery HTTP 200 and the matching Supabase entitlement. A real renewal, refund, subscription cancellation and customer-portal session have not been exercised. Native store purchases remain outside this Chrome verification. The app never activates access merely because a browser returns from checkout.

## Later work observed

Growth review still differs from the updated feature matrix: the existing `monthly_plan_review` gate and review implementation target Pro monthly, whereas the new specification describes Plus monthly and Pro weekly. That feature was not implemented or relabeled as part of this payment repair. No unrelated future-phase features were built.

## Files created or changed

- `app/src/app/paywall.tsx`
- `app/src/components/AccountDataResetGate.tsx` and its test
- `app/src/components/rooms/PaywallModal.tsx`
- `app/src/components/rooms/PaywallCheckout.test.tsx`
- `app/src/components/rooms/paywallUI.test.ts`
- `app/src/components/rooms/roomsUI.test.ts`
- `app/src/i18n/en.ts`
- `app/src/lib/env.ts` and its test
- `app/src/services/dodoService.ts` and its test
- `packages/core/src/dodoBilling.ts` and its test
- `packages/core/src/subscriptions.ts` and its tests
- `supabase/functions/_shared/dodo.ts`
- `supabase/functions/_shared/dodoHandlers.ts` and its test
- `supabase/.env.example`
- `docs/DODO_SETUP.md`
- `docs/PLANS_AND_FEATURES.md`
- This report

Provider references: [Dodo checkout request and flags](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/checkout-sessions.ts), [Dodo webhook signature verification and secret retrieval](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/webhooks/webhooks.ts), [Supabase function secrets](https://supabase.com/docs/guides/functions/secrets).
