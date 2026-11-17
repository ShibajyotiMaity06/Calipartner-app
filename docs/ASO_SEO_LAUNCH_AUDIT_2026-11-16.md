# ASO, SEO and launch audit — 16 November 2026

The second supplied attachment replaces `docs/aso_seo.md`. That playbook is the strategy reference; its sample store copy is a draft. Publishable English metadata is in `scripts/site/store-listing.json`, checked against current delivered features. No store listing has been submitted. The owner confirmed that neither developer account has been purchased yet.

## Implemented in this change

- Eight crawlable static pages: `/`, `/features`, `/pricing`, `/download`, `/privacy`, `/terms`, `/support` and `/delete-account`. They do not need JavaScript, account initialization or the Expo bundle to show their content.
- Unique titles/descriptions, canonical URLs on `https://app.calipartner.site`, Open Graph/Twitter share tags and a generated 1200×630 share image, organization/breadcrumb schema, app schema on home/download without fabricated ratings, sitemap and robots files.
- Public deletion email action with the real support mailbox and instructions for ownership verification, linked data, retained records and separate subscription cancellation. Opening a draft is not reported as a submitted deletion request.
- Static 404 with navigation; legacy `.html` URLs redirect to canonical URLs. Authenticated app screens remain outside the sitemap and have `noindex` metadata and headers.
- Web-app entry and generated QR. Mobile store availability says Coming soon; no placeholder store IDs, fake download badges or broken store links. A numeric Apple ID enables the Safari banner and Apple link; the explicit Google Play availability flag enables the actual package URL.
- Welcome audience and truthful cardless trial copy; persistent embedded-browser guidance at sign-in, a bounded Google waiting state and an email flow that remains usable. Late OAuth failures cannot overwrite a subsequent email attempt.
- Terms and privacy share the same English catalogue between web and app. Opening Privacy selects the correct tab. Removed obsolete export, ephemeral-AI and immediate-all-backup-purge promises. Paywall/About legal links now use the production origin.
- English store metadata, description, release notes and keyword research seed sheet. The second attachment’s Google short description uses “leaderboards”; compare consistency against individual goals, never lowest calories or greatest weight loss.
- Two residual onboarding “200+ recipes” claims corrected to 90+. The paywall’s existing Coming soon separation is retained. Native store review remains implemented, with feedback fallback before the Android store listing is published.

## Architecture and deliberate scope decisions

The existing Expo/React Native app and Vercel hosting remain. A small TypeScript build step renders public HTML after Expo export. Vercel build commands explicitly run that step. `app-shell.html` preserves the Expo SPA and existing app routes; `/launch` is its stable entry. The public root forwards existing OAuth code/token/error returns to `/launch`, retaining parameters without sending them to third parties. The PWA starts at `/launch`. The versioned service worker caches the app shell separately so visiting a public policy page cannot replace offline app navigation.

No Next.js migration, server, payment backend, analytics tracker or new entitlement model was added. `tsx` executes the build step; `qrcode` creates a local SVG instead of sending links to a third-party QR service. Existing `sharp` renders the share card. CSS uses the shared token layer and existing local fonts. The current app identity is preserved rather than introducing the playbook’s older Steel/Silver palette into this scoped change.

Public prices reproduce the existing plan catalogue; the signed-in purchase sheet confirms actual provider currency, amount and terms. The marketing CTA opens the app rather than creating an anonymous or duplicate checkout. Existing Razorpay/Dodo callbacks under `/paywall` and portal returns under `/me` still resolve to the app shell.

## Copy corrections to the supplied draft

| Draft | Publishable statement |
| --- | --- |
| Weekly growth reviews | Purchased-Pro monthly reviews with sufficient evidence and explicit target acceptance |
| Plus trial alongside weekly AI planner | Cardless seven-day trial; full AI plans require purchased Plus/Pro and consent |
| Trial followed by implied automatic billing | No card and no automatic charge; paid purchases are separate and bill immediately |
| Pair challenges in the free feature block | Pair challenges in Plus/Pro |
| Partner matching | Friend discovery and rooms; matching/messaging remain Coming soon |
| Private photos without storage qualification | Account-scoped device-local photos, no CaliPartner cloud backup |
| Hardcoded placeholder store ID / `com.calipartner.app` | No placeholder links; actual native identifier is `app.calipartner.mobile` |
| Sample character counts | Automated limits check against the actual strings; Apple keyword bytes checked |

## Web billing verification

The existing hosted smoke test passed against the production origin using a temporary isolated test account, which was removed afterward. India received four INR Razorpay products; the US received four USD Dodo products. India’s direct Dodo request was denied. New paid products had zero provider trial days. IP-based routing persisted the detected country and the subsequent catalogue request succeeded. Catalogue reads created no checkout or subscription.

Automated billing coverage includes checkout idempotency, signature verification, webhook ordering, pending/failed/cancelled outcomes, renewal cancellation and entitlement updates. This is not a real-money end-to-end transaction or proof of provider settlement. Before accepting live payments, complete controlled dashboard/test-mode checks of successful payment → signed webhook → entitlement, failed payment, cancellation, renewal and refund. No live charge, subscription, cancellation or refund was performed here.

