## Part 1 — Design philosophy and HCI rules (what "best UX" means here)

### 1.1 Five principles for this product
1. **Quiet everywhere, bold in one place.** The paired view (Room) gets the boldness. Everything else is calm.
2. **Two people, not a scoreboard.** Identity colour, never score colour. Percent of your own goal, never raw calories side by side.
3. **Never block a log.** Logging is the core loop. It works offline, opens on what you eat most, and takes the fewest taps possible.
4. **Honest and gentle.** Estimates are labelled, rates have safety limits, no guilt copy, no streak-loss shame, no fake urgency.
5. **Premium means restraint and craft.** Few colours, one accent, precise spacing, tabular numbers, motion that explains.

### 1.2 HCI laws turned into rules

| Law or heuristic | What it means in this app | Where it bites |
|---|---|---|
| **Fitts's law** (big, near targets are fast) | Primary actions sit in the thumb zone (bottom 40%). Minimum target 44×44 pt (iOS) and 48×48 dp (Android); primary buttons 56 high and full width. | Log sheet, quantity step, Nudge, tab bar |
| **Hick's law** (more choices, slower choice) | Never more than 5 top-level choices; the Log hub shows 6 tiles, then goes deeper. Onboarding asks one question per screen. | A04–A09, D01 |
| **Miller's 7±2 / chunking** | Lists are grouped under headers; Progress is cards, not one long chart page. | M01, N01 |
| **Jakob's law** (people expect what other apps do) | Food search, barcode scan, water taps, bottom tab bar behave like the apps people already know. We differ only in the paired view. | D02, D04, C01 |
| **Doherty threshold** (feedback under 400 ms) | Every tap responds in under 100 ms (haptic or visual); saves are optimistic; skeletons not spinners. | All logging |
| **Peak–end rule** | Make the first minute (target reveal) and the end of a day (seam fuse) the memorable moments. | A10, J01 |
| **Zeigarnik / goal-gradient** | Show progress toward the day counting ("Day counts at 50%") and rings that fill, not empty checklists. | C01, J01 |
| **Progressive disclosure** | Show the number first, the formula one tap away, never both at once. | A11, C02 |
| **Recognition over recall** | Recent and frequent foods first; last-used quantity beside each row. | D02 |
| **Postel / error prevention** | Accept "2 roti", "200g", "1.5"; block unsafe rates with the reason and the nearest safe option. | D03, A09 |
| **Nielsen #1 visibility of status** | Sync pill, "Saved on this phone", server-time countdowns, "last synced" for steps. | P01 |
| **Nielsen #3 user control** | Undo on every destructive log (5 s), swipe to delete, back always works. | Global |
| **Nielsen #5 error prevention** | Confirm only the irreversible (delete room, delete account). Never confirm a log. | N16, B07 |
| **Aesthetic–usability effect** | Beautiful numerals, even spacing and soft motion make people trust the numbers. | Type scale, Part 3 |
| **Von Restorff** (the odd one is remembered) | One apricot button per screen. Everything else is neutral. | All |

### 1.3 Behavioural design: used carefully
- **Habit loop:** cue (reminder) → action (log in two taps) → reward (ring fills, seam fuses). The reward is information and a small haptic, not points.
- **Social accountability:** one partner's status is visible; nudges are friendly and limited (PRD SOC-1).
- **No dark patterns:** no countdown timers on the paywall, no pre-ticked upsells, no guilt, cancel link is visible (SUB-14).
- **Health safety is a UX job:** unsafe rates are unavailable with the reason; fasting is hidden when screening says so; copy never claims medical effects.

### 1.4 Platform conventions (do not fight them)
- **iOS 26:** let system bars and the native tab bar adopt Liquid Glass; use glass sparingly on custom surfaces, test with **Reduce Transparency** and **Reduce Motion**, and use inset half-sheets (Apple adopting-Liquid-Glass guidance).
- **Android:** support **predictive back**; do not intercept the back event unless the screen truly needs a confirm. Targeting API 36 is expected to be required around mid-2027 (secondary source, check before you ship).
- **Navigation:** iOS left-edge swipe + back chevron; Android system back. Sheets dismiss by drag on both.
- **Sign in with Apple** must be offered on iOS because Google sign-in is offered, and listed first on iOS.
- **Subscriptions** use store billing only; **Restore purchases** is visible on the paywall and in Me.
- **Health data:** Health Connect (Android), HealthKit (iOS), asked in context, never at launch.

### 1.5 Who we design for
A first-time user in India, often on a mid-range Android (market share in Q1 2026 per CMR: Vivo 21%, Samsung 17%, OPPO 14%, Xiaomi 12%, Apple 9%; MediaTek chips 48%). Consequences: assume a 6.5" 720p LCD, 4 to 6 GB RAM, patchy data, bright sun; so **contrast and size margins matter more than on a flagship**, blur and shadows are budgeted, fonts are bundled, lists are virtualised, and Hindi is a first-class language.
