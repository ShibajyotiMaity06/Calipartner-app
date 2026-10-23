CaliPartner security and release review

Production release candidate | 19 October 2026

## Release decision: Do not release this candidate

47 findings: 4 Critical, 26 High, 16 Medium, 1 Low.

The most urgent defects allow client-accessible subscription mutation, expose private food and focus data, and accept forged billing events when configuration is missing. Database runtime errors, incomplete offline recovery and simulated paid features also prevent this repository from being a production release candidate.

# Scope and evidence

Reviewed the supplied working tree, including pre-existing local changes. AGENT_RULES.md, AGENTS.md and docs/prd.md were read before tracing migration history, RLS, privileged functions, Edge handlers, offline services, shared calculators, Realtime hooks, purchase/deletion flows and representative mobile screens. The pricing proposal and final migration were checked separately. No existing application code or migration was edited.

Evidence labels distinguish source-confirmed defects from local reproductions. Local probes used actual handlers with mocked backend/provider I/O and real SQLite where relevant. They did not contact production, charge a model, modify store accounts or validate deployed ACL overrides. Temporary review tests and logs were removed following your clarification; only this document is delivered.

No local PostgreSQL/Supabase runtime, Docker, Deno or native device environment was available. SQL findings cite exact source and reproduction procedures rather than claiming live RPC or pgTAP execution. Some privacy and entitlement paths are masked by separate SQL errors; those dependencies are stated. This repository review does not certify deployed cloud settings, every dependency or every device state.

## Existing verification results

| **Check**             | **Observed result**                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                  | 77 errors and 3 warnings (80 total). Existing problems were left unchanged.                                                                                                                                             |
| Typecheck             | Failed: unresolved @calipartner/core in this supplied installation, plus further TypeScript errors. A clean workspace install is needed to separate environment resolution failures from remaining source failures.     |
| Existing tests        | App: 25 suites failed to load and 21 passed. Core: 1 suite failed to load and 31 passed. UI: 5 suites passed. 663 individual tests passed in suites that loaded. Primary load failure: unresolved @calipartner/core.    |
| Local probes          | 13 checks executed before the no-test clarification: 11 failing assertions and 2 passing arithmetic controls. Scripts removed. The attempt-limit check observed handler calls; it did not spend a real provider budget. |
| SQL and native checks | No live database or phone execution. Physical-device crashes, background/kill behavior, accessibility, camera permissions and store sandbox purchases remain unverified.                                                |

## Reproduction conventions

Use disposable adult accounts A and B on a fresh nonproduction Supabase instance migrated from this repository. Use an ordinary anon/authenticated API role for attacks; use service-role access only when explicitly inspecting setup/result state. UUID placeholders refer to those fixtures. Source paths are relative to the repository root and line numbers match the reviewed working tree.

Critical means broad unauthorized privileged mutation or disclosure. High means release-blocking privacy, authorization, safety, data loss or paid-feature correctness. Medium means material defects with narrower scope or additional timing/deployment conditions. Low means limited polish or acceptance gaps.

# Priority index

| **ID** | **Severity** | **Finding**                                                                           |
| ------ | ------------ | ------------------------------------------------------------------------------------- |
| C01    | Critical     | Public database RPCs can grant paid access, revoke other users and corrupt AI budgets |
| C02    | Critical     | RevenueCat webhook accepts forged events when its secret is absent                    |
| C03    | Critical     | AI food-photo endpoint discloses a stranger custom food and owner ID                  |
| C04    | Critical     | Personal focus statistics are readable for an arbitrary user                          |
| H01    | High         | Daily logging fails because summary SQL uses a nonexistent goal column                |
| H02    | High         | Room progress, invitation acceptance and focus joins reference nonexistent schema     |
| H03    | High         | Code join returns success without adding a new member                                 |
| H04    | High         | R2 presigned URLs do not implement AWS Signature Version 4                            |
| H05    | High         | Any signed-in user can approve or block another user attachment                       |
| H06    | High         | Image download authorization ignores attachment existence and moderation              |
| H07    | High         | Room focus base tables bypass focus status and label privacy                          |
| H08    | High         | AI quotas are checked before spending and can be raced or avoided on errors           |
| H09    | High         | An edit queued during sync is permanently deleted by an older request                 |
| H10    | High         | Delta sync permanently skips rows sharing a page boundary timestamp                   |
| H11    | High         | Core offline entities can upload but never download to a new device                   |
| H12    | High         | Cutting rate cap is raised above the hard 1 percent limit                             |
| H13    | High         | Guest data migration preserves invalid ownership and adds nonexistent columns         |
| H14    | High         | Direct fasting writes bypass every health-screening gate                              |
| H15    | High         | Goal targets accept calorie floors and weekly rates that the PRD forbids              |
| H16    | High         | Chat idempotency lookup returns another room message                                  |
| H17    | High         | Privacy changes do not hide prior feed events or aggregate contributions              |
| H18    | High         | Final room snapshot omits the paid-room usability check                               |
| H19    | High         | Sponsoring another room reuses one plan while the former room stays usable            |
| H20    | High         | Paywall may purchase a different product and reports success without one              |
| H21    | High         | Account deletion claims success on failure and leaves external and local data         |
| H22    | High         | Paid AI coach is a simulated chat with fabricated user statistics                     |
| H23    | High         | Partner Finder is a sample offer rather than the required safe matching system        |
| H24    | High         | Local row and outbox writes are not atomic when the app is killed                     |
| H25    | High         | Offline chat sync drops attachments and loses the server message identity             |
| H26    | High         | RevenueCat transfer revocations are not replay-safe and failures are acknowledged     |
| M01    | Medium       | Public Realtime presence channels reveal room viewers                                 |
| M02    | Medium       | Final snapshot and local trackers use the wrong user day                              |
| M03    | Medium       | Focus totals allocate midnight sessions and pauses to incorrect days                  |
| M04    | Medium       | Reading an expired room timer can prevent participant finalization                    |
| M05    | Medium       | Focus start and rejoin do not preserve session invariants                             |
| M06    | Medium       | Focus and room snapshot subscriptions are not published by migrations                 |
| M07    | Medium       | Step permission and hardware readings are simulated in the production service         |
| M08    | Medium       | Privacy screen discoverability and leaderboard switches do not persist                |
| M09    | Medium       | Weight graphs return raw weights as a trend instead of a moving average               |
| M10    | Medium       | Room consistency score uses a seven-day denominator for arbitrary ranges              |
| M11    | Medium       | Chat cache retains content excluded by current block and mute rules                   |
| M12    | Medium       | Export My Data returns fabricated records                                             |
| M13    | Medium       | Image metadata stripping and object deletion are not implemented on the server        |
| M14    | Medium       | Hot paths repeatedly query members and messages instead of batching                   |
| M15    | Medium       | Pricing rules disagree across the PRD, paywall and final database                     |
| M16    | Medium       | Focus clock correction is lost on restart and does not handle in-session clock jumps  |
| L01    | Low          | Hardcoded copy and fixed-size controls need an accessibility and localization pass    |

# Critical findings

## C01 Public database RPCs can grant paid access, revoke other users and corrupt AI budgets

Location: supabase/migrations/20261008000006_phase5_v04_room_billing_capacity_lifecycle.sql:391; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:580; supabase/migrations/20261008000013_phase11_ai_food_photo.sql:133; supabase/migrations/20261008000009_phase9_notifications.sql:428

Issue: These SECURITY DEFINER functions accept caller-selected user IDs without an authorization check. No migration revokes function execution from PUBLIC. RLS on the underlying tables does not protect these owner-privileged entry points.