## Store handoff

Use `scripts/site/store-listing.json` for English India metadata and the shared description. Category: Health & Fitness. Contact: `shibajyoti.maity06@gmail.com`. Copy the public privacy, support and deletion URLs from that file. Existing `app/assets/ios-icon.png` is 1024×1024 with no alpha; `app/public/icon.png` is 512×512. Verify each store’s current asset constraints before upload.

Capture the actual release build, with permitted test accounts and real supported flows. Do not upload the local browser audit images as native product screenshots. Prepare captions of six words or fewer in this order:

1. Log Indian food in seconds — food search and the diary.
2. Train with a partner — own-goal comparison with permitted sharing.
3. Streaks and accountability — real streak and Plus pair challenge.
4. Scan, search, re-log — barcode and My meals.
5. Workouts and GPS runs — a real device-recorded route.
6. 90+ Indian recipes — the paid recipe library.
7. Rooms for friends and squad — room chat and progress.
8. Photo food logging and coach — consented purchased-Pro flows.

Record the preview on a device with captions. No generated feature screenshots, synthetic ratings or unverified screenshots are published. Hindi localization remains a later native-speaker-reviewed release.

## Owner actions and external dependencies

- Purchase/configure Apple and Google developer accounts, complete tax/bank details, app privacy/Data safety/health declarations and age rating. Supply a private review account and review notes through the consoles, never in git.
- Set the real `EXPO_PUBLIC_APPLE_APP_ID` and `EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE=true` only after listings are available. Current defaults deliberately show the web app and pending store releases.
- When signing identities exist, configure and verify Apple associated domains/AASA and Android intent filters/assetlinks with real Team ID and Play App Signing SHA-256. No invented association files are deployed. Existing `/invite/[token]` web flows remain; cross-install deferred deep linking is not claimed.
- Verify the public deletion request is received in the owner-confirmed mailbox. Establish and document exact backup/security/billing retention schedules with the actual providers before store submission; current copy does not invent a deletion SLA.
- Configure Search Console domain verification and Bing Webmaster Tools, then submit `/sitemap.xml`. DNS verification and console access are external tasks. Check actual field Core Web Vitals after traffic exists; browser tests are not a field CWV measurement.
- Preserve the production host at `app.calipartner.site`; configure any alternate-domain redirects in the existing host/DNS account. No second domain is assumed to be owned.
- Conduct name/trademark and handle availability checks, keyword-volume research and store screenshot tests in the appropriate tools. The seed sheet deliberately leaves unknown volume/difficulty blank. No outreach, review replies, account purchase or submission was performed.

## Later work from the playbook — not presented as delivered

Food nutrition pages need verified serving data, lawful source reuse, original food-specific notes and a real qualified reviewer. Start with about ten reviewed pages, then expand to 30–50 based on quality and indexing. Do not fabricate IFCT/USDA provenance or dietitian credentials, or publish hundreds of unchecked pages. No thin placeholder food routes are added to the sitemap. Articles, calculators, Hindi pages, analytics/consent configuration, press assets, creator outreach and recurring ASO experiments remain the playbook’s later content work.

No real ratings are available. App structured data therefore omits `aggregateRating`; it does not promise eligibility for a Google rich result. Validate deployed pages in Rich Results Test after publishing.

## Primary sources checked

- [Apple product-page fields, screenshots and previews](https://developer.apple.com/app-store/product-page/)
- [Google Play listing setup and field limits](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)
- [Google Play account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Expo web export modes](https://docs.expo.dev/versions/latest/config/app/)

These replace unverified algorithm/ranking assertions in practitioner blogs. Store consoles remain authoritative for submission-specific requirements.

## Verification results

- Full `npm test`: app `Test Files 171 passed (171)` / `Tests 945 passed (945)`; core `Test Files 67 passed (67)` / `Tests 649 passed (649)`; UI `Test Files 8 passed (8)` / `Tests 66 passed (66)`. Total: 1,660 workspace tests.
- Database: `Database migrations: 119 passed`; all SQL/RLS groups passed. Edge Function suites: 149 passed, zero failed; moderation typecheck passed.
- Lint: zero errors, 64 existing warnings; no new token violations. Typecheck passed in all three workspaces.
- Web export plus static-page generation passed. Android/iOS Hermes exports passed; exports do not substitute for physical-device review.
- Browser: all eight pages at 375/1280px with JavaScript disabled; 44px tap targets, 200% text wrapping, real 404, canonical redirects, correct app Privacy tab, sign-in guidance and offline app shell after policy navigation passed. Local captures are in ignored `.artifacts/seo/`.
- Hosted billing routing/currency/catalogue/no-provider-trial checks passed; the temporary test account was removed. No money moved.
- New regressions cover rendered metadata/schema, store availability and field limits, OAuth return preservation, repeatable static builds, welcome/trial clarity, failed/hanging Google sign-in and unpublished-store feedback fallback.

No production deployment result is implied by local exports. Git delivery and any observed hosting deployment status are reported separately at handoff.
