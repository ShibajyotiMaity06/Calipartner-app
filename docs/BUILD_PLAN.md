# CaliPartner — Master Build Plan (copy-paste prompts)

Put this file at `/docs/BUILD_PLAN.md`, the PRD at `/docs/PRD.md`, and `AGENT_RULES.md` in the repo root.

---

## 1. How to work (the loop)

For every phase:

1. **New chat/session per phase.** Paste only that phase's prompt. Never paste the whole plan.
2. **Sonnet 5.5 (Medium) builds** the logic: database, RLS, Edge Functions, sync, calculations, tests, integrations. Prompt "A".
3. **Gemini 3.8 Flash builds the screens** (only where a Prompt "B" exists), using the hooks and types Sonnet created. It must not change logic.
4. **You run it on a real phone** and go through the test checklist.
5. **GPT reviews** with the review prompt (Section 5) plus the phase's "review focus". It finds problems; it does not rewrite.
6. **Sonnet fixes** what GPT found (fix prompt, Section 5). Re-run tests.
7. **Commit and tag** (`phase-3-done`). Then the next phase.

**Which model for what**

| Work | Model |
|---|---|
| Database schema, RLS, SQL functions, Edge Functions, sync, formulas, integrations, tests, security fixes | Sonnet 5.5 Medium |
| Screens, components, styling, charts layout, empty/loading/error states, animations, accessibility pass | Gemini 3.8 Flash |
| Independent review, attack testing (privacy, entitlement bypass), test ideas | GPT |

**Golden rules**
- One phase at a time. If an agent starts building something from a later phase, tell it to stop and revert that part.
- Never paste API keys, service-role keys or passwords into a prompt. They go in `.env` files and Supabase secrets.
- If a phase is too big for one session, split it at the "BUILD" bullets and say "do bullets 1–4 now".
- After every phase: lint + typecheck + all tests green before you move on.

---

## 2. What I changed from your reference plan

| Reference plan | Here | Why |
|---|---|---|
| Node + Express + MongoDB | **Supabase (Postgres)** | Rooms, requests, privacy and leaderboards are relational; RLS enforces privacy in the database; free to start. |
| Socket.IO for chat | **Supabase Realtime** | No extra server to run. |
| Offline mode in Phase 14 | **Offline-first from Phase 3** | Retrofitting sync later is painful and causes duplicate/lost data. |
| Progress before Rooms | **Rooms right after tracking (Phase 5)** | Rooms are your USP. Test the partner effect with friends early. |
| Subscriptions at the end | **Entitlement logic in Phase 5, real purchases in Phase 10** | Server-side gating must exist before features that depend on it. |
| "Terra" reviewer | **GPT** | The model you have access to. |
| Missing | Usernames + requests, fasting, recipes, AI coach, rate-us, annual plan, email-code login | In PRD v0.3. |
| Challenges in launch | **After launch** | PRD marks challenges P1. |

---

## 3. Your manual tasks (agents can't do these)

| When | You do |
|---|---|
| Before Phase 0 | Install Node LTS, Git, Docker Desktop, Supabase CLI, Android Studio (and Xcode if you have a Mac). Create GitHub repo, Expo account. |
| Before Phase 1 | Create Supabase project (Mumbai region if most users are in India). Create Google Cloud OAuth client; Apple Developer account ($99/yr) for Sign in with Apple. Pick an email sender (Resend or Brevo), verify your domain (SPF/DKIM/DMARC), add its SMTP details in Supabase Auth settings. |
| Before Phase 3 | Prepare IFCT/popular Indian foods data as CSV (agent writes the importer). Get a USDA FoodData Central API key (free). |
| Before Phase 4 | Nothing new (Health Connect/HealthKit permissions come at release). |
| Before Phase 6 | Choose the exercise dataset (check its licence) or give the agent a curated CSV. |
| Before Phase 8 | Create Cloudflare account and R2 buckets (private chat bucket, public recipe bucket); API keys into Supabase secrets. |
| Before Phase 9 | Create Firebase project, enable Cloud Messaging, upload APNs key (iOS), put the service account into Supabase secrets. |
| Before Phase 10 | Google Play Console ($25 once): create the app and 3 subscription products. App Store Connect: create 3 subscription products; enrol in the Small Business Program. RevenueCat project, products, webhook secret. |
| Before Phase 11 and 14 | Choose AI provider, create API key, put it in Supabase secrets. Check the provider's data/training terms. |
| From Phase 12 | Start writing the recipes (target 150) and shooting photos NOW. This is the slowest task in the whole project. |
| Phase 17 | Privacy policy and terms (have a lawyer review), store listings, Data Safety/Privacy labels, Health Connect declaration, support email, deferred deep-link provider account. |

---

## 4. Phase prompts

> Every prompt starts with the same two lines so it can be pasted on its own.

---

### PHASE 0 — Foundation
**Models:** Sonnet (build) · **Size:** S

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 11 (Technical Approach) and 9 (Non-Functional). The repo is empty except docs. Build ONLY Phase 0. Do not build any product feature.

GOAL: a clean, running foundation.

BUILD:
1. Monorepo layout from AGENT_RULES.md: /app (Expo + React Native, TypeScript strict, Expo Router, expo-dev-client, EAS config with development/preview/production profiles), /supabase (supabase init, config, empty migrations folder, functions folder, seed, tests folder), /packages/core (pure TypeScript with Vitest or Jest), /docs.
2. Tooling: ESLint, Prettier, strict tsconfig, path aliases, Vitest/Jest, GitHub Actions CI running lint + typecheck + tests for app and core.
3. App foundation: Supabase client singleton, environment config via app.config.ts (only EXPO_PUBLIC_* non-secret values) plus .env.example, global error boundary, loading/error components, logger, network-status hook, i18n scaffold (English; no hard-coded strings), theme tokens (neutral palette, light/dark), navigation skeleton with 5 placeholder tabs: Today, Room, Log (+ center button), Progress, Me.
4. Local database: expo-sqlite setup with a simple versioned migration runner and an empty "outbox" table (id, entity, operation, payload JSON, created_at, attempts, last_error).
5. Supabase: local dev via CLI, one sample migration, one `health` Edge Function. The app calls it on the Today placeholder and shows "Connected".
6. README with exact setup commands (install, run Supabase locally, run app, run tests, build a dev client).

DO NOT BUILD: auth, any real screens, any feature tables.