Reproduction: On a disposable Supabase instance, use an ordinary user token and call rpc('dev_grant_plan', {p_user_id: YOUR_UUID, p_tier:'pro', p_period:'annual', p_status:'paid', p_days:3650}). Read your entitlement and check AI access. Call dev_revoke_plan with a second account UUID to remove its access. Independently, apply_revenuecat_event can mint a paid entitlement without the webhook. record_ai_usage accepts negative p_cost, allowing a caller to lower the global cost total; queue_push_notification accepts arbitrary recipient and message text.

Suggested fix: Remove dev helpers from production. Put internal functions in a non-exposed schema; revoke EXECUTE from PUBLIC, anon and authenticated and grant only the backend roles that need them. Apply the same audit to trial, usage, notification and maintenance helpers. Reject negative usage inputs. Preserve explicit grants only for caller-authorized RPCs.

Evidence and limits: Source-confirmed under normal PostgreSQL/Supabase grants; deployed ACL overrides were not accessible. Official reference: <https://supabase.com/docs/guides/database/functions>

## C02 RevenueCat webhook accepts forged events when its secret is absent

Location: supabase/functions/revenuecat-webhook/index.ts:31

Issue: Verification is conditional on the secret being nonempty, so missing configuration disables authentication. The real handler returned HTTP 200 for a forged purchase in the isolated local probe.

Reproduction: Unset REVENUECAT_WEBHOOK_SECRET and REVENUECAT_SHARED_SECRET in a disposable deployment. POST an event with id='forged-unique', type='INITIAL_PURCHASE', app_user_id=YOUR_UUID and product_id='pro_yearly'. Supply any gateway-accepted JWT if the deployment requires one. The handler forwards it to the privileged entitlement RPC. A missing expiration is accepted as null and paid checks treat null as unexpired.

Suggested fix: Fail closed with a configuration error when the secret is absent. Require and compare the configured bearer secret on every webhook. Allowlist supported event types and products and validate expiration and identity fields before mutation.

Evidence and limits: The HTTP path depends on deployed gateway JWT settings; the handler flaw was reproduced with mocked backend I/O.

## C03 AI food-photo endpoint discloses a stranger custom food and owner ID

Location: supabase/functions/ai-food-photo/index.ts:300; supabase/functions/ai-food-photo/index.ts:32; packages/core/src/ai_food_photo.ts:487

Issue: The endpoint searches foods with its service-role client, applies no owner/source/deleted filter and returns the entire matched Food. Client-controlled test model output is accepted in production code. The local real-handler probe returned the victim owner_id and private food ID.

Reproduction: Account B creates a custom food named 'Secret recovery recipe'. Account A with photo access posts {test_mock_response:{items:\[{food_name:'Secret recovery recipe',estimated_grams:100,confidence:1}\]}} to ai-food-photo. Inspect candidates\[0\].matched_food. It contains B's custom record even if the accounts share no room. Supplying model output avoids needing to photograph or prompt the desired string.

Suggested fix: Remove client test-output fields from deployed handlers. Match through an RLS-bound user client or explicitly restrict catalog rows to public items plus the caller own items, excluding tombstones. Return only the necessary food fields.

Evidence and limits: Real handler and mapping executed locally; Supabase query results were mocked to demonstrate the missing authorization boundary.

## C04 Personal focus statistics are readable for an arbitrary user

Location: supabase/migrations/20261008000010_phase9b_focus.sql:1226; supabase/migrations/20261008000010_phase9b_focus.sql:1247; supabase/migrations/20261008000009_phase9_notifications.sql:233

Issue: The SECURITY DEFINER statistics function trusts p_user_id instead of binding it to the caller. It returns private label breakdowns, minutes and dates without membership or sharing checks. The notification settings helper has the same arbitrary-user pattern.

Reproduction: Create a completed personal focus session for B with label 'Private medical study'. As unrelated A, call get_personal_focus_stats with p_user_id=B_UUID. It returns B's label breakdown and daily history. With the usual PUBLIC execute grant, supplying B_UUID also bypasses the nominal unauthenticated branch. Call get_or_create_notification_settings for B to retrieve B's settings.

Suggested fix: Make the public personal-statistics RPC derive the owner solely from auth.uid(). Keep arbitrary-user variants internal and backend-only. Apply caller authorization to the notification helper and test a stranger, former member and anonymous caller.

Evidence and limits: Source-confirmed; no live database execution was available.

# High findings

## H01 Daily logging fails because summary SQL uses a nonexistent goal column

Location: supabase/migrations/20261008000007_phase7_progress_streaks_leaderboards.sql:237; supabase/migrations/20261008000001_phase2_goal_profiles_health_screening.sql:18; supabase/migrations/20261008000015_phase13_fasting.sql:715

Issue: The goal schema defines daily_calorie_target, but the final daily-summary function and progress functions query goal_profiles.target_calories. No migration adds or renames that goal column.

Reproduction: Apply the migration set on a fresh disposable database, create an adult profile, then call recompute_daily_summary(USER_UUID, '2026-10-19') or insert an otherwise valid food entry. The summary SQL raises an undefined-column error; an AFTER trigger error rolls back the originating write. Individual progress and snapshot paths repeat the bad column.

Suggested fix: Add a forward migration correcting every query to the actual goal schema. Verify real inserts/edits/deletes for food, water, weight and workouts against a freshly migrated database, including the installed triggers.

Evidence and limits: Source-confirmed. SQL/pgTAP was not executed because PostgreSQL, Supabase runtime and Docker were unavailable.

## H02 Room progress, invitation acceptance and focus joins reference nonexistent schema

Location: supabase/migrations/20261008000007_phase7_progress_streaks_leaderboards.sql:1174; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:459; supabase/migrations/20261008000010_phase9b_focus.sql:733; supabase/migrations/20261008000012_phase10_subscriptions_paywall_entitlements.sql:343; supabase/migrations/20261008000015_phase13_fasting.sql:603

Issue: Rooms have state rather than status or host_id; room_requests has type/responded_at rather than request_type/updated_at. get_room_member_cap and queue_room_state_change_notification have no definitions in the migrations. Several core RPCs therefore fail at execution.

Reproduction: On a migrated disposable instance: call get_room_progress for a real room; accept a pending invitation; join an active room-focus session; trigger a paid-to-locked or over-capacity room transition; request a snapshot. Each reaches one of the invalid identifiers. After correcting the first error, continue through the full path: room progress also references rm.created_at, which room_members does not define.

Suggested fix: Correct names and missing helpers in new migrations. Run database integration smoke tests for every public RPC on the final migration state; exercise both success and lifecycle transition branches.

Evidence and limits: Some subsequent defects in this report are masked until these runtime errors are corrected; those dependencies are called out.

## H03 Code join returns success without adding a new member

Location: supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:388; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:378

Issue: After checking the existing member, join_by_code executes SELECT count(\*). That always sets PL/pgSQL FOUND true. The subsequent IF FOUND therefore updates the missing member ID instead of taking the INSERT branch.

Reproduction: Use the one-argument join_by_code overload with a paid/trial account that is not a member of a usable, nonfull room. The capacity COUNT returns one row. The UPDATE affects zero rows, but the RPC still writes a member_joined event and returns status='joined'. Check room_members as the service role: no membership was created.

Suggested fix: Store the existence result immediately in a dedicated boolean or use a single INSERT ... ON CONFLICT operation. Check the resulting membership before emitting the event and success response.

Evidence and limits: Source-confirmed; requires the other schema/runtime blockers in the join-trigger path to be resolved to complete a live end-to-end demonstration.

## H04 R2 presigned URLs do not implement AWS Signature Version 4

Location: packages/core/src/chat.ts:444; packages/core/src/chat.ts:480

Issue: The signer is a 32-bit string hash, not HMAC-SHA256. It emits a Unix timestamp as X-Amz-Date and omits X-Amz-Credential, X-Amz-SignedHeaders and X-Amz-Signature. The protocol check failed locally.

