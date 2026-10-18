### 7.C Today

Today is **your own day**: calm, single column, thumb-friendly. It must answer in two seconds: how am I doing, what is next.

#### C01 · Today · DIA-1 to DIA-7, STR-1 · P0
**Purpose:** the daily diary and the home of the app.
**Layout (top → bottom):**
1. **Header (64):** greeting with first name `title-1` · date chip (tap → C05) · streak pill 28 high with flame glyph and number (tap → C07).
2. **Room strip (44):** avatars of room members, a 6 px dot in each person's identity hue when they logged today, an unread-chat dot. If no room: a single card "Find a partner" or "Invite a friend" (the dashed half-card preview, see J01 empty state).
3. **Hero card (s1):** your CalorieRing 120 on the left (identity hue, centre = remaining kcal) · on the right: eaten, remaining, a three-segment macro bar and gram values. Under the card, a single line: "Day counts at 50% of your target." until the logged-day threshold is met; then "Logged. Day 12."
4. **Meal cards (five):** Breakfast, Lunch, Dinner, Snacks, Extra. Each: name, kcal, up to three item names, trailing 32 circle "＋". Empty meals show only the name and ＋. The suggested section for the current time is highlighted with an apricot ＋. The top of each non-empty section shows up to three smart suggestions (LOG-14).
5. **Two half cards:** Water (eight tappable bars) and Steps (number, thin bar, "from Health Connect").
6. **Optional cards in order:** Workouts today (with "Add workout"), Fasting timer (only if turned on), Focus (today's focus time and "Start"), Recipes and Ask Coach entry cards (coach card shows a lock for non-plan holders).
**Interactions:** tap ＋ → D01 pre-set to that meal; tap a meal card → C03; tap hero → C02; long-press an item → quick actions (copy, delete); pull to refresh; swipe date chip left/right to move between days.
**States:** offline pill; first run empty state (hero shows 0 and a "Log your first meal" nudge); over goal (cream second lap, "320 over"); loading skeleton; partner strip empty.
**A11y:** headings per section; ring and macro values read as sentences; the whole page reflows to single column at 200%.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| C02 | Calories and macros detail (sheet) | Large ring, rows for protein, carbs, fat with eaten / target / left, optional fibre, sugar, sodium (LOG-16) | Tap a macro to see top contributing foods | Raw numbers allowed because this is your own view |
| C03 | Meal section detail | Header with meal name and total; list of entries (name, quantity, kcal); sticky "Add food" button | Swipe to delete with undo; tap to edit (C04); "Copy meal to…" (D12) | LOG-6, LOG-7 |
| C04 | Edit entry (sheet) | Food name, quantity editor (same as D03), meal selector, share toggle | Save / Delete; delete shows undo toast | Entry stores a nutrient snapshot (LOG-10) |
| C05 | Date picker / calendar | Month strip with dots on logged days; tap a day to open it | Past days fully editable (DIA-5); future days disabled | Today ring in apricot edge |
| C06 | Day complete moment (state, not a screen) | Seam fuses on Room; on Today the line under the hero changes to "Logged. Day 12." with a success haptic | Triggered by the logged-day rule (PRD 7.4) | Replaces a "close day" button (decision D8) |
| C07 | Streak detail (sheet) | Current streak `numeral-l`, longest streak, a 28-day dot grid (filled dots, open circles), freeze status (STR-4, P1) | Copy about freezes: "One freeze a week protects a day you miss." | No loss-guilt copy |

### 7.D Logging (the ＋ Log sheet and food)

Logging is the most frequent task, so it is the most optimised. Targets: **a repeat food in two taps**, a new food in under 15 seconds, an AI photo in under 20 seconds.

#### D01 · Log hub (the ＋ sheet) · LOG-*, WRK-1, WAT-1, TRK-1, FST-3, FOC-1 · P0
**Purpose:** the single entry point to every kind of logging.
**Layout:** glass tall sheet (90%), grabber · title "Add to lunch" with a small meal selector chip (default chosen from time of day, LOG-6) · a 3×2 grid of tiles (96×96): **Food, Workout, Water, Weight, Fast, Focus** · under it a "Quick add" row: Previously logged (horizontal chips of the 6 most frequent for this meal), Scan, Photo, Recipes, My meals · bottom padding for safe area.
**Interactions:** Food opens D02 on the **Recent** tab, not search; Water and Weight open a half-sheet in place; Fast and Focus open their own sheets (F03 / G01).
**States:** Fast tile is hidden when fasting is off or screening forbids it (FST-1).
**A11y:** tiles are buttons with names; the sheet traps focus; Reduce Transparency makes it opaque.

#### D02 · Food search · LOG-1, LOG-11 to LOG-15 · P0
**Purpose:** find the food in the fewest taps.
**Layout:** sticky search field (56) with a barcode icon and a camera icon at the trailing edge · segmented control: **Recent · Frequent · My foods · All foods** (default Recent) · list rows: food name `heading`, brand and serving `body-s` `textMid`, kcal right-aligned tabular, and a trailing circular **＋** (one-tap re-log with the last-used quantity, LOG-13) · sort chips: Recent, Frequent, A to Z, and a meal filter · section "Suggestions for lunch" (LOG-14) at the very top of Recent.
**Interactions:** tap the row → D03; tap ＋ → adds immediately with last quantity, toast "Added to lunch" with Undo; swipe left on a history row removes it from history only (LOG-15); typing switches to ranked results: Previously logged, My foods, then database (IFCT first for Indian foods).
**States:** no results → "No match. Add it yourself" with buttons "Create food" and "Scan barcode"; offline → only cached lists, banner "Showing foods on this phone."
**Copy:** search placeholder "Search a food, like dal or paneer".

#### D03 · Quantity and save · LOG-5, LOG-10, SHR-1 · P0
**Purpose:** set the amount and save.
**Layout:** back chevron · food name · **big editable number** (`numeral-xl`) with a unit selector below: g, ml, piece, katori (bowl), cup, tbsp, slice · live macro preview (three identity-hue bars + numbers) · two switch rows: **Share with my room** (default on, depends on privacy), **Someone else ate this too** (reveals member chips; one log writes pending cards to their diaries, SHR-1, D13) · meal selector chip · bottom primary **"Add to lunch"**.
**Interactions:** the number is edited by a numeric pad that rises with the sheet; a quick row of presets (0.5, 1, 1.5, 2 and last-used) sits above the keypad; unit change keeps the weight equivalent and recalculates live.
**States:** nutrients missing → shown as "unknown" not zero; very large quantity → gentle confirm "That is 3,200 kcal. Is that right?".
**Copy:** same verb through the flow: button "Add to lunch", toast "Added to lunch".

#### D04 · Barcode scan · LOG-2 · P0
**Purpose:** log packaged food by barcode.
**Layout:** full-bleed camera, 260×160 cutout with apricot corner brackets only, a torch toggle and a close button in the top bar, a "Type the number" link at the bottom.
**Interactions:** success haptic and the item card slides up (name, serving, kcal, **Add to lunch**).
**States:** not found → card "We don't have this yet" with **Create it** (prefills the barcode, D09); camera permission denied → P02; low light → torch hint.

#### D06 · AI photo result · LOG-3, 7.7 · P0
**Purpose:** review an AI estimate before saving; never present it as fact.
**Layout:** photo (top 40%) · list of detected foods, each with name, estimated quantity (editable), kcal · a **confidence band** under the total, "About 520 kcal (440 to 600)" · label "Estimate. Check the portions." · bottom primary "Add to lunch", secondary "Retake".
**Interactions:** tap any food to edit or remove; "Add a missing food" opens D02.
**States:** daily scan limit reached → D07; low confidence → "Hard to tell. Pick the food yourself." with search; offline → "Photo logging needs a connection" and a shortcut to D02.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| D05 | Photo capture | Full-bleed camera, shutter button 72, gallery picker, close | Tip text "Fit the whole plate in the frame" | LOG-3 |
| D07 | AI photo limit / consent | Short card: limit reached or first-use explanation of what is sent | Plan holders get a higher allowance; "Log it by search instead" | Caps from PRD 7.7 |
| D08 | Previously logged / My foods manager | List with sort, filter, search-within; swipe actions; row tap edits custom foods | Same rows as D02 with edit access | LOG-12, LOG-15 |
| D09 | Create / edit custom food | Name, serving size and unit, calories, protein, carbs, fat, optional fibre, barcode field | Per-serving and per-100 g switch; saves to My foods | LOG-4 |
| D10 | My meals builder | Name field, list of foods with quantities, total macros, Save | Reusable personal item | LOG-8 |
| D11 | Quick add calories | One field "Calories", optional macros, meal chip | For when you do not know the food | Entries marked "Quick add" |
| D12 | Copy meal or day (sheet) | Choose target meal / date, preview | "Copy" with undo | LOG-7 |
| D13 | Shared-meal tagging (sheet) | Member chips with avatars, per-person portion defaults to same, "Send" | Pending status shown; no negative effect if ignored (SHR-4) | SHR-1 to SHR-5 |
