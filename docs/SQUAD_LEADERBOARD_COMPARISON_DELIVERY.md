# Squad leaderboard and comparison delivery

Owner request: 2 November 2026. The supplied leaderboard, squad and compare PDF is the visual reference; the owner explicitly approved the database/hooks needed for the feature changes and chose the average of calorie, protein, carb and fat completion, each capped at 100%.

Delivered:

- Home shows both people in a pair and the top three in a larger squad. Overview uses the same ranked rows; Leaderboard lists everyone, including a 20-person room. Equal scores share ranks.
- Squad has Overview, Leaderboard and Chat. Member rows open a separate person page. Comparison has exactly two independently selectable people, with Iris/Teal identity colours and each person?s own targets.
- A membership-checked SQL projection returns mandatory macros, targets and steps for Free, Plus and Pro. Base nutrition, targets, weights and workout tables retain owner-only RLS. A separate SQL projection gates meal names/nutrition and detailed workout sets using the viewer?s active Plus/Pro access.
- Height and weight are independent optional visibility settings. The new UI offers no switches to hide macros, steps, meals or workouts.
- Chat has an @ member picker using actual usernames. Server-side capture creates unique recipient receipts; Home shows a dropdown only when unread tags exist. It supports pagination and opens the exact tagged message even when older than the newest chat page. Seen state changes only after acknowledgement. Blocks, mutes, deletion, membership and plan gates are checked server-side.
- Check-in, nudge, multi-person comparison and shared-progress entry points were removed from the refreshed screens. Historical records and legacy APIs were retained; unrelated features were not rebuilt.
- The earlier You/Profile naming, personal-only You tab, light italic fonts and create/join sheet remain. Cancelling a sheet opened from Home returns to Home. Member and comparison Back return to their origin. Shared text/buttons support 200% scaling; the floating tab bar and chat reserve space for enlarged labels. Sheets respect Reduce Motion and retain opaque surfaces.

Files created or changed in this delivery:

- `docs/SQUAD_LEADERBOARD_COMPARISON_DELIVERY.md`
- `app/src/components/chat/ChatMention.test.tsx`
- `.gitignore`
- `.prettierignore`
- `app/src/app/(tabs)/room.tsx`
- `app/src/app/(tabs)/today.tsx`
- `app/src/app/squad/compare.tsx`
- `app/src/app/squad/person.tsx`
- `app/src/components/chat/ChatComposer.tsx`
- `app/src/components/chat/ChatView.tsx`
- `app/src/components/chat/SquadTags.test.tsx`
- `app/src/components/profile/PerRoomVisibilityModal.tsx`
- `app/src/components/rooms/HomeSquadLeaderboard.tsx`
- `app/src/components/rooms/HomeSquads.test.tsx`
- `app/src/components/rooms/HomeSquads.tsx`
- `app/src/components/rooms/PersonalDayCard.tsx`
- `app/src/components/rooms/RoomAccess.test.tsx`
- `app/src/components/rooms/RoomHeader.tsx`
- `app/src/components/rooms/RoomPrivacy.test.tsx`
- `app/src/components/rooms/SquadMemberPicker.tsx`
- `app/src/components/rooms/SquadMentions.tsx`
- `app/src/components/rooms/SquadViews.tsx`
- `app/src/components/rooms/SquadVisibilityModal.tsx`
- `app/src/hooks/useSquad.test.tsx`
- `app/src/hooks/useSquad.ts`
- `app/src/i18n/en.ts`
- `app/src/i18n/squadDesign.ts`
- `app/src/services/squadService.test.ts`
- `app/src/services/squadService.ts`
- `docs/BUILD_PLAN.md`
- `docs/prd.md`
- `docs/ui/00-decisions.md`
- `packages/core/src/index.ts`
- `packages/core/src/squad.test.ts`
- `packages/core/src/squad.ts`
- `packages/ui/src/components/Button.tsx`
- `packages/ui/src/components/Sheet.test.tsx`
- `packages/ui/src/components/Sheet.tsx`
- `packages/ui/src/components/TabBar.tsx`
- `packages/ui/src/components/Text.tsx`
- `scripts/squad_revision_browser_audit.mjs`
- `scripts/squad_revision_cases.mjs`
- `scripts/squad_revision_hosted_audit.mjs`
- `scripts/test_rooms_v3.mjs`
- `supabase/functions/ai-coach/deno.json`
- `supabase/functions/ai-food-photo/deno.json`
- `supabase/functions/calculate-targets/deno.json`
- `supabase/functions/chat-signed-url/deno.json`
- `supabase/functions/chat-upload-url/deno.json`
- `supabase/functions/dodo-checkout/deno.json`
- `supabase/functions/dodo-webhook/deno.json`
- `supabase/functions/food-lookup/deno.json`
- `supabase/functions/revenuecat-webhook/deno.json`
- `supabase/migrations/20261103044940_squad_leaderboard_mentions.sql`

Validation:

```text
App: Tests 693 passed (693)
Core: Tests 514 passed (514)
UI: Tests 55 passed (55)
Squad revision database tests: 8 passed, 0 failed
```

- Unit, service, hook, rendered UI, SQL/RLS and all existing Edge Function suites pass. The new tests cover personal-goal scoring/caps/ties, missing targets, room/account changes, visibility acknowledgement and retry, free payload boundaries, Plus expiry, 20-person projections, local days, exact username tags, idempotency, old messages, pagination and blocked/muted/deleted content.
- Web, Android and iOS Expo exports pass. These check bundling; physical-device and signed store builds are separate release checks.
- The browser contract audit passes pair/top-three/full-20 boards, Free/Plus member and comparison views, independent any-two selection, create/join cancellation, page Back, exact old mention opening, tag sending, disappearance after seen acknowledgement, 320/390/844 widths and 200% text without clipping. Screenshots are in `.artifacts/squad-revision/`.
- The hosted audit passes acknowledged saves and identical retries, Free basics, Plus meal/workout details, optional measurements, unread tags and seen receipts, outsider denial and expired Plus gates. All four disposable accounts and their room were removed; the fixture receipt contains no remaining account IDs.

Deployment:

The only schema change is `20261103044940_squad_leaderboard_mentions.sql`, applied through Supabase?s official [Apply a migration API](https://supabase.com/docs/reference/api/v1-apply-a-migration), which recorded its UTC version. The local file was named to match that recorded version before commit. Its SHA-256 is `58a01e361461d5783435eaa0083590d88ed22c990cea8433e76e5a3ad25eab7b`. No historical migration was edited or replayed. Older unrelated migration-history gaps prevent an unscoped CLI push and remain separate maintenance.

Assumptions:

- Ties share a rank. Missing or invalid targets are unranked. A deliberately zero macro target is already complete; intake above any target gives no ranking bonus.
- Each member?s today uses their stored time zone and the latest effective saved goal.
- Shared meals/workouts are gated by the viewer?s Plus/Pro, including when the person being viewed is Free. Existing Plus chat and Pro media rules remain. Free recipients see the unread-tag count and an upgrade prompt, without chat text.
- Existing room quotas, safety calculators and acknowledged-save behaviour remain authoritative.

Manual follow-up: reload the web app or run a current native development build. No new accounts, keys or console settings are required. Review on a physical phone before a store release.

Later work: the previously existing historical migration-history gaps can be reconciled separately. No later-phase feature was added.
