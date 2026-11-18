# CaliPartner launch plans and availability

Updated 18 November 2026. The purchase sheet displays verified provider prices. The entitlement service controls access.

## Pricing

Personal tracking is free forever. Plus and Pro charge the full amount at checkout and renew at the selected interval. There are no new free trials.

| Plan | Duration | India upfront | International upfront | Monthly equivalent |
| --- | --- | ---: | ---: | --- |
| Plus | 1 year | ₹1,499 | $29.99 | ₹125 / $2.50 |
| Plus | 6 months | ₹999 | $19.99 | ₹166 / $3.33 |
| Plus | 3-month exit offer | ₹599 | $11.99 | ₹199 / $4.00 |
| Pro | 1 year | ₹2,499 | $49.99 | ₹208 / $4.17 |
| Pro | 6 months | ₹1,599 | $32.99 | ₹266 / $5.50 |
| Pro | 3-month exit offer | ₹899 | $18.99 | ₹299 / $6.33 |

The main paywall defaults to **1 Year** and also offers **6 Months**. The three-month offer appears when an eligible customer exits before completing a purchase. Monthly equivalents are informational. Existing subscriptions retain their provider and agreed terms.

Indian web checkout uses Razorpay in INR. International web checkout uses Dodo in USD. Android and iOS use their store prices through RevenueCat. Verify all three intervals in the provider catalog before enabling checkout. Keep historical product mappings for existing subscribers.

## Available features

| Feature | Availability | Evidence / limits of the promise |
| --- | --- | --- |
| Food search, custom foods, barcode and diary | All plans | Signed-in saves require acknowledged online delivery. Four current meal sections; older Extra entries remain. |
| My meals | All plans | Save selected combinations, load private saved meals, select a meal slot and log the combination atomically. Existing `saved_meals` RLS and online-save transaction are reused. |
| Steps, water, weight, custom exercise/set logging | All plans | Real measurements and acknowledged saves; native steps come from device integrations. |
| Outdoor running route | All plans | Foreground location, native map and web route preview. Native builds and Android Maps configuration are required; without the Android key, the route preview remains available. No background tracking promise. |
| Human squad text chat | All plans | Joined usable squads, consent, moderation and block checks apply. |
| Friend discovery and username requests | All plans | Free request limits remain server enforced. This is not matchmaking or stranger direct messaging. |
| Hosted squads | Free / Plus / Pro | Existing server limits: capacities of 2 / 5 / 20 people respectively. |
| Fasting and eating windows | Plus and Pro | Existing screening and duration safeguards; no health claims. |
| Recipe library | Plus and Pro | 90+ recipes (93 in bundled_recipes.json); starter content remains available to Free. |
| Meal plans and grocery lists | Purchased Plus and Pro | Consent and purchased access are required. Setup previews existing recipes without requesting AI generation. |
| Workout routines and shared workout detail | Plus and Pro | Routine generation/rebuild has its existing purchased-access rules. No rest-timer or personal-record promise. |
| Private progress photo vault | Plus and Pro | Camera/gallery, stored date, optional weight/notes/pose, delete and two-photo comparison. Account-scoped device storage only; no cloud backup or application-level encryption claim. |
| Personal AI Coach | Purchased Pro | Consent, safety, responsible-use and server cost controls remain. No numerical allowance is advertised. |
| AI photo food logging | Purchased Pro | Review estimates and explicitly save. No numerical allowance is advertised. |
| Chat-to-log / Describe meal | Purchased Pro | Food logging and coach entry points; review portions and macros before acknowledged saves. |
| Monthly progress review | Purchased Pro | Existing fourteen-day evidence window and safety limits; changes require explicit acceptance. This is not a weekly automatic adjustment. |
| Room media sharing | Pro uploads | Existing R2, membership, moderation and read permissions remain. |
| Priority support | Pro | Owner-confirmed email channel: shibajyoti.maity06@gmail.com; Pro-tagged subject and account/app metadata. No response-time guarantee. |
| Help and store review | All plans | Real support email draft and native review request; OS may suppress the dialog. Without a configured store listing, feedback is available. |

## Coming soon ? not included with a purchase today

These remain visible on the paywall as future plans, without release dates:

| Planned feature | Intended plan |
| --- | --- |
| Body circumferences | Plus / Pro |
| Full data export (JSON/CSV) | Plus / Pro |
| Partner Finder matching and messaging | Plus / Pro |
| Seasonal challenges | Plus / Pro |
| Workout rest timer and personal records | Plus / Pro |
| Fits my day recipe collections | Pro |
| Weekly AI progress insights and macro adjustments | Pro |


Pair challenges remain in the Plus/Pro benefits. Existing historical records and backend export capabilities are preserved while deferred entry points are removed. Onboarding previews four published recipes from the library.

## Release verification still requiring owner/device access

- Configure the Android Maps SDK public key restricted to the actual package `app.calipartner.mobile` and release signing certificate.
- Configure `EXPO_PUBLIC_APPLE_APP_ID` when the App Store listing exists; never ship the attachment's placeholder ID.
- Send a test email to the owner-confirmed support address and verify the Pro tag and metadata arrive correctly.
- Rebuild EAS development/production clients for the added native modules; test permissions, camera, photo persistence, maps and store review on Android and iOS.
- Migration `20261116000001_launch_hardening.sql` is applied and recorded in the linked Supabase project. Hosted checks confirm idle guarding, signed push transport and anonymous denial for compact avatar rewards. Compare daily egress after the updated app ships; this is not yet a measured live bandwidth reduction.
