### 7.N Me and settings

#### N01 · Me · SET-1, SUB-14, FND-3 · P0
**Purpose:** profile, goals and everything you can change.
**Layout:** profile header (avatar 72, nickname, @username, edit) · **Plan card** ("Basic room plan, 3 of 5 people" or "No plan. Free tracking is yours forever." with a quiet "See plans") · grouped lists, each in a card: **My goals** (goal, rate, step and water goals, health answers) · **Privacy** (N05) · **Find a partner** (status "Open" / "Off") · **Fasting** · **Focus** · **AI coach history** · **Notifications** · **Health sync** · **Units and language** · **Appearance** · **Help and feedback** (including "Rate CaliPartner") · **About and legal** · **Sign out**.
**Interactions:** each row opens its own screen; the requests inbox has a bell in the header with a count.
**States:** guest → banner "Create an account to keep your data and join rooms".

#### N05 · Privacy · PRV-1, PRV-2, USR-4, RNK-6, FST-9, FOC-13 · P0
**Purpose:** real control in plain words, with real estate (not a buried row).
**Layout:** intro line "You decide what people in your room see." · grouped switch rows (CMP-16), each with one line of consequence text: "Partners can see my meal items" · "Partners can see my weight" (off) · "Partners can see my workouts" · "Show that I'm focusing" (on) · "Show my focus labels" (off) · "Share fasting status" (off) · "Who can find me by username" (Everyone / Nobody) · "Appear on leaderboards" · a row "Per-room visibility" (N06) · a row "Preview what my partner sees" (N07, P1).
**Rules:** changes apply immediately and retroactively hide earlier shared items from the room, feed and charts (PRV-2).

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| N02 | Edit profile | Avatar, nickname, @username (change once a month with a countdown), city and language (for Partner Finder, optional) | Username change shows the 30-day hold | USR-2 |
| N03 | Goals and body | Goal, rate (re-uses A09), sex, height, weight, activity, optional fields, health questions | Changes apply from today; history is not rewritten | ONB-10, ONB-11 |
| N04 | Daily goals | Step goal (default 8,000), water goal, focus goal | Steppers | STP-3, WAT-2 |
| N06 | Per-room visibility | Choose a room, then the same switches as N05 for that room | Defaults come from N05 | PRV-1 |
| N07 | Preview as partner | A read-only view of the paired card exactly as the partner sees it | P1 | PRV-3 |
| N08 | Discoverability and blocked | "Who can find me", blocked users list (K08) | — | USR-4, USR-9 |
| N09 | Notifications | Per-type switches (meal, water, fasting, partner logged, workout finished, nudge, chat, invitation, focus, partner finder), per-room chat mute, quiet hours, "Pause all" | Hide message previews option | NTF-1 to NTF-3 |
| N10 | Units, language, region | Metric / imperial, English / Hindi, time zone | Language switches instantly | SET-1 |
| N11 | Appearance and accessibility | Theme (Dark, Light when shipped, System), Reduce motion override, Haptics, Text size preview | Mirrors system settings by default | 4.5, 8.4 |
| N12 | Health sync | Status (connected, last synced), what we read, Disconnect, Fix step counting (E04) | — | SET-1, STP-1 |
| N13 | Help centre | Search, topics, contact support | Opens web view or in-app articles | SET-2 |
| N14 | Report / feedback | One form with a type (Report a problem, Wrong food entry, Send feedback), text, optional log attachment | Feedback is separate from the rating prompt | SET-2, RAT-6 |
| N15 | About and legal | Terms, privacy policy, health disclaimer, community guidelines, data attributions (Open Food Facts, IFCT), version | — | SET-3 |
| N16 | Sign out and confirm | Confirm sheet with plain consequence | Delete account link goes to B07 | AUTH-5 |

### 7.O Plans and paywall

The paywall is a **room plan** (PRD 6.18). The room is billed; the host or a sponsor pays; members join free; personal tracking is always free. The 3-day trial starts when a user creates their first room. Never show countdown timers or fake discounts. Prices are localised from the store; those below are the PRD's proposals and may change.