DONE WHEN: the app runs on an Android emulator via a development build, calls the local health function, CI passes, README is accurate.
Finish with the end-of-session report from AGENT_RULES.md.
```

**Test checklist (you):** app opens on your phone/emulator; tabs switch; "Connected" shows; `npm test` passes; CI is green on GitHub.
**Review focus (GPT):** repo hygiene, secrets not committed, strict TS really on, CI actually runs tests.

---

### PHASE 1 — Login, profile, username, RLS test harness
**Models:** Sonnet (build) · **Size:** M · **PRD:** AUTH-1..7, USR-1..4, 8.1, 8.2

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.1 (AUTH-1..AUTH-7), 6.7 (USR-1, USR-2, USR-3, USR-4, USR-9) and 8.1–8.2. Inspect the existing code before changing anything. Build ONLY Phase 1.

BUILD:
1. Supabase Auth setup (config as code where possible): email 6-digit code login (passwordless), Google, Apple. NO phone auth. Document in README the manual dashboard steps I must do (Google/Apple credentials, custom SMTP).
2. `profiles` table (id = auth.users.id): username (citext, unique, 3–20 chars, letters/numbers/underscore/period, no leading/trailing period or underscore, no double periods, reserved/offensive words blocked), nickname, avatar_url, date_of_birth, sex, height_cm, units, timezone, country, discoverable (default true), created_at. Enforce rules with DB constraints/functions, not only in the app.
3. Username functions: `is_username_available(text)` (rate limited), `search_users(prefix)` (min 3 chars, max 10 results, returns only avatar/nickname/username, respects `discoverable`, excludes blocked users, rate limited), change-username rule (once per 30 days; released name held 30 days).
4. Age gate: DOB required; users under 18 are rejected server-side (DB/function), not just in the UI.
5. Disposable-email blocking at sign-up (auth hook or Edge Function) with a maintainable blocklist.
6. Guest mode: the app lets a new user use local-only features before signing in; provide the hook/service that migrates local data to the account after sign-in (test it with a placeholder entity).
7. Account deletion Edge Function (deletes user data and the auth user; idempotent).
8. Functional (plain, minimally styled) screens: sign-in with email code, Google/Apple buttons, choose username (live availability), DOB/age gate, profile edit, delete account, sign out. Session persisted securely (SecureStore).
9. RLS: enable on every table. Build the RLS TEST HARNESS (SQL tests, e.g. pgTAP or a script) with a helper to run assertions as different users. Tests: user A cannot read/update user B's profile beyond the public search fields; unauthenticated access denied; under-18 blocked; username uniqueness is case-insensitive; search rate limit.

DO NOT BUILD: onboarding, goals, food, rooms, subscriptions, profile photos upload.

DONE WHEN: I can sign up with an email code, pick a username, sign out/in, delete the account; all RLS tests pass; lint/typecheck/tests green.
Finish with the end-of-session report.
```
**Manual (you):** configure SMTP + Google/Apple in Supabase dashboard.
**Test checklist:** sign up with a real email and receive the code in <30 s; wrong code rejected; try an under-18 DOB; try a disposable email; two usernames differing only by case; delete account then try signing in.
**Review focus (GPT):** auth bypass, username enumeration, rate limits, RLS gaps on `profiles`, under-18 bypass, deletion leaving orphan data.

---

### PHASE 2 — Onboarding and targets calculator
**Models:** Sonnet (build) · Gemini (screens) · **Size:** M · **PRD:** 6.2, 7.2

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.2 (ONB-1..ONB-11) and 7.2 (calculation rules, worked example). Inspect existing code. Build ONLY Phase 2 logic.

BUILD:
1. In /packages/core: pure, deterministic functions with full unit tests:
   - age from DOB; unit conversions (kg/lb, cm/ft-in)
   - BMR: Mifflin-St Jeor (male +5, female -161, other -78); Katch-McArdle when body-fat % is given
   - TDEE with multipliers 1.2 / 1.375 / 1.55 / 1.725 / 1.9
   - daily change = rate_kg_per_week * 7700 / 7; targets for cut/maintain/bulk
   - safety rules: calorie floor 1200 (female) / 1500 (male) / 1350 (other); weekly cap 1% of body weight for cut and bulk; bulk advisory above 0.5% bw/week; large-deficit advisory above 25% of TDEE; BMI guard (no cut below BMI 18.5); target-date check returning required rate or earliest realistic date
   - macros: protein 2.0 / 1.6 / 1.8 g/kg (cut/maintain/bulk); fat 25% of kcal but never below 0.6 g/kg; carbs the remainder; 4/4/9 kcal per gram
   - function that returns all preset rates with `available` + `reason` + `target_kcal` for each
   GOLDEN TESTS must reproduce the PRD worked example exactly: male, 25y, 175cm, 70kg, moderate -> BMR 1674, TDEE 2594; cut 0.25/0.5/0.75 -> 2319/2044/1769; cut 1.0 unavailable (floor); bulk 0.25/0.5 -> 2869/3144; bulk 0.75 unavailable (cap 0.70); cut 0.5 macros 140g / 57g / 243g. Add edge cases (lb inputs, other-sex, body-fat input, very light/heavy users, target-date too aggressive).
2. Supabase: `goal_profiles` table (history rows with effective_from; current = latest), `health_screening` table (private; pregnancy/breastfeeding, diabetes/medication, eating-disorder history; never readable by anyone but the owner), Edge Function `calculate-targets` that calls the SAME core module. Recompute trigger rules from 7.2 (weight change >= 2 kg or goal/rate/activity edit) with user confirmation recorded.
3. App: onboarding state machine and a `useTargets()` hook + services. Works offline (uses core directly) and syncs the result to the server.
4. RLS + tests for the new tables (owner-only).

DO NOT BUILD: food logging, Today content, rating prompt, adaptive recalibration.

DONE WHEN: all golden tests pass; server and app return identical numbers for the same inputs (add a test that compares them).
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)** — after Sonnet finishes
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md sections 6.2 and 6.24. You work on the VIEW LAYER ONLY. Do not edit /packages/core, /supabase or any hook; if something is missing, tell me.

