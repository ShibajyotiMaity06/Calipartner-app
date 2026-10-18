# AGENT_RULES.md — CaliPartner

Keep this file in the repo root. Every agent session reads it first.

## Source of truth

- Product requirements: `/docs/prd.md` (v0.3). If code and PRD disagree, stop and report it. Do not guess.
- Build order: `/docs/BUILD_PLAN.md`. You are given ONE phase at a time. Build only that phase. Do not build future phases, extra features or "nice to haves".

## Stack (fixed. Do not swap any of it)

- Mobile: React Native + Expo (TypeScript strict, Expo Router), EAS development builds (not Expo Go), Android + iOS.
- On-device: SQLite (expo-sqlite) with an outbox queue. Offline-first from the first feature.
- Backend: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). No separate Node/Express/Mongo server.
- Shared logic: `/packages/core` (pure TypeScript, no React, no Supabase imports) with unit tests. Used by the app AND by Edge Functions.
- Auth: email 6-digit code, Google, Apple. NO phone/SMS login.
- Images/files: Cloudflare R2 (private, signed URLs issued by an Edge Function after a membership check).
- Subscriptions: RevenueCat -> webhook -> our own `entitlements` table (the only source of truth).
- Push: FCM. Reminders for meals/water/fasting: local notifications.
- AI: server-side only (Edge Functions). Keys only in Supabase secrets.

## Repo layout

```
/app            Expo React Native app
/supabase       config, migrations, functions, seed, tests (SQL/RLS)
/packages/core  pure TS: calculators, formulas, validators (+ tests)
/docs           PRD.md, BUILD_PLAN.md, notes
AGENT_RULES.md
```

## Non-negotiable rules

1. **Security lives in the database.** Every table has Row Level Security enabled with explicit policies. The app is never trusted to hide data, check subscriptions or enforce privacy toggles.
2. **Never expose another user's data except through a SQL function/view that applies their privacy settings.** Room members must never read each other's base tables directly.
3. **Entitlements are checked server-side** (RLS/functions/Edge Functions) for rooms, chat, room progress and the AI coach.
4. **No secrets in the app or in git.** Only `EXPO_PUBLIC_*` values for non-secret config. Provide `.env.example` only.
5. **All writes from the app must be idempotent** (client-generated UUIDs, upserts) so retries and offline sync never duplicate data.
6. **All timestamps in UTC.** Per-user "day" boundaries use the user's stored time zone.
7. **Calculations live in `/packages/core`** and are covered by unit tests (including the PRD 7.2 worked example). Never re-implement a formula in a screen.
8. **Safety rules are product rules:** calorie floors, rate caps, no ranking by weight loss or lowest calories, no health claims in fasting copy. Do not weaken them.
9. **Migrations only.** Never edit the database by hand; every schema change is a new migration file. Never edit an old migration after it has been committed.
10. **Tests are part of "done".** Logic, RLS policies and sync behaviour need automated tests. Run lint, typecheck and all tests before saying you are finished.
11. **Don't touch what you weren't asked to.** Don't refactor working code, rename things or change files outside the phase scope unless required (explain why).
12. **Ask only if truly blocked.** Otherwise make the simplest reasonable assumption and list it in your report.

## UI rules (for any agent working on screens)

- View layer only: do not change hooks, `/packages/core`, `/supabase`, or API contracts. If a hook is missing something, report it instead of editing it.
- Every screen needs loading, empty and error states.
- Neutral colours between people (no red/green "winning/losing" between members).
- Accessible: labels for screen readers, text scales with system font size, contrast AA, never colour-only meaning, text summary for every chart.
- All user-facing strings go through the i18n layer (English first).
- Add `testID`s to key interactive elements.

## End-of-session report (always)

1. What you built (short list).
2. Files created/changed.
3. Tests added and their results (paste the summary line).
4. Assumptions you made.
5. Anything I must do manually (accounts, keys, console settings).
6. Anything you noticed that belongs to a later phase (do NOT build it).

## UI rules (from CaliPartner_UI_UX_Spec.md)

U1. Design source of truth is docs/ui/. Tokens live only in packages/ui/tokens. No hex, font name, spacing or radius literals elsewhere.
U2. Apricot is the app, not a person. One apricot action per screen. Text and icons on apricot use onBrand (#1C1109), never white.
U3. Two people = identity hues (default Iris and Teal). Identity colour never means good or bad. Only the pairs in allowedPairs may be used together.
U4. No red or green for performance. Over goal = cream second lap + the word "over". danger colour only for destructive actions and errors.
U5. Percent of own goal in any side-by-side view. Raw calories only in a person's own view. Hidden data shows a lock, never zero.
U6. Fonts: Bricolage Grotesque (numbers, titles), Figtree (UI), Anek Devanagari (Hindi). Static weights only. Tabular numerals on every number that changes.
U7. Glass only on the tab bar and the Log sheet, with opaque fallback for Reduce Transparency and low-end Android.
U8. One orchestrated motion moment: the seam fuse. All other motion answers an action. Respect Reduce Motion.
U9. Every tappable element is at least 44x44. Every icon button has an accessibility label. Text scales to 200% without clipping.
U10. Copy: plain, warm, second person, sentence case, no emoji, no exclamation marks, no guilt. Verb names the object ("Add to lunch").
U11. Logging never blocks and works offline. Show status, not spinners.
U12. UI work never changes logic, schema, RLS, packages/core or entitlement checks.