Reproduction: Call buildSignedR2Url with real R2 credentials. Inspect its query parameters, then attempt PUT/GET against a private R2 bucket. The URL is incompatible with the documented R2 signing protocol, so authenticated image upload/download cannot work. Do not make the bucket public as a workaround.

Suggested fix: Use a maintained S3-compatible SigV4 implementation or aws4fetch on the server. Sign canonical method/path/query/headers, enforce object limits, and verify against a real private test bucket.

Evidence and limits: The invalid URL was generated locally; no real bucket was contacted. Protocol reference: <https://developers.cloudflare.com/r2/api/s3/presigned-urls/>

## H05 Any signed-in user can approve or block another user attachment

Location: supabase/functions/chat-image-moderation/index.ts:42; supabase/functions/chat-image-moderation/index.ts:62; packages/core/src/chat.ts:511

Issue: The moderation endpoint authenticates a user but never checks the attachment owner or room membership. It accepts test_flag and uses a provider that judges the filename rather than image bytes. A local handler probe approved a victim attachment with HTTP 200.

Reproduction: As unrelated A, POST {attachment_id:B_ATTACHMENT_ID,storage_key:'anything.jpg',test_flag:'ok'} to chat-image-moderation. It updates B's attachment through the service-role client. Change test_flag to 'blocked' to censor B's image. With no flag, an ordinary filename receives an OK result without content inspection.

Suggested fix: Restrict moderation mutations to a trusted worker, remove client verdict/test flags, fetch the exact pending object and run a real image moderation provider. Bind verdicts to object digest and attachment. Fail closed until review completes.

Evidence and limits: UGC filtering is a release requirement; the current path is a material review risk under Apple guideline 1.2: <https://developer.apple.com/app-store/review/guidelines/#user-generated-content>

## H06 Image download authorization ignores attachment existence and moderation

Location: supabase/functions/chat-signed-url/index.ts:100; supabase/migrations/20261008000008_phase8_room_chat.sql:262

Issue: The signing endpoint only checks the room prefix, membership and room usability. It never looks up the attachment/message, deleted state, moderation status, sender block or mute. Attachment inserts also accept caller-supplied storage keys and moderation_status.

Reproduction: After a known message is deleted or an attachment is blocked, POST its old room_id/storage_key as another current room member. The endpoint still returns a new URL; the isolated handler probe returned 200. Separately, directly insert an attachment with moderation_status='ok' and a chosen key for your own message: the INSERT policy does not constrain those fields.

Suggested fix: Resolve a stored attachment and parent message before signing. Require an OK verdict, nondeleted message and viewer access including block/mute rules. Only the trusted uploader/moderator should set storage ownership and moderation state.

Evidence and limits: Real downloads are currently also blocked by the invalid R2 signer. This authorization defect remains after that signer is fixed.

## H07 Room focus base tables bypass focus status and label privacy

Location: supabase/migrations/20261008000010_phase9b_focus.sql:129; supabase/migrations/20261008000010_phase9b_focus.sql:169; supabase/migrations/20261008000010_phase9b_focus.sql:1117

Issue: RLS grants every usable-room member full focus session and participant rows. It does not evaluate share_focus_status or share_focus_label. Even the sanitized get_room_focus RPC emits all participants without checking their focus-status toggle.

Reproduction: B disables both focus sharing toggles in a room and starts focus with a private label. As A in that room, SELECT label, started_by, started_at from room_focus_sessions and SELECT user_id,status,joined_at from room_focus_participants. The policies allow the rows. A postgres_changes subscriber receives the same authorized base-row data.

Suggested fix: Remove member-wide SELECT access to sensitive base rows. Expose a privacy-filtered RPC/view and authorized redacted broadcasts. Enforce both label and status settings consistently for sessions, participants, history, totals and notifications.

Evidence and limits: Source-confirmed; this is independent of the stranger personal-statistics RPC defect.

## H08 AI quotas are checked before spending and can be raced or avoided on errors

Location: supabase/functions/ai-food-photo/index.ts:176; supabase/functions/ai-food-photo/index.ts:316; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:846

Issue: Access reads the used count, then the provider runs, and only successfully parsed responses are accounted for. There is no atomic reservation, attempt cap or output-token ceiling. Provider/parse failures bypass accounting and record_ai_usage errors are ignored.

Reproduction: With one scan remaining, send many requests concurrently; all may pass the same pre-call count before any usage is recorded. Repeatedly send images that make the provider fail or return invalid output: each can incur provider work without using a scan. UTC-day resets also permit scanning across a UTC boundary within one local day.

Suggested fix: Atomically reserve per-user and global quota before calling the model. Apply distributed attempt and concurrency limits, provider max-output tokens/timeouts, and hard spend limits. Record actual provider usage on every charged outcome, independently of parse success, and release only eligible reservations.

Evidence and limits: Quota race and failure accounting are source-confirmed; no real paid model was called. The latest pricing document additionally specifies a per-user monthly ceiling that is absent.

## H09 An edit queued during sync is permanently deleted by an older request

Location: app/src/services/syncService.ts:245; app/src/services/syncService.ts:101

Issue: flushOutbox snapshots a payload and later deletes the outbox row by ID alone. enqueueOutbox replaces that same row when a user edits during the network request. The old completion deletes the newer payload and marks the local entity synced.

Reproduction: Queue food-1 with name='first'. Begin flushOutbox and hold the remote upsert promise. Edit food-1 and enqueue name='newer edit'. Resolve the first request successfully. Inspect the real SQLite outbox: food-1 is absent although only the first payload reached the server. This exact interleaving failed the local regression probe.

Suggested fix: Acknowledge a specific immutable operation/version instead of an entity ID. Delete conditionally only if the sent version still matches. Serialize/lease flushes and preserve edits created while a request is in flight.

Evidence and limits: Locally reproduced using the actual sync functions and real SQLite.

## H10 Delta sync permanently skips rows sharing a page boundary timestamp

Location: app/src/services/syncService.ts:368; supabase/config.toml:9

Issue: Delta reads have no pagination or secondary ordering, but advance a strict updated_at > cursor to the last returned timestamp. Supabase caps the response at 1,000 rows.

Reproduction: Create 1,001 user_food_stats records with the same updated_at. Run pullEntityDelta twice against a backend applying the configured 1,000-row limit. The first pull imports 1,000 and advances the cursor; the second excludes all records with that timestamp. The remaining record never arrives. The local SQLite probe observed 1,000 instead of 1,001.

Suggested fix: Use keyset pagination with a stable compound cursor such as (updated_at, primary_key), or a server change sequence. Read all pages before completing the watermark and safely handle ties.

Evidence and limits: Locally reproduced with a mocked capped backend and real SQLite. Account-unscoped entity cursors also need partitioning or clearing when the signed-in user changes.

## H11 Core offline entities can upload but never download to a new device

Location: app/src/services/syncService.ts:747; app/src/services/syncService.ts:698; app/src/services/focusService.ts:386

Issue: syncAll only pulls food, food stats, foods, water, weight, activity and workouts. The delta dispatcher has no handling for focus sessions/settings, fasting sessions/settings, recipe favorites/reports or saved meals. An unsupported entity still advances its cursor.

Reproduction: Create and sync a personal focus or fast on device A, then sign into a fresh device B and run the normal sync. B reads local state and never imports the remote session. Directly passing focus_sessions to pullEntityDelta counts the remote record and advances its cursor without writing local_focus_sessions; the local probe reproduced this discard.

Suggested fix: Implement complete owner-scoped synchronization for every supported entity, including active sessions and tombstones. Reject unknown entities without advancing cursors. Recover authoritative state after restart and account change.

Evidence and limits: The source gap and unsupported-focus discard were verified; multi-device native testing remains outstanding.

