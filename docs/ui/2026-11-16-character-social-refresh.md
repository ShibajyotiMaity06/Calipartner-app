# Character customizer and social navigation ? 16 November 2026

## Built

- Item-only thumbnails in the customizer and individual shop product cards. Alpha-bound viewboxes frame all 74 item layers without changing the original artwork. Selecting a card immediately previews it on the main character.
- Circular garment/hair and skin swatches with an outer selection ring; no visible Selected label. Paid colours keep their lock and existing paid-access flow.
- A draggable lower panel with an enlarged character when collapsed. Dragging upward restores the editor; tapping or activating the handle with a keyboard is an alternative. Native gestures and browser pointer capture are separate, and Reduce Motion is respected.
- Three-column item cards and a persistent save/purchase footer. Female beanie scale/position now clears the face.
- Buy all selected items opens one itemized CC review. Each server-acknowledged purchase has its own stable retry UUID. Partial failures retain completed purchases and retry only unfinished items. A first character or changed model is acknowledged through the existing APIs before spending; final outfit saving remains explicit.
- One shared gold SVG coin with CC lettering replaces the dollar glyph everywhere it was used. Header balances appear only on Home and You; the AI entry appears only on Home. Wallet totals and product prices remain where needed for purchases.
- Chat and Friends tabs. Friends reuses Community discovery, search, requests, accepted friends, profile editing, block/report and existing access rules. Settings Community links open the Friends tab; existing /friends links still work without theme, coin or AI controls. Chat retains its theme switch.
- The independent Squad Together today card now uses the active palette. Coach replies use the existing CaliPartner logo, with no information-circle avatar badge.

## Validation

- App: `Tests 919 passed (919)`; core: `Tests 645 passed (645)`; UI: `Tests 66 passed (66)`.
- Database: `Database migrations: 118 passed`; full SQL/RLS and Edge suites pass.
- Added native panel gesture/reduced-motion coverage and purchase tests for partial completion, distinct per-item request IDs, stable retry IDs and model-acknowledgement failure before spending.
- Extended browser audits cover item-only layers, circular skin swatches, beanie rendering, actual drag in both directions, tap collapse/restore, multi-item purchase/model switch/save, header visibility, Friends integration and the light Squad card. These are deterministic fixtures; no real payment or user account is changed.
- Format check, lint and typecheck pass. Lint retains 74 pre-existing warnings and no errors.
- Expo web, Android and iOS exports pass. Native export artifacts are local verification files, not store releases.

## Assumptions and manual verification

- Buy all means the currently selected unowned purchasable items. Existing owned items are not charged again, earned-only items retain their earning requirement, and paid collection access is unchanged.
- The existing API purchases one item per transaction; confirmed items remain owned if a later item fails. An atomic cart would require a separate backend contract and is not introduced here.
- The original supplied character artwork remains the visual source. The screenshot informs layout and interaction.
- No accounts, keys, provider-console changes or backend deployments are needed. Check the installed native build on an Android and an iPhone for touch dragging, safe-area layout and large system text before release. Automated exports do not replace device QA.

## Later scope

Standalone direct messaging and atomic cart transactions remain separate work. No hooks, services, core logic, migrations, entitlement checks or database policies were changed.

## Files created or changed

- `AGENT_RULES.md`
- `app/src/app/(tabs)/chat.tsx`
- `app/src/app/(tabs)/me.tsx`
- `app/src/app/(tabs)/progress.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/_layout.tsx`
- `app/src/app/friends.tsx`
- `app/src/app/shop/[collectionId].tsx`
- `app/src/components/HeaderActions.tsx`
- `app/src/components/avatar/AvatarPage.tsx`
- `app/src/components/avatar/AvatarView.tsx`
- `app/src/components/avatar/CharacterEditor.tsx`
- `app/src/components/avatar/CharacterPanel.test.tsx`
- `app/src/components/avatar/CharacterPanel.tsx`
- `app/src/components/avatar/ColorSwatch.tsx`
- `app/src/components/avatar/PurchaseSheet.test.tsx`
- `app/src/components/avatar/PurchaseSheet.tsx`
- `app/src/components/avatar/thumbnailBounds.generated.ts`
- `app/src/components/coach/CoachMealFlow.test.tsx`
- `app/src/components/coach/CoachMessageBubble.tsx`
- `app/src/components/friends/CommunityPanel.tsx`
- `app/src/components/friends/FriendsContent.tsx`
- `app/src/components/rooms/SquadTogetherProgress.tsx`
- `app/src/i18n/avatar.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `docs/ui/2026-11-16-character-social-refresh.md`
- `packages/ui/src/components/CoinIcon.tsx`
- `packages/ui/src/tokens/avatar.ts`
- `scripts/avatar_browser_audit.mjs`
- `scripts/avatar_thumbnail_bounds.mjs`
- `scripts/coin_navigation_browser_audit.mjs`
