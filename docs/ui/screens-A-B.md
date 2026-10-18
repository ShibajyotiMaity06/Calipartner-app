## Part 7 — Screen inventory

### 7.0 How to read this part
There are **180 entries (38 hero, 142 compact)**. Hero screens are written in full. Secondary screens, sheets and states are in compact tables with the same facts in short form (Layout = top to bottom). Priority is P0 (launch), P1 (soon after), P2 (later) as in the PRD. Anything marked **NEW** is not in PRD v0.4 and needs your approval.

### 7.A Launch and onboarding

Goal of the flow: from install to a personal target in under 90 seconds, **one question per screen**, the account asked for last (AUTH-2), and the Partner Finder offered once (ONB-12). Progress is a thin 4 px bar at the top; back always works; every optional step has "Skip".

#### A02 · Welcome · AUTH-2, ONB-9 · P0
**Purpose:** say what the app is in one line and start.
**Layout:** top: language chip (EN / हिन्दी) right-aligned · middle: a looping 6-second PairRing preview, two arcs filling, no text inside · below: `title-1` "Eat well, together." and one `body` line "Track food, steps and workouts, and keep a friend on the same page." · bottom (thumb zone): primary "Get started", secondary "I already have an account", text link "Have an invite code?".
**Interactions:** Get started → A03. Language chip switches the whole UI instantly. Invite code opens a small field sheet.
**States:** Reduce Motion: static ring.
**A11y:** the ring preview is decorative (hidden from screen readers).

| ID | Screen | Layout (top → bottom) | Key content and actions | Notes |
|---|---|---|---|---|
| A01 | Launch | Centred logo (iris→apricot→teal seam over two arcs) on `bg0` | Shown only while fonts and local DB load; target under 1.5 s | No animation beyond a 200 ms fade; native splash matches `bg0` |
| A03 | Age gate (AUTH-3) | Title, 3 numeric fields (day, month, year) with auto-advance, reason line | "We ask because CaliPartner is for adults." Under 18 → blocked screen with a kind message and no data kept | Numeric keypad; no date wheel |
| A05 | About you (ONB-2) | Segmented sex (Male, Female, Other), height field with cm / ft-in switch, weight field kg / lb | One step per scroll, "Next" pinned above keyboard; units switch converts live | Hindi labels tested at 1.3× |
| A06 | Activity level (ONB-2) | Five tappable cards (Mostly sitting … Very active) each with one plain sentence and an example ("desk job, 10k steps") | Single select; selected card gets apricot edge | Prevents the common over-estimate |
| A07 | Optional details (ONB-2, ONB-5) | Body fat % (optional), target weight (optional), target date (optional) | If target + date needs a pace above the cap, show the earliest realistic date instead (ONB-5) | "Skip" prominent |
| A08 | Private health check (ONB-11) | Title "A few private questions", three switch rows (pregnant or breastfeeding, diabetes or medicine that affects food, history of an eating disorder), consequence line under each | "Used only to hide fasting and show cautions. Never shared with your room." | Skippable; changeable in N03 |
| A11 | How we calculated this (ONB-6) | Title, three stacked cards: Inputs · Formula in words (BMR then activity then rate) · Result | Numbers only; every number is tappable to edit the input | Reached from A10 "How is this worked out?" |
| A13 | Notification primer (ONB-7) | Title, three examples of the notifications they will get, a switch list (meals, water, partner) | Primary "Turn on reminders" then OS prompt; "Not now" | Asked after value is shown, not at launch |
| A14 | Health data primer (ONB-7, STP-1) | Icon, "We read your steps from Health Connect / Apple Health", lists read and write, "never sold or shared" | Primary "Connect"; "Use phone sensor instead" | Shown first time the steps card is opened, not in onboarding by default |

#### A04 · Goal · ONB-1 · P0
**Purpose:** choose cut, bulk or maintain.
**Layout:** progress bar · `title-1` "What do you want to do?" · three full-width cards (88 high): **Lose fat**, **Build muscle**, **Stay where I am**, each with one plain line ("Eat a little less than you burn.") · bottom: disabled "Next" until one is chosen (enabled on tap, then auto-advances after 250 ms).
**Interactions:** card selection is a light haptic; selected card takes apricot edge and a check.
**A11y:** radio group semantics.