## H12 Cutting rate cap is raised above the hard 1 percent limit

Location: packages/core/src/targets.ts:128

Issue: getWeeklyRateCap returns at least 0.75 kg/week for every cut. At 40 kg the stated PRD cap is 0.40 kg/week, but the function returns 0.75.

Reproduction: Evaluate getWeeklyRateCap(40,'cut'): expected 40\*0.01=0.4; actual 0.75. This was reproduced in the real calculator. For a 50 kg adult with sufficient TDEE, the code can present 0.75 kg/week even though the hard cap is 0.50.

Suggested fix: Apply exactly 1% of current body weight to both goal types. Resolve the PRD inconsistency explicitly: its 70 kg worked example lists 0.75 as available despite the 0.70 hard cap. Keep that ambiguity from silently weakening the hard rule for all lighter users.

Evidence and limits: Independent recomputation; calorie and macro arithmetic for the standard 70 kg, 0.5 kg/week example passed.

## H13 Guest data migration preserves invalid ownership and adds nonexistent columns

Location: app/src/services/guestMigration.ts:75; app/src/hooks/useFoodEntries.ts:45

Issue: migrateGuestData adds camelCase userId and synced_from_guest while retaining the original user_id. Generic outbox upserts send those fields directly to tables that define neither column. Normal guest food logging writes guest-user into local mirrors rather than recording an entry through the guest migration path.

Reproduction: Record a guest food_entries payload with user_id='guest-user'; migrateGuestData(db, REAL_USER_UUID). Read the queued JSON: user_id is still guest-user, userId was added, and synced_from_guest was added. The local probe confirmed this. For the normal UI path, log food as a guest, create a profile and check whether that local food entry was reassigned.

Suggested fix: Unify guest writes with the actual migration source. Transactionally rewrite ownership to user_id, remove non-schema fields and migrate each entity exactly once with valid UUIDs. Verify the real pre-signup UI flow through server acceptance.

Evidence and limits: Payload defect locally reproduced; normal UI wiring gap is source-confirmed.

## H14 Direct fasting writes bypass every health-screening gate

Location: supabase/migrations/20261008000015_phase13_fasting.sql:68; supabase/migrations/20261008000015_phase13_fasting.sql:72; app/src/services/fastingService.ts:228

Issue: Health gates exist in start_fasting_session, but direct INSERT/UPDATE policies check only ownership. The application offline sync uses direct table upserts, so the guarded RPC is not the authoritative write path.

Reproduction: Create an adult profile with has_eating_disorder_history=true or pregnant_or_breastfeeding=true. Confirm the start RPC rejects fasting. Then directly insert your own fasting_sessions row with planned_minutes=1200 and status='active'; owner RLS permits it. The same bypass applies to a low-intake pause. An account without a profile is not failed closed by the start RPC either.

Suggested fix: Enforce eligibility on the actual database write path with validated RPC-only writes or a trigger/policy that covers inserts and updates. Preserve safe offline operation, but revalidate eligibility on sync and handle rejection explicitly.

Evidence and limits: The database does enforce the 20-hour planned-duration column bound; the missing protections are screening, low-intake and complete eligibility enforcement.

## H15 Goal targets accept calorie floors and weekly rates that the PRD forbids

Location: supabase/migrations/20261008000001_phase2_goal_profiles_health_screening.sql:18; supabase/migrations/20261008000001_phase2_goal_profiles_health_screening.sql:43; packages/core/src/targets.ts:462

Issue: Owner RLS accepts caller-calculated targets with only an 800 kcal minimum and weekly_rate_kg up to 5. The calculator flags an unsafe requested rate but still returns its target rather than making it invalid. Server persistence does not enforce the sex-specific floor, BMI guard or body-weight cap.

Reproduction: As a 70 kg male, directly insert a goal_profiles cut with daily_calorie_target=800, weekly_rate_kg=5, valid activity/body fields and nonnegative macros. It passes the declared column checks and owner policy. Separately call calculateTargets for the 70 kg worked example at 1 kg/week: it returns 1,494 kcal with a flag, below the male floor.

Suggested fix: Validate and derive the authoritative target server-side from the stored profile. Reject unsafe persisted plans and macros, including direct updates. Represent unavailable calculator choices explicitly so callers cannot save a flagged result.

Evidence and limits: Source-confirmed. A forged low target also undermines goal-day scoring once the logging schema blocker is fixed.

## H16 Chat idempotency lookup returns another room message

Location: supabase/migrations/20261008000008_phase8_room_chat.sql:512

Issue: send_chat_message verifies membership in the requested room, then looks up an existing client_id globally and returns its sender, room and text without checking that it belongs to that room or caller.

Reproduction: Use two rooms. B sends a message with known client_id='review-known-id' in B's room. A is only a member of A's usable room and has accepted chat terms. As A, call send_chat_message with p_room_id=A_ROOM and p_client_id='review-known-id'. The early idempotency return discloses B's text. A previously observed client ID remains usable after leaving its original room.

Suggested fix: Scope idempotency keys to the caller and intended room. Return an existing row only after authorizing its actual room and sender; otherwise reject the key collision. Apply equivalent ownership rules to all retries.

Evidence and limits: Source-confirmed; no guessable message ID assumption is required when a former member already knows a client ID.

## H17 Privacy changes do not hide prior feed events or aggregate contributions

Location: supabase/migrations/20261008000006_phase5_v04_room_billing_capacity_lifecycle.sql:1961; supabase/migrations/20261008000005_phase6_workouts_exercises.sql:376; supabase/migrations/20261008000015_phase13_fasting.sql:424; supabase/migrations/20261008000007_phase7_progress_streaks_leaderboards.sql:1448

Issue: Feed RLS checks membership/usability but not current author privacy; workout payloads retain type, duration and date after sharing is disabled. Room snapshot averages accumulate hidden goal-completion values before redaction. The progress steps average also ignores share_steps.

Reproduction: While B shares workouts, create a workout event. B then disables share_workouts. As A, query room_events: the old payload is still readable. For averages, use a two-member room, set A completion=0 and B completion=80 while B hides completion. A room average of 40 reveals B's 80 exactly. Repeat the steps-average subtraction with B's share_steps off.

Suggested fix: Apply current author sharing and block rules at read time for events and every aggregate. Exclude hidden contributions and use minimum group sizes where an average still permits inference. Retroactively purge or redact cached payloads on privacy changes.

Evidence and limits: Feed defect is present independently. Snapshot/progress aggregate demonstrations require the separately identified schema blockers to be fixed first.

## H18 Final room snapshot omits the paid-room usability check

Location: supabase/migrations/20261008000015_phase13_fasting.sql:357; supabase/migrations/20261008000015_phase13_fasting.sql:364

Issue: The final get_room_snapshot replacement removed the previous room_is_usable / locked-room rejection. It only rejects archived rooms after recomputing state, then reads every member summary.

Reproduction: Create a room with two members and a valid entitlement. Expire its entitlement and bring its room state to locked. Call the final five-argument get_room_snapshot as a current member. Once its unrelated target_calories/host_id errors are corrected, its logic proceeds to return room health metrics instead of ROOM_LOCKED.

Suggested fix: Restore a fail-closed usability/state check before any private-data read. Test expired trial, paid lapse, over-capacity timeout and locked state against the final function, rather than an older migration definition.

Evidence and limits: Source-confirmed latent entitlement bypass. Currently masked by the snapshot runtime errors; this is not a claim of a successful live snapshot exploit.

## H19 Sponsoring another room reuses one plan while the former room stays usable

Location: supabase/migrations/20261008000012_phase10_subscriptions_paywall_entitlements.sql:462; supabase/migrations/20261008000012_phase10_subscriptions_paywall_entitlements.sql:225