Build the onboarding screens using the existing onboarding hooks: goal choice (cut/maintain/bulk), body stats (units toggle), activity level with plain-language descriptions ("choose based on a typical week including workouts"), rate picker showing each rate with its exact daily calories and a clear disabled state with the reason when unavailable, target weight/date with the "earliest realistic date" message, a "How we calculated this" screen showing formula, inputs and result, optional private health-screening questions with a short explanation of why we ask, and a final targets summary screen.
Tone: calm and supportive; never shame. Include loading, empty and error states, accessibility labels and testIDs. Use the theme tokens; no hard-coded strings (i18n).
Finish with a list of files changed.
```
**Test checklist:** try your own numbers and compare with a spreadsheet; try an extreme rate; try lb/ft units; kill the app mid-onboarding and reopen.
**Review focus (GPT):** recompute 10 random cases independently and compare; floors/caps can't be bypassed via the API; screening data is private.

---

### PHASE 3 — Food, logging and the offline-first layer
**Models:** Sonnet (build) · Gemini (screens) · **Size:** L · **PRD:** 6.3, 6.4, 7.8, NFR

**Prompt A (Sonnet) — data and sync**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.3 (LOG-1..LOG-16), 6.4 and 9. Inspect existing code. Build ONLY Phase 3 data/logic (screens come in the next prompt).

BUILD:
1. Tables + RLS: `foods` (source: ifct/off/usda/user, name, brand, barcode, serving units incl. household units, nutrients per 100 g, owner_id for custom foods, attribution), `food_entries` (client-generated UUID, user_id, food_id, meal_section in breakfast|lunch|dinner|snacks|extra, quantity, unit, nutrient snapshot columns, logged_at UTC, local_date, source search|scan|photo|history|copy|recipe, shared_meal_id nullable, updated_at, deleted_at), `user_food_stats` (use_count, last_used_at, last_quantity, last_unit, last_meal_section), `saved_meals`. Owner-only RLS; custom foods private to owner.
2. Food import tooling: a script to import IFCT/popular foods from a CSV (I will supply; also generate a 100-food dev seed) and to export a compact bundled SQLite food index for instant OFFLINE search shipped inside the app.
3. Edge Function `food-lookup`: barcode via Open Food Facts, text fallback via USDA FoodData Central; cache results into `foods`; store attribution; rate limit; never load the full public databases.
4. OFFLINE-FIRST SYNC LAYER (generic, reusable by later phases): local SQLite mirror of entries with `sync_state`; outbox queue; idempotent upserts by client UUID; exponential-backoff retry; last-write-wins using updated_at; soft deletes; network detection; background sync trigger; pull of changes since last sync; failed-sync recovery; survives app kill mid-sync.
5. Hooks/services: useDiary(date) with daily totals and per-section subtotals, useAddEntry/useEditEntry/useDeleteEntry, useFoodSearch (local first, then remote), usePreviouslyLogged (sort Recent/Frequent/A-Z, filter by section, search, remove from history without deleting entries, last-used quantity, one-tap add), useSectionSuggestions (top foods per section over the last 30 days by frequency), custom food create/edit (edits never change past entries), copy meal/day, barcode scan service (expo-camera).
6. Tests: unit tests for quantity scaling and totals; sync tests simulating offline->online, online->offline, app killed mid-sync, duplicate requests, same entry edited twice; RLS tests (user A cannot read B's entries or custom foods).

DO NOT BUILD: UI polish, recipes, AI photo, rooms, shared meals (field only), water/steps/weight.

DONE WHEN: with airplane mode on I can search bundled foods, log into all 5 sections, edit/delete, restart the app, then reconnect and see everything sync exactly once.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash) — screens**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md sections 6.3 and 6.4. VIEW LAYER ONLY: do not edit hooks, /packages/core or /supabase.

Build, using the existing hooks: the Today screen (calorie ring, macro bars, five meal sections Breakfast/Lunch/Dinner/Snacks/Extra with subtotals and add buttons, date navigation), the Log bottom sheet with tabs Search | Scan | Photo (placeholder) | Previously logged | My Foods, the quantity screen (units incl. bowl/katori, live nutrient preview, meal section picker), the Previously logged list with a one-tap "+" that adds with the last-used quantity (tap row to change quantity), section suggestions at the top of each section, the barcode scan screen, custom food form, edit/delete entry, copy meal/day sheet.
Design: fast and uncluttered; big touch targets; skeleton loaders; empty states that explain what to do; offline banner; sync status icon (synced/pending/failed with retry). Accessibility labels and testIDs. No hard-coded strings.
Finish with a list of files changed.
```
**Manual (you):** supply the IFCT/popular foods CSV; add USDA key to Supabase secrets.
**Test checklist:** airplane-mode logging for a day; barcode scan a real packet; log the same food 3 times and check it shows in Previously logged with last quantity; kill the app during sync; use two phones on one account and edit the same entry.
**Review focus (GPT):** duplicate/lost entries, time zone and local_date errors around midnight, RLS on custom foods, sync conflict behaviour, food cache poisoning.

---

### PHASE 4 — Water, weight, steps and distance
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** 6.5, 7.8

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.5 (WAT-1..WAT-5, STP-1..STP-5, TRK-1, TRK-2) and 7.8. Inspect existing code. Build ONLY Phase 4 logic. Reuse the Phase 3 sync layer.

BUILD:
1. Tables + RLS + sync: `water_logs`, `weight_logs`, `activity_days` (steps, distance_m, source, one row per user per local date, merge-safe).
2. /packages/core (with tests): default water goal (35 ml x kg, rounded to 250, min 1500, max 4000); stride length (height x 0.415 male / 0.413 female / 0.414 other); distance from steps; informational walking calories (0.5 x kg x km); weight trend (7-day moving average, raw if fewer than 3 entries); weekly pace; projected date to target (only if pace points to target and >= 0.05 kg/week); goal progress %.
3. Steps: Health Connect (Android) and HealthKit (iOS) integration through well-maintained libraries, with source priority: health platform > phone step sensor/pedometer > manual entry; de-duplicate sources; platform-measured distance beats calculated distance; permission request flow and denied-state handling; background-safe sync.
4. Hooks/services: useWater(date), useWeight(), useSteps(date), derived metrics.
5. Tests: dedupe of overlapping sources, time zone/date-boundary cases, weight trend math, offline sync of all three.

DO NOT BUILD: charts (Phase 7), notifications/reminders (Phase 9), room sharing.

DONE WHEN: water/weight/steps work offline, steps appear from the phone, no double counting, metrics match the formulas.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section 6.5. VIEW LAYER ONLY.
Using the existing hooks build: Today cards for water (quick-add 250 ml / 500 ml / 1 L / custom, undo, progress), steps and distance (progress to goal, source indicator), weight entry sheet with a simple trend summary (start, current, change, weekly pace, projected date or "not enough trend yet"), history lists with edit/delete, and the permission explanation screens for Health Connect / HealthKit including the denied state with a "how to enable" help. Loading/empty/error states, accessibility, testIDs, i18n.
```
**Test checklist:** walk 200 steps and watch it update; deny health permission and use manual entry; add weight 3 days in a row; change phone time zone.
**Review focus (GPT):** duplicate step counting, midnight/time-zone bugs, bad weight outliers, permission-denied crashes.

---

### PHASE 5 — Rooms, usernames, requests, privacy, side-by-side view
**Models:** Sonnet (5A, then 5B) · Gemini (5C) · **Size:** L · **PRD:** 6.7, 6.8, 6.9, 6.11, 6.12, 6.13, 7.1, 7.6
**This is your USP. Be strict about security.**

**Prompt 5A (Sonnet) — data, privacy, entitlement logic**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.7 (USR-5..USR-8), 6.8, 6.11, 6.13, 7.1 and 7.6. Inspect existing code. Build ONLY the database/logic part of Phase 5.

BUILD:
1. Tables + RLS: `rooms`, `room_members` (role host|member, status active|locked|paused|left, per-data-type privacy settings with the PRD 6.13 defaults), `room_requests` (type invitation|join_request, status pending|accepted|declined|expired|cancelled, expires_at 14 days), `blocks`, `reports`, `shared_meals` (+ participants with pending|accepted|declined), `room_events`, `reactions`, `nudges`, `daily_summaries` (user_id, local_date, calories, macros, steps, water_ml, workout_minutes, weight_kg nullable, logged_day, goal_day) maintained by triggers/functions from the underlying logs.
2. ENTITLEMENT STUB (real purchases come in Phase 10): `entitlements` table (user_id, plan, source apple|google|dodo|none, status trial|paid|grace|free, period_end), `device_trials`, and SQL functions `has_room_access(uid)` and `has_premium(uid)` implementing PRD 7.1: the 3-day trial starts at the FIRST room create/join, not at signup; one trial per account and per hashed device id. Dev-only function to grant/revoke Premium for testing.
3. SQL functions (SECURITY DEFINER, carefully written, each checks auth.uid(), membership, status and entitlement): create_room, send_room_invitation(username), request_to_join(username or room code), respond_to_request, cancel_request, join_by_code, leave_room, remove_member, transfer_host, set_privacy, set_who_can_invite, block_user, report, nudge (2/recipient/day), react, tag_shared_meal, respond_shared_meal (accept creates an independent diary entry with the chosen quantity, same section by default).
4. PRIVACY-ENFORCING READ API: `get_room_snapshot(room_id)` returns, per member, ONLY the fields that member has chosen to share (hidden fields are returned as a `locked` marker, never as zero/null that could be mistaken for data). Room members must have NO direct select access to each other's base tables (food_entries, weight_logs, workouts, etc.).
5. Room state machine: Active / Dormant (fewer than 2 members with access) / Archived; lapsed members become `locked`, their data frozen and hidden; read-only behaviour for dormant rooms; invitation acceptance by a user without access triggers the paywall flow (return a clear error code, do not fail silently).
6. Limits: 10 members per room, 3 rooms per user, 20 pending requests per user, 10 new requests per hour.
7. AUTOMATED ATTACK TESTS (SQL): user A cannot read B's entries via room id, user id, direct table select, crafted function args or a stale membership; removed/left/locked members lose access immediately; a non-member cannot read or react to anything; blocked users cannot invite or request; hidden privacy fields never appear in any response; free-without-trial and expired-trial users cannot create/join/view rooms; trial can't be restarted; invitations by username respect `discoverable`; privacy changes apply retroactively.

DO NOT BUILD: chat, room progress graphs, leaderboards, notifications, real purchases.

DONE WHEN: the full attack-test suite passes and lint/typecheck/tests are green.
Finish with the end-of-session report.
```

