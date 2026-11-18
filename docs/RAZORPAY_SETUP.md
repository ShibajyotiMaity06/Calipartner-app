# Razorpay for Indian web subscriptions

New web checkouts use the signed-in account's saved billing country: `IN` selects Razorpay in INR; other supported countries select the existing Dodo USD catalog. The web paywall includes an acknowledged billing-country selector. Missing country never defaults to India. Android and iOS continue to use Google Play Billing / Apple IAP through RevenueCat, with no Razorpay SDK or web checkout flow on native.

Existing subscriptions stay with their original provider. An Indian Dodo subscriber still opens the Dodo customer portal. Active Apple/Google subscribers manage their store subscription. Razorpay subscribers manage renewal from the web paywall, including when their subscription has a billing problem or their access has lapsed. New web subscriptions are blocked while an existing web checkout/subscription is unresolved, and while another provider's entitlement is active.

## Configure secrets

Use the linked project's [Supabase Edge Function secrets](https://supabase.com/dashboard/project/ipxsziqwrowxblwalnqj/functions/secrets). Never put these values in `app/.env.example`, any `EXPO_PUBLIC_*` variable, source control, screenshots or chat.

```dotenv
RAZORPAY_KEY_ID=<live Key ID>
RAZORPAY_KEY_SECRET=<matching API secret>
RAZORPAY_WEBHOOK_SECRET=<separate random webhook signing secret>
RAZORPAY_ENVIRONMENT=live
RAZORPAY_ALLOW_TEST_MODE=false
RAZORPAY_APP_URL=https://<your production web-app domain>
RAZORPAY_PLANS_JSON={"plus_annual":"plan_...","plus_semiannual":"plan_...","plus_quarterly":"plan_...","pro_annual":"plan_...","pro_semiannual":"plan_...","pro_quarterly":"plan_..."}
```

`RAZORPAY_APP_URL` must match the browser origin where checkout runs. It may be omitted if the existing `DODO_APP_URL` already names that same origin. The public Key ID is returned only when opening browser Checkout; API and webhook secrets remain server-side.

Generate the API keys in the Razorpay dashboard after account/website activation. Enable Razorpay Subscriptions for the account. Configure these six plans with one subscription item and currency INR:

| Registry key | Razorpay period | Interval | INR | Paise |
| --- | --- | ---: | ---: | ---: |
| `plus_annual` | `yearly` | 1 | 1,499 | 149900 |
| `plus_semiannual` | `monthly` | 6 | 999 | 99900 |
| `plus_quarterly` | `monthly` | 3 | 599 | 59900 |
| `pro_annual` | `yearly` | 1 | 2,499 | 249900 |
| `pro_semiannual` | `monthly` | 6 | 1,599 | 159900 |
| `pro_quarterly` | `monthly` | 3 | 899 | 89900 |

The server verifies each configured plan before displaying it or starting checkout. New subscriptions charge immediately and have no trial. Keep existing monthly mapping keys and historical trial mandates for webhooks. Annual, six-month and three-month subscriptions use 9, 18 and 36 billing cycles, respectively.

## Register the webhook

In the Razorpay dashboard, register:

```text
https://ipxsziqwrowxblwalnqj.supabase.co/functions/v1/razorpay-webhook
```

Use exactly the same signing secret as `RAZORPAY_WEBHOOK_SECRET`. Subscribe to:

- `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.updated`
- `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`
- `subscription.paused`, `subscription.resumed`
- `refund.processed`, `payment.dispute.lost`

Signature verification uses HMAC SHA-256 over the original request body, before parsing or provider reads. Recurring paid access requires a captured INR payment and a paid recurring invoice whose payment, subscription, approved price and billing end can be verified through Razorpay's API. Unsupported/missing invoice periods fail closed. A Checkout callback only triggers receipt verification and waiting; it never grants access. Verified events update the existing `entitlements` source of truth with `source=razorpay`.

Stopping renewal requires a separate confirmation and an acknowledged provider cancellation. Razorpay renewal is stopped immediately, while CaliPartner retains the existing paid/trial access through its recorded expiry. Full current-period refunds and lost disputes revoke that period. Partial refunds preserve access. Refunds of older periods cannot revoke a later renewal; a late capture cannot restore a refunded period. A lapsed/refunded subscription that remains open at the provider can still be managed and cancelled before starting another subscription.

Keep the existing Dodo keys, both product registries and Dodo webhook. The INR registry remains necessary for historical Dodo events; new international checkouts require the USD registry. Configure annual, six-month and three-month RevenueCat packages with immediate store pricing.

## Deployment and testing

Apply the subscription-term migration before deploying `web-billing`, `razorpay-checkout`, `razorpay-webhook`, and the updated `dodo-checkout`/`dodo-webhook`. The JWT gateway is disabled for these handlers; they perform their own bearer-token or webhook-signature verification. Function import maps include the shared pure TypeScript billing module.

For an isolated test Supabase project, use matching Razorpay test keys, test plans, a separate webhook secret, `RAZORPAY_ENVIRONMENT=test` and `RAZORPAY_ALLOW_TEST_MODE=true`. Configure that project's own webhook URL and test web origin. Default live configuration rejects test keys. Never enable test billing against the production entitlement database.

After configuration, check the annual and six-month quotes and the three-month exit offer. Verify immediate checkout, cancellation, failed payment, repeated callbacks and webhooks, renewal cancellation, refunds and account ownership. Only verified captured payments yield paid access. Check Android and iOS through RevenueCat and international web through Dodo.

Razorpay subscription creation has no documented idempotency header. The server reserves the client UUID before creating anything and never repeats a creation with an unknown outcome. If a provider response is lost before its subscription ID is recorded, the checkout remains pending for investigation. Reconcile the provider dashboard/API using `notes.checkout_id`; do not delete the reservation or create a second subscription blindly.

Implementation tests use provider fixtures and do not prove a real charge or mandate. Real Razorpay end-to-end testing requires the account credentials and dashboard setup above. A rebuilt/redeployed web app is needed for the new selector and checkout UI.

References: [API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/), [subscription integration and receipt verification](https://razorpay.com/docs/payments/subscriptions/integration-guide/), [subscription API](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/), [webhook events](https://razorpay.com/docs/webhooks/subscriptions/), [cancellation](https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription/), [subscription invoice contract](https://razorpay.com/docs/api/payments/subscriptions/fetch-invoices/), [official invoice types](https://github.com/razorpay/razorpay-node/blob/master/lib/types/invoices.d.ts).
