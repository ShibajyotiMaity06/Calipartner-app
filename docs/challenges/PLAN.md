# CaliPartner — Challenges Section: Full Plan

**28 Oct 2026 · what is inside each part, how it works, and how to build it with no hardcoded values**

This plan is based on your three screenshots (Challenges tab: Active, Seasonal, Occasion Plans, Completed), the PRD safety rules, and the pricing and room decisions we made (free pair, host's Plus for rooms of 3 to 5, Pro for bigger rooms, per-person unlocks). I have **not** seen your code, so Phase CH-0 is an audit of what already exists. Use `{...}` placeholders in this file as "comes from data, never typed into the UI".

---

## 1. What your screenshots show, and what must change

| What I see | Problem | Fix (section) |
|---|---|---|
| "1,420 joined", "3,890 joined", "850 joined" on seasonal cards | Looks like hardcoded numbers. Invented counts mislead users and can break store rules on misleading claims. At launch the real number will be small | Real counters; show the number only when it is above a minimum, otherwise "Be one of the first" (6.2, 12) |
| "Priya", "Rahul", "You: 75%" / "Priya: 60%" | Names and percentages must come from the real partner profile and real progress | Per-participant day results (5, 11) |
| "Day 4 of 7", "Day 2 of 7" | Must be computed from the start date in the user's own time zone | 5.5 |
| "8,000 steps today", "60 minutes focus session" | Targets must come from the challenge rules and, by default, from each person's own baseline | 5.2 |
| "Join challenge" shown on every seasonal card | The button should change with state: join, joined, starts in N days, ended, locked | 4.3 |
| "New Year Habit Reset" has an "info" icon | Placeholder icon. Icons should come from the template | 11 |
| "Completed: 7 of 7 days with Priya", "2 of 2 days with Rahul" | Needs real per-day results, and wording that never says "failed" | 5.7 |
| The "AI Coach" floating button covers card content | Add bottom padding so the last card and the buttons are never hidden | 4.1 |
| Colours are the old Apricot theme | Use design tokens only, so the Steel + Silver palette applies without touching this screen's code | 12 |

---

## 2. The idea in one page

**A challenge is a short story you play with someone else.** It has a start, a daily moment that takes a few seconds, small wins along the way, and a finish you can share. The engine underneath is boring on purpose: a few rule types written once in code, and every challenge, season and number comes from data.

Principles:
1. **Compete with yourself, together.** Progress is "% of *your own* target", so a 4,000-step person and a 12,000-step person can share a challenge fairly.
2. **Consistency beats volume.** We reward showing up, never raw totals or weight changes.
3. **Kind by design.** Missed days are covered by shields, pauses and partner "cover", not red failure screens.
4. **Everything is data.** New challenges, new seasons and new text ship without an app update.
5. **Real numbers only.** If there is no data, show an honest empty state.
6. **Private by default.** A challenge shares only the metric it uses.

---

## 3. Building blocks

### 3.1 Who it is with ("scope")

| Scope | Meaning | Plan rules |
|---|---|---|
| **Solo** | Just you | Free: 1 active challenge at a time. Plus: more at once |
| **Pair** | You and your partner | Free pair: 1 active 7-day pair challenge. Plus: longer, more at once |
| **Room** | 3 or more people in a room | Needs a host with Plus (3 to 5 people) or Pro (more); each member sees details by their own plan, as agreed |
| **Season** | Everyone, on a calendar (Winter Arc, New Year...) | Personal progress plus a community board |
| **Occasion** | You and your partner plan toward a date (wedding, birthday, trip) | Separate flow, section 4.8 |

### 3.2 How it is scored ("format"). These are the only six rule types written in code.

| Format | Rule in plain words | Example (all data rows, not code) |
|---|---|---|
| **Streak** | Hit a daily target on N days | "8,000 steps a day" |
| **Total** | Add up a number until a goal | "Walk or run 100 km this month" |
| **Weekly rhythm** | Hit the target on at least K days in each week | "Step and workout goals, 5 days a week" |
| **Checklist** | Finish your chosen daily tasks (3 to 5) | Winter Arc: move, drink water, log meals |
| **Duel** | Two people, same week, whose % of their own target is higher; ends with a rematch | "Daily Steps Sprint" with a forfeit card |
| **Co-op** | A team fills one shared bar, with a per-person daily cap so nobody carries the room | "Squad walks 500 km together" |

### 3.3 What can be measured ("metrics"). Each one reads data you already collect.

| Metric key | Source | Notes |
|---|---|---|
| `steps` | Health platform, then phone sensor, then manual | Same source priority as the PRD; manual is allowed only if the template says so |
| `distance` | Same | GPS distance is added when GPS tracking ships |
| `workouts_count`, `workout_minutes` | Workout log | A rest-day rule is built in |
| `food_log_days` | Food diary | A day counts when the person logs at least the configured number of meals; this measures logging, not eating less |
| `protein_in_range` | Food diary and the person's target | A range ("at or above minimum, not extreme"), never a cap |
| `water_ml` | Water log | |
| `focus_minutes` | Focus timer | Powers "Deep Study 60" |
| `weigh_in_days` | Weight log | Counts the act of weighing, never the number |
| `partner_actions` | Nudges, cheers | Optional bonus tasks inside checklists |

**Not allowed as a challenge metric:** weight lost, calories under a limit, fasting length, body measurements, "burn X calories". See section 9.

---

## 4. The screens

### 4.1 Challenges home

```text
Challenges                                   [+ Create challenge]
Streaks, seasons and partner plans
[ All ][ Active ][ Seasonal ][ Occasion ][ Completed ]   (Invites dot)

TODAY                         (only if something is due)
  Steps          5,400 / 7,200   [Log now]
  Focus          0 / 60 min      [Start]
INVITES
  {Partner} invited you to {Challenge}      [View]
ACTIVE
  [card] [card]
SEASONAL        live now, then starting soon
  [card] [card] [card]
OCCASION PLANS
  [Plan for an event ->]  or  [active plan with countdown]
COMPLETED
  [row] [row]                                [See all trophies]
```

Rules:
- Sections with no content are **hidden**, except Active, which shows an empty state with a "Start one" button.
- "Today" is the most useful part. It lists what is still due across all active challenges, computed live, with a shortcut to the screen where the person logs it.
- Add bottom padding equal to the tab bar plus the AI Coach button, so nothing is covered.
- Order inside Seasonal: joined first, then live and ending soonest, then upcoming.

### 4.2 Active challenge card (what is on it and where each piece comes from)

| Element | Source |
|---|---|
| Icon | `template.icon_key` mapped to the icon set |
| Title | Template title key, or the creator's own title for custom challenges |
| Orange subtitle ("8,000 steps today") | Generated from the rule: `{target} {unit_label}`; the target is the person's own personal target |
| "Day 4 of 7" | `floor((today_local − start_local) / 1 day) + 1` over `duration_days`, in the person's time zone |
| Rings and "You: 75%" / "{Partner}: 60%" | Today's `value ÷ personal_target` for each participant, from day results, capped at 100% for the ring |
| Names and photos | Profiles of the participants, with their consent settings |
| State badge | Joined / Waiting for {partner} to accept / Paused / Ending today |

### 4.3 Seasonal card: one button, many states

| State | Button and text |
|---|---|
| Upcoming, not started | "Starts in {n} days" with **Remind me** |
| Open, not joined | **Join** (shows plan lock if the plan does not include it) |
| Joined, running | "Day {d} of {n}" with a small progress bar; tap opens detail |
| Ended, you took part | "View results" |
| Ended, you did not | Hidden |
| Locked by plan | Lock icon; tap shows what the plan includes (never a fake countdown) |

The line "{n} joined" shows only when the real count is at least `challenge_config.min_public_count`; otherwise show "Be one of the first".

### 4.4 Challenge detail

```text
< {Title}                                   {share}  {menu}
Day {d} of {n} · {days_left} days left
        (  you ring  ) (  partner ring  )
        {You 75%}      {Priya 60%}
Days   o o o o x o o  (pass / partial / missed / shield / paused / rest / upcoming)
TODAY'S TASKS
  Steps  5,400 / 7,200        [Log now]
SHIELDS  {s} · Pause {p} days left       [Cover for me?]
RULES   rule summary · forfeit card (if any)
ACTIVITY
  {Priya} finished today's goal · {time}
  [Cheer] [Nudge]
```

Duel challenges show a head-to-head bar; co-op shows one team bar made of member segments. Everything on this page is read live from day results and the activity feed.

### 4.5 Create challenge (a short wizard)
1. **Pick a template** (or "Build your own").
2. **With whom:** just me, my partner, my room. Options are filtered by the person's plan and limits.
3. **Target:** defaults to a personal target (5.2). Same-target-for-both is an option.
4. **Duration:** only the options the template and plan allow (for example 7 days on Free).
5. **Extras:** rest days, allow manual entries, forfeit card (duels only).
6. **Review and invite.** Pair and room challenges wait for acceptance.

All limits (maximum duration, targets, number of active challenges) are validated **on the server** from config, so the app can never create a challenge the rules forbid.

### 4.6 Invite flow
- The invite expires after `invite_expiry_hours` (config). Both people must accept before a pair challenge starts.
- Start day: the next local midnight, or a day the creator picks within `max_start_delay_days`.
- If declined or expired, the creator gets a gentle message and a button to try another challenge. Never "they ignored you".

### 4.7 Completion screen
- Real stats: days passed, longest streak, totals, who cheered. Badge awarded, share card (section 8), and a **Rematch** or **Next challenge** button.
- "Next challenge" suggestions come from simple rules: a longer version, a partner version, or the current season.
- Wording: **Completed** when the pass rule is met, otherwise **Finished: {x} of {y} days**. Never "Failed".

### 4.8 Occasion plans ("Partner Event Planning")
Purpose: plan toward a date with your partner (wedding, birthday, vacation) without crash dieting.
1. Choose event type and date. Weeks left are computed.
2. Choose what you want to focus on: **habits** (steps, workouts, water, protein) or, if the person wants, a gentle body goal.
3. For a body goal the **safe-rate engine** from the PRD runs first. If the date is too close for a safe change, the app says so and suggests a smaller, kinder goal. Never an unsafe target.
4. The result is a **timeline of weekly milestones** both partners see, with a countdown.
5. **Event week mode** (links to the flexible-week feature): lighter targets in the week before, a plan for the day itself, and a recovery plan after. No guilt.
6. Hidden entirely when the person's health screening says so.

### 4.9 Completed and trophies
Rows show title, partner, result ("7 of 7 days"), and date. Tapping opens the recap. A **Trophy shelf** (badges earned) lives here and on the profile.

---

## 5. How progress works (the rules the engine follows)

### 5.1 One record per person per day
Each participant has a `day_result` for every day of the challenge: `value`, `target`, `status`, `source`. Everything on screen is built from these rows. The **server** calculates them. The app never calculates progress on its own.

Statuses: **pass**, **partial**, **miss**, **shield** (saved by a shield), **covered** (saved by partner), **paused**, **rest**, **pending** (waiting for data sync), **upcoming**.

### 5.2 Personal targets (fair play)
Default target = the person's own median for that metric over the last 14 days, plus a small stretch (`stretch_pct`), kept inside safe caps per metric (`metric_caps`). If there is too little history, use a starting level based on the activity level chosen in onboarding. The person sees "Based on your last 2 weeks" and may adjust within `target_adjust_pct`. A pair may choose "same target for both" instead. All numbers live in config.

Daily scores are **capped at 100%**, so one huge day cannot win a challenge. The ring may show extra as a "bonus" label, but it never counts.

### 5.3 Pass rules
Each template has a `pass_rule`: all days, at least N days, or K days per week. Percent thresholds are data.

### 5.4 Shields, pause and "Cover for me"
- **Shield:** earned after every `shield_every_days` passed days (up to `shield_max`). A missed day uses one automatically, so the streak survives one bad day.
- **Pause:** up to `pause_days_max` days per challenge for illness or travel. Paused days leave the maths with no penalty.
- **Cover for me:** a partner may spend one of *their* shields to save your missed day, once per challenge (`cover_max`). Both see it in the feed. This is the feature people will talk about.
- **Rest days:** workout and rhythm challenges always include rest days.
- Suggested starting values (all editable in config): a shield after every 7 passed days, at most 2 held, 3 pause days, 1 cover.

### 5.5 Days, time zones and late data
- A "day" is the person's **local** day, taken from their stored time zone, with the zone captured at join and updated when they travel.
- A day stays **pending** until `result_finalize_delay_hours` after midnight so late step syncs count. The UI shows "Syncing...".
- Joining after the start is allowed for seasons (personal clock), and for pair challenges only before day 2, by config.

### 5.6 Keeping it honest (anti-cheat, without accusing anyone)
- Source priority: health platform, then phone sensor, then manual. Templates say whether manual counts.
- Plausibility limits per metric (for example the maximum steps in a minute) sit in config. A flagged day is marked **unverified**.
- Unverified days still count in private pair or room challenges (friends trust each other) but are excluded from public season boards.
- Nobody is ever labelled a cheater in the UI.

### 5.7 Outcomes
Completed, Finished (partial), Left early, Cancelled (a partner left; it converts to solo with no penalty). All wording is neutral and from the text catalogue.

---

## 6. Seasons and the calendar (all data)

### 6.1 How a season works
A season is a calendar row: name, start, end, regions, and the templates inside it. A template such as Winter Arc has a **personal clock** inside the season window: you start your own 75 days when you join, so latecomers are not behind. The community board ranks by **consistency %**, not by volume. A season can be shown early as "Starts in {n} days" with a reminder, so people can plan.

Seasons can have **chapters** (milestones at set day numbers) that unlock cosmetic rewards and a short recap, for example "Foundation", "Build", "Peak", "Finish line". Chapters are data rows with day numbers and text keys.

### 6.2 Community numbers
- `joined_count` and `completed_count` are counters updated by the server.
- Show them only above `min_public_count`. Below that, "Be one of the first".
- Never show another person's raw steps, calories or weight on a public board. Show consistency % and rank bands.

### 6.3 Starter seasons (seed data, India-first; every row is editable in the database)
| Season / template | Duration | Format | Idea |
|---|---|---|---|
| Winter Arc | 75 days | Checklist | Non-negotiables: move, water, log meals (person picks 3 to 5) |
| New Year Habit Reset | 30 days | Streak | Log nutrition with your partner |
| Summer Consistency | 60 days | Weekly rhythm | Step and workout goals 5 days a week |
| Monsoon Move (idea) | 30 days | Streak | Indoor-friendly movement |
| Festive Balance (idea) | 14 days | Checklist | Enjoy the festival, log it, keep a walk |
| Republic Day and Independence Day runs (ideas) | 7 days | Total | Distance goals |

Keep festival and fasting content **optional and respectful**. Hide it when the profile or the health screening says so.

### 6.4 Starter templates for everyday use
Daily Steps Sprint (7 days, streak), Focus Streak ("Deep Study 60", 7 days), Hydration Kickstart (7 days), Weekend Warrior (2 days), Log It (7, 14 or 30 days), Protein Pals (5 of 7 days in range), Move Together (a co-op pair week), plus Duel and Co-op versions of steps.

---

## 7. The social layer

| Feature | How it works |
|---|---|
| **Live rings** | When your partner hits their goal, your screen updates in real time (Supabase Realtime), with a small animation. Falls back to refresh |
| **Nudge and Cheer** | One tap. Nudges are limited per day by config. Cheers are unlimited and gentle. Never a message that says "you missed" |
| **Cover for me** | See 5.4 |
| **Forfeit cards** | For duels only. A fun, **non-monetary** card from a catalogue ("loser makes the chai"). Shown in the feed and on the share card. **No real-money stakes** (gambling rules on both stores). Custom forfeit text is length-limited and filtered |
| **Rematch** | One tap after a duel, with the same rules |
| **Co-op team bar** | Segments by member, per-person daily cap, "everyone contributed" milestone. The weekly highlight goes to the most **consistent** member, not the highest total |
| **Room challenges** | The host creates them. Capacity follows the host's plan. Details that are locked for non-Plus members stay locked per person, as decided before |
| **Activity feed** | Joined, passed today, used a shield, covered, finished. Each line has a type, text key and parameters, so it is translated and never hardcoded |
| **Leaderboards** | The weekly leaderboard stays in the Leaderboard tab. A challenge shows its own standing: consistency % and rank band. Public boards are opt-in |

---

## 8. Rewards (no money, no pressure)
- **Badges:** data rows with a rule (for example "complete a 30-day challenge", "use Cover for me", "finish all chapters of a season"). Shown on a **Trophy shelf**.
- **Streak flames** and **chapter frames** around the avatar, as cosmetic rewards.
- **Share card:** an image generated from real stats (days, streak, partner name if they agreed). It never shows weight, calories or body measurements.
- **Recap text:** a plain-language recap when a challenge ends. Pro can add an AI coach recap that reads your last weeks.
- No points that can be bought, no prizes of value, no countdown pressure.

---

## 9. Safety and wellbeing (these override fun)

1. No challenges about weight lost, calorie limits, fasting length, extreme workouts or body measurements.
2. Food challenges measure **logging** and **protein in range**, never eating less.
3. Challenge screens never show other people's calories or weight, only % of their own target.
4. Maximum targets and durations are capped in config per metric. The server rejects anything above.
5. Rest days and illness pause are built in. No shaming language.
6. Respect the PRD's age rules and the health screening: hide fasting, intensity and event body-goal features when the screening says so.
7. A report and block option exists on every shared challenge. Blocked or removed users leave all shared challenges, and the rest convert to solo with no penalty.
8. "Opt out of comparisons" in settings hides rings and ranks from others and keeps only personal progress.
9. Add a plain line in each challenge: general guidance only, not medical advice.

---

## 10. Plans and gating

| | Free | Plus | Pro |
|---|---|---|---|
| Solo | 1 active, 7-day starter templates | Several at once, all templates | Same as Plus |
| Pair | 1 active 7-day pair challenge | 14, 30, 60, 75-day, several at once | Same |
| Duel and forfeit cards | Duel yes, forfeit cards locked | Both | Both |
| Seasons | See them and set reminders. **Recommended:** let Free join **one** season solo with the basics | Join several, partner and room mode, shields extras, chapters and recap | Same, plus AI recap |
| Create your own | Locked | Yes (within limits) | Yes |
| Shields and Cover for me | 1 shield held, no cover | Full | Full |
| Rooms | Capacity by host (Plus: up to 5 including you; Pro: more) | Host's Plus unlocks room challenges | |
| Badges and Trophy shelf | Basic badges | Full shelf and share card variants | Same |

I'd soften one earlier decision: let Free users join **one** season solo. Seasons are your biggest marketing moments, and a visible community is worth more than a locked card. Plus extras (partner and room mode, shields, chapters, recap, share cards) still give people a reason to upgrade. The decision is yours, section 16.

Locked items show what Plus adds and a trial button. They are never fake counters or timers. All limits come from `challenge_config` and the plan table, so you can change them without an update.

---

## 11. Data model (names are suggestions)

| Table | Key columns |
|---|---|
| `challenge_templates` | `id`, `slug`, `format` (streak, total, weekly_rhythm, checklist, duel, coop), `metric_key`, `scope_options`, `duration_options`, `target_rule` (json: baseline window, stretch, caps), `pass_rule` (json), `plan_required`, `season_id`, `icon_key`, `title_key`, `desc_key`, `chapters` (json), `allow_manual`, `safety_flags`, `active`, `version` |
| `challenge_seasons` | `id`, `name_key`, `starts_at`, `ends_at`, `regions`, `sort`, `visible_from` |
| `challenges` (an instance) | `id`, `template_id`, `template_version`, **`rules_snapshot`**, `creator_id`, `scope`, `room_id`, `start_date`, `end_date`, `status`, `forfeit_id` |
| `challenge_participants` | `challenge_id`, `user_id`, `status` (invited, joined, left, completed, finished), `personal_target`, `tz`, `shields`, `pause_days_used`, `cover_used`, `joined_at` |
| `challenge_day_results` | `challenge_id`, `user_id`, `local_date`, `value`, `target`, `status`, `source`, `verified` |
| `challenge_events` | `challenge_id`, `type`, `actor_id`, `params` (json), `created_at` (the activity feed) |
| `challenge_counters` | `template_id`/`season_id`, `joined_count`, `completed_count` |
| `badges`, `user_badges` | rule keys, `earned_at`, `challenge_id` |
| `forfeit_cards` | `id`, `text_key`, `active` |
| `occasion_plans`, `occasion_milestones` | event type, date, partner, plan json, milestone rows with week numbers and status |
| `challenge_config` | key and value rows for every number in this document, editable without a release |

Key decisions:
- **`rules_snapshot` is copied into each running challenge**, so editing a template never changes challenges already in progress.
- **Row-level security:** only participants can read a challenge's results. Room challenges require room membership. Public counters are separate and carry no personal data.
- **Server jobs:** (1) recompute day results when new data syncs and hourly; (2) finalise days after the delay; (3) apply shields; (4) end and finalise challenges; (5) update counters and award badges; (6) send reminders.
- **Pure rule logic** (targets, pass rules, shields, outcomes) goes in `/packages/core` as deterministic functions with tests, like your other calculators.
- **Notifications** (all text from catalogue keys with parameters, per-challenge mute, quiet hours): invite received, start tomorrow, morning "today's goal is {target}", evening "{remaining} to go", partner finished (opt-in), cheer received, shield used, challenge ends tomorrow, completed.

---

## 12. "No hardcoded values": the rules for the agent and for review

1. Every visible string comes from the **text catalogue** with parameters (names, numbers, plurals). No literal English in components.
2. Every number on screen is read from the database or computed from it: counts, percentages, days, targets, remaining amounts, durations.
3. Every threshold (caps, delays, limits, shield rules, minimum counts) lives in `challenge_config` or the template rules.
4. Names and photos come from profiles. Dates come from server time and the person's stored time zone.
5. Icons come from `icon_key`. Colours, spacing and radii come from **design tokens only**, so the palette change needs no edit here.
6. Sample data exists only in seed scripts and test fixtures. Production screens use real data or an honest empty state.
7. Review checklist for every pull request: search the repo for the sample names ("Priya", "Rahul"), digit literals inside challenge components, and hex colours. Zero matches are allowed outside tests and seeds.
8. Loading, empty, error and offline states exist for every section and card.

---

## 13. Edge cases the agent must handle
- Phone without a step sensor or health permission: hide step challenges, or offer manual entry only where the template allows it.
- Partner leaves, deletes their account or is blocked: the challenge becomes solo with no penalty, and their data is anonymised.
- Invite not accepted before it expires: show a neutral message and offer to resend.
- Person travels across time zones or changes the phone clock: use the stored zone and compare with server time. Ignore client-side clock changes.
- Late data arrives for a finalised day: ignore after finalisation and show the final state. Never rewrite history silently.
- Target changed mid-challenge: allowed once, only downward in the first days, logged in the feed.
- Template edited while challenges run: running challenges keep their snapshot.
- Duplicate challenge creation: enforce limits with a server check and an idempotency key.
- Challenge outcome when a participant is paused for most of it: score by passed days over eligible days.
- Plan changes mid-challenge (Plus ends): running challenges continue to the end; new creation follows the new plan.

---

## 14. Measuring success
Events: `challenge_viewed`, `join_tapped`, `joined`, `invite_sent`, `invite_accepted`, `invite_expired`, `day_passed`, `shield_used`, `cover_used`, `paused`, `completed`, `finished_partial`, `share_tapped`, `lock_tapped`, `create_started`, `created`, `rematch_tapped`.

What to watch: join rate by template, completion rate by format, accepted-invite rate for pair challenges, 30-day retention of people in a challenge against those not in one, lock taps that become trials, and which formats make people open the app on a day they would otherwise skip.

---

## 15. Build phases (prompts for Antigravity)

Release mapping (matches your monthly rollout): CH-0 to CH-4 before launch, CH-5 shortly after, CH-6 in time for Winter Arc in December, CH-7 later.

**Rules block to paste at the top of every prompt**
```text
Follow CaliPartner_Challenges_Plan.md. Do not hardcode any user-visible string, number, name, colour or threshold (plan section 12).
All text through the text catalogue, all numbers from the database or computed server-side, all limits from challenge_config, all styling from design tokens.
Pure rule logic goes in /packages/core with unit tests. Do not change calorie, macro, streak or safety logic elsewhere.
Finish with typecheck, lint, tests, and a list of anything not done.
```

**CH-0 Audit (stop and show me before changing anything)**
```text
Find every file for the Challenges tab, Occasion Plans and Completed challenges. List: existing tables and enums, existing queries, mock or hardcoded data
(search for "Priya", "Rahul", "joined", digit literals, hex colours in these components), current navigation and filters.
Write docs/challenges/AUDIT.md with what exists, what is fake, what can be reused, and a migration plan. Make no code changes.
```

**CH-1 Data foundation**
```text
Create migrations for the tables in plan section 11 (templates, seasons, challenges with rules_snapshot, participants, day_results, events, counters, badges,
forfeit_cards, occasion_plans, occasion_milestones, challenge_config) with row-level security as described, indexes, and seed scripts for the starter templates and seasons in 6.3 and 6.4.
Add text-catalogue keys for every string. Write RLS tests: a user cannot read another user's challenge, room members can read room challenges, counters are public but contain no personal data.
```

**CH-2 Engine (server and core)**
```text
In /packages/core implement the six formats, personal target calculation, pass rules, shields, pause, cover, outcome and anti-cheat flags as pure functions driven by the rules json.
Add server functions and scheduled jobs: recompute day results, finalise days after the configured delay, apply shields, finish challenges, update counters, award badges.
Tests must cover: time zones and travel, late sync, paused days, cover, partner leaving, template edits during a running challenge, and daily score caps.
```

**CH-3 Challenges home**
```text
Rebuild the Challenges tab per plan section 4.1 to 4.3 using view models from the server: Today strip, Invites, Active cards, Seasonal cards with the state machine, Occasion entry, Completed rows.
Filters: All, Active, Seasonal, Occasion, Completed. Real loading, empty, error and offline states. Add bottom padding so the AI Coach button never covers content.
Remove all mock data. Use design tokens only.
```

**CH-4 Detail, create, invite, completion**
```text
Build the detail screen (4.4), the create wizard with server-side limit validation (4.5), the invite and accept flow (4.6) and the completion screen (4.7) with the neutral wording rules.
Plan gating from the plan table and the config, with lock screens that explain what Plus adds. Add analytics events from section 14.
```

**CH-5 Social layer**
```text
Add live rings with Supabase Realtime and a polling fallback, Nudge and Cheer with daily limits from config, Cover for me, the activity feed, notifications with quiet hours and per-challenge mute,
Duel with forfeit cards and Rematch. Add safety features from section 9: report, block, opt out of comparisons.
```

**CH-6 Seasons and Occasion plans**
```text
Seasonal calendar with the personal-clock model, chapters, reminders ("Remind me"), counters shown only above min_public_count, the community board by consistency percent and rank band, plan gating.
Occasion plans per 4.8: event, date, timeline of weekly milestones using the safe-rate engine, event-week mode, hidden by health screening. Make Winter Arc the first live season.
```

**CH-7 Rooms, rewards and sharing**
```text
Co-op team challenges for rooms with per-person daily caps, host and capacity rules, per-person unlock of details. Badges and Trophy shelf, chapter frames, share card generation from real stats only (no weight or calories),
Pro AI recap hook. Add the dashboard of events and the success metrics from section 14.
```

**Review loop for every phase:** run the app on a real Android phone, check each state (loading, empty, error, offline, locked), search the repo for hardcoded names, numbers and colours, and run the tests before moving on.

---

## 16. Decisions for you (my recommendation first)

1. **Free users and seasons:** let Free join one season solo (recommended), or keep seasons fully Plus.
2. **Seasonal clock:** personal 75-day clock inside a season window (recommended), or everyone on the same calendar dates.
3. **Shield and cover numbers:** start with a shield every 7 passed days, 2 held, 3 pause days, 1 cover, and tune after real data.
4. **Public leaderboards:** opt-in only (recommended).
5. **Duel and forfeit cards:** keep them, non-monetary (recommended). They are fun and drive rematches.
6. **First seasons:** Winter Arc in December, then New Year Habit Reset in January, as in the release plan.

---

**Reliability note:** this plan is built from your screenshots, the PRD and our earlier decisions, not from your code. The numbers marked as "suggested" are starting points to tune with real data. Health-related rules (sections 4.8 and 9) should be reviewed by a registered dietitian before launch.