**Prompt 5B (Sonnet) — client hooks**
```
Read /AGENT_RULES.md and /docs/PRD.md sections 6.7–6.13. Inspect existing code. Build ONLY the client data layer for Phase 5 (no UI): typed hooks/services for rooms list, create room, requests inbox (incoming/outgoing), search user by username, send invitation / join request, accept/decline/cancel, join by code, room snapshot with realtime refresh (subscribe only while the Room screen is visible), privacy settings read/write, nudge, reaction, shared meal tagging and responding, leave/remove/transfer host, block/report, and clear typed error codes (e.g. NO_ROOM_ACCESS, ROOM_FULL, RATE_LIMITED). Add unit tests with mocked Supabase. Do not edit SQL unless you find a bug (report it).
```

**Prompt 5C (Gemini Flash) — screens**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md sections 6.8, 6.9, 6.11, 6.12, 6.13. VIEW LAYER ONLY: use the existing room hooks; never edit hooks, /supabase or /packages/core.

Build: Room tab with segments Today | Chat (placeholder) | Progress (placeholder) | Members; the SIDE-BY-SIDE card (me left, partner right: goal-completion ring as % of their own goal, steps, water, workout status, meal checklist for Breakfast/Lunch/Dinner/Snacks; Extra never shown as missing); for 3+ members an avatar row to switch "me vs this person" plus an overview row; locked items shown with a neutral lock icon (never a zero); create room; invite by username (search with debounce); requests inbox (Incoming/Outgoing, neutral status text such as "Not accepted"); join by code; room settings (rename, who can invite, leave, remove, transfer host); privacy settings screen with per-data-type toggles and an eye icon on shared items; "preview" text explaining who sees what; nudge and reaction buttons with friendly pre-written text; shared meal cards ("Rahul logged Dinner with you. Add to your diary?" with quantity edit); dormant/"Waiting for your partner" and "Rejoin your room" states; paywall-required state that opens a placeholder paywall.
Rules: neutral colours (never red/green winning/losing between people), supportive copy, loading/empty/error states, accessibility, testIDs, i18n.
```
**Manual (you):** none.
**Test checklist (use two real phones — this is the friends alpha):** create room on A, invite B by username, B accepts; toggle privacy on B and watch A's view change immediately; hide calories then check A can't see them anywhere; remove B and confirm B loses access instantly; try the code join; tag a shared meal with a different quantity; let a trial expire (use the dev function) and check the locked state.
**Review focus (GPT):** this is the most important review. Give it the whole `/supabase` folder and ask it to try to read another user's private data in every way it can think of. Also: trial restart exploits, race conditions on join/leave, request spam, function privilege escalation (SECURITY DEFINER search_path), realtime channel leaks.

> **Milestone — FRIENDS ALPHA.** Give the app to 5–10 pairs of friends now (even with workouts/chat/progress missing). Watch whether both people stay active for 2–4 weeks before investing in the rest.

---

### PHASE 6 — Workout tracker
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** 6.6, 7.8

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md section 6.6 (WRK-1..WRK-10) and 7.8. Inspect existing code. Build ONLY Phase 6 logic (P1 items WRK-11..15 are out of scope). Reuse the Phase 3 sync layer.

BUILD:
1. Tables + RLS + sync: `exercises` (library + custom, muscle group, equipment, type), `workouts`, `workout_exercises`, `workout_sets` (reps, weight, duration, distance). Owner-only RLS.
2. Exercise library importer from a CSV/JSON I supply (generate a 40-exercise dev seed); licence/attribution field.
3. /packages/core with tests: workout volume (sum reps x weight), estimated 1RM (Epley, sets <= 12 reps), MET-based calorie estimate (informational only, never added to targets), cardio pace/speed.
4. Hooks/services: create/edit/delete workout for any date, add exercises and sets, copy previous workout to today, previous performance per exercise ("Last time: 3 x 8 at 40 kg"), history list/calendar data, per-workout summary, running session timer (timestamps, survives app kill).
5. Room integration: "worked out today" (type + duration) flows into `daily_summaries` and `room_events` according to privacy settings; workout details (sets/weights) stay hidden unless shared.
6. Tests: formulas, offline logging and sync, RLS (others can't read workouts; room members only see what privacy allows).

DO NOT BUILD: routines/templates, rest timer, PR detection, shared workouts, Health Connect workout import (all P1).
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section 6.6. VIEW LAYER ONLY.
Build with existing hooks: "Add workout" flow from Today and the Log sheet; workout logger (type picker, exercise picker with search and muscle-group filter, set rows with fast numeric entry for reps/weight, "last time" hint, add/remove/reorder sets), cardio form, running timer bar, finish summary (duration, volume, estimated calories labelled "estimate"), workout history list and calendar, workout detail with edit/delete, Today workout card. Fast one-handed entry is the priority. Loading/empty/error states, accessibility, testIDs, i18n.
```
**Test checklist:** log a full leg day offline; copy it to tomorrow; check the room shows "worked out today" and hides weights by default.
**Review focus (GPT):** data privacy of workout details, timer drift after app kill, volume math with units.

---

### PHASE 7 — Progress graphs, streaks, consistency score, leaderboards
**Models:** Sonnet · Gemini (screens) · **Size:** L · **PRD:** 6.14, 6.15, 6.16, 7.3, 7.4, 7.5

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.14, 6.15 (PRG-1..PRG-10, RPG-1..RPG-5), 6.16 and 7.3–7.5. Inspect existing code. Build ONLY Phase 7 logic.