#### O02 · Paywall · SUB-9, SUB-10 · P0
**Purpose:** let the person pick a room size and pay once, with clarity.
**Layout (top → bottom):**
1. Close button (top left, 44×44, always visible).
2. `title-1`: contextual: "Keep your room with Priya" (when known), "Add more people", "Ask your coach", or "Find a workout partner".
3. **Size picker:** "How many people will be in your room?" three plan cards (CMP-19): **Basic 2 to 5**, **Plus 6 to 20**, **Pro 21 to 50**; the card matching the current room is preselected. (Community 51 to 100 appears later behind a flag.)
4. **Billing toggle:** Monthly · 3 months · Annual, with the saving shown as a quiet chip (no shouting badge). Preselect the option you want most people to start on (the old prompt preselected 3 months); confirm which in your pricing decision.
5. **What you get:** three rows: room, chat, progress and focus for everyone · AI coach and Partner Finder for you · bigger photo allowance. A sentence below: "Logging, your diary and your streak stay free."
6. Primary CTA **"Start free trial"** (or "Continue") with a one-line renewal sentence in `label`: "Renews at ₹… every 3 months. Cancel any time in your store settings."
7. Footer: **Restore purchases**, Terms, Privacy.
**Interactions:** selecting a card updates the CTA price; purchase uses the store sheet only.
**States:** trial available → CTA says "Start 3-day free trial"; trial used → "Continue"; store unavailable → "We can't reach the store. Try again."; pending purchase → "Waiting for the store to confirm."
**A11y:** plan cards are radio buttons with the full price sentence; no countdowns.

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| O01 | Plan overview (Me) | Card: plan name, the room it covers, cap and current member count, renewal date, "Change plan", "Manage in store", Restore purchases | Visible even when no plan ("No plan") | SUB-14 |
| O03 | Trial banners | Inline banner on Today and Room: "2 days left in your room trial" with a quiet "See plans" | Shown on days 2 and 3 only | SUB-3 |
| O04 | Purchase success | Short confirmation: room name and the cap, "Invite friends" and "Done" | Success haptic | SUB-1 |
| O05 | Room full: upgrade (host) | "Your room is full. Plus fits up to 20 people." with the next tier highlighted, "Upgrade" | Store upgrade flow, immediate | SUB-6, SUB-7 |
| O06 | Keep this room going (any member) | Same as O02 with context "Keep your room going" and a line "You'll become the plan holder." | Reached from J20 | SUB-8 |
| O07 | Payment problem (grace) | Banner then sheet: "We couldn't renew your plan. Update your payment to keep your room." with "Fix payment" | Room keeps working during store grace | SUB-13 |
| O08 | Manage / cancel | Opens the store page; in-app text explains what happens at cancel (room becomes paused after the period; personal tracking stays free) | Cancel link is clear | SUB-14 |
| O09 | Restore result | Sheet "We found your plan" or "No purchases found" | Required on iOS paywall | SUB-12 |
| O10 | Promo code | Field and Apply | P1 | SUB-18 |

### 7.P System and global screens

| ID | Screen | Layout | Key content and actions | Notes |
|---|---|---|---|---|
| P01 | Offline and sync | Pill at the top "Saved on this phone. Will sync."; a "Sync status" row in Me with queue length | Never blocks logging | LOG-9 |
| P02 | Permission denied | Sheet: what stops working, what still works, **Open settings** | Used for camera, notifications, Health | ONB-7 |
| P03 | Full-screen error / maintenance / update | Calm centred message, retry, "Update the app" for forced updates | Voice rules apply | — |
| P04 | Universal report sheet | Reason list, note, confirm; used for message, user, recipe, food entry | One component everywhere | CHT-8, USR-9 |
| P05 | Destructive confirm pattern | Sheet with consequence in plain words and a red-text confirm; Cancel is the default focus | Only for irreversible actions | — |
| P06 | Deep-link router | Handles invites, requests, focus, challenge; routes via sign-in if needed | Shows A15 for invites | ROOM-2 |
| P07 | Home-screen widget (after MVP) | Small and medium widgets: calories left; "you vs partner today" as two arcs | Built after launch | — |
| P08 | Share cards | Privacy-safe images for progress and challenges | Never include exact weight by default | PRG-13 |