Issue: sponsor_room moves attached_room_id without enforcing an existing attachment or updating the former room. room_is_usable checks only the room plan_holder_id entitlement and ignores whether that entitlement remains attached to that room.

Reproduction: Give A one paid plan and membership in rooms R1 and R2. Sponsor R1, then R2. The entitlement is attached to R2, but R1 still points to A as plan holder and room_is_usable(R1) remains true. Repeat with further rooms. In addition, simultaneous create_room calls count hosted rooms before taking a user-level lock and can both pass a one-room limit.

Suggested fix: Atomically enforce the approved plan-to-room model, using per-user/entitlement locking and attachment invariants. An authorized plan move must recompute both old and new rooms. Verify concurrent creation, sponsorship and takeover; do not infer coverage solely from plan_holder_id.

Evidence and limits: Source-confirmed under the retained room-billing helpers. The newer pricing proposal allows multiple Pro rooms, but Plus remains limited and the one-plan-per-room PRD is still contradictory.

## H20 Paywall may purchase a different product and reports success without one

Location: app/src/components/rooms/PaywallModal.tsx:216; app/src/components/rooms/PaywallModal.tsx:249; app/src/components/rooms/PaywallModal.tsx:282

Issue: If the selected package is not found, the UI silently falls back to the first available package. If no package exists, it shows purchase success. Prices are hardcoded rather than taken from the selected store product; promo codes ending in 50 appear applied with no store offer redemption.

Reproduction: Configure an offering with only a monthly Plus package. Select annual Pro and press purchase: the fallback can purchase the unrelated first package. With empty offerings, press purchase and observe the success modal. Enter RANDOM50 and observe a claimed discount even though no store redemption occurs.

Suggested fix: Match tier and billing period exactly and disable purchase if unavailable. Display the localized store price, subscription duration and eligibility. Show success only after verified purchase/restore plus entitlement synchronization; use real store offer redemption.

Evidence and limits: Store review risk: accurate purchase descriptions and functioning subscriptions are required. <https://developer.apple.com/app-store/review/guidelines/#subscriptions>

## H21 Account deletion claims success on failure and leaves external and local data

Location: supabase/functions/delete-account/index.ts:59; supabase/functions/delete-account/index.ts:67; app/src/contexts/AuthContext.tsx:205

Issue: The endpoint logs auth-deletion errors but returns success. It does not delete R2 objects; deleting attachment rows alone cannot remove those objects. The app then signs out without clearing its SQLite database or account-specific image caches.

Reproduction: Force admin.deleteUser to return an error while calling delete-account with a valid session: the endpoint still responds success. For a normal deletion, upload a chat object, delete the account, then inspect the private bucket and on-device calipartner.db. The handler contains no object cleanup or local database removal. A creator account also cascades its rooms, deleting other members' room history without the normal leave/host-transfer flow.

Suggested fix: Implement a retryable deletion job covering auth, relational data, owned objects and local account data. Propagate failure/pending state truthfully and preserve appropriate room ownership. Explain active store subscriptions and provide cancellation management.

Evidence and limits: Source-confirmed; storage and device cleanup were not exercised against live services. Policy references: <https://developer.apple.com/support/offering-account-deletion-in-your-app/> and <https://support.google.com/googleplay/android-developer/answer/13327111>

## H22 Paid AI coach is a simulated chat with fabricated user statistics

Location: app/src/components/coach/CoachChatView.tsx:63; app/src/components/coach/CoachChatView.tsx:119

Issue: The production route renders an in-memory sample conversation. Replies and recipe suggestions are hardcoded, usage starts at a sample count, consent defaults true and no coach backend/data-summary/tool/refusal implementation exists.

Reproduction: Open /coach with a Pro entitlement and ask 'How am I doing this week?' without logging data. The response claims six logged days and protein adherence from fixed text. Restart the screen: usage/history are recreated. Ask an unsafe dieting question: there is no implemented server refusal policy or deterministic tool pipeline.

Suggested fix: Remove the paid-feature claim until the actual backend exists, or implement the entitled, consented, tool-grounded coach with refusal tests, persistent history, deletion and cost controls before release.

Evidence and limits: Confirmed implementation gap, not a demonstrated model prompt-injection exploit: there is no live coach model integration to attack.

## H23 Partner Finder is a sample offer rather than the required safe matching system

Location: app/src/components/onboarding/PartnerFinderOfferModal.tsx:21; app/src/components/onboarding/PartnerFinderOfferModal.tsx:81; supabase/migrations/20261008000012_phase10_subscriptions_paywall_entitlements.sql:1004

Issue: The repository exposes a sample card and a local opt-in toggle, but no matching profile/request tables, banded discovery RPC, deterministic matching pipeline or full finder route. The card displays fabricated adherence. Required pool limits, mutual gender preferences, age/activity filters and note/bio filtering are not implemented as a server workflow.

Reproduction: Toggle 'Open to a partner', close and reopen the offer, and trace Set preferences. There is no persisted Finder consent/profile and no implemented browse/request/accept server flow to enforce PRD 6.24/7.12. Search migrations/functions for the required matching tables and matching RPC: only the access helper and consent type exist.

Suggested fix: Keep Finder unavailable and remove misleading paid/opt-in claims until a complete server-enforced design is implemented. Add banded response contracts, non-enumerable bounded discovery, mutual women-only/age gates, block/report, filtering and request rate limits.

Evidence and limits: Missing-feature finding. Pool scraping or women-only bypass cannot be claimed as an executed exploit of a backend that does not exist.

## H24 Local row and outbox writes are not atomic when the app is killed

Location: app/src/services/foodService.ts:415; app/src/services/foodService.ts:501; app/src/services/fastingService.ts:274

Issue: Logging writes a local mirror, related stats and outbox records in separate awaited statements without a transaction. A crash after the mirror insert but before enqueue leaves a pending row with no upload operation; crash recovery only resets existing in-flight operations.

Reproduction: While offline, terminate the app immediately after local_food_entries INSERT and before its enqueueOutbox call. Restart. The diary displays the local entry but sync has no queued entry to send. Repeat with startFast between local_fasting_sessions insertion and outbox enqueue. A new-device restore never sees those writes.

Suggested fix: Commit the local entity, dependent changes and outbox operation in one SQLite transaction. Make startup reconciliation detect orphaned pending rows and use stable operation IDs.

Evidence and limits: Source-confirmed kill-window reproduction; the app was not killed on a physical device.

## H25 Offline chat sync drops attachments and loses the server message identity

Location: app/src/services/chatService.ts:341; app/src/services/syncService.ts:235; app/src/services/syncService.ts:251

Issue: The offline queue payload only contains the message text/client ID; attachments are only sent by the immediate RPC path. Generic flushOutbox directly upserts chat_messages, ignores the generated server ID and marks the local message sent. It never uploads or registers queued attachment rows.

Reproduction: Queue an image message while the immediate send_chat_message RPC fails with a network error. Reconnect through syncAll. The generic upsert can create the text message and clear the outbox, but the server has no attachments. The local ID remains the string client ID rather than the server UUID, so subsequent delete/read-state calls can address the wrong ID.

Suggested fix: Use one idempotent chat replay pipeline for online and offline sends: upload/register attachments, call the authorized message RPC, reconcile server/local identities and only then acknowledge the queued operation.

Evidence and limits: Source-confirmed; actual image networking is also blocked by the invalid R2 signer.

## H26 RevenueCat transfer revocations are not replay-safe and failures are acknowledged

Location: supabase/functions/revenuecat-webhook/index.ts:42; supabase/functions/revenuecat-webhook/index.ts:73; supabase/functions/revenuecat-webhook/index.ts:105

