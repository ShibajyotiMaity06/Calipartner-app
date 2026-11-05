> Owner bug report, 4 November 2026 (weekly-plan nutrition): investigate and repair identical calorie/protein/carbs/fat estimates assigned to different foods in the onboarding AI plan. Remove fixed nutrition examples from generation, validate copied estimates before saving, and let the owner rebuild an affected saved plan using existing preferences. Preserve acknowledged saves, existing plans on failure, privacy, consent, targets, safety and subscription gates.

> Owner follow-up, 4 November 2026 (nutrition, discovery and food): use fixed nutrition text colours throughout: protein green, carbs white, calories yellow and fat red. These hues label nutrients, never performance. Match the empty-Squad Home card to Your part today; make Home See all buttons green. Discover shows at most five real discoverable profiles sharing the viewer's current cut/bulk/maintain goal; username search remains available. Squad summaries show overall completion percentages without raw calorie totals. Selected Squad tab text is yellow, with no added top border. Keep member selection on its current view; compare selectors show names only with smaller type. You has Diary, Progress and Challenges using the existing challenge system. Food logging exposes custom food, a combined food/recipe Favourites tab, clearable food search history, and editable per-portion calories/protein/carbs/fat (including AI results), with acknowledged online saves and stable retries. Preserve catalog values, diary records, privacy, safety and plan gates. Necessary targeted hooks, core helpers, services, migrations and regression tests are authorized; this supersedes earlier empty-discovery, food-tab, nutrient-colour and selected-border decisions within this scope.

> Owner request, 4 November 2026 (entry screens and request fixes): replace only the Why it works and Plus/Pro onboarding screens, Welcome, Create account and Log in using the supplied two-page PDF as a visual reference. Retain the owner-supplied CaliPartner logo, upright Plus Jakarta Sans, email-code/Google/Apple authentication and existing safety/entitlement rules. Replace the web billing country dropdown with automatic IP-country detection: India uses Razorpay/INR and other detected countries Dodo/USD; unknown detection must show retry and block new purchases. Preserve existing subscription providers and native store billing. Resolved Squad/friend requests disappear from incoming/outgoing inboxes after acknowledged actions and refresh across clients. Overview/Leaderboard/Chat selection uses a yellow top border. Necessary targeted hooks/services/Edge Function changes and regression tests are authorized. This supersedes earlier manual-country and view-only restrictions within this scope.

> Owner request, 4 November 2026 (web billing): implement Razorpay for new Indian web subscriptions only, using the saved billing country IN; unknown countries must be supplied before checkout. International web uses Dodo USD. Android and iOS retain RevenueCat with Google Play Billing / Apple IAP. Preserve existing subscriptions with their current provider, webhook-only entitlements, Plus-only seven-day trials, idempotent requests and private server keys. Targeted backend, database, shared billing logic, paywall, configuration and tests are authorized. Missing Razorpay configuration must fail closed until the owner supplies credentials.

> Owner correction, 4 November 2026 (Squad chat): authenticated joined members at every tier, including Free/basic, may use human Squad text chat, typing, mentions, unread state, reports and approved shared-media reads. Remove subscription gates only for these chat capabilities; retain room usability, membership, consent, moderation, blocks, mutes, rate limits and idempotency. Pro media uploads, AI and all other paid features remain unchanged. Targeted backend, hooks, UI, tests and deployment are authorized. Supabase credentials belong only in the operating system credential store, never in this repository.

> Owner request, 4 November 2026: the food, Back navigation, Squad and weekly AI plan changes recorded at the top of docs/prd.md authorize the targeted core, hooks, API, schema, Edge Function and UI work needed for this delivery. Weekly planning is the only exception to purchased-Pro-only AI: Monday preview is available after consent; the full week and personal tips require purchased active Plus/Pro, excluding every trial. Preserve existing privacy, safety and unrelated entitlements.

> Owner request, 3 November 2026 (recipes, scanner and fasting): retain only High protein, High carb and Indian recipe filters, using actual catalog tags/regions; simplify barcode scanner instructions and progressively disclose secondary capture options. Repair and expose the existing fasting timer, protocol/eating-window setup, history and reminders with real profile screening, stored-zone timing, acknowledged saves and server-enforced Plus/Pro access (including eligible Plus trial). Free may only safely end an already-active fast or disable fasting after access expires. Keep 18+ and health/low-intake safeguards, the 20-hour planned maximum, private histories, no health claims and no fasting rankings. Necessary targeted core, hooks, service and migration repairs are authorized for this request. This supersedes conflicting earlier phase/UI-only/food-filter requirements within this scope.

