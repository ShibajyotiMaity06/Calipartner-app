# Connect Dodo Payments for Chrome

Chrome uses Dodo directly. Android and iOS retain RevenueCat store billing. The browser requires no RevenueCat web key or Stripe account.

1. Create or open your [Dodo account](https://app.dodopayments.com), finish the business/account verification and enable live payments. Test mode is for an isolated test backend.
2. Create four recurring subscription products: Plus monthly (₹249 / $4.99), Plus yearly (₹1,499 / $29.99), Pro monthly (₹499 / $9.99) and Pro yearly (₹2,499 / $49.99). Configure the 7-day trial on Plus only; Pro has no trial. Copy each product ID (`pdt_...`). The live checkout displays the final local price, taxes and renewal/trial terms.
3. In Dodo Developer settings, create a live API key. In Supabase Project Settings, Edge Functions, Secrets, set these values. Do not paste secret values into chat, app config, git or any `EXPO_PUBLIC_*` variable.

```dotenv
DODO_PAYMENTS_API_KEY=<live API key>
DODO_ENVIRONMENT=live_mode
DODO_ALLOW_TEST_MODE=false
DODO_APP_URL=https://<your existing app domain>
# Production India INR products:
DODO_PRODUCTS_JSON={"plus_monthly":"pdt_0NqYkFnrBtumqnnW6amME","plus_annual":"pdt_0NqYjxau37A8F15U4ovnt","pro_monthly":"pdt_0NqYkgvwBKDtjSQRQxwbm","pro_annual":"pdt_0NqYkSYMM9n1wJoZLJp9Y"}
# (Or Global USD products: {"plus_monthly":"pdt_0Np8JSfvie3Eqg47kDEzZ","plus_annual":"pdt_0Np8JdWRcfrMJqyruTzkE","pro_monthly":"pdt_0Np8JFZXhiKHXsUJH9GD8","pro_annual":"pdt_0Np8IxfM0q2BFdPQHPMDC"})
DODO_PRODUCTS_USD_JSON={"plus_monthly":"pdt_0Np8JSfvie3Eqg47kDEzZ","plus_annual":"pdt_0Np8JdWRcfrMJqyruTzkE","pro_monthly":"pdt_0Np8JFZXhiKHXsUJH9GD8","pro_annual":"pdt_0Np8IxfM0q2BFdPQHPMDC"}
```

4. In Dodo, open **Developer > Webhooks > Add endpoint**. Use `https://ipxsziqwrowxblwalnqj.supabase.co/functions/v1/dodo-webhook`. Subscribe to subscription events, `refund.succeeded` and `dispute.lost`. Copy the endpoint signing secret to the Supabase secret `DODO_PAYMENTS_WEBHOOK_KEY`.

The optional USD registry selects the fixed international prices for accounts whose stored profile country is not `IN`. India and missing-country profiles use the default registry. Catalog and checkout use the same server selection; the browser never supplies prices or product IDs. Checkout validates the recurring amount, currency, billing interval and trial against `PLANS_AND_FEATURES.md`, and fixes the checkout currency to the quoted currency. Both registries are recognized by the verified webhook. Keep JSON values valid JSON without surrounding shell quotes in the dashboard.
5. The functions and migrations were deployed in this session. For another environment, deploy `dodo-checkout` and `dodo-webhook` with their function-local import maps and JWT verification disabled at the gateway. Checkout verifies the signed-in bearer token itself. The webhook verifies Dodo's signature on the raw body. Apply the committed Dodo migration first. Native RevenueCat webhook deployment remains separate.
6. Redeploy/rebuild the app, sign in with a free account, select a plan and press Buy. You should leave the app for Dodo checkout. Cancel once: no access should be granted. Complete a purchase (or an eligible Plus trial): only a verified webhook should activate the matching Supabase entitlement with `source=dodo`. On return to the app, press **Check plan status** if confirmation is still pending. Check Dodo's webhook delivery log for a 200 response. Me opens Dodo's customer portal for cancellation and plan management.

For local testing, use a separate Supabase project, Dodo test products/keys, `DODO_ENVIRONMENT=test_mode`, `DODO_ALLOW_TEST_MODE=true`, and an appropriate localhost return URL. Never point test-mode billing at the production entitlement database. Do not claim that a real charge occurred in test mode.

Checkout request UUIDs and server records make retries reuse an existing checkout. A browser redirect, query parameter, client-supplied price or email never grants access. Existing paid accounts manage their subscription instead of starting a second one. If a provider request has an unknown network outcome, its reserved request stays pending for investigation rather than automatically creating another checkout.

References: [Checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [subscription integration](https://docs.dodopayments.com/developer-resources/subscription-integration-guide), [webhook setup and signature verification](https://docs.dodopayments.com/developer-resources/webhooks).