BUILD:
1. /packages/core with tests: logged day (>= 2 entries AND >= 50% of target), goal day ranges (cut 85–105%, bulk 95–115%, maintain 90–110%), Weekly Consistency Score = 100 x (0.4 x logged/7 + 0.6 x goal/7) capped at 100, personal and room streaks (user time zone), low-intake rule (below calorie floor on 5 of 7 days -> those days are not goal days and a check-in flag is raised).
2. Server: complete `daily_summaries` computation (idempotent recompute function + triggers), `weekly_scores`, scheduled jobs (pg_cron or scheduled Edge Function) for streaks and weekly scores with a 24-hour grace period for late time zones.
3. Individual progress query functions for ranges 7d/30d/90d/6m/1y/all: weight (raw + trend + goal line + pace + projection), calories vs target and adherence, macro averages, steps/distance, water, workouts (per week, minutes, volume, exercise progression), consistency and streak history, goal progress %.
4. ROOM PROGRESS functions (privacy-enforced like get_room_snapshot): per-metric series per member, weight shown as change since each person's own start and progress toward own goal (never raw weight unless opted in), locked members excluded and marked, summary table ordered me-first then alphabetical (ranking allowed only on Consistency).
5. Leaderboards: weekly, divisions (Cutting, Bulking, Maintain, Beginner for first 28 days), cohorts of ~100 matched by time zone/region, top 10 + own rank, nickname/avatar/score only, tie-breakers, Monday reset, opt-out, eligibility (access + >= 3 logged days).
6. Tests with fixtures covering time zones, partial weeks, ties, privacy locks, opt-out, low-intake rule. RLS/attack tests for the new functions.

DO NOT BUILD: challenges, chart UI, notifications.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md sections 6.15 and 6.16. VIEW LAYER ONLY. Use a React Native SVG-based charting library.
Build: Progress tab with segments My Progress | Leaderboard | Challenges (Challenges = "coming soon"); range selector (7D/30D/90D/6M/1Y/All) shared by all charts; weight chart (points + trend + goal line + summary numbers), calories vs target, macros, steps, water, workouts, consistency/streak history, goal progress ring; tap a point for day details; ROOM > Progress screen with metric selector, member chips to show/hide people, locked-member indicator, summary table (me first, alphabetical; no ranking except Consistency); Leaderboard screen with division label, top 10 + my rank, opt-out toggle, and the info note "ranked by consistency, not restriction".
Every chart needs a text summary for screen readers, empty states explaining what to log, skeleton loaders. Neutral colours between people. testIDs, i18n.
```
**Test checklist:** log 7 days of fake data via a dev seed; compare the consistency score with a manual calculation; hide weight on one phone and confirm the room chart excludes it.
**Review focus (GPT):** recompute scores independently, DST/time zone edge cases, privacy leakage through aggregates (e.g., inferring hidden weight from group stats), leaderboard cohort leaks.

---

### PHASE 8 — Room chat with images
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** 6.10, 8.3

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.10 (CHT-1..CHT-12), 8.2, 8.3 and 9. Inspect existing code. Build ONLY Phase 8 logic.

BUILD:
1. Tables + RLS: `chat_messages` (client_id for idempotency, room_id, sender_id, text <= 2000, created_at, deleted_at), `chat_attachments` (storage key, width, height, size, moderation_status), `chat_read_state`. Access ONLY for current members with room access; nothing readable after leaving/removal/lock.
2. Realtime: one Supabase Realtime channel per room, subscribed only while the chat screen is visible; message history pagination (50/page); unread counts; system messages (member joined/left, room created, streak milestones) that can be muted.
3. Images: client compression (longest side ~1600 px, JPEG/WebP), thumbnail generation, EXIF/location stripping on the device AND verified/stripped again server-side; upload through an Edge Function that checks membership and returns a presigned PUT to the private Cloudflare R2 bucket; reads through an Edge Function that checks membership and returns short-lived signed GET URLs; max 5 images/message, 10 MB each, allowed types JPEG/PNG/HEIC/WebP; deleting a message deletes the stored objects.
4. Offline queue with retry using the existing outbox (idempotent by client_id), delivery states sending/sent/failed, dedupe, reconnect handling.
5. Safety: report message, mute/block member (hides their messages for the muter), delete own message, rate limits (20 messages/min, 30 images/hour), automated image moderation hook (provider adapter + stub; mark `pending|ok|blocked`), moderation queue table, terms-accepted record (`consent_records`) required before first message.
6. Dormant rooms are read-only.
7. Tests/attack tests: non-member can't fetch messages or image URLs; expired/removed member loses access immediately; signed URLs expire; duplicate sends create one message; rate limits; pagination correctness; reconnect gap-fill; oversized/invalid file rejection.

DO NOT BUILD: replies, edits, read receipts, typing indicators, push notifications (Phase 9), voice notes, GIFs.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section 6.10. VIEW LAYER ONLY.
Build the Chat segment in Room: message list (inverted, paginated), bubbles with nickname/avatar/time, system-message style, composer with text + camera/gallery picker (up to 5 images, previews, remove), upload progress per image, failed state with "Retry", full-screen image viewer (pinch to zoom, save to gallery), long-press menu (delete own, report), terms acceptance sheet before first message, unread badge on the Room tab and a "new messages" divider, offline banner, read-only state for dormant rooms, empty state ("Say hi to your partner"). Smooth keyboard handling on both platforms. Accessibility labels, testIDs, i18n.
```
**Manual (you):** R2 buckets/keys in Supabase secrets.
**Test checklist:** send text and 3 photos between two phones; airplane-mode send then reconnect; remove a member and confirm they can't open old image links; report a message.
**Review focus (GPT):** image URL guessing, signed-URL lifetime, SSRF/path traversal in upload functions, EXIF leakage, spam, realtime subscription leaks across rooms.

---

### PHASE 9 — Notifications
**Models:** Sonnet · Gemini (settings screens) · **Size:** M · **PRD:** 6.12 (NTF-1..3), 6.20 (FST-6)

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.12, 6.20 (FST-6) and 7.1. Inspect existing code. Build ONLY Phase 9 logic.

BUILD:
1. `devices` table (user_id, FCM token, platform, app version, last_seen), registration/refresh/unregister on sign-in/out, stale-token cleanup.
2. `notification_settings` (per type toggles, quiet hours, per-room chat mute, hide-previews option).
3. Edge Function `send-push` using FCM HTTP v1 (service account from secrets) with batching and error handling (remove invalid tokens). Database triggers/queues for: nudge received, partner logged/finished workout (respect privacy and mute), room invitation/join request/accepted, chat message (skip if the recipient is viewing the chat; respect mute/preview setting; never include another person's calorie numbers), streak at risk (evening, user's time zone), weekly summary (Monday), trial ending (days 2 and 3 of the trial), subscription lapse/payment issue (hook only; real events in Phase 10).
4. LOCAL notifications (expo-notifications) for meal reminders, water reminders and weekly weigh-in at user-set times; fasting reminders will plug into the same service later.
5. Permission request at a useful moment (not on first launch), deep links from notifications to the right screen.
6. Tests: quiet hours, mute, privacy (no hidden data in payloads), no push to removed members, token cleanup.

