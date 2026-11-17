# CaliPartner ? launch plans and availability

Updated 16 November 2026. This replaces the stale feature matrix. The purchase sheet displays acknowledged store/web prices; the server entitlement remains the only authority for access.

## Prices and trial

| Plan | India monthly / annual | International monthly / annual |
| --- | --- | --- |
| Free | Free | Free |
| Plus | ?249 / ?1,499 | $4.99 / $29.99 |
| Pro | ?499 / ?2,499 | $9.99 / $49.99 |

The eligible Plus trial lasts seven days, needs no card and never starts an automatic charge. Pro has no trial. Native billing uses the stores through RevenueCat; new Indian web subscriptions use Razorpay and other supported web regions use Dodo. Checkout prices must be loaded before purchase.

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
| Meal plans and grocery lists | Purchased Plus and Pro | Existing consent, plan readiness and access checks apply. Trial access does not include full AI plans. |
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


Pair challenges remain in the Plus/Pro benefits. Existing historical records and backend export capabilities are preserved while deferred entry points are removed. Labelled onboarding demonstrations remain illustrative and never write sample diary data.

## Release verification still requiring owner/device access

- Configure the Android Maps SDK public key restricted to the actual package `app.calipartner.mobile` and release signing certificate.
- Configure `EXPO_PUBLIC_APPLE_APP_ID` when the App Store listing exists; never ship the attachment's placeholder ID.
- Send a test email to the owner-confirmed support address and verify the Pro tag and metadata arrive correctly.
- Rebuild EAS development/production clients for the added native modules; test permissions, camera, photo persistence, maps and store review on Android and iOS.
- Migration `20261116000001_launch_hardening.sql` is applied and recorded in the linked Supabase project. Hosted checks confirm idle guarding, signed push transport and anonymous denial for compact avatar rewards. Compare daily egress after the updated app ships; this is not yet a measured live bandwidth reduction.