> Owner request, 3 November 2026 (food and polish follow-up): add all 247 supplied individual foods alongside the existing food catalog, without filters or recipe conversion. Food methods are Search, Recipes, Photo and Scan, with unfiltered recent foods listed directly and no history/my-food tabs, frequency/alphabet sorting or separate meal-description action. Community discovery starts empty and requires username search. You separates the dated personal diary (all meals/macros, steps, workouts and water) from Progress (30/90 days). Center the half-width Weight tile in row three; use danger styling for Leave squad; remove Add friends from squad creation. Hide app navigation only while squad chat is open, restore it on exit, and show mention members in vertical rows. Use consistent upright Plus Jakarta Sans and existing brand colours for borders and surfaces. Correct local-time prompts and expand consented purchased-Pro AI context to the caller?s daily logs, with explicit in-chat meal drafts and acknowledged Log actions. Necessary targeted service, hook, core and Edge Function repairs are authorized for these requested behaviours; preserve database privacy, entitlements, safety and existing records. This supersedes conflicting earlier requirements only within this scope.

> Owner UI correction, 3 November 2026: restore upright Plus Jakarta Sans static regular/medium/semibold/bold weights, compact buttons with accessible tap targets, stable equal-size Home squad/create cards, member counts beside squad names, and Friends from the Home people action. Remove the goal subtitle beneath Your part today. Refresh the time-based Home meal prompt on focus and every minute using the stored profile time zone. You contains personal progress, macros, workouts, steps, water and squad memberships with confirmed leave actions; its tab uses the person icon and the former Profile tab uses Settings. The Log hub contains only food, workout, water, steps and weight, with food methods inside Food; remove squad selection and check-ins. Remove obsolete food-sharing/tagged-partner switches: existing squad projections already share saved food with joined squads, keeping membership, block and paid-detail gates. Remove the Overview chat preview and compact squad tabs and chat composer; mentions are entered by typing @. Keep loading surfaces on the app background. The owner also explicitly authorized targeted backend/API changes for conversational AI meal clarification and confirmed in-chat logging: collect food/portion details and meal section, show estimated macros and an explicit Log action, then require one atomic acknowledged save with stable retry IDs, purchased-Pro and consent checks. Estimates are for today's diary in the stored user time zone. Preserve safety, private base tables, block checks and existing paid squad-detail gates. This supersedes conflicting earlier font, navigation and UI requirements and the view-only restriction for this targeted AI flow.

# AGENT_RULES.md — CaliPartner

Keep this file in the repo root. Every agent session reads it first.

## Source of truth

- Product requirements: `/docs/prd.md` (v0.3). If code and PRD disagree, stop and report it. Do not guess.
- Build order: `/docs/BUILD_PLAN.md`. You are given ONE phase at a time. Build only that phase. Do not build future phases, extra features or "nice to haves".

## Stack (fixed. Do not swap any of it)

- Mobile: React Native + Expo (TypeScript strict, Expo Router), EAS development builds (not Expo Go), Android + iOS.
- On-device: SQLite (expo-sqlite) for read caches and guest setup. Signed-in logging requires an acknowledged online save.
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
5. **All writes from the app must be idempotent** (client-generated UUIDs, upserts) so explicit retries never duplicate data.
6. **All timestamps in UTC.** Per-user "day" boundaries use the user's stored time zone.
7. **Calculations live in `/packages/core`** and are covered by unit tests (including the PRD 7.2 worked example). Never re-implement a formula in a screen.
8. **Safety rules are product rules:** calorie floors, rate caps, no ranking by weight loss or lowest calories, no health claims in fasting copy. Do not weaken them.
9. **Migrations only.** Never edit the database by hand; every schema change is a new migration file. Never edit an old migration after it has been committed.
10. **Tests are part of "done".** Logic, RLS policies and online save behaviour need automated tests. Run lint, typecheck and all tests before saying you are finished.
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
U11. Logging requires an internet connection. Confirm saves only after server acknowledgement and show actionable request errors.
U12. UI work never changes logic, schema, RLS, packages/core or entitlement checks.

## Git delivery (owner instruction, 24 October 2026)

- Commit and push requested changes after all required checks pass: format check, lint, typecheck and every test suite, plus an appropriate build check for UI/runtime changes.
- Do not push while any required check fails. Existing unrelated lint warnings do not authorize broad refactoring.
- Use the locally available CaliPartner deploy SSH identity matching the owner's supplied public key. Never copy a private key into the repository or logs.
