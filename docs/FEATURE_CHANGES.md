# CaliPartner feature changes

Final owner-approved scope, 24 October 2026. This report covers the room, onboarding and subscription changes plus the username/friends follow-up. The table below includes your final correction.

## Room limits and subscriptions

| Host plan | Rooms they can host | People per room |
| --- | --- | --- |
| Free | 1 | 2 |
| Plus | 3 | 5 |
| Pro | 5 | 20 |

- Both people can use a free pair room without subscribing.
- A third through fifth member requires a Plus host. Six through twenty require a Pro host.
- Other members can join a paid host's room for free. Their own subscription controls their individual paid features.
- Hosting limits are enforced by the server and reflected in the app and paywall.
- Existing subscription prices and other Pro benefits are retained because no new numeric prices were supplied.

## Shared progress, chat and challenges

- Free shared progress includes calories, protein, carbohydrates and fibre, plus whether someone logged food and trained today. Each person's privacy choices apply.
- Sending text chat or sharing an exact workout requires the sender to have Plus or Pro. A free recipient can read shared messages and workouts.
- Sending chat photos and videos requires Pro.
- Seven-day pair challenges require both participants to have Plus or Pro, with explicit challenge acceptance.
- Dismissing an upgrade returns to the previous flow without continuing into room creation.

## Subscription expiry and room takeover

- Rooms that require a paid host freeze when the required subscription ends.
- For thirty days, the host can renew or an existing eligible member can take over using their own subscription and an available hosted-room slot.
- After the deadline the room is deleted by maintenance. Personal diaries and workouts are retained.
- A normal free pair room stays active without a paid subscription.

## Username search and friend requests

- Signed-in users can search discoverable usernames, open profiles, send requests, and view incoming requests, outgoing requests and accepted friends.
- Free users can send three new requests in a rolling seven-day window. Active Plus and Pro remove that weekly limit; server abuse-rate limits still apply.
- Requests require explicit recipient acceptance. Users can decline, cancel, remove, block or report a connection.
- Retrying an existing request or receiving a reciprocal request does not spend the allowance twice or automatically accept it.
- Cancelling, declining, removing or deleting a recipient account does not refund the sender's weekly allowance.
- Friendship does not automatically create a room or share health data.
- Friends and social-profile editing are available from Me. The production one-to-one discovery entry now opens real username search.

## Social profiles and privacy

- Users can set a short bio, training style, optional Instagram username and HTTPS website.
- Sharing social details requires an explicit opt-in. Private details show a lock.
- Other people receive only the permitted nickname, username, avatar and shared social fields through server-filtered functions.
- Search respects discoverability and blocks in both directions. Profiles do not expose email, date of birth, body measurements, private location, food logs or targets.
- Health-sharing permissions remain separate from social-profile sharing.

## Offline use and account safety

- Social-profile edits, friend requests, responses, blocks and reports are saved in an account-scoped outbox before syncing.
- Retries keep the same request/report identifiers. The server checks the live plan and quota when syncing.
- Cached views are labelled; pending and failed actions have visible status.
- Queued blocks hide the person locally while waiting to sync. Authorization failures never fall back to an old cached profile.
- Account changes close social modals and clear screen drafts. Queued actions remain bound to the account that created them.
- Later profile edits supersede stale offline retries. Personal tracking continues to use the existing offline flow.

## Onboarding, goals and home

- Height can be entered in centimetres or feet/inches independently of weight units, including height edits from Me.
- Water and step goals are requested after the body-weight goal.
- Shared sizing tokens make the interface moderately more compact while retaining accessible text scaling and touch targets.
- Selected training days have clearer visual and text feedback.
- The home leaf symbol is removed.
- The screen before the paywall uses a few short premium highlights without Plus/Pro labels. The following paywall explains the tiers.
- The weekly-limit warning wording is removed. Calculator and database safety caps remain enforced.

## Monthly Pro check-in

- Pro includes a monthly review of current body weight and routine changes.
- Updated inputs recalculate the suggested macros. The user confirms the new plan before it replaces their current targets.

## Validation

All required checks passed:

- `npm run check`: lint, typecheck and all tests passed. Lint has zero errors and 104 existing warnings; no new design-token violations.
- `npm run format:check`: all matched files use Prettier code style.
- `npm run build:web`: Expo web export completed.
- `git diff --check`: passed.

Test summary lines:

```text
App:   Test Files 62 passed (62); Tests 565 passed (565)
Core:  Test Files 36 passed (36); Tests 450 passed (450)
UI:    Test Files 5 passed (5); Tests 52 passed (52)
Database migrations: 34 passed
Database tests: 17 passed, 0 failed
Friends database tests: 13 passed, 0 failed
```

New coverage includes database privacy and subscription enforcement, friend consent and quota boundaries, idempotent offline retries, account isolation, profile validation and interface controls. The database runner replays the migration chain against an isolated PostgreSQL engine with Supabase-compatible auth roles and RLS; it does not need production credentials or Docker.

## Deployment and manual checks

1. Apply the database migrations to the intended Supabase project before releasing the app. If the earlier compatibility migrations have not been applied, use `npx supabase db push --include-all` as described in the prior handoff. No production database was changed by these local checks.
2. If the prior room release is not deployed, deploy the updated `chat-upload-url` Edge Function and confirm the room lifecycle maintenance job runs every fifteen minutes.
3. Use the existing RevenueCat products and prices; update store descriptions to the final room limits and individual benefits. No new secrets are required for friends.
4. If not already done for the room media work, create Android/iOS EAS development builds for the added native media modules. Test live purchases, private media uploads, room takeover, friend requests with two accounts, offline reconnection and account switching.
5. Check screen readers, 200% text scaling and a small phone on both mobile platforms. The web export and automated tests do not replace native-device checks.

## Assumptions and later work

- "Three per week" means a rolling seven-day UTC window; timezone edits cannot refill it. The quota applies to newly sent requests, not incoming requests or accepted friends.
- Room quotas limit hosting. Members can still join a room supported by an eligible host for free.
- A social profile consists of the optional fields above; it does not turn private fitness data into public profile content.
- New friend push notifications, broader Partner Finder matching, unrelated lint cleanup and seasonal-challenge redesign are outside this request and were not built.
