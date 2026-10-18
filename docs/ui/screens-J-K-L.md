### 7.J Room (the hero area)

The Room tab has five segments: **Today · Focus · Chat · Progress · Members** (RV-1), a scrolling segmented control under the header. Spend the app's boldness here and nowhere else.

#### J01 · Room · Today segment, two people · RV-1 to RV-8, STR-2 · P0
**Purpose:** you and your partner side by side, in one glance.
**Layout (top → bottom):**
1. **Header (64):** room name `title-1`, room streak, member avatars, settings glyph, inbox bell with a dot when there are requests.
2. **State sentence:** one line in `body-s`, e.g. "You've both logged 11 days straight." or "Priya hasn't logged yet today."
3. **Focusing now strip (RV-11):** shown only when someone is in a focus session: avatars, "Priya is focusing", **Join**.
4. **Paired card (the hero, about 60% of the screen):** PairRing 184 centred, straddling the seam · below, two PersonColumns split by the Seam · NudgeButton on the seam at the card's midpoint · under the card, the seam caption.
5. **Quick actions:** three text pills: **Log a shared meal**, **Send a photo**, **Open chat** (RV-6).
6. **Feed:** plain rows (avatar 24, sentence, time) separated by hairlines, no cards; each shared item carries the 14 px eye (CMP-23) (RV-7). Feed groups similar events in larger rooms.
**Interactions:** tap a column's meal row for the partner's entry (if shared); tap a dot to react (SOC-2, five fixed reactions); tap the NudgeButton to open J05 (or send the default message); tap the ring to open J12 for charts.
**States:**
- *No partner yet:* the right half is a **dashed-outline placeholder** that previews the real card, with "Invite a friend" (share sheet) and "Find a partner" (L01). This is the most persuasive object in the app; make it beautiful. No cartoon people.
- *Partner hasn't logged:* open circles, 0% in `textLo`, line "Priya hasn't logged yet today."
- *Partner hides data:* `CMP-25` lock, never zero (RV-5).
- *Half-lit and fused seam* as in 5.3.
- *Over goal:* cream second lap and "320 over" (own column only).
- *Paused participation:* the person's column shows "Paused until 24 Oct" and is excluded from streaks (ROOM-10).
**A11y:** the card reads as two labelled groups; the seam is announced; at 150%+ the card stacks.

#### J02 · Room Today · 3 to 12 people · RV-4 · P0
**Purpose:** compare with one person at a time without a crowded screen.
**Layout:** same as J01, but under the header an **avatar strip selector** (each avatar with its identity ring and a logged dot) · the ring shows you and the selected person; the label under the ring names the comparison "You and Priya" · an **overview row** of everyone's completion as small 64 px rings or percent chips, you first, then alphabetical (RV-4).
**Interactions:** tap an avatar swaps the inner arc and the right column with a 220 ms crossfade; swipe the card to move to the next person.
**Rule:** never render three or more arcs on one ring.

#### J03 · Room Today · large room (13 to 100) · RV-10, ROOM-13 · P0
**Layout:** header · overview card showing **you**, **room average** and a searchable member list (paged, you first, then alphabetical) · comparison card against one chosen member · a grouped feed ("6 people logged lunch").
**Interactions:** search by nickname or @username; tap a member to open J14; realtime updates are summarised (no flashing rows).
**Performance:** virtualised list; no per-row shadows or blur.

#### J08 · Chat · CHT-1 to CHT-14 · P0
**Purpose:** one calm chat per room.
**Layout:** message list (newest at the bottom) with sender avatar and nickname on first message of a run, timestamps on grouping, system messages centred in `textLo` ("Rahul joined", milestone lines) · composer pinned above the keyboard: attach (camera, gallery) and a text field, send button in apricot when there is text · unread divider "3 new" · reply preview chip when replying (P1).
**Interactions:** long-press a message → J11 sheet (Copy, Reply, React, Delete own, Report); tap an image → J09; offline messages show "Sending…" then "Failed, tap to retry" (CHT-5); typing indicator and read receipts (P1, user can turn off).
**States:** read-only in a Dormant room (CHT-12) with a banner; locked room → J20; slow mode in rooms of 21+ shows a countdown in the composer (ROOM-14, P1); first message requires accepting the community rules once (CHT-8).
**A11y:** messages are in a list with sender and time; images require alt text from the sender's caption or "Photo from Rahul".