DO NOT BUILD: fasting UI, marketing pushes.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash):** notification settings screen (type toggles, quiet hours, per-room mute, hide previews) and the permission-priming screen; VIEW LAYER ONLY (same rules header as above).
**Manual (you):** Firebase project, APNs key, service account into secrets.
**Test checklist:** nudge from phone A arrives on B with the app closed; chat push with preview hidden; quiet hours block it.
**Review focus (GPT):** data in push payloads, pushes to non-members, token hijack, notification flooding.

---

### PHASE 10 — Subscriptions and paywall
**Models:** Sonnet · Gemini (paywall UI) · **Size:** M · **PRD:** 6.18, 7.1 · **Milestone: PAID BETA**

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.18 (SUB-1..SUB-12) and 7.1. Inspect existing code. Build ONLY Phase 10 logic.

BUILD:
1. RevenueCat SDK (react-native-purchases) with three products: monthly, 3-month, annual (Premium entitlement). Fetch offerings, purchase, restore, handle cancelled/expired/billing-retry/grace states.
2. Edge Function `revenuecat-webhook`: verify the shared-secret/authorization header, be idempotent (event id), map events to the `entitlements` table (source apple|google), handle renew/cancel/expire/refund/billing issue/product change. The `entitlements` table remains the ONLY source of truth; the app only displays it.
3. Replace the Phase 5 dev stub with the real flow while keeping the same `has_room_access` / `has_premium` functions: trial starts at first room create/join; Paid and Grace grant full access; AI coach requires Premium (no trial).
4. Paywall triggers (SUB-5): opens when a user without access taps Room, accepts an invitation, or tries to create/join a room; soft banners on trial days 2 and 3; shown AFTER the room preview for invited users. Locked-preview component for the AI coach (SUB-12).
5. Lapse handling: a member whose access ends becomes `locked`, the room's state is recomputed (Active/Dormant), pending invitations to lapsed users are handled, and a "Rejoin your room" state is returned.
6. Server-side enforcement tests (attack tests): free/expired users cannot read or write rooms, chat, room progress or AI coach by any route (direct table access, functions, realtime subscription, Edge Functions, storage URLs); forged/replayed webhooks are rejected; webhook order issues (expire before renew) are handled; duplicate webhooks do nothing; restore on a new device works; refund removes access.
7. Entitlements table is shaped to accept a future `dodo` source (web checkout, P2) without redesign.

