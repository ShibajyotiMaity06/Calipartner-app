### 7.G Focus Time

Focus is a stopwatch or timer, solo or with the room. **No ranking, no leaderboard** (FOC-10). Time is computed from stored server or UTC timestamps, never counters.

#### G01 · Start focus (sheet) · FOC-1 · P0
**Purpose:** start a personal or room session in three taps.
**Layout:** half sheet · segmented control **Stopwatch · Timer** · for Timer: a large time with presets (25, 45, 60, 90 min) and custom · label field with suggestions (Study, Work, Read, 20 characters max) · switch "Start with my room" (only if the user is in an unlocked room) · bottom primary "Start focus".
**Interactions:** medium haptic on start; opens G02.
**States:** room locked → switch disabled with "Room is paused".

#### G02 · Focus running · FOC-2, FOC-3, FOC-8 · P0
**Purpose:** a calm, distraction-free timer.
**Layout:** tab bar hidden · centre: `numeral-xl` time with a 6 px ring · label under the ring · two buttons: **Break** (pause) and **End** · for room sessions: a row of participant avatars with "Focusing" or "On break" and each person's elapsed time.
**Interactions:** screen stays awake (optional); Break stops counting focused time; leaving the screen keeps the session alive; a local notification fires at timer end and "5 minutes left" (FOC-9).
**States:** after 4 hours of stopwatch → "Still focusing?" (G06); after 90 min → a gentle break suggestion (P1); app killed → time recomputed on return.
**A11y:** time announced every minute only on request; Break and End are full-width buttons.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| G03 | Session complete | Total focused time, label, "Add a note" optional, Done | Shows today's total and the weekly goal progress | FOC-4 |
| G04 | Room Focus segment | Active session card (starter, mode, label if shared, participants with status and elapsed time, Join / Leave), then recent sessions | "Focusing now" strip also appears on Room Today (RV-11) | FOC-5 to FOC-7 |
| G05 | Room session live | Same as G02 plus a participant list sheet; late joiners see correct remaining time; Leave button in place of End for non-starters | Timer sessions end for everyone at the same server moment | FOC-5, FOC-6 |
| G06 | Still focusing? / healthy prompts | Small sheet: "Still focusing?" with Yes and End; or "You've been at it for 90 minutes. Stretch?" | Supportive, never "you are behind" | FOC-8, FOC-12 |
| G07 | Focus history and edit | List of sessions by day with label and length; tap to edit or delete | Totals by label; longest session | FOC-4, FOC-10 |
| G08 | Focus settings | Weekly goal (hours), streak minimum (default 25 min), break prompt switch, label visibility to room (hidden by default) | Lives in Me | FOC-11, FOC-13 |

### 7.H Recipes

Recipes are free for everyone (RCP-10). The library is original text and photos only (RCP-11).

#### H03 · Recipe detail · RCP-2, RCP-5, RCP-6 · P0
**Purpose:** decide, scale and log in one place.
**Layout:** hero photo 4:3 (the main use of food imagery) · title `title-1`, tags (veg / egg / non-veg, time, difficulty) · nutrition per serving (kcal, protein, carbs, fat) in four tiles · servings stepper (scales ingredients; nutrition per serving stays the same, RCP-5) · ingredients list with grams and household measures · steps · tips · sticky bottom bar: heart (favourite) and primary **"Log this recipe"** (opens a sheet with servings and meal, RCP-6).
**Interactions:** tap an ingredient to see its food entry; "Cook mode" (large text, one step at a time, screen awake; **NEW, P1**).
**States:** offline → cached text and cached photos; no photo → neutral `s2` block with a glyph.
**Copy:** "Report a problem with this recipe" at the bottom (RCP-9).

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| H01 | Recipes home | Search field; "Fits your day" card (remaining kcal and protein, RCP-12, P1); collection carousels (High-protein breakfasts, Quick dinners, Cutting-friendly, Bulking-friendly); recent and favourites | Cards are photo + name + kcal + protein | RCP-1, RCP-12 |
| H02 | Search and filters | Search by name or ingredient; filter chips: meal, diet, calories, minimum protein, time, cuisine; results grid | Active filters shown as removable chips | RCP-4 |
| H04 | Cook mode | Full-screen step text 24 sp, next / previous, ingredients drawer, timer chips | Keeps screen awake; P1 | NEW |
| H05 | Log recipe (sheet) | Servings stepper (0.5 steps), meal chip, "Someone else ate this too", primary "Add to dinner" | Writes a nutrient snapshot | RCP-6 |
| H06 | Favourites and recent | Two segments, same cards, works offline | Saved recipes cached | RCP-7 |

### 7.I AI coach (plan holders only)

The coach never calculates targets itself; all numbers come from the deterministic calculators (AIC-4). The label "AI can make mistakes. Not medical advice." sits under every answer (AIC-10).

#### I03 · Coach chat · AIC-2 to AIC-10 · P0
**Purpose:** ask about your own data and get a plan.
**Layout:** header "Coach" with history button · conversation (user bubbles on the right in `s2`, coach answers on the left on `bg0` with no bubble) · suggested prompt chips above the composer on empty chat ("How am I doing this week?", "What should I eat tonight to hit my protein?", "Explain my calorie target") · composer with send · under each answer: thumbs up, thumbs down, report, and the AI label · recipe or food suggestions appear as small cards with a **Log it** button (AIC-5).
**Interactions:** streaming text; first token within about 3 seconds; limit counter ("22 of 30 messages left today").
**States:** limit reached → "You've used today's messages. Back tomorrow."; provider down → "The coach is resting. Try again soon."; unsafe request (crash diet) → a supportive refusal with an alternative.
**A11y:** streaming text is announced when complete, not word by word.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| I01 | Locked preview (non-plan holders) | A sample conversation, blurred answers, lock glyph, primary "See room plans" | Opens O02 with context "Coach" | AIC-1, SUB-16 |
| I02 | Consent | Plain list: what is sent (your summary), who processes it, that it is not used to train models (to verify), how to delete; primary "I agree" | Shown once before first use | AIC-9 |
| I04 | History and delete | List of conversations by date; swipe to delete; "Delete all" | Never visible to other users | AIC-9 |
| I05 | Log it from chat (sheet) | Parsed foods with quantities, meal chip, "Add to lunch" | Confirm before saving | AIC-11, P1 |