#### J12 · Room progress · RPG-1 to RPG-8 · P0
**Purpose:** compare trends fairly.
**Layout:** metric selector chips (Consistency, Weight change, Calories vs target, Steps, Water, Workouts, **Focus**) · range chips (7 d to 1 y, Since the room started) · chart: one line or bar per member in identity hues, member chips to show or hide people (up to 8 at once in large rooms, with a room-average line) · summary table: me first, then alphabetical (sorting by rank is optional and off by default) (RPG-4) · milestone markers (P1).
**Rules:** weight appears only as change since each person's own start or progress toward their own goal, never the raw number unless they opted in (RPG-2); a member who hides a metric appears with a lock and is left out of that chart, and values cannot be inferred from other charts (RPG-3). Focus shows weekly time and the room total with no ranking (RPG-8).
**A11y:** every chart has "View as table".

#### J20 · Room paused (Locked) · ROOM-7, SUB-8 · P0
**Purpose:** explain without blame and offer a way forward.
**Layout:** the room's paired card desaturated to `textLo`, seam fully dashed · a centred card: "This room is paused." · one line "Your streak is saved for 30 days." · primary **"Keep this room going"** (opens O06 with a size picker) · secondary "Leave room" (confirm).
**Rules:** nobody is told who stopped paying or why; chat and shared data are hidden until unlocked, personal diaries are untouched.

#### J22 · Room full · ROOM-12, SUB-6 · P0
**Variants:** *host* — "Your room is full. Plus fits up to 20 people." with primary "See plans" (O05); *invitee or member* — "This room is full." with a neutral line "Ask the host to make space." Pending invitations do not reserve seats.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| J04 | What they can see (sheet from the eye glyph) | Title "Who sees this", full sentences ("Priya can see that you logged lunch, not what you ate."), link "Change privacy" (N06) | Opened from every shared item | PRV-1 |
| J05 | Nudge picker (sheet) | 4 pre-written messages ("Rahul logged lunch. Time for yours?"), "Send" | Limit 2 per recipient per day; mute per room | SOC-1 |
| J06 | Reaction picker | Row of 5 fixed reactions on long-press or tap | Medium haptic on send | SOC-2 |
| J07 | Partner's meal viewer (sheet) | Meal name, items and portions if shared; reaction row; "Add to my diary" if tagged | Locked glyph if hidden | RV-5 |
| J09 | Image viewer | Full-screen, pinch to zoom, save to gallery, close, share | EXIF location is stripped already | CHT-4 |
| J10 | Attach images (sheet) | Camera, gallery; up to 5 images with thumbnails; compress before upload | Progress bar per image | CHT-2 |
| J11 | Message actions (sheet) | Copy, Reply, React, Delete (own), Report | Delete shows "Message deleted" to others | CHT-7, CHT-8 |
| J13 | Members | Search field (rooms of 20+), list of people with avatar, nickname, @username, role badge text (Host, Plan holder); tap opens J14; host sees "Invite" and join requests tab | Paged list | ROOM-3, ROOM-13 |
| J14 | Member profile (sheet) | Avatar 72, name, @username, streak, buttons Mute, Block, Report; host-only: Remove, Make host | Mute hides nudges, reactions and chat from them for you | ROOM-8 |
| J15 | Room settings | Rename, who can invite (Host only / Any member), invite link on/off, chat system messages, notifications mute, slow mode (21+), plan holder row, danger zone (Delete room) | Host-only sections are labelled | ROOM-3, ROOM-9, ROOM-14 |
| J16 | Create room | Room name field, plan summary (trial or plan and cap), primary "Create room" | Starts the 3-day trial for the first room (SUB-3) | ROOM-1 |
| J17 | Invite to room (sheet) | Three tabs: **Link** (share sheet), **Code** (short code, copy), **Username** (search and send) | Capacity shown "3 of 5" | ROOM-2, USR-5, USR-10 |
| J18 | Host actions confirms | Transfer host, remove member: confirm sheets with plain consequences | Destructive style only on the confirm button | ROOM-3, ROOM-4 |
| J19 | Leave or pause (sheet) | Two choices: **Pause my participation** (pick dates, ROOM-10) or **Leave room** (confirm) | Pause keeps you in the room | ROOM-10 |
| J21 | Room dormant | Banner "This room has been quiet. Chat is read-only." with "Log today to wake it up" | Chat read-only | ROOM-6, CHT-12 |
| J23 | Weekly summary card | A card on Monday at the top of Room Today: consistency, streak, highlights in two sentences | Dismissible; P1 | RV-9 |

### 7.K Requests, invitations and shared meals