DO NOT BUILD: Dodo web checkout, promo codes, price experiments.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section 6.18. VIEW LAYER ONLY.
Build the paywall (monthly, 3-month and annual with localised prices from RevenueCat, annual highlighted as best value with the saving shown, what stays free, what Premium includes: rooms, room chat, room progress, AI coach, "Restore purchases", terms/privacy links, clear billing text), the trial banner (days left), "Rejoin your room" screen for lapsed members, subscription management screen in Me (plan, renewal date, manage-in-store link), and the AI coach locked-preview card. Calm, honest tone; no dark patterns; loading/error states; accessibility; testIDs; i18n.
```
**Manual (you):** create products in Play Console/App Store Connect, RevenueCat dashboard, webhook secret, test accounts (Google license testers, Apple sandbox).
**Test checklist:** buy each plan in sandbox; cancel; let it expire; restore on another device; try opening Room as a free user; check the locked member's partner sees "Waiting for [name] to rejoin".
**Review focus (GPT):** try every bypass you can think of; webhook forgery/replay; race between webhook and client; entitlement downgrade leaving access via cached tokens or realtime channels.

> **Milestone — PAID BETA.** Start tracking AI cost per paid user and the trial-to-paid rate.

---

### PHASE 11 — AI food-photo logging
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** LOG-3, 7.7

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.3 (LOG-3), 7.7 and 8.2. Inspect existing code. Build ONLY Phase 11 logic.

BUILD:
1. Edge Function `ai-food-photo`: authenticated; consent check (`consent_records` type ai_processing); daily caps by state (trial 3/day, paid 15/day, free-after-trial 0) read from a config table; image size/type limits; call the vision model with a strict JSON schema output (items, estimated grams, confidence); map items to our `foods` (search + fallback to estimate); return candidates for user confirmation. The AI API key is a server secret and is never sent to the app.
2. Images are processed and deleted; stored only if the user explicitly shares to a room/chat.
3. `ai_usage` table (user_id, day, feature, count, tokens, estimated cost) + a global monthly budget switch that disables the feature gracefully; structured logging.
4. Client service: capture/compress, send, show candidates, user edits quantities or swaps items, save as `food_entries` with source=photo through the normal sync layer. Results labelled "estimate".
5. Tests with a mocked model: caps per state, consent required, malformed model output handled, prompt-injection text inside images/food names can't change behaviour, budget switch works, no key leakage.

DO NOT BUILD: AI coach, voice, multi-photo meals.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash):** camera capture screen, consent sheet, "analysing" state, results editor (candidate list with quantity steppers, swap/remove/add item, "estimate" label, total calories/macros), daily-limit-reached state with a gentle upsell. VIEW LAYER ONLY.
**Manual (you):** AI provider key into Supabase secrets; set the monthly budget value.
**Test checklist:** photograph 10 different Indian meals and judge accuracy; hit the daily cap; deny consent.
**Review focus (GPT):** cost-abuse vectors (cap bypass via multiple devices/accounts), key exposure, oversized uploads, injection via image text.

---

### PHASE 12 — Recipe library
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** 6.21 · **Start writing recipes now**

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md section 6.21 (RCP-1..RCP-11). Inspect existing code. Build ONLY Phase 12 logic.

BUILD:
1. Tables + RLS: `recipes` (title, description, cuisine, diet tags, meal type, prep/cook minutes, difficulty, servings, steps, tips, image URLs, status draft|published, nutrition per serving snapshot, version), `recipe_ingredients` (recipe_id, food_id, quantity, unit, note), `recipe_favorites`, `recipe_reports`. Published recipes readable by any signed-in user; drafts/writes only via the service role (scripts). Users can write only their own favorites/reports.
2. AUTHORING PIPELINE: define `docs/RECIPE_TEMPLATE.json` (with 5 sample Indian recipes) and a CLI script `npm run recipes:import` that validates and imports recipes: every ingredient must map to a food id (fuzzy-match suggestions on failure), units convertible to grams, image present, servings > 0; it CALCULATES nutrition per serving from ingredients (calories, protein, carbs, fat, fibre; manual override only with a written reason field), uploads images to the public R2 recipe bucket, and writes draft or published. Re-import creates a new version. Produces a readable error report.
3. Read functions: search/browse by name, ingredient and tags; filters (meal type, diet, calorie range, minimum protein, time, cuisine); recipe detail; servings scaler (core function with tests); `log_recipe(recipe_id, servings, meal_section)` creating a food_entries row with a nutrient snapshot (source=recipe) via the normal sync layer; favorites; recently viewed (local).
4. Offline: cache viewed/favourite recipe text and images.
5. Tests: nutrition calculation accuracy against hand-computed fixtures, scaling, import validation failures, RLS (drafts invisible, users can't edit recipes), logging 1.5 servings = 1.5x nutrients.

DO NOT BUILD: collections, "fits my day" suggestions, meal planner, grocery list, user-submitted recipes.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash):** recipe browse (search, filter chips, grid with photo/time/calories/protein), detail screen (hero image, servings scaler, ingredients, steps, nutrition per serving, favourite, "Log this recipe" sheet with servings + meal section), favourites tab, Log sheet "Recipes" tab, Today entry point. VIEW LAYER ONLY.
**Your content task:** write recipes to the template, test the importer on 10, then batch the rest.
**Test checklist:** import the 5 samples, check calories against a manual sum, log 1.5 servings, use offline.
**Review focus (GPT):** recompute nutrition for 5 recipes by hand, importer edge cases, image path handling.

---

### PHASE 13 — Fasting tracker
**Models:** Sonnet · Gemini (screens) · **Size:** S · **PRD:** 6.20, 7.9

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.20 (FST-1..FST-12), 7.9, 6.2 (ONB-11) and 8.1. Inspect existing code. Build ONLY Phase 13 logic.

BUILD:
1. Tables + RLS + sync: `fasting_settings` (enabled, protocol, eating window start/end), `fasting_sessions` (start_at UTC, planned_minutes, end_at, status active|completed|ended_early). Owner-only. Hidden from rooms unless the user opts in to share "fasting now / completed today" via the existing privacy settings.
2. /packages/core with tests: protocols 12:12, 14:10, 16:8, 18:6, 20:4 and custom window (max planned 20 h; no OMAD, no multi-day); fast state computed from timestamps (elapsed/remaining/completed/ended early); scheduled-window mode; stats (average duration, completion rate); fasting streak (personal); DST and time-zone safe.
3. Gating: feature hidden if screening (ONB-11) says pregnant/breastfeeding, diabetes/medication affecting food, or eating-disorder history; paused while the low-intake check-in flag is active; 18+ only.
4. Safety behaviour: check-in prompt when a fast runs 2 h past plan or past 20 h; strong end-fast prompt at 24 h; logging food during a fast shows a non-blocking prompt ("Log this and end your fast?"). Fasting never alters calorie targets or the consistency score and is excluded from leaderboards/challenges.
5. Local notifications for fast start/end and eating-window-closing using the Phase 9 service (reschedule correctly on edit).
6. Hook data for Progress (fasting hours/week).
7. Tests: kill-and-reopen correctness, time zone change, edit start/end, gating matrix, reminders rescheduling.

DO NOT BUILD: any health-claim content (fat-burning zones, ketosis, autophagy), fasting challenges.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash):** Today fasting card (timer ring, elapsed/remaining, start/end buttons), protocol picker, schedule editor, history with neutral "Ended early" wording (no red), stats, check-in sheets, "Try fasting" card shown only when allowed, settings under Me. Copy must contain NO health claims. VIEW LAYER ONLY.
**Test checklist:** start a fast, kill the app, reopen after an hour; change time zone; answer "history of an eating disorder" in screening and confirm fasting disappears.
**Review focus (GPT):** safety gating bypass, copy with health claims, timer correctness.

---

### PHASE 14 — Premium AI coach
**Models:** Sonnet · Gemini (screens) · **Size:** M · **PRD:** 6.22, 7.10, 8.1, 8.2

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.22 (AIC-1..AIC-10), 7.10, 8.1 and 8.2. Inspect existing code. Build ONLY Phase 14 logic.

BUILD:
1. Tables + RLS: `coach_conversations`, `coach_messages` (role, content, tokens, feedback up|down|null), owner-only; reuse `ai_usage` and `consent_records` (type ai_processing).
2. Edge Function `coach-chat` (streaming via SSE): authenticated; `has_premium(uid)` checked on EVERY request (Paid or Grace only; trial and free are rejected with a standard PREMIUM_REQUIRED error); consent required; limits from config (30 messages/day, 1,000 chars/message, last 20 messages + data summary); per-user daily token cap and global monthly budget switch (cheaper model first, then safe shutdown message).
3. Context builder: a compact summary built by SQL from the user's OWN data only (goal/rate, targets, today's totals, 7-day averages, weight trend, workouts, steps, water). Never include other users' or room data.
4. Tools the model may call (server-executed, results quoted verbatim): get_targets, get_remaining_macros_today, search_foods, search_recipes, get_recipe_nutrition (all backed by /packages/core and existing tables). The model must not compute targets itself.
5. System prompt and policy in a versioned file: refuse or redirect intake below the calorie floor, crash diets, extended fasting, purging/laxatives, weight-loss supplements; respond with care and resources to signs of disordered eating or self-harm; recommend a professional for medical conditions; never diagnose; label as AI; treat food names, recipe text and user notes as untrusted data (prompt-injection resistant). Input and output safety checks (rules + model check).
6. Endpoints: list/delete conversations (delete removes messages), feedback thumbs, report a response.
7. Tests (mocked model + real policy tests): free/trial/expired user rejected on every route; message cap; token cap; budget switch; no cross-user data in context; "800 kcal diet" request refused with a safe alternative; disordered-eating phrasing gets a supportive response; prompt injection inside a custom food name has no effect; tool failure produces an honest "can't work that out" message; deleted conversation is gone.

DO NOT BUILD: logging food by chat (P1), photos in coach chat, proactive pushes.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash)**
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section 6.22. VIEW LAYER ONLY.
Build: consent screen (what data is sent to the AI provider, link to delete history), coach chat screen with streaming text, suggested prompts ("How am I doing this week?", "What should I eat tonight to hit my protein?", "Explain my calorie target"), recipe/food suggestion cards with a "Log it" button that opens the normal logging flow, thumbs up/down and report on each answer, "AI can make mistakes - not medical advice" label, daily-limit-reached state, offline state, history list with delete, and the locked-preview + paywall entry for non-Premium users. Calm tone. Loading/error states, accessibility, testIDs, i18n.
```
**Manual (you):** AI provider key and budget; confirm the provider's data-use terms (no training on your users' data).
**Test checklist (also have GPT play attacker):** ask it for a 700 kcal plan; ask about a medical condition; tell it you purge after meals; paste "ignore previous instructions"; try as a trial user and as a lapsed user.
**Review focus (GPT):** jailbreak/safety tests, cost abuse, cross-user data in context, entitlement bypass on the streaming endpoint.

---

### PHASE 15 — Rate-us, polish, monitoring
**Models:** Sonnet (logic, monitoring) · Gemini (polish) · **Size:** M · **PRD:** 6.23, 9

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 6.23 (RAT-1..RAT-6) and 9. Inspect existing code. Build ONLY Phase 15 logic.

BUILD:
1. Rating prompts with the platform APIs only (StoreKit review request on iOS, Google Play In-App Review on Android): trigger 1 = end of onboarding right after the targets summary is shown; trigger 2 = 7 days after install with >= 5 logged days OR first 3-day room streak, only if shown fewer than twice in total. Never during logging, chat, a paywall, or right after an error. `RatingPromptState` stored locally and server-side. Permanent "Rate CaliPartner" item in Me. Separate "Send feedback" form (not tied to the rating, no gating, no incentives).
2. Sentry (crashes + performance) and PostHog (or Firebase Analytics) with the PRD section 12 events; no PII or health values in analytics payloads; consent/opt-out switch.
3. Remote config table/Edge Function for tunable limits (AI caps, nudge limits) so they can change without a release.
4. App version handling: minimum supported version check with a friendly "please update" screen.
5. Tests for the prompt rules (a table-driven test of when it may/may not show).

