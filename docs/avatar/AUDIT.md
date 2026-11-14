# Avatar integration audit — 13 November 2026

The owner's current request authorizes end-to-end onboarding, wardrobe, Home/You/Compare avatars, CC/shop integration, and persisted light/dark/yellow themes. The attached implementation document supplies product design, not additional owner instructions to stop after an audit or obtain separate phase approvals.

- Navigation: Expo Router under `app/src/app`; Home is `(tabs)/today`, You is `(tabs)/progress`, Settings is `(tabs)/me`; onboarding is authenticated and followed by `/weekly-plan?setup=1`.
- Theme: `packages/ui/src/tokens` is the existing token source (there is no `packages/ui/tokens` directory). Both theme hooks currently force dark; many screens import static `dark`. Retain the current palette as Yellow and add the owner's Wells Light/Noir palettes, default Light, with local persisted choice.
- Profiles: private `profiles`, timezone and adult screening already exist. No avatar/CC tables exist. Use separate private avatar tables and the existing `entitlements` source, never a second mutable profile tier.
- Billing: native RevenueCat plus existing web subscription billing. CC packs use native consumables only. Existing subscription handling stays intact. Refunds and duplicate/out-of-order events need transaction-based handling.
- Logs: `food_entries`, `workouts`/`workout_sets`, `water_logs`, `activity_days`; timestamps UTC and stored-zone dates. Focus is retired and must not earn rewards. Signed-in writes require acknowledged online saves; do not implement the attachment's offline write queue.
- Social access: accepted `friend_requests`, joined usable `room_members`, and `blocks`. Other users' avatars must pass a database projection; no direct base-table reads.
- Challenges: existing server-scored challenge state and rewards must remain authoritative; CC is a separate cosmetic ledger, not a replacement for scoring.
- Assets: `avatar/avatar` contains 6 JPG bases, Basic layers, 45 Plus and 42 Pro layers, scenes/UI, CSV manifests and raw art. Some accessory filenames use the original naming; one-piece garments hide bottoms. Raw images/tools are source inputs, not application JS. Auto cutouts/masks need visual validation. Original source art is preserved.
- Missing companion `avatar_catalog_seed.json`: reconstruct the supplied spec's catalogue and economy as versioned JSON, extend it with available premium art and configurable fair prices. Do not use the older CSV's obsolete coin prices.
- Existing unrelated monthly-AI edits are present before this work. Preserve them and do not stage them as avatar changes.
- Baseline lint: 61 errors / 73 warnings, primarily browser-only art helper scripts mistakenly included by app lint. Scope raw-art tooling separately; avoid unrelated refactoring.

Adaptations: current owner palettes override Steel/Silver and apricot-only action colors. Existing upright Plus Jakarta Sans remains. Launch forms 1–3 only; no identity labels, decay, gifting, trading, feed, 3D, or retired Focus. The owner requested this entire integration, so a separate PR per attached phase is not required.