#### A09 · Rate picker · ONB-3, ONB-4 · P0
**Purpose:** show maintenance calories and let the user pick a safe weekly rate.
**Layout:** maintenance number `numeral-xl` ("2,240 kcal a day to stay the same") · a vertical list of rate cards: 0.25, 0.5, 0.75, 1 kg a week, each showing the exact daily calories, with the recommended (0.5) marked "Steady" · unavailable rates are greyed with the reason ("Below your safe minimum of 1,500 kcal") and the nearest allowed rate · bottom "Continue".
**Copy:** "Faster is not always better. 0.5 kg a week is easy to keep up."
**Interactions:** tap to select; no sliders (precision and accessibility).
**States:** if the user entered a target date (A07) the matching rate is pre-selected with its date.

#### A10 · Target reveal · ONB-3 · P0
**Purpose:** the first "wow": the personal number.
**Layout:** a single large ring (184) filling once to 100% with the gradient `iris → apricot → teal` (one of three allowed gradient uses) · `numeral-xl` "1,840" inside with "kcal a day" · one sentence: "Based on your stats, this puts you on track to lose 0.4 kg a week." · macro split as three numbers (protein, carbs, fat) · text link "How is this worked out?" (A11) · bottom: primary "Looks good", secondary "Change my rate".
**Interactions:** the ring animates once (`ring`, 1.2 s), success haptic at the end. Native rate-us prompt is triggered 1 second **after** the user taps "Looks good" (RAT-1), never during the reveal.
**A11y:** the number is announced with the sentence; animation skipped with Reduce Motion.

#### A12 · Find-a-partner offer · ONB-12, FND-3 · P0
**Purpose:** offer the Partner Finder once without pushing.
**Layout:** `title-1` "Want a workout partner?" · two sentences: "We can suggest people with similar goals. You choose who to say hi to." · a preview of one safe match card, blurred · switch "Open to a partner" (off by default) · small line "Browsing and sending needs a room plan. Anyone can accept." · bottom "Set preferences" and "Maybe later".
**Interactions:** turning the switch on opens L02 (consent) first.

#### A15 · Invite preview · ONB-9, ROOM-2 · P0
**Purpose:** a person opened a link: show who is waiting, before any sign-up wall.
**Layout:** inviter avatar 72 with ring · first name `title-1` · streak line · "Rahul is waiting for you." · a live but blurred paired card with the empty half highlighted · bottom primary "Join Rahul's room" · small line "Free to join. Your diary stays yours."
**Interactions:** the primary leads to B01 then A04–A10 (shortened: goal and stats only), then straight into the room.
**States:** room full → "This room is full. Ask Rahul to make space." (J22); invalid or expired link → "This invite isn't working. Ask Rahul for a new one."
**Note:** the paywall never appears here. Joining is free.

### 7.B Account

| ID | Screen | Layout (top → bottom) | Key content and actions | Notes |
|---|---|---|---|---|
| B01 | Sign in / up (AUTH-1) | Logo, title "Create your account", stacked buttons: Apple (first on iOS), Google, "Continue with email" | No phone or SMS login; guest users see "Your data on this phone moves with you" | Required before creating or joining a room |
| B02 | Email entry | Field, helper text, primary "Send code" | Blocks disposable domains (AUTH-7) with "Use a different email" | Keyboard type email, autofill |
| B03 | 6-digit code | Six boxes with auto-advance, resend after 30 s, paste support, "Wrong email?" link | Auto-reads from clipboard / SMS-less autofill | Error: "That code didn't work. Check it or resend." |
| B04 | Username and nickname (AUTH-4, USR-1) | Nickname field; @username field with live availability tick; rules under field | Rules shown as you type: 3 to 20, letters, numbers, `_` `.` | Username changes limited to every 30 days (USR-2) |
| B05 | Avatar (AUTH-4) | Grid of 24 illustrated avatars + "Upload photo" | Photo optional; photo is never shown to strangers | Default avatar assigned if skipped |
| B06 | Guest data merge (AUTH-2) | Summary card "We found 6 meals and 2 days on this phone", primary "Keep it", secondary "Start fresh" | Shown once after sign-up | Never loses data without confirm |
| B07 | Delete account (AUTH-5) | Warning card listing what is removed, how to cancel store subscriptions with a link, field "Type DELETE" | Destructive only here | Two-step: confirm sheet then B08 |
| B08 | Deletion complete | Short confirmation, "Your data has been removed" | Signs out and clears local data | — |
| B09 | Export my data (AUTH-6) | Format chooser (CSV, JSON), primary "Prepare export" | Delivered by share sheet or email link | P1 |