DO NOT BUILD: any new product feature.
Finish with the end-of-session report.
```
**Prompt B (Gemini Flash) — polish pass**
```
Read /AGENT_RULES.md (UI rules) and the design prompt/design system I will paste below. VIEW LAYER ONLY. Do NOT change any hook, business logic, database or API.
[PASTE YOUR DESIGN PROMPT HERE]
Polish in this order, one area per commit: onboarding, Today, Log sheet, quantity screen, Previously logged, workouts, fasting, recipes, Room side-by-side, requests and privacy, chat, progress charts, leaderboard, paywall, AI coach, Me/settings. For each: consistent spacing/typography from theme tokens, loading/empty/error states, subtle animations (respect reduce-motion), dark mode, large-font support, screen-reader labels, touch targets >= 44 px, tablet/small-phone layouts. List anything that needs a logic change as a note instead of changing it.
```
**Test checklist:** reinstall and confirm the rating prompt appears once at the end of onboarding (it may not show in dev builds — verify via logs); run with large fonts and TalkBack/VoiceOver; check dark mode.
**Review focus (GPT):** prompt rule coverage, analytics payloads contain no health data, accessibility gaps.

---

### PHASE 16 — Full review and hardening
**Models:** GPT (audit) · Sonnet (fixes) · **Size:** M

**Prompt (GPT) — release-candidate audit** (give it the entire repo)
```
You are an independent senior reviewer. Review the complete CaliPartner repository as a production release candidate. Read /AGENT_RULES.md and /docs/PRD.md first. Do NOT rewrite working code. Produce a prioritised issue list (Critical / High / Medium / Low) with file, line, exact reproduction or exploit steps, and a suggested fix. Where possible write a failing test that proves the issue.

Focus on: (1) Row Level Security and SQL functions (SECURITY DEFINER misuse, search_path, privilege escalation, missing policies, realtime channel leaks); (2) room privacy: can any user read another user's food, weight, workouts, fasting, chat or images beyond what they chose to share (including through aggregates and room progress); (3) entitlement bypass for rooms, chat, room progress, AI photo and AI coach; (4) webhook forgery/replay; (5) AI cost abuse and prompt injection; (6) offline sync: duplicates, lost writes, conflicts, app kill mid-sync, time-zone/DST bugs; (7) calculation correctness against PRD 7.2/7.3 with independent recomputation; (8) safety rules: calorie floors, rate caps, no ranking by weight/calories, fasting gating, coach refusals; (9) performance (missing indexes, N+1, large payloads, startup time); (10) mobile crashes, loading/empty/error states, accessibility; (11) secrets in the repo or app bundle; (12) store-policy risks (health data, user-generated content, subscriptions, ratings, account deletion).
```

**Prompt (Sonnet) — fixes** (see Section 5)
**Also do:** a manual two-week test with real friends; fix every Critical/High before Phase 17.

---

### PHASE 17 — Production preparation and store submission
**Models:** Sonnet · **Size:** M

**Prompt A (Sonnet)**
```
Read /AGENT_RULES.md first. Read /docs/PRD.md sections 8, 9 and 11. Inspect existing code. Build ONLY Phase 17.

BUILD / VERIFY:
1. Production environment separation (dev / staging / production) for Supabase, R2, RevenueCat, FCM, AI keys; migration deployment process; seed/reference data scripts; documented rollback plan.
2. Database: indexes reviewed against real query plans, connection settings, scheduled backups verified, retention/cleanup jobs (expired requests, archived rooms, old chat media, old coach conversations per PRD).
3. Deep links: Android App Links (assetlinks.json) and iOS Universal Links (apple-app-site-association) hosted on our domain, plus integration points for a deferred deep-link provider so invite links survive installation (provider keys supplied by me).
4. Rate limiting reviewed on every public Edge Function; WAF/CORS settings; secrets audit.
5. Privacy/legal support: in-app links to privacy policy/terms/community guidelines, a public account-deletion page, data export (P1) placeholder, consent logs, health-data disclaimers, support/contact info (required for user-generated content).
6. Production builds with EAS (versioning, signing, release channels), internal testing tracks (Play) and TestFlight, crash-free-session check, performance profile on a low-end Android device.
7. A launch checklist file `docs/LAUNCH_CHECKLIST.md` listing every console setting, declaration and form I must complete (Play Data Safety, Health Connect declaration, App Store privacy labels, HealthKit usage strings, subscription metadata, age rating, review notes with a demo account).

DO NOT BUILD new features.
Finish with the end-of-session report.
```
**Your tasks:** privacy policy/terms with legal review; store listings, screenshots; support email; Health Connect/HealthKit declarations; closed testing with 20 users for 14 days (Google requires this for new personal developer accounts — check current Play rules).
**Review focus (GPT):** run the Phase 16 audit again on the release candidate branch.

---

## 5. Generic prompts (reuse every phase)

### Review prompt (GPT) — paste after each phase, plus the phase's "Review focus"
```
You are an independent reviewer for the CaliPartner app. Read /AGENT_RULES.md and the PRD sections relevant to the phase I name. Review ONLY the code changed in this phase (git diff against the previous phase tag) plus anything it touches. Do not rewrite code and do not add features.

Return a prioritised list (Critical / High / Medium / Low). For each issue: file and line, what is wrong, how to reproduce or exploit it, and the smallest fix. Then list missing tests. Specifically try to break: privacy (reading someone else's data), entitlement checks, offline/duplicate/time-zone handling, input validation and rate limits, and any rule in AGENT_RULES.md that was ignored. End with "Safe to move on: yes/no" and why.

PHASE: <name>
REVIEW FOCUS: <paste the phase's review focus>
```

### Fix prompt (Sonnet)
```
Read /AGENT_RULES.md. Below is an independent review of Phase <N>. Fix every Critical and High issue and any Medium issue that is quick and safe. For each fix add or update an automated test that fails before the fix and passes after. Do not expand scope, do not refactor unrelated code, and do not build later phases. If you disagree with a finding, say why instead of ignoring it. Run lint, typecheck and all tests, then give the end-of-session report with a table: issue -> fixed/not fixed -> test.

REVIEW:
<paste GPT's review here>
```

### UI-only prompt skeleton (Gemini)
```
Read /AGENT_RULES.md (UI rules) and /docs/PRD.md section <X>. VIEW LAYER ONLY: do not edit /packages/core, /supabase, hooks or API contracts. Using the existing hooks <list them>, build: <screens>. Include loading, empty and error states, accessibility labels, testIDs and i18n strings. If something you need is missing from a hook, stop and tell me instead of changing it. Finish with the list of files changed.
```

### Rollback / "agent went off-track" prompt
```
Stop. You are building outside this phase's scope. Revert every change that belongs to a later phase (list them first, then revert), keep only what the phase prompt asked for, and re-run lint, typecheck and tests.
```

---

## 6. After launch (not now)
Challenges and occasion plans · adaptive calorie recalibration · workout routines, rest timer, PR detection and shared workouts · chat replies/read receipts/editing · coach food logging · recipe collections and "fits my day" · body measurements and progress photos · streak freezes · data export · more languages · home-screen widget · web app with Dodo Payments checkout (same `entitlements` table).