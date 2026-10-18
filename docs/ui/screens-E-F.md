### 7.E Water, steps, weight and workouts

#### E01 · Water · WAT-1 to WAT-5 · P0
**Purpose:** log water in one tap.
**Layout:** header "Water" with unit toggle (ml / fl oz) · a large bottle or ring showing today's total `numeral-l` and "of 2,500 ml" · three quick buttons (Glass 250 ml, Bottle 500 ml, Large 1 L) at 56 high in the thumb zone · "Custom amount" text button (E02) · below: today's entries (time, amount; swipe to delete) · bottom: reminder row (WAT-4) with a switch and times.
**Interactions:** each tap fills the bottle with a 220 ms animation and a light haptic; toast "Added 250 ml. Undo." for 4 s.
**States:** goal reached → bottle full, caption "Goal reached"; no reminder yet → short suggestion.
**A11y:** the bottle reads "1,250 of 2,500 millilitres".

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| E02 | Water custom / goal (sheet) | Numeric field with ml / fl oz, "Save"; below, "Daily goal" with stepper in 250 ml steps | Default is 35 ml/kg rounded to 250, min 1,500, max 4,000 | WAT-2 |
| E04 | Step source and background help | Source list (Health Connect / HealthKit, phone sensor, manual) with the active one marked; battery-optimisation tips for Android (Xiaomi, Vivo, OPPO) | "Fix step counting" checklist; "Last synced 2:14 pm" | STP-1, STP-4 |
| E05 | Weight log (sheet) | Big numeric field, unit chip, date (defaults today, back-datable), Save | Shows change vs last entry in plain words | TRK-1, TRK-2 |
| E07 | Add measurement | Chooser (waist, chest, hips, arms, thighs), value, date | Private by default | TRK-3, P1 |
| E08 | Progress photos | Grid by date, add-photo tile, compare two photos side by side | Private by default; stored encrypted; "Only you can see these" | TRK-3, P1 |

#### E03 · Steps and distance · STP-1 to STP-5 · P0
**Purpose:** show steps, distance and an informational calorie estimate, with the source.
**Layout:** big ring or arc with steps `numeral-l` and "of 8,000" · three stat tiles: distance (km), active estimate (kcal, labelled "estimate, not added to your target"), average this week · a 7-day bar chart with today outlined · source line "From Health Connect · last synced 2:14 pm" with a tap target to E04 · "Edit step goal" row.
**States:** no permission → permission primer (A14) in place of the ring; sensor only → "Counting on this phone"; manual → numeric field.
**Copy:** "Exercise calories are not added back to your target."

#### E06 · Weight and body · TRK-1, PRG-2 · P0
**Purpose:** see the trend, not the noise.
**Layout:** summary strip: current, start, change (kg and %), weekly pace · chart card: raw dots plus a 7-day moving average line and a dashed goal line; range chips 7 d, 30 d, 90 d, 6 m, 1 y, All · "Projected to reach your target around 14 Feb" in `body-s` · history list · "Add measurement" and "Progress photos" rows.
**Interactions:** tap a point shows a tooltip; long-press edits the entry.
**States:** fewer than 3 entries → "Add a few more weigh-ins to see your trend."
**Copy:** a quiet note "Daily weight moves up and down. The line shows the trend."

#### E09 · Workouts hub · WRK-1, WRK-6, WRK-7 · P0
**Purpose:** log, repeat and review workouts.
**Layout:** header with a list / calendar toggle · today's card (workouts done or "Add workout") · "Repeat a previous workout" horizontal list (WRK-6, two taps) · history list grouped by week with type icon, name, duration, volume or distance · primary "Start workout" pinned.
**Interactions:** tap history to open E15; swipe to delete with undo.
**States:** empty → "Log your first workout" with the three types.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| E10 | Choose workout type | Six tiles: Strength, Cardio, Sports, Yoga or Mobility, Walk or Run, Other + optional name, start time, effort 1 to 10 | Strength → E11, others → E14 | WRK-1 |
| E11 | Strength session (active) | Top: running timer (WRK-10) and Finish; list of exercises each with "Last time: 3 × 8 at 40 kg" (WRK-5); sets as rows (reps, weight, done check); "Add set"; "Add exercise" | Reorder by drag; rest timer button (E17); keeps running in background and survives app kill | WRK-2, WRK-5 |
| E12 | Exercise library | Search, filters (muscle group, equipment), list of 300+ exercises, "Create custom" | Multi-select adds several at once | WRK-4 |
| E13 | Exercise detail / create custom | Name, muscle group, equipment, notes; history chart (heaviest weight, estimated 1RM) | Custom exercises are private | WRK-4, PRG-7 |
| E14 | Cardio log | Duration, optional distance, auto pace or speed, effort, notes | Calories estimate shown as informational | WRK-3 |
| E15 | Workout summary | Duration, total volume, MET-based calorie estimate (label: estimate), PR badges (plain text chips), "Share to room" switch, "Save as routine" (P1) | Edit and delete | WRK-8, WRK-9 |
| E16 | Routines | List of saved routines, tap to start, edit, duplicate | P1 | WRK-11 |
| E17 | Rest timer (sheet or inline) | Large countdown, +15 s, skip; local notification when done | P1 | WRK-12 |

### 7.F Fasting (optional, off by default)

Fasting is never shown unless the user turns it on **and** screening allows it. It is never in the consistency score, leaderboards or challenges (FST-8), and it avoids all health claims (FST-10).

#### F03 · Fasting timer (active) · FST-3, FST-4, FST-12 · P0
**Purpose:** show the current fast or eating window.
**Layout:** state label ("Fasting" or "Eating window") · ring with `numeral-l` elapsed and "of 16 h" · remaining time and the next change ("Eating window opens at 12:30") · times for start and end (tap to edit, F04) · primary "End fast" (or "Start fast") · protocol chip (16:8, tap to change) · shown on Today as a compact card that opens this screen.
**Interactions:** logging food while fasting never blocks: sheet "Log this and end your fast?" with "Log and end", "Log and keep fasting" (FST-5).
**States:** passes 20 hours → check-in sheet; 24 hours → strong "End your fast" prompt (F06). Timers use stored UTC timestamps.
**Copy:** no ketosis, fat-burning or autophagy language.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| F01 | Fasting intro / turn on | Short explanation, who should not fast (pregnant, diabetes, eating-disorder history), switch "Turn on fasting" | If screening (A08) flags a risk, this screen explains and offers nothing to turn on | FST-1, FST-11 |
| F02 | Choose protocol | Cards 12:12, 14:10, 16:8, 18:6, 20:4, Custom window; time pickers | Longest planned fast 20 h | FST-2 |
| F04 | Edit fast times | Two time pickers with date, Save | Back-dating allowed | FST-3 |
| F05 | Fasting history and stats | List of fasts, average duration, completion rate, hours graph | Personal only | FST-7, FST-8 |
| F06 | Safety check-in (sheets) | Two variants: 20 hours "How are you feeling?" with End fast and Keep going; 24 hours "Time to eat." with End fast | If the user reports feeling unwell, offer to end the fast and show help text | FST-11 |
