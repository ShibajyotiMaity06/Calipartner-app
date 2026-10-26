# Connect Dodo Payments for Chrome

Chrome uses Dodo directly. Android and iOS retain RevenueCat store billing. The browser requires no RevenueCat web key or Stripe account.

1. Create or open your [Dodo account](https://app.dodopayments.com), finish the business/account verification and enable live payments. Test mode is for an isolated test backend.
2. Create four recurring subscription products: Plus monthly, Plus yearly, Pro monthly and Pro yearly. Retain the approved amounts/currencies. Configure the 7-day trial on Plus only; Pro has no trial. Copy each product ID (`pdt_...`). The live checkout displays the final local price, taxes and renewal/trial terms.
3. In Dodo Developer settings, create a live API key. In Supabase Project Settings, Edge Functions, Secrets, set these values. Do not paste secret values into chat, app config, git or any `EXPO_PUBLIC_*` variable.

```dotenv
DODO_PAYMENTS_API_KEY=<live API key>
DODO_ENVIRONMENT=live_mode
DODO_ALLOW_TEST_MODE=false
DODO_APP_URL=https://<your existing app domain>
DODO_PRODUCTS_JSON={"plus_monthly":"pdt_...","plus_annual":"pdt_...","pro_monthly":"pdt_...","pro_annual":"pdt_..."}
```

4. In Dodo, open **Developer > Webhooks > Add endpoint**. Use `https://ipxsziqwrowxblwalnqj.supabase.co/functions/v1/dodo-webhook`. Subscribe to subscription events, `refund.succeeded` and `dispute.lost`. Copy the endpoint signing secret to the Supabase secret `DODO_PAYMENTS_WEBHOOK_KEY`.
5. The functions and migrations were deployed in this session. For another environment, deploy `dodo-checkout` and `dodo-webhook` with their function-local import maps and JWT verification disabled at the gateway. Checkout verifies the signed-in bearer token itself. The webhook verifies Dodo's signature on the raw body. Apply the committed Dodo migration first. Native RevenueCat webhook deployment remains separate.
6. Redeploy/rebuild the app, sign in with a free account, select a plan and press Buy. You should leave the app for Dodo checkout. Cancel once: no access should be granted. Complete a purchase (or an eligible Plus trial): only a verified webhook should activate the matching Supabase entitlement with `source=dodo`. On return to the app, press **Check plan status** if confirmation is still pending. Check Dodo's webhook delivery log for a 200 response. Me opens Dodo's customer portal for cancellation and plan management.

For local testing, use a separate Supabase project, Dodo test products/keys, `DODO_ENVIRONMENT=test_mode`, `DODO_ALLOW_TEST_MODE=true`, and an appropriate localhost return URL. Never point test-mode billing at the production entitlement database. Do not claim that a real charge occurred in test mode.

Checkout request UUIDs and server records make retries reuse an existing checkout. A browser redirect, query parameter, client-supplied price or email never grants access. Existing paid accounts manage their subscription instead of starting a second one. If a provider request has an unknown network outcome, its reserved request stays pending for investigation rather than automatically creating another checkout.

References: [Checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [subscription integration](https://docs.dodopayments.com/developer-resources/subscription-integration-guide), [webhook setup and signature verification](https://docs.dodopayments.com/developer-resources/webhooks).