Issue: The handler requires app_user_id before branching for TRANSFER, although transfer events use transferred_from/transferred_to identity fields. When reached, the branch directly lapses all source users before any event-ID/timestamp check, then ignores destination RPC errors and returns 200.

Reproduction: Send a documented TRANSFER payload with transferred_from/transferred_to and no app_user_id: validation returns 400 before the transfer branch. To exercise that branch, include app_user_id; let source A subsequently obtain a newer paid entitlement, then replay the earlier transfer. A is lapsed again before destination idempotency is checked. Force a destination apply_revenuecat_event error: the webhook still reports transferred and the provider receives success.

Suggested fix: Parse and validate each event type using its documented schema. Apply transfers atomically behind an event ID and per-subscription timestamp guard. Reconcile destination state with RevenueCat as needed; fail/retry on errors rather than returning success. Do not invent indefinite paid state from absent transfer product/expiry fields.

Evidence and limits: Source-confirmed control flow; no live billing event was submitted. Schema reference: <https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields>

# Medium findings

## M01 Public Realtime presence channels reveal room viewers

Location: app/src/hooks/useRoomFocus.ts:85; app/src/hooks/useRoomFocus.ts:121; app/src/hooks/useRoomChat.ts:193

Issue: Channels are created without private:true, and no realtime.messages membership policies are installed. Presence includes user IDs and online/viewing timestamps. Postgres table RLS does not authorize Presence.

Reproduction: With the project allowing public channels, observe a known focus:room:ROOM_UUID channel from an unrelated authenticated client and inspect presenceState while a member opens Focus. The topic is deterministic, and membership is not checked for the public presence subscription. Repeat for the chat presence topic.

Suggested fix: Use private channels with realtime.messages authorization bound to active usable-room membership; disable public channels in the project and test removal/rejoin behavior. Minimize presence fields and respect sharing settings.

Evidence and limits: Deployment-dependent: if public channels are disabled already, the present public-channel client configuration can fail instead. Reference: <https://supabase.com/docs/guides/realtime/authorization>

## M02 Final snapshot and local trackers use the wrong user day

Location: app/src/hooks/useDiary.ts:18; app/src/hooks/useWater.ts:30; app/src/hooks/useSteps.ts:31; supabase/migrations/20261008000015_phase13_fasting.sql:371

Issue: Several local Today/default date paths use the UTC date. The final snapshot computes one caller-local date outside its member loop and uses it for every member, despite their different stored time zones. Current-day targets also compare effective_from against date midnight, excluding goals created later that same day.

Reproduction: Set a New York profile and test at 2026-10-20T00:30:00Z: local time is still October 19, but the UTC-default diary/water/steps key is October 20. Compare members in New York and Kolkata: the snapshot queries both summaries using the caller's date. Create a target at 10:00 local and query that day: effective_from <= day-midnight excludes it.

Suggested fix: Use a shared stored-time-zone day helper and recompute each member day separately. Define target effective-day semantics and query the correct instant/day range. Cover midnight, DST transitions and travel.

Evidence and limits: Source-confirmed boundary examples; the server snapshot path also has the High runtime blockers already listed.

## M03 Focus totals allocate midnight sessions and pauses to incorrect days

Location: supabase/migrations/20261008000010_phase9b_focus.sql:296; packages/core/src/focus.ts:265

Issue: Server summaries and statistics group the complete session by its start date rather than splitting at local midnight. The core splitter exists but is not used by SQL. It spreads paused time proportionally across days, which cannot represent a pause that happened wholly on one side of midnight.

Reproduction: End an unpaused New York session from 2026-11-01T03:30Z to 04:30Z, spanning local midnight before the DST fallback. Expected: 30 minutes on October 31 and 30 on November 1. SQL places 60 on October 31. For a 23:30-00:30 session paused only from 00:00-00:30, expected focused minutes are 30/0; proportional allocation yields about 15/15.

Suggested fix: Store the session time zone and pause intervals. Split real UTC intervals at actual local midnight instants, subtract pause intersections and use the same algorithm for local and server statistics.

Evidence and limits: Independent interval recomputation; no physical-device timer test was performed.

## M04 Reading an expired room timer can prevent participant finalization

Location: supabase/migrations/20261008000010_phase9b_focus.sql:1088; supabase/migrations/20261008000010_phase9b_focus.sql:1499

Issue: get_room_focus changes an expired room timer to ended, but does not close participant rows or linked personal sessions. process_focus_maintenance only finalizes timers still marked active, so the first read can make that timer invisible to the cleanup pass.

Reproduction: Start a one-minute room timer, let it expire and call get_room_focus before cron runs. Then run process_focus_maintenance. Inspect room_focus_participants and linked focus_sessions: the room session was already marked ended, so its participant cleanup is skipped and personal stats may remain unfinished.

Suggested fix: Move timer completion into one transactional finalizer used by reads, user actions and cron. Make finalization repair partially ended sessions and account for active breaks.

Evidence and limits: Source-confirmed timing/interleaving; joining the timer currently also encounters the missing capacity helper.

## M05 Focus start and rejoin do not preserve session invariants

Location: supabase/migrations/20261008000010_phase9b_focus.sql:548; supabase/migrations/20261008000010_phase9b_focus.sql:742; supabase/migrations/20261008000010_phase9b_focus.sql:764

Issue: Starting room focus checks a count without locking or a unique active-room constraint, allowing concurrent starters. A rejoin preserves the old joined_at and paused_seconds while clearing left_at; the linked personal session similarly reopens its original start time, counting time spent absent.

Reproduction: Race two start_room_focus calls in the same room when no session exists: both can see zero before inserting. For rejoin, focus 10 minutes, leave for 60 and rejoin. End after another 10: preserved start timestamps can count the absent hour. Calling join while already on break also reactivates status without settling last_paused_at.

Suggested fix: Enforce one active session per room with a partial unique index and transaction lock. Represent participation as intervals or accumulate completed spans before rejoin. Make duplicate join calls idempotent and validate participant caps inside the same lock.

Evidence and limits: Source-confirmed race and interval logic. End-to-end join reproduction first requires correcting the missing get_room_member_cap helper.

## M06 Focus and room snapshot subscriptions are not published by migrations

Location: app/src/hooks/useRoomFocus.ts:91; app/src/hooks/useRoomSnapshot.ts:78; supabase/migrations/20261008000008_phase8_room_chat.sql:981

Issue: The migrations add only chat_messages and chat_read_state to supabase_realtime. The focus and room snapshot hooks subscribe to other tables without repository publication setup, so fresh deployments do not deliver those events.

Reproduction: Start from the repository migration set. Query pg_publication_tables for supabase_realtime and confirm the focus/snapshot tables are absent. Open the same room on two clients and start/pause focus or change a subscribed room property: the second client does not receive the expected database event.

Suggested fix: Add explicit, privacy-safe publication/broadcast setup in a migration. Verify fresh-install Realtime behavior for two members and a stranger; do not expose sensitive base rows just to make events arrive.

Evidence and limits: Source-confirmed deployment gap; manually configured dashboard publications could differ.

## M07 Step permission and hardware readings are simulated in the production service

Location: app/src/services/stepIntegrationService.ts:53; app/src/services/stepIntegrationService.ts:96; app/src/hooks/useSteps.ts:41

Issue: requestStepPermissions writes granted to SecureStore without requesting OS health permissions. readDeviceSteps always returns zero with a health_platform label. The hook also derives stride from a fixed 170 cm/other profile, not the actual user.

Reproduction: On a native build, tap the step permission action: the service records a grant without invoking HealthKit/Health Connect/pedometer APIs. Walk and refresh steps: it returns zero. Depending on source-priority handling, this zero-valued higher-priority reading can supersede manually entered data.

Suggested fix: Implement real platform permission/read/background adapters, represent unavailable readings honestly and use the stored user height/sex for stride. Verify denied/revoked permissions and source deduplication on both platforms.