#### K01 · Requests inbox · USR-5 to USR-8, FND-8 · P0
**Purpose:** one place for everything someone asked of you.
**Layout:** header "Requests" · segmented **Incoming · Outgoing** · list rows with avatar, nickname, @username, type chip (Room invitation, Join request, Partner request, Shared meal) and status (Pending, Accepted, Not accepted, Expired, Cancelled) · swipe or buttons Accept / Decline (Decline reads "Not now").
**Interactions:** tap a row → K02. Outgoing: Cancel.
**States:** empty → "No requests. Invite a friend or find a partner." The sender sees a declined request neutrally as "Not accepted".
**Limits shown in copy:** "You can have 20 pending requests."

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| K02 | Request detail | Avatar, nickname, @username, the room or message, the safe card for partner requests (L08), Accept, Not now, Block and report | Capacity check on accept; if full, J22 | USR-5, FND-8 |
| K03 | Join a room (search) | Field accepting @username or a room code; result card; "Send request" | Rate-limit message "Try again in 40 minutes" | USR-6, USR-8 |
| K04 | Username search | Field, minimum 3 characters, up to 10 results with avatar, nickname, @username | No other data shown | USR-3 |
| K05 | Public profile card (sheet) | Avatar, nickname, @username, **Invite to my room**, **Send join request**, Report | Respects "Who can find me" (USR-4) | USR-3, USR-4 |
| K06 | Shared meal card | "Rahul logged Dinner with you. Add to your diary?" with portion editor, **Add to dinner**, **Not now** | Creates an independent entry (SHR-3) | SHR-2 |
| K07 | Block and report | Reason list, optional note, confirm, "Blocked users" link | Block hides everything both ways | USR-9, ROOM-8 |
| K08 | Blocked users | List with Unblock | Lives in N08 | USR-9 |

### 7.L Partner Finder (premium to browse and send; free to opt in and accept)

Design rules for this area (PRD 6.24, 7.12, 8.5): banded fields only (age band, city, no exact data), no photo or @username before acceptance, 18+ only, women-only mode, a safety card before the first request, no bots or padded lists.

#### L05 · Suggestions · FND-5, FND-6, FND-13 · P0
**Purpose:** let a plan holder pick from a short, safe list.
**Layout:** header "Suggested partners" with a filter glyph · small line "Updated weekly. Up to 10 people." · a vertical stack of **match cards** (CMP-20), each 100% width: illustrated avatar (not a photo), nickname, age band ("25 to 29"), goal chip, training style, experience, time of day, city, languages, a one-line bio, up to three reasons ("Same goal", "Trains mornings", "Speaks Hindi"), actions **Send request** (apricot) and **Not interested** (text) · menu with **Report** and **Block**.
**Interactions:** Send opens L07 (optional 140-character note); Not interested removes the card with undo.
**States:**
- *Fewer than 3 matches:* "Not enough people match yet. We'll tell you when someone does." plus a "Notify me" switch; no fake profiles (FND-13).
- *Free user who opted in:* teaser only (L11).
- *Women-only mode:* a small chip "Women only" under the header.
- *First request:* L04 appears first.
**A11y:** each card is one accessible group with the reasons read out.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| L01 | Find a partner (entry) | Two-line explanation, how it works in three steps, primary "Set preferences", secondary "How we keep it safe" | Reached from Today strip, empty Room, Me, onboarding | FND-3 |
| L02 | Consent: Open to a partner | Plain list of exactly what strangers will see (banded fields), what they will not see (exact age, photo, @username), 18+ confirmation, switch | Off by default; turning off removes you at once | FND-2 |
| L03 | Preferences | Pre-filled fields: goal, training style, experience, time of day, city, languages, bio (140 chars), match preference, **Women only** | Editable any time | FND-4, FND-12 |
| L04 | Safety card (once) | Three rules: meet in public places, never share money or ID details, report anyone who makes you uncomfortable; primary "Got it" | Shown before the first request or acceptance | FND-10 |
| L06 | Match card detail | Expanded card with all banded fields and reasons, **Send request**, Report | No photo, no @username | FND-5 |
| L07 | Send request (sheet) | Optional note (140), counter, links and phone numbers blocked with an inline message, **Send request** | Limit 10 per day and 20 pending | FND-7 |
| L08 | Request received | Same safe card, **Accept**, **Not now**, **Block and report** | Sender can't tell ignored from declined | FND-8 |
| L09 | Start your room (after accept) | Two cards: **Create a new room** and **Join a room** (either person's with space); the plan holder hosts by default; trial note if neither holds a plan | Photo and @username revealed after accepting | FND-9 |
| L10 | Empty / no matches | Same as L05 state with the "Notify me" switch | — | FND-13 |
| L11 | Free-user teaser | A card: "12 people with goals like yours are open to a partner. Get a plan to say hi." | Count only, shown only if 5 or more, no profiles | FND-15 |
| L12 | Match feedback | After 7 days: "How is your match going?" thumbs up or down | Tunes matching weights; P1 | FND-16 |
