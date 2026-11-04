# Free Squad chat and hosted deployment - 4 November 2026

## What changed

- Human Squad text chat is available to every authenticated joined member, including Free/basic, trials and lapsed subscribers. The composer, typing, mentions, read state, reports, approved attachment reads and chat push authorization no longer require a subscription.
- Membership, room lifecycle, accepted chat terms, blocks, mutes, moderation, rate limits, privacy and acknowledged idempotent sends remain enforced. Media uploads still require Pro. AI Coach access is unchanged.
- The supplied Supabase management token is stored in Windows Credential Manager as `CaliPartner/Supabase/ManagementAccessToken`, outside the repository. Local helper files live in `%LOCALAPPDATA%/CaliPartner/`; they contain no token literal. CLI requests load the credential into the child process environment and restore the previous environment afterward. Token expiry remains controlled by Supabase.
- Deployed the preceding food and weekly-plan work, plus the Free chat migration. Live testing uncovered unavailable configured AI model routes and malformed provider JSON. Weekly planning now has supported-model fallbacks, strict JSON schema output for compatible Groq models, a total provider deadline and sanitized diagnostic categories. The existing backup Groq credential now participates in fallback. Invalid drafts get at most one correction attempt per route, within the same total deadline. Core safety/nutrition validation still runs before saving; only constant diagnostic reason codes are logged.

## Files changed

- Requirements: `AGENT_RULES.md`, `docs/prd.md`, `docs/BUILD_PLAN.md`.
- App: `app/src/app/(tabs)/room.tsx`, `app/src/components/chat/ChatView.tsx`, `ChatMention.test.tsx`, `app/src/components/rooms/PaywallModal.tsx`, `RoomAccess.test.tsx`, `app/src/i18n/en.ts`.
- Shared entitlements: `packages/core/src/subscriptions.ts`, `subscriptions.test.ts`, `subscriptions_attack.test.ts`, `weeklyPlan.ts` (constant validation reason codes; no safety bounds changed).
- Backend: `supabase/migrations/20261104000400_free_squad_chat.sql`, `supabase/config.toml`, `supabase/functions/chat-signed-url/index.ts` and `index.test.ts`, `supabase/functions/send-push/index.ts` and `index.test.ts`, `supabase/functions/weekly-plan/index.ts`, `index.test.ts` and new `schema.ts`.
- Database regressions: `scripts/chat_access_cases.mjs`, `chat_concurrency_cases.mjs`, `rooms_v3_cases.mjs`, `squad_revision_cases.mjs`.
- Browser regression: `scripts/nov4_browser_audit.mjs`.
- Operations: new `scripts/apply_migration_files.ps1`, `scripts/verify_free_chat_hosted.ps1`, and this report.
- The owner's pre-existing blank-line edit in `app/.env.example` is excluded from delivery.

## Validation

- Format: `All matched files use Prettier code style!`
- Lint: `0 errors, 72 warnings`; no new token violations, 254 grandfathered violations.
- Typecheck: app, core and UI passed.
- Full test run: app 118 files / 725 tests; core 49 / 546; UI 6 / 55. All SQL/RLS suites passed with 94 migrations. Edge suites: billing 9, food/photo 24, chat/push 17, AI Coach 14, weekly planning 11, challenges 7; all passed.
- Web export and Android Hermes export passed. This is a bundle/build check, not an installed-device test.
- Browser audit passed at 375/390/844px, including Free text send, chronological Back navigation, stable idle Compare, inline member selection, food copying and weekly-plan access/editing fixtures.
- Hosted Free chat passed with two temporary synthetic accounts: create/join, accepted terms, send/retry/read, mention, typing, read acknowledgement and reply. Free AI Coach requests returned 403.
- Hosted chicken breast and chicken egg saves passed, including identical retries: `293 kcal` and `44.32 g protein`, without doubled totals.
- Hosted weekly-plan verification passed using a real provider: acknowledged generation/save, Monday-only Free and Plus trial projections, and all seven days with personal workout/diet tips for a synthetic paid Plus entitlement.
- Temporary rooms and auth users are deleted in the hosted script's cleanup block. No test messages were sent to real users.

## Deployment and assumptions

- Applied and recorded exact versioned migration source for `20261104000000` through `20261104000400` on the linked project. Deployed `food-lookup`, `weekly-plan`, `chat-signed-url` and `send-push` through the Supabase Management API.
- The hosted migration ledger has ten missing older records. Standard `db push` refused this history. The deployment script applies only explicitly named new migrations in transactions and records their exact SQL atomically; it refuses to replay old missing versions. Historical gaps were not falsely marked applied or blindly replayed.
- "Chat with anyone" means other joined members of the same usable Squad, as specified by the request for Squad group chat. No direct-message feature was added. Generated exercises use repetition counts supported by the existing workout editor; timed exercise prescriptions are excluded.
- Provider behavior follows the official [Groq structured-output documentation](https://console.groq.com/docs/structured-outputs) and [supported model list](https://console.groq.com/docs/models). The app receives no server AI keys or full paid plan content for Free/trial accounts.

## Manual steps and later work

- Reload the development app or ship a new native app release to receive the composer/paywall UI changes. The database and Edge Function changes are already hosted.
- Physical Android/iOS navigation testing remains a device check; browser Back and automated navigation coverage passed.
- `USDA_API_KEY` is not configured in hosted secrets. Food lookup currently uses the existing public demo-key fallback; configure a production key for reliable provider quota.
- Reconcile the pre-existing historical migration-ledger gaps as a separate audited maintenance task. Do not run `db push --include-all` against those gaps without checking each migration's actual effects.