Evidence and limits: The fake service is source-confirmed; device-specific resulting UI behavior requires real-device validation.

## M08 Privacy screen discoverability and leaderboard switches do not persist

Location: app/src/components/rooms/PrivacySettingsModal.tsx:209; app/src/components/rooms/PrivacySettingsModal.tsx:216

Issue: These switches only mutate component state. They do not call profile discovery settings or the leaderboard opt-out RPC. The meals switch also changes share_calories_macros instead of share_meals, so its meaning does not match its storage.

Reproduction: Open room privacy, turn off discoverability and leaderboard visibility, then query the stored profile and leaderboard_settings or reopen/remount the screen. They retain the server defaults. Toggle the meals-related switch and inspect the outgoing patch: it updates calorie/macros sharing rather than the meal-sharing policy.

Suggested fix: Read and persist the correct server preferences, show pending/error state and roll back failed changes. Give meal visibility its own never/per-meal/always control and make the preview use the real policy.

Evidence and limits: Source-confirmed control wiring; cosmetic controls must not be presented as privacy guarantees.

## M09 Weight graphs return raw weights as a trend instead of a moving average

Location: supabase/migrations/20261008000015_phase13_fasting.sql:740; supabase/migrations/20261008000015_phase13_fasting.sql:752

Issue: The final progress RPC labels each raw weight as trend_weight_kg and uses the latest raw measurement as the current trend. PRD 7.8 requires a seven-day moving average when at least three entries exist.

Reproduction: Log consecutive weights 70, 72 and 74 kg within a seven-day window. Independently compute the third-day mean: 72 kg. get_individual_progress builds a third-day trend point of 74 and bases goal progress on the latest raw weight. The separate weekly pace/projected date fields are initialized without implementing the required trend calculation in this replacement.

Suggested fix: Compute the required rolling window and date-aware trend in the shared deterministic logic and server summaries, with independent numeric checks. Do not label raw data as a calculated trend.

Evidence and limits: Source-confirmed; the RPC first encounters the already-reported goal column error on the current schema.

## M10 Room consistency score uses a seven-day denominator for arbitrary ranges

Location: supabase/migrations/20261008000007_phase7_progress_streaks_leaderboards.sql:1283

Issue: get_room_progress counts logged and goal days across its selected 30/90/180-day range, then divides both counts by seven. A member with seven good days in a month can appear to have a perfect period consistency score. Weekly division selection also uses the goal at week end rather than week start.

Reproduction: Seed seven logged goal days and 23 missed days in a 30-day period. The range summary calculates min(100,100\*(0.4\*7/7+0.6\*7/7))=100, although those same days in a 30-day period correspond to 23.3% period adherence. Change a user's goal midweek: compute_weekly_scores selects effective_from <= week_end for division.

Suggested fix: Specify whether room summaries show the last completed weekly score or a normalized period measure, then implement that definition. Freeze leaderboard division using the week-start goal.

Evidence and limits: The independent PRD weekly formula itself passes for legitimate seven-day inputs. These are range/selection defects; room progress also has the High schema blocker.

## M11 Chat cache retains content excluded by current block and mute rules

Location: app/src/services/chatService.ts:226; app/src/services/chatService.ts:48

Issue: Local messages are cached by room without a viewing-user scope or privacy version. Server-filtered omissions are merged into that cache rather than removing inaccessible messages. Signing out does not clear it.

Reproduction: Read B's messages as A, then block or mute B and reload the chat. The server RPC omits B's messages, but the merge retains the previously cached local copies. On an offline error the same cache is returned. Switching accounts on one device also reuses room-keyed cached content if that room is opened.

Suggested fix: Partition private caches by authenticated account, invalidate/refilter them when block/mute/membership changes and distinguish authorization failures from offline failures. Preserve only the content the current viewer is allowed to access.

Evidence and limits: Source-confirmed cache behavior. Offline revocation of data already legitimately seen cannot be guaranteed, but the application must stop deliberately redisplaying it after it learns of a block or account switch.

## M12 Export My Data returns fabricated records

Location: app/src/components/profile/ExportDataModal.tsx:27

Issue: The export control shares one hardcoded diary row dated October 18 with fixed calorie/step values, while the UI promises a complete food, weight, step and workout export.

Reproduction: Log distinguishable food, water, weight and workout entries. Open Export My Data in CSV and JSON modes. The shared output contains the fixed sample data instead of the account records.

Suggested fix: Generate a real, owner-scoped export from the appropriate local/server sources, include the promised categories and verify row counts. Remove the export-success claim until implemented; keep any legally required data-request route accessible.

Evidence and limits: Source-confirmed. This is an inaccurate product/data-access claim, rather than proof about any jurisdiction-specific legal duty.

## M13 Image metadata stripping and object deletion are not implemented on the server

Location: supabase/functions/chat-image-moderation/index.ts:2; supabase/migrations/20261008000008_phase8_room_chat.sql:438

Issue: The moderation endpoint imports stripImageExif but never downloads, decodes, strips or rewrites the object. The message deletion trigger removes attachment records only. No R2 object deletion path was found in those flows.

Reproduction: Upload a GPS-tagged image directly using the granted object path, bypassing the normal client compressor. Invoke moderation: no object bytes are inspected or rewritten. Delete the message and inspect the bucket: a SQL DELETE cannot remove that object. Reusing the known key is additionally enabled by the signing-authorization defect.

Suggested fix: Use an upload-quarantine pipeline that verifies bytes/type/size, decodes and re-encodes metadata-free images before approval, and performs retryable object deletion on message/account/retention cleanup.

Evidence and limits: Source-confirmed pipeline gap; a live private bucket was unavailable and the invalid signer currently blocks ordinary uploads.

## M14 Hot paths repeatedly query members and messages instead of batching

Location: supabase/migrations/20261008000015_phase13_fasting.sql:388; app/src/services/chatService.ts:83; supabase/migrations/20261008000007_phase7_progress_streaks_leaderboards.sql:1118; app/src/services/foodService.ts:47

Issue: Room snapshots/progress issue multiple queries per member, and local chat performs one attachment query per message. Functions accept unbounded page/selected-member inputs. Initial food seeding runs batches without an atomic completion marker; one partial successful batch causes later launches to treat the seed as complete.

Reproduction: Load 50 cached chat messages and trace SQLite: each message adds an attachment SELECT. Request a large-room/year progress range or oversized p_page_size and count the per-member queries/payload. Interrupt first food seeding after one batch; relaunch: the count>0 shortcut skips the remaining bundled foods.

Suggested fix: Batch joins/aggregations and attachment reads, enforce server page/range/selection bounds and add indexes based on real EXPLAIN ANALYZE results. Make bundled seeding transactional or resumable with a version/completion marker.

Evidence and limits: Query shape and partial-seed behavior are source-confirmed. Startup latency, production query plans and payload sizes were not benchmarked; no unsupported numerical performance claims are made.

## M15 Pricing rules disagree across the PRD, paywall and final database

Location: docs/prd.md:1000; docs/CaliPartner_Pricing_Plan.md:460; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:18; supabase/migrations/20261019000001_pricing_v2_per_person_plans.sql:305

Issue: The PRD specifies room-paid access with free members and Plus/Pro caps of 20/50. The pricing proposal switches to per-person access, while the final migration reduces caps to 10/20 and retains room-wide paid helpers. The paywall still promises 20/50. The older two-argument join_by_code overload is retained and does not enforce the newer one-argument plan rule.

Reproduction: Compare the Pro/Plus benefits shown in PaywallModal with room_tier_configs after the latest migration: the server caps are smaller than the advertised limits. As a free account, call join_by_code with p_code and p_device_hash to route to the legacy overload; it permits joining where the newer signature raises PLAN_REQUIRED, subject to remaining capacity/schema blockers. Create a paid-member room then expire only that member entitlement: room-level chat/focus checks do not enforce the new per-person paused-member model.

