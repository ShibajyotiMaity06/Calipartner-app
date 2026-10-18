### 7.M Progress, leaderboard and challenges

The Progress tab has three segments: **My progress · Leaderboard · Challenges** (PRD 6.26). Charts follow CMP-14. Rankings are on consistency only, never on weight lost, calories or measurements (RNK-1).

#### M01 · My progress (hub) · PRG-1 to PRG-10, PRG-14 · P0
**Purpose:** see how things are going without a wall of charts.
**Layout:** range chips (7 d, 30 d, 90 d, 6 m, 1 y, All) pinned under the segmented control · a vertical stack of summary cards, each with a title, one headline number and a small sparkline: **Weight**, **Calories**, **Macros**, **Steps**, **Water**, **Workouts**, **Consistency**, **Focus** (and **Fasting** if turned on) · each card opens a detail screen (M02 to M08) · at the top a one-sentence summary of the week in plain words (P1, PRG-11).
**Interactions:** tap a card for its detail; long-press a chart point to see the day; "View as table" on every detail.
**States:** a chart with too little data shows what to log to see it ("Log 3 weigh-ins to see your trend") with a button, never an empty axis (PRG-10).

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| M02 | Weight detail | Same as E06 with a goal line, start, current, change, pace and projected date | Raw dots + 7-day average | PRG-2, PRG-9 |
| M03 | Calories detail | Bars of daily intake vs target band, weekly average, adherence "5 of 6 logged days in range" | No red or green; in-range days use the owner's hue, out-of-range use outlined bars | PRG-3 |
| M04 | Macros detail | Average protein, carbs, fat per day vs targets as three horizontal bars | Values are numbers as well as bars | PRG-4 |
| M05 | Steps and water detail | Two stacked bar charts, weekly averages, goal lines | Segmented control Steps / Water / Distance | PRG-5, PRG-6 |
| M06 | Workouts detail | Sessions per week, total duration, total volume; exercise picker with heaviest weight and estimated 1RM over time | PR points marked with a dot | PRG-7 |
| M07 | Consistency and streaks | Weekly Consistency Score history (0 to 100) as a line, streak history, explanation of how the score is built | The formula is explained in words, not hidden | PRG-8, STR-3 |
| M08 | Focus detail | Minutes per day and week against the optional goal, totals by label, longest session | Never ranked | PRG-14, FOC-10 |
| M09 | Weekly and monthly summary | Auto-generated paragraph from the numbers + three small stats | Shareable as card (M10) | PRG-11, P1 |
| M10 | Share progress card | Preview of a privacy-safe image (no exact weight unless chosen), Share button | Uses the native share sheet | PRG-13, P1 |

#### M11 · Leaderboard · RNK-1 to RNK-7 · P0
**Purpose:** a friendly weekly comparison that cannot reward unhealthy behaviour.
**Layout:**
1. A persistent single line above the list (not behind an info icon): **"Ranked on consistency and how close you get to your own goal. Not on eating least."**
2. **Division chips:** Cutting · Bulking · Maintain · Beginner (first 28 days).
3. **Top 10 list:** rank in `numeral-m`, avatar, nickname, consistency score. No weights, no calories.
4. **Your row pinned** at the bottom of the list with a `hairlineLit` edge and `s2` fill (not a special colour), so first and fortieth look equally dignified.
5. Footer: "Weekly reset on Monday." and a link "Hide me from leaderboards" (RNK-6).
**Interactions:** tap a row to see only nickname and avatar (no profile).
**States:** the cohort is about 100 people matched by time zone and region (RNK-3); new users see "Your first ranking arrives on Monday."; opted out → "You're hidden. Turn this back on in Privacy."
**Copy rule:** no medals or trophies; rank is a number.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| M12 | Monday recap | Sheet: your score, change from last week in plain words, one highlight, "See leaderboard" | Ties broken by logged days then earliest completion | RNK-5 |

