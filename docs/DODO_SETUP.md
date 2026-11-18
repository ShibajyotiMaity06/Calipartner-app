# Connect Dodo Payments for Chrome

New international web subscriptions use Dodo in USD. New Indian web subscriptions use [Razorpay](RAZORPAY_SETUP.md). Preserve existing Dodo mapping keys for renewals, refunds and management. Android and iOS sell through RevenueCat and the native stores.

Chrome uses Dodo directly. Android and iOS retain RevenueCat store billing. The browser requires no RevenueCat web key or Stripe account.

1. Create or open your [Dodo account](https://app.dodopayments.com), finish the business/account verification and enable live payments. Test mode is for an isolated test backend.
2. Verify the six USD recurring products against [the pricing matrix](PLANS_AND_FEATURES.md). For each tier, use one year, six months and three months. Set zero provider trial days on every sale product. Three-month products are offered after dismissal of the standard paywall.
3. In Dodo Developer settings, create a live API key. In Supabase Project Settings, Edge Functions, Secrets, set these values. Do not paste secret values into chat, app config, git or any `EXPO_PUBLIC_*` variable.

```dotenv
DODO_PAYMENTS_API_KEY=<live API key>
DODO_ENVIRONMENT=live_mode
DODO_ALLOW_TEST_MODE=false
DODO_APP_URL=https://<your existing app domain>
# Existing India registry stays configured for historical events.
DODO_PRODUCTS_JSON=<existing INR JSON>
DODO_PRODUCTS_USD_JSON={"plus_annual":"pdt_...","plus_semiannual":"pdt_...","plus_quarterly":"pdt_...","pro_annual":"pdt_...","pro_semiannual":"pdt_...","pro_quarterly":"pdt_..."}
```

4. In Dodo, open **Developer > Webhooks > Add endpoint**. Use `https://ipxsziqwrowxblwalnqj.supabase.co/functions/v1/dodo-webhook`. Subscribe to subscription events, `refund.succeeded` and `dispute.lost`. Copy the endpoint signing secret to the Supabase secret `DODO_PAYMENTS_WEBHOOK_KEY`.

Keep the existing monthly keys in the registries when monthly subscribers are still active. The server fetches each configured product and verifies currency, price, cadence and zero trial days before quoting or opening checkout.

5. Apply the subscription-term migration and deploy the checkout and webhook functions. Checkout validates the signed-in bearer token. The webhook validates Dodo's signature.
6. Confirm both main options and the three-month offer open the matching checkout. Cancelling keeps existing access. Only a signed, verified payment event activates the corresponding entitlement. Check the Dodo webhook delivery log and the customer portal for a subscribed account.

For local testing, use a separate Supabase project, Dodo test products/keys, `DODO_ENVIRONMENT=test_mode`, `DODO_ALLOW_TEST_MODE=true`, and an appropriate localhost return URL. Never point test-mode billing at the production entitlement database. Do not claim that a real charge occurred in test mode.

Checkout request UUIDs and server records make retries reuse an existing checkout. A browser redirect, query parameter, client-supplied price or email never grants access. Existing paid accounts manage their subscription instead of starting a second one. If a provider request has an unknown network outcome, its reserved request stays pending for investigation rather than automatically creating another checkout.

References: [Checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [subscription integration](https://docs.dodopayments.com/developer-resources/subscription-integration-guide), [webhook setup and signature verification](https://docs.dodopayments.com/developer-resources/webhooks).