Suggested fix: Approve one authoritative billing/access contract before release, update PRD and catalog, and migrate existing paid rooms without reducing promised access. Remove or align legacy overloads. Enforce that contract consistently in server policies, lifecycle, paywall, restore and takeover.

Evidence and limits: Product/source mismatch, not a recommendation to choose either pricing model. Free member access is correct under the PRD and a bypass under the newer pricing proposal, which is why the contract must be resolved.

## M16 Focus clock correction is lost on restart and does not handle in-session clock jumps

Location: app/src/services/focusService.ts:86; app/src/services/focusService.ts:125; app/src/hooks/usePersonalFocus.ts:61

Issue: The server offset is process-local and timer ticks use wall-clock Date.now. A system clock change after synchronization changes elapsed time immediately; an offline restart resets the offset to zero. There is no monotonic elapsed anchor or persisted correction.

Reproduction: Start focus with a successful server-clock sync. Advance the device clock by one hour while the timer is running: getServerCorrectedNow and elapsed time also advance by one hour until another sync. Start with a skewed device clock, kill the app and reopen offline: the stored session survives but the cached correction does not, so its elapsed time is computed against the skewed clock.

Suggested fix: Anchor running elapsed time to a monotonic clock plus a server epoch, persist the best-known correction/anchor for recovery and resynchronize on foreground/network restoration. Treat large wall-clock changes explicitly. Keep room completion authoritative on the server.

Evidence and limits: Source-confirmed clock arithmetic; physical-device kill/restart and OS clock-change tests remain required.

# Low findings

## L01 Hardcoded copy and fixed-size controls need an accessibility and localization pass

Location: app/src/components/onboarding/PartnerFinderOfferModal.tsx:60; app/src/components/profile/ExportDataModal.tsx:78; app/src/components/coach/CoachChatView.tsx:84

Issue: Several screens bypass the i18n layer with hardcoded English and decorative punctuation. Custom segmented/modal controls and charts require a complete VoiceOver/TalkBack and 200% text-size check; static UI tests do not establish that behavior.

Reproduction: Switch supported language settings and open Finder offer, export and coach: these strings remain hardcoded. At 200% font size on a small device, traverse those modals and segmented controls with the screen reader, checking clipping, focus order, hit targets and chart summaries.

Suggested fix: Move visible strings into i18n, use semantic labels/roles/states and flexible text layouts, then perform real-device accessibility acceptance. File additional concrete layout bugs from that pass rather than treating this source review as a certification.

Evidence and limits: Hardcoded-string defects are confirmed; particular device clipping/crash outcomes were not tested.

# Independent calculation checks

PRD 7.2 recomputed directly: raw BMR = 10 x 70 + 6.25 x 175 - 5 x 25 + 5 = 1673.75; rounded BMR = 1674; TDEE = round(1673.75 x 1.55) = 2594. Cut 0.5 kg/week: daily change = 0.5 x 7700 / 7 = 550; target = 2044 kcal. Protein = 140 g; fat energy = 511 kcal, rounded fat = 57 g; remaining carbohydrate = 973/4 = 243.25, rounded to 243 g. Actual calculator output matched these controls.

PRD 7.3 recomputed directly: 5 logged days and 3 goal days produce 100 x (0.4 x 5/7 + 0.6 x 3/7) = 54.2857, or 54.3 to one decimal. Two entries and 1000 kcal against a 2000 target qualify as logged; one entry does not. Cut intake 1700/2000 = 85% qualifies as a goal day; 1699/2000 does not. These boundary controls passed. Rate-cap, unsafe persistence, trend and SQL integration failures are separate findings.

# Coverage and remaining evidence

| **Requested area**             | **Review outcome**                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS and SQL functions          | Public privileged mutation and arbitrary-owner reads are Critical. Many functions pin public, pg_temp; some trigger helpers do not pin a path, but no separate exploitable search_path attack was established. Owner-only health base-table policies exist; function access bypasses those protections. |
| Room health data, chat, images | Food/focus disclosure, focus base-row access, historical feed events, aggregates, chat idempotency and image authorization fail privacy boundaries. No claim is made that a stranger can directly read every health base table.                                                                         |
| Entitlements and capacity      | Grant/apply functions, final snapshot gate, plan attachment reuse, create races, legacy overloads and join FOUND are covered. Older room join paths take room row locks; a universal same-room join-cap race was not established.                                                                       |
| Webhooks                       | Missing-secret forgery and transfer replay/error handling are covered. Ordinary apply_revenuecat_event has event-ID and timestamp checks; they do not protect its direct public invocation or the separate source-user transfer update.                                                                 |
| AI costs and injection         | Non-atomic quotas, unaccounted failures, client test-output injection and service-role food disclosure are covered. Photo prompt/output defenses exist but were not tested against a provider-backed adversarial image corpus. Coach refusals cannot be certified because its backend is absent.        |
| Offline and calculations       | In-flight loss, local/outbox atomicity, delta cursor ties, incomplete entity pulls, guest migration and chat replay are covered. Independent PRD numeric controls passed. Multi-device conflict/account-switch and full kill recovery remain integration checks.                                        |
| Safety and rankings            | Rate cap, persisted floors/rates/BMI checks, fasting eligibility and trend/period-score failures are listed. No prohibited weight-loss/lowest-calorie ranking implementation was established.                                                                                                           |
| Performance and mobile         | Per-member/per-message query patterns, input limits, partial seeding and large ranges are covered. No measured startup budget, memory profile or real-device crash rate was available. Loading/error/empty components exist, but full UI-state and accessibility acceptance is not certified.           |
| Secrets                        | No confirmed production AI key, service-role key or private key was found in the scanned text/path files; matched key-like test material was in a test. This was not a full historical git-secret scan or a release APK/IPA/JS-bundle scan. No release binary was generated.                            |
| Store policies                 | UGC filtering, misleading purchase claims, simulated health/coach content, fake export and incomplete deletion are material review risks. Relevant official store guidance is linked with the findings. Actual store forms, listing age rating and health declarations were unavailable.                |
| Partner Finder                 | A production matching backend is absent. Banded-card enforcement, scraping resistance, mutual women-only preferences, age gate and note/bio filtering remain unimplemented acceptance requirements, rather than executed attacks on a nonexistent backend.                                              |
| Focus                          | Personal-stat access, base-table privacy, public presence, missing publications, clock drift/restart, race/rejoin accounting, timer completion and midnight splitting are covered. Physical-device background, notification and restart verification remains required.                                  |

# Manual release validation still needed

After fixing the findings: clean-install dependencies and run every repository check; migrate a disposable real Supabase instance and execute the SQL/RPC reproductions with anon/authenticated/service_role ACLs; validate real private R2 upload/download/moderation/deletion; exercise store sandbox purchase, restore, refund and transfer events; verify private Realtime settings; and test Android/iOS offline, kill/restart, DST, camera, accessibility and deletion.

Verify webhook gateway settings explicitly. RevenueCat uses a shared Authorization secret, while Supabase gateways may require a Supabase JWT unless configured otherwise. The repository does not declare a revenuecat-webhook verify_jwt override, so test the gateway and handler together.

Reconcile the privacy policy and health-data declarations with actual data flows and AI provider terms. Confirm external account-deletion requests, active-subscription cancellation messaging, and native rating prompts without incentives or sentiment filtering. These external configurations and outcomes were unavailable for this review.

# Delivered changes

Only this findings document is retained. Temporary review tests and logs were removed. Existing application code, migrations, tests, local edits and untracked font assets were preserved. No fixes, refactors, deployments, purchases or external messages were made.