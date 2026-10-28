# Challenges audit — 28 October 2026 (CH-0)

## Finding

The Challenges tab is a local UI demo, not a working challenge system. Its active cards, seasonal participation counts, progress, feeds and completed results are fabricated. Creating or leaving a challenge only changes component state; refreshing loses the change. Seasonal joining, occasion saving and sharing do not produce durable server records.

This audit is the review checkpoint explicitly required by the supplied plan: **“CH-0 Audit (stop and show me before changing anything)”** and **“Make no code changes.”** No challenge implementation has been changed for this audit. The separately requested post-onboarding pair invitation is independent work.

## Files and navigation

| File | Current behavior / problem |
| --- | --- |
| `app/src/app/(tabs)/progress.tsx` | My progress / Leaderboard / Challenges navigation; mounts `ChallengesView` for the Challenges segment. |
| `app/src/components/progress/ChallengesView.tsx` | All / Active / Seasonal / Occasion / Completed filters exist. `DEFAULT_ACTIVE_CHALLENGES`, `SEASONAL_CHALLENGES` and `COMPLETED_CHALLENGES` supply invented people, dates, percentages, counts and feed items. Creation uses `Date.now()` and local state, not UUIDs/outbox/server validation. |
| `app/src/components/progress/CreateChallengeModal.tsx` | Local activity tiles and numeric caps/defaults; default partner is a sample person; no accepted participant IDs, persistence, privacy or server plan validation. |
| `app/src/components/progress/ChallengeDetailModal.tsx` | Displays the supplied mock object; leave is a callback changing local state. No server progress, daily results or translated event catalogue. |
| `app/src/components/progress/ChallengeResultModal.tsx` | Default title and completed-day values imply an earned result without data. Share and next-challenge actions are callbacks. |
| `app/src/components/progress/OccasionPlanModal.tsx` | Local event/date/weight flow. Hardcoded starting weight/date assumptions and weight change defaults. No server screening enforcement or saved timeline. Must not be used as a working safe-rate planner. |
| `app/src/components/progress/ChallengesComingSoon.tsx` | Existing honest placeholder, currently separate from the active demo. |
| `app/src/components/progress/progressUI.test.ts` | Mostly copy/presentation tests; no full lifecycle/permissions/clock/offline challenge tests. |
| `app/src/components/rooms/RoomExtras.tsx`, `app/src/services/roomExtrasService.ts` | A distinct, real seven-day food-logging pair challenge feature. It is not the Challenges tab's engine. |

## Existing backend and reusable code

- `pair_challenges` is the only relevant existing challenge table. It has IDs, room, creator/partner, pending/active/declined state and timestamps. RLS denies direct app access; the RPCs enforce membership, usable rooms, blocking and both participants' Plus access. `get_pair_challenges` derives logging days from daily summaries, respecting streak privacy. Existing automated tests cover that older feature. These rules conflict with the new plan's Free seven-day pair allowance and must be explicitly migrated; silently keeping two different products would be misleading.
- There are no general challenge templates, seasons, rules snapshots, participant day results, configuration, challenge event feed, counters, badge awards, forfeits or occasion-plan/milestone tables. There is no general challenge engine, service, offline outbox, finalization job or challenge reminder job.
- Reuse the authenticated profile projection, friendships/room membership, `active_room_tier`, room capacities/host limits and `create_room_v3` idempotency conventions.
- Reuse `food_entries`, `daily_summaries`, `water_logs`, activity/step records, workouts, focus sessions and weight-log **occurrence** data as metric sources. Challenges must never expose the source rows of another participant. Sensor/manual source eligibility and reliable distance availability need explicit validation against the current source fields.
- Reuse account-scoped SQLite/outbox patterns from `friendsService`, the existing sync/network hooks, i18n, shared UI tokens, quiet-hours notification pipeline, report/block flows and server-safe goal calculation functions. The new engine must not modify existing calorie, macro, streak or safety formulas.

## Confirmed hardcoded/fake content

