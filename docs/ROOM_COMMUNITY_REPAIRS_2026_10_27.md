# Room and Community repairs — 27 October 2026

## Delivered

- Restored the missing hosted `room_workout_shares` / `pair_challenges` tables and five RPCs. Existing privacy filters, explicit sharing, membership and subscription checks are preserved. An empty room now returns empty lists instead of a missing-function error below Shared workouts.
- Replaced the deployed legacy leave function with a transaction that transfers hosting or archives the last-member room, cancels abandoned invitations and releases its hosting slot. Retries are idempotent. Recovered the three existing rooms with no remaining members; rooms with members are retained.
- Removed both client fallbacks that changed/deleted membership outside that transaction and could report success despite failure. Leave failures now remain visible for retry.
- New clients accept invitations through the current consent/capacity function. The legacy boolean RPC signature forwards to it too, so existing installed clients use the same rules. Free guests can join a Free pair; friendship alone still does not accept a room invitation.
- The message inbox shows one empty sentence: “No incoming requests.” or “No outgoing requests.” Removed duplicate friend/room headings, empty messages and the pending-limit paragraph.
- Rebuilt Friends as Community using the supplied reference: compact profile rows, search, Discover / Requests / Friends tabs with real counts, goal filters, profile access, request actions and the system Invite share sheet. Profile editing and notification settings remain available.
- Enabled `minimal_address: true` when creating Dodo checkout sessions, using the provider's [official checkout API schema](https://github.com/dodopayments/dodopayments-node/blob/main/src/resources/checkout-sessions.ts). No payment is initiated automatically.

## Pro annual test purchase

The earlier live cutover intentionally retired test purchases in migration `20261027000003_retire_dodo_test_access.sql`. The hosted Dodo entitlement is a lapsed Pro record, consistent with that cutover. This is test access being removed, not evidence of a paid live annual subscription being cancelled. Test purchases do not become live purchases; no sandbox entitlement was restored. The existing transition tests also verify that an older test checkout cannot revoke a newer live purchase.

## Checks

```text
Format: All matched files use Prettier code style!
Lint: 0 errors; 83 existing warnings; no new token violations
Typecheck: app, core and UI passed
App: 658 passed
Core: 490 passed
UI: 52 passed
Database: 47 migrations loaded; 69 cases passed, 0 failed
Dodo: 9 passed, 0 failed
Food/photo Edge Functions: 17 passed, 0 failed
Push: 7 passed, 0 failed
Coach: 8 passed, 0 failed
Total automated tests: 1,310 passed, 0 failed
Android/iOS/web export: passed
```

Added regression coverage for restoring the actual missing hosted APIs, abandoned Free quotas, legacy and current invitation acceptance, unauthorized acceptance, repeated leaving, host ownership transfer, cancelling archived-room invitations, occupied-room preservation, anonymous/outsider denial, client leave failures, minimal checkout addresses, Community navigation/actions and concise inbox states. Existing offline friendship/outbox and shared-workout privacy suites also pass.

The first full run timed out in the existing real-JPEG barcode test while Metro exported all platforms concurrently. The full suite passed on rerun without that competing build; no unrelated test or barcode implementation was changed.

## Deployment and verification

Applied only the new `20261027000004_room_lifecycle_workout_repairs.sql` migration to the linked Supabase project. Deployed `dodo-checkout` with the existing live configuration. No unrelated historical migration was replayed and no secret or billing product was changed.

Live checks with disposable users verify the room invitation reaches its recipient, Free acceptance and retry succeed, membership reaches two, both members can read empty workout lists, host departure transfers ownership, a new room can reuse the old Free slot, and last-member departure archives it. Disposable records are removed after the audit.

Browser checks cover Community search, tabs, profile opening and concise request empty states. The layout fits 320 / 390 / 430 px widths and text enlarged to 200%. Local screenshots and logs remain ignored under `.cache/room-social-*`.

The live checkout was opened without submitting payment: billing collects country and ZIP, with no street, city or state inputs. Dodo emitted its own hydration warning while rendering the page; the form remained usable. The app emitted no browser errors. Final read-only verification confirms the migration is recorded, zero active rooms have no members, and the lapsed Pro entitlement matches a retired test product.

## Assumptions and manual steps

- “One room left” means one simultaneously hosted room for Free, not a lifetime creation allowance. Occupied rooms keep consuming a host slot; archived rooms do not.
- The reference is a layout direction. Existing APIs support username search, not general name search. Mutual counts and presence are omitted because the API does not supply them.
- Selecting your friend sends an invitation; your friend must explicitly accept it from the room message inbox. Until then, 1 of 2 people is correct.
- Backend fixes are live. Reload the updated frontend for the UI/client changes. Installed production mobile apps need the usual app update; this session exports bundles but does not publish store binaries or an EAS Update.
- No new accounts, keys or console settings are required. A real live purchase is required for a live Pro entitlement.

## Files created or changed

- `app/src/app/(tabs)/room.tsx`
- `app/src/app/friends.tsx`
- `app/src/components/friends/CommunityPanel.tsx` (new)
- `app/src/components/friends/FriendRequests.tsx`
- `app/src/components/friends/socialFlows.test.tsx`
- `app/src/components/rooms/RequestsInboxModal.tsx`
- `app/src/hooks/useRooms.ts`
- `app/src/i18n/en.ts`
- `app/src/services/roomService.ts`
- `app/src/services/roomService.test.ts`
- `supabase/functions/_shared/dodoHandlers.ts`
- `supabase/functions/_shared/dodoHandlers.test.ts`
- `supabase/migrations/20261027000004_room_lifecycle_workout_repairs.sql` (new)
- `scripts/room_repair_cases.mjs` (new)
- `scripts/test_rooms_v3.mjs`
- `docs/prd.md` and `docs/BUILD_PLAN.md` (repair authorization/scope)
- This delivery report (new).

## Later scope

No additional product features were built. The previously documented Auth-account deletion/diary-trigger issue remains outside this request. Mutual-friend counts, presence and broader search would require a separately authorized API/privacy change.