#### M13 · Challenges list · CHL-1, CHL-2, CHL-5 (NEW) · P1
**Purpose:** find, join and track challenges.
**Layout:** primary "Create challenge" button at the top right · **Active** section: ChallengeCard per challenge with a progress state ("Day 3 of 7", PairRing for your pair) · **Seasonal** section: full-width cards with duotone imagery (Winter Arc, New Year, summer cut) · **Occasion plans**: a card "Plan for an event" (birthday, wedding, trip) → M16 · **Completed** collapsed list.
**Interactions:** tap a card → M14.
**Imagery rule:** this is one of only two places for gradients and imagery (with the paywall hero).

#### M14 · Challenge detail · CHL-1, CHL-5 · P1
**Layout:** title, activity glyph, date range and day count · **paired or group progress**: for two people the PairRing/PersonColumn pattern (percent of each person's own goal, neutral colours); for a room, member chips with a progress bar each (no ranking) · today's task line ("8,000 steps today") · activity feed for the challenge (plain rows) · footer: how it is scored in one sentence ("Counts days you reach your goal. Not calories.") · menu: Leave challenge (confirm).
**States:** upcoming → "Starts Monday"; finished → M17.

#### M15 · Create challenge · CHL-5 (NEW), based on your screenshot · P1
**Purpose:** a friend challenge in under 20 seconds.
**Layout (top → bottom):**
1. **Header:** back, title "Create challenge".
2. **Activity** (label `label`): a 3×2 grid of tiles (about 104×88, radius 16, `s1`, 1 px `hairlineLit`): **Walking, Running, Studying, Gym, Cycling, Custom**, each a 28 px line icon and a name. Selected tile: apricot 16% fill, apricot edge, apricot icon.
3. **Goal:** a field with a unit chip that changes with the activity: Walking "steps a day" (default 8,000), Running "km a day" (3), Studying "minutes a day" (60, uses Focus Time), Gym "workouts a week" (3), Cycling "km a day" (10), Custom "times a day" (1, a daily tick with a name field). Stepper ± buttons on the field (48×48), tabular number.
4. **Duration:** chips **1 day · 7 days · 30 days** (selected = apricot style). Seasonal 30/60/90 stay on admin-made challenges (CHL-1).
5. **Partner (optional):** a search row "Add a partner or room" with the avatar chips of your room members; search accepts @username (only people already in your room or on your accepted list, so the challenge never becomes a way to message strangers). If left empty, the challenge is solo or for the whole room (switch "Whole room").
6. **Summary line:** "You and Priya · 8,000 steps a day · 7 days · starts today."
7. **Primary button (pinned, 56):** **Create challenge**.
**Interactions:** tile tap = light haptic; Create sends invites to the chosen people (they accept in K01) and opens M14.
**Guardrails:** goals have sane limits per activity (for example steps 1,000 to 30,000, Focus up to 8 hours); **there is no calorie or weight-loss activity tile**; copy says "Counts days you reach your goal" and scores consistency, never "most" or "fastest" (PRD healthy-use rules).
**Data note:** Running and Cycling use distance from Health Connect / HealthKit or manual entry in v1; in-app GPS is a later feature (STP-6, P2). If Health is not connected, the tile shows a small "Needs Health sync" hint, not an error.
**States:** missing partner and "Whole room" off = solo; room locked → partner row disabled with "Room is paused".
**A11y:** tile grid is a radio group; the unit chip is part of the field label.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| M16 | Occasion plan wizard | Step 1 pick event (birthday, wedding, trip, New Year) and date; Step 2 current weight and target; Step 3 the plan: weekly targets inside safe rate caps, shown as a simple timeline; primary "Make it a room challenge" | If the wish is unrealistic: "That's quicker than is safe. Here's a plan that works by 20 Dec." and a realistic date | CHL-2, CHL-3 |
| M17 | Challenge result | Sheet: days completed, a plain sentence, share-to-chat button, "Start another" | No medals; a small cream check mark | CHL-1 |
