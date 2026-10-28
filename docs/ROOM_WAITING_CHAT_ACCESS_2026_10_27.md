# Room waiting view and chat access — 27 October 2026

## What changed

- A pending room now has one view: “Waiting for your friend to accept”, “You can also share the room code”, the selectable code, Copy code and Share room code. Removed the username-invitation action and all shared workouts, challenges, progress cards and upgrade banners from that waiting view. The header does not repeat the code or capacity while waiting. Room settings still provides room management.
- Progress says “Progress opens when your friend accepts the invitation.” until a second joined member is present. Afterwards, its existing paid access rules apply.
- Free viewers tapping Chat see “Get Plus or Pro to open room chat” and See plans. The conversation component, message loader, realtime chat subscription and unread lookup are not opened for Free. Plus/Pro chat also waits for the invitation to be accepted.
- Members appears only when the viewer has active Plus/Pro access and the room contains more than two joined people. This includes eligible Plus trials. Pair rooms hide it for every plan. An already-selected Members view falls back to Today when it becomes unavailable.
- The header uses the current snapshot's member count when available. While waiting, a five-second refresh checks acceptance if realtime misses an event; it stops when someone joins or the screen loses focus.
- Copy uses the SDK-compatible `expo-clipboard` module on Android/iOS/web, and confirms success only after a successful copy. Sharing uses the system share sheet. Both actions retain a short error state.

## Server enforcement

The latest owner instruction supersedes the older rule allowing Free to read chat. Migration `20261027000005_paid_chat_read_access.sql` adds restrictive chat-table policies and gates message-reading RPCs, read state and unread counts by the viewer's live entitlement. It preserves membership, privacy, blocking and mute checks. Replaying a successful send after lapsing cannot recover its message payload. Free recipients do not receive new chat previews; existing pending previews are skipped, and dispatch rechecks access before sending.

`chat-signed-url` verifies the authenticated viewer's server-side tier before signing a media URL. Its function-specific import map is included so hosted bundling resolves the shared core package. The migration and `chat-signed-url` / `send-push` functions are deployed. No pricing, billing mode, real user subscription or room quota was changed.

The live acceptance check also exposed a stale `target_calories` column reference in `get_room_snapshot`. Migration `20261027000006_room_snapshot_current_target.sql` replaces only that lookup with the canonical `daily_calorie_target`, preserving the function?s membership and privacy behavior. A regression test reproduces the actual old function against a schema without the compatibility alias, then proves the repair.

The paid Chat browser check also exposed two room-chat hooks opening the same realtime channel together. The room-level unread watcher now stops while Chat is selected, leaving the conversation as the single listener. This avoids the existing subscribed-channel callback collision without changing the shared hook.

## Verification

```text
Format: All matched files use Prettier code style!
Lint: 0 errors; 83 existing warnings; no new token violations
Typecheck: app, core and UI passed
App: 665 passed
Core: 490 passed
UI: 52 passed
Database: 49 migrations loaded; 74 cases passed, 0 failed
Dodo: 9 passed, 0 failed
Food/photo: 17 passed, 0 failed
Push and chat media: 9 passed, 0 failed
Coach: 8 passed, 0 failed
Total automated tests: 1,324 passed, 0 failed
Android/iOS/web export: passed
Android native autolinking: expo-clipboard resolved
```

Added seven interface tests for the pending view, acceptance refresh, Progress message, Free chat not mounting/fetching, paid chat, Members visibility, clipboard and sharing. Five new database cases exercise Free/paid/trial/expired/lapsed access, direct tables, RPCs, media metadata, unread counts, previews, stale-send replay, outsiders and anonymous access. Two Edge tests cover authenticated media access and the fresh entitlement check before chat preview delivery. Existing offline sync and all unrelated test suites pass.

Live browser checks with disposable accounts verify the minimal waiting view, actual clipboard contents, 320/390/430 px widths and 200% text, the Progress waiting message, zero chat loads for Free, acceptance clearing the waiting view, Free RPC/media denial, paid Chat opening, pair-versus-three-person Members visibility, and hiding Chat/Members after a downgrade. Disposable users and rooms were removed. Screenshots/logs remain ignored under `.cache/room-waiting-*`.

## Assumptions and manual steps

- “More than two people” means joined members, not invitations waiting for acceptance. Members also requires the viewer's own active Plus/Pro plan, even in a room hosted by someone else.
- The waiting state lasts until a second person joins. Once that happens, normal Today content returns and paid Progress becomes available.
- Reload the updated web frontend. Native development/production builds must be rebuilt and reinstalled because Copy now includes `expo-clipboard`; a Metro reload or JavaScript-only update cannot add the native module. No account, key, payment or console change is required. This session exports bundles and verifies autolinking but does not submit store binaries or publish an EAS Update.
- The clipboard integration follows the [Expo Clipboard API](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/), with the dependency version selected from the repository's installed Expo SDK compatibility list.

## Files

- `app/package.json`, `package-lock.json` — compatible clipboard dependency.
- `app/src/app/(tabs)/room.tsx` — waiting-state branching, access messages, chat mounting and member count.
- `app/src/components/rooms/DormantWaitingState.tsx` — minimal code view/actions.
- `app/src/components/rooms/RoomHeader.tsx` — Members visibility and waiting header.
- `app/src/components/rooms/RoomAccessNotice.tsx` (new) — brief access/waiting notice.
- `app/src/components/rooms/RoomAccess.test.tsx` (new) — actual screen/component interaction tests.
- `app/src/i18n/en.ts` — concise copy.
- `supabase/migrations/20261027000005_paid_chat_read_access.sql` (new) — database access and preview gate.
- `supabase/functions/chat-signed-url/index.ts`, `index.test.ts` (new), `deno.json` / `deno.lock` (new) — paid media gate and tests/configuration.
- `supabase/functions/send-push/index.ts`, `index.test.ts` — fresh entitlement check for previews.
- `scripts/chat_access_cases.mjs` and `scripts/room_snapshot_repair_cases.mjs` (new), `scripts/rooms_v3_cases.mjs`, `scripts/test_rooms_v3.mjs` — current database access coverage.
- `package.json` — include media checks in the full test command.
- `docs/prd.md`, `docs/BUILD_PLAN.md` — record the latest rule and limited scope.
- This report (new).

## Later scope

No future phase was built. The previously documented account-deletion/diary-trigger issue remains outside this request. Already-issued media URLs retain their existing short expiry; paid checks prevent issuing a fresh URL after access lapses.