- Active cards contain sample names, “Day 4 of 7”, “Day 2 of 7”, fixed dates, progress percentages and invented recent activity.
- Seasonal cards contain “1,420 joined”, “3,890 joined” and “850 joined”. There are no corresponding real counters.
- Completed cards and result defaults fabricate earned results; target limits/defaults/durations are defined in components.
- Multiple visible English strings bypass i18n. Components use static dark tokens and some literal geometry/colors rather than the active theme and shared layout tokens.
- Occasion defaults assume a weight loss and a fixed number of weeks. That flow needs replacement, not merely new styling.

## Migration/build plan

1. **CH-1:** Add a new migration for templates, seasons, versioned instances, participants, day results, events, public aggregate counters, config, forfeits, badges/awards and occasion timelines. Enable RLS on every table. Publish data through membership/consent-aware RPCs. Add catalogue translations and seed real template/config rows, never participant/result fixtures in production.
2. **CH-2:** Implement six deterministic rule formats in `packages/core`; take every threshold from config/rules. Capture rules snapshots, personal baselines, timezone/date rules, source eligibility, finalization delay, daily caps, eligible-day outcomes, shields/pause/cover and screening limits. Add recomputation/finalization jobs and real log-source integrations.
3. **CH-3:** Replace the demo with account-scoped server view models, cached/offline states, real Today due tasks, invites, filtered active/seasonal/completed sections and accessible progress summaries.
4. **CH-4:** Wire template/custom creation, target/duration validation, explicit invite acceptance, expiry, neutral outcomes and completion/recap to the server/outbox. Remove all mock defaults, invented feeds and fake completed cards.
5. **CH-5:** Add live updates/poll fallback, configured social actions, shields/cover, duel rematch/forfeits, comparison opt-out, report/block behavior and quiet-hours/mute notifications.
6. **CH-6:** Add the personal-clock seasonal calendar, chapters/reminders, verified opt-in community board and health-screened, safe-rate occasion milestones/event-week mode.
7. **CH-7:** Complete room co-op daily caps/host rules, badge/trophy awards, real-stat share images and purchased-Pro-only optional AI recap. No new paid/free AI exceptions.

## Decisions and assumptions to review

- Use the supplied plan's recommended choices: one Free solo season; personal seasonal clock; editable starter shield/pause/cover rules; opt-in public boards; non-monetary forfeit catalogue; December Winter Arc followed by January reset. These belong in database configuration, not components.
- The plan says one Free solo challenge and one Free pair challenge; treat those as separate scope limits, with the one Free season explicitly configured. Require confirmation if a single combined allowance was intended.
- Keep current design tokens. A global palette redesign is not required to make these screens theme-aware.
- Room membership alone must not expose challenge details. Explicit challenge acceptance and comparison/privacy settings still apply; public boards contain only consented identity, consistency percentage and rank band.
- Onboarding must present the invitation immediately after goal setup. Sharing should create an invitation, not occupy a hosted-room slot. Acceptance creates the two-person room atomically under the host quota. Invite links must survive authentication/onboarding, retries must not create duplicate rooms, and personal logging must remain available offline.

## Validation required after implementation

Use exactly two disposable Auth accounts for the end-to-end pair flow, with temporary Free/Plus/Pro fixtures attached only to those accounts. Exercise every seeded template and all six formats, creation/retry/quota, invite accept/decline/expiry, real logging/progress recomputation, local day/DST/finalization, privacy/block/leave/delete, shields/cover/pause/rest, template edits, plan lapse, seasons/counters/reminders, occasion screening and outcomes/rewards/sharing. Use controlled clocks/source fixtures in automated tests for long-running lifecycle cases; do not pretend a 75-day production run happened instantly. Remove all disposable data afterwards.

Run format, lint, typecheck, all unit/database/Edge/sync suites, platform exports, small-screen/font-scaling checks and live browser verification before commit/push. No challenge implementation or claimed end-to-end challenge pass belongs to CH-0 itself.
