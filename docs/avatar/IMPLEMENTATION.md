# Avatar and appearance delivery

## Delivered

- Onboarding creates a character before the existing personalised-plan flow. You and Home show the saved character and CC; You opens the wardrobe. Compare renders both selected members through a relationship-checked database projection.
- Wardrobe: male/female models, eight skin tones, 20 garment and 20 hair colors, all launch slots, previews, owned finishes, model-compatible inventory, one-piece bottom hiding, acknowledged saves, stable retry UUIDs and an unsaved-change confirmation.
- Shop: nine collections and 93 products, tier access from existing server entitlements, item and discounted complete-set purchases, wishlist, set-completion labels and shortfall guidance. Owned items remain equippable after expiry. Additional premium art uses the documented fair price bands; all pricing/configuration lives in the database.
- Wallet: earned/purchased balances, ledger, dedicated native RevenueCat CC offering, store-localized prices, server-only crediting and refund clawback. No web cash checkout, subscription currency grants, client crediting or offline write queue.
- Progress: server-validated routine rewards and Daily Drop, first-week Starter Path, XP banking, three earned forms and levels 1–6, one-time level/form notice, trusted completed-challenge rewards, streak/season achievement items.
- Light (default), Dark and Yellow (previous palette) persist on the device. Home exposes all three. Shared controls and legacy screens read the current palette. Wells colors are tokenized; secondary dark text and light nutrient text use accessible variants. Glass dock/log-sheet colors follow the theme.
- Asset build preserves source art and validates matching canvases/alpha, prepares transparent bases and segmented skin masks, converts black aura canvases to alpha, and emits 378 bundled full/preview WebP variants (about 5.1 MiB). Skin and garment recoloring preserves shading/alpha rather than painting flat silhouettes.

## Files

- `app/src/components/avatar/`, `app/src/hooks/useAvatar.tsx`, `app/src/services/avatar*`, `app/src/i18n/avatar.ts`, `app/assets/avatar/`.
- Routes: `app/src/app/avatar/`, `app/src/app/shop/`, `app/src/app/wallet.tsx`; integration in onboarding, Home, You, Compare and root layout.
- Shared appearance: `packages/ui/src/theme/`, `packages/ui/src/tokens/colors.ts`, `packages/ui/src/tokens/avatar.ts`, existing token consumers; legacy `app/src/theme/` bridge.
- `packages/core/src/avatar.ts` and tests; `.ts` imports enabled for the shared Deno/app module while retaining strict no-emit typechecking.
- `supabase/migrations/20261113000100_avatar_economy.sql`, `20261113000200_avatar_catalog.sql`, `20261114000100_avatar_public_cosmetic_fields.sql`, `supabase/seed/avatar_catalog.json`, RevenueCat webhook and test. Shared projections exclude exact XP and creation timestamps.
- `scripts/build-avatar-assets.mjs`, `seed_avatar_catalog.mjs`, `avatar_cases.mjs`, `avatar_browser_audit.mjs`, existing database test runner and package scripts. Raw art tools are excluded from application lint/format checks.
- Legal/delete screens disclose currency terms and forfeiture. Existing unrelated AI edits are preserved separately.

## Config and pricing

`avatar_config.avatar_enabled` can close all avatar client mutations and hide launch surfaces; onboarding still continues if disabled. The default is enabled for this owner-requested launch. Existing purchase/refund processing remains available so disabling presentation cannot lose a paid receipt.

`avatar_products.price_cc`, collection bundle discounts, `price_multiplier`, tier discounts, spend order, earn rules, levels, starter-day window and reward steps are server configuration. The purchase RPC compares the confirmed quote with current pricing and refuses a changed price.

Default packs match the supplied spec: 100/250/500/1,000/2,500 CC, target India prices ₹75/₹189/₹375/₹750/₹1,875 and US prices $0.99/$2.49/$4.99/$9.99/$24.99. Actual UI prices come only from the native store offering. Additional Studio garments are 120–180 CC (Plus) / 220–300 CC (Pro), accessories 100 / 200 CC.

## Manual setup / validation

1. Create native consumables `cc_100`, `cc_250`, `cc_500`, `cc_1000`, `cc_2500`; confirm supported regional price points in both consoles. Add them to RevenueCat offering `cc`, separate from subscription entitlements.
2. Enable App Store / Play server notifications and RevenueCat `NON_RENEWING_PURCHASE` and `CANCELLATION` delivery to the existing authenticated webhook. [Official RevenueCat setup and event semantics](https://www.revenuecat.com/docs/platform-resources/non-subscriptions).
   Hosted verification found that `REVENUECAT_WEBHOOK_SECRET` / `REVENUECAT_SHARED_SECRET` is absent. Configure the same private authorization value in Supabase secrets and the RevenueCat webhook console. Until configured, the endpoint fails closed; real native receipt crediting is not claimed as validated.
3. Validate actual sandbox receipt credit/refund on a native development build with test store accounts. Automated tests exercise the verified webhook and database grant/refund boundaries; they do not claim a live store transaction.
4. Review the generated skin masks and accessory alignment across all forms on physical Android/iOS devices. The deterministic fallback masks are not artist-supplied masks. Launch art is bundled so it remains available offline; remote R2 catalogue delivery is deferred until new art drops require it.

## Later work

Forms 4/5, monthly/limited art drops, remote R2 manifest delivery/composite download cache, share-image export, matching-pair badges and push wishlist alerts are not part of the owner's requested launch flow. No decay, identity labels, gifting, transfers, trading, 3D or retired Focus rewards were added.

## Verification

- Vitest summaries: `Tests 898 passed (898)` (app), `Tests 636 passed (636)` (core), `Tests 65 passed (65)` (UI).
- `Avatar database tests: 10 passed, 0 failed`; every existing database and Edge suite also passed through `npm test`.
- Format and strict typecheck passed. Lint passed with zero errors and existing warnings; no new token violations.
- Web, Android and iOS exports passed. Browser checks passed for creation, failed-save retry UUID, skin/outfit tint, CC purchase, Home/You/Compare, discard confirmation, all themes, persistence and narrow/landscape layouts.
- Hosted verification: 11 checks passed, with disposable accounts/squads removed. The existing missing RevenueCat webhook secret is reported as manual configuration, not as a verified cash purchase.

The browser audit uses deterministic contracts. SQL tests execute the migrations and enforce ownership, server tier access, private reads, atomic ledger spending, replay safety, refund debt, reward validation and cosmetic-only public projections.
