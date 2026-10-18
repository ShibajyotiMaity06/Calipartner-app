## Part 5 — Component library

Build these once, in `/packages/ui` (tokens first). No hard-coded hex or spacing anywhere else.

### 5.1 Core components

| ID | Component | Spec |
|---|---|---|
| CMP-01 | **Button** | Primary: apricot fill, `onBrand` text, 56 high, radius 16, full width in sheets. Secondary: transparent, 1 px `hairlineLit`, `textHi` label. Tertiary: text only in `apricot`. Destructive: `danger` text on transparent (fill only inside a confirm sheet). Pressed: `apricotPressed` or `s3`. Disabled: `s2` fill, `textOff` label, never hidden. Loading: label stays, a 16 px spinner replaces the icon. Verb names the object ("Add to lunch"). |
| CMP-02 | **Chip / segmented control** | Chip height 36 (hit area 44), radius 12. Selected: apricot 16% fill + 1 px apricot edge + apricot text. Unselected: 1 px `hairlineLit` edge, `textMid`. Segmented control: 40 high, thumb slides over `base`. Scrolls horizontally when it does not fit. |
| CMP-03 | **Card** | `s1` fill, radius 20, 1 px `hairline`, top highlight, padding 16. Tappable cards show a trailing chevron or a clear action; pressed = `s2`. |
| CMP-04 | **Sheet** | Half (50%), tall (90%), full. 28 radius, 36×4 grabber in `hairlineLit`, scrim black 50%. Opens over `base`, drags to dismiss, stops at snap points. The Log sheet is the only glass sheet. Inset half-sheets on iOS 26. Sheets do not nest more than one level. |
| CMP-05 | **Tab bar** | Floating, 64 high, radius full, inset 12. Five slots: Today, Room, ＋, Progress, Me. ＋ is a 56 apricot circle that rises 8 above the bar. Active tab: filled icon + apricot label; inactive: outline icon `textLo`. Badges: 8 dot on Room (unread/requests) in `apricot`. Labels always shown (not icon-only). Hide on full-screen flows (scan, focus running). |
| CMP-06 | **Fields** | 56 high, `s2` fill, 1 px `hairlineLit`, radius 12, label above (not placeholder-only). Numeric fields use a numeric keypad with a unit suffix chip. Error: `danger` edge + icon + text below ("Use 3 to 20 letters, numbers, . or _"). Stepper: − / + 48×48 buttons around a tabular numeral. |
| CMP-07 | **List row** | 56 min height, leading icon/avatar 40, title `heading`, subtitle `body-s` `textMid`, trailing value or chevron. Hairline separators inset 16. Swipe left = delete (with undo toast), swipe right = favourite or duplicate. |
| CMP-08 | **Avatar** | 24, 36, 40, 72. Optional 2 px ring in identity hue. Presence dot 6 px in identity hue (never green). Fallback: initials on `s3`. |
| CMP-09 | **PairRing** | Two arcs on one shared circle (see 5.2). |
| CMP-10 | **Seam** | The paired view's vertical line (see 5.3). |
| CMP-11 | **PersonColumn** | Mirrored half of the paired card (see 5.4). |
| CMP-12 | **NudgeButton** | 44 pill centred on the seam (see 5.5). |
| CMP-13 | **CalorieRing + MacroBar** | Single-person ring (apricot is not used: ring takes the owner's identity hue). Centre = remaining or eaten in `numeral-l`. Macro bar = three segments in 100/55/28% identity steps with gram values under. |
| CMP-14 | **Charts** | Line 1.5 px, owner's identity hue; 7-day moving average as a thicker 2.5 px line over faint raw dots; goal as a dashed `hairlineLit` line; no area fill; no 3-D; dots only on tap; tooltip card `s2`; axis labels `textLo` `label`. Bar charts for steps, water, workouts; today's bar highlighted with an outline. Maximum 4 series. Always provide "View as table" for accessibility. |
| CMP-15 | **Toast, undo, banner, sync pill** | Toast: `s3`, 48 high, above tab bar, 4 s, undo action in apricot. Banner: inline card with icon + one action. Sync pill: 28 high at the top: "Saved on this phone. Will sync." |
| CMP-16 | **Switch row** | Title + one line of consequence text beneath ("Partners can see your meal items."). Switch is 52×32; label is also tappable. |
| CMP-17 | **Empty state** | One line of what this is, one line of why, the action. No illustration of people. A small line-art glyph (48) is allowed. |
| CMP-18 | **Skeleton** | Same geometry as the final layout in `s2`, no shimmer sweep. Rings show the track without the arc. |
| CMP-19 | **Plan card** | Size tier (Basic/Plus/Pro), range ("2 to 5 people"), price per month, billed-as line, selected = apricot edge. Savings label is a quiet chip, not a badge. |
| CMP-20 | **Match card** | Banded profile fields only (see L05). Illustrated avatar, age band, goal chip, style, experience, time of day, city, languages, bio, up to three "why you match" reasons. |
| CMP-21 | **TimerDisplay** | `numeral-xl` tabular time computed from stored UTC timestamps (never a counter). A thin ring (6 px) shows progress. |
| CMP-22 | **ChallengeCard** | Full-width, radius 20, the only place a duotone gradient/imagery is allowed. Name, date range, activity glyph, state chip (Join / Day 3 of 7 / Done). |
| CMP-23 | **Visibility eye** | 14 px eye glyph on every shared item. Tap opens a sheet: exactly who sees this and why, with a link to privacy settings. |
| CMP-24 | **Permission primer** | Full-screen or sheet before the OS prompt: what we read, what we write, what we never do; primary "Allow", secondary "Not now". |
| CMP-25 | **Hidden metric** | A neutral lock glyph with "Not shared", never an empty value or zero. |

### 5.2 PairRing (the signature component)
- Two arcs on **one shared circle**: outer = you in your identity hue, 10 px stroke, round cap; inner = partner, 7 px stroke, 6 px gap. Each arc is a **percent of that person's own goal**, starts at −90° and sweeps clockwise. Track: `s2`, 1 px. Diameter 184 (Room), 120 (Today strip), 64 (list).
- Centre: your percent in `numeral-xl` (44 at 184 px), with "1,180 left" in `label` below. The partner's percent is a small pill at the end of their arc, so the number travels with the arc.
- At 100% an outer glow in the arc's own hue at 18%. **Past 100%**: a second lap in `cream` on top, one extra lap maximum, never more than two laps. Caption "320 over" in `textMid`.
- Animation: `ring` easing from the previous value; first paint animates from zero once per session.
- Rooms of 3 or more: the ring shows you plus the person you last compared with; never three arcs on a ring.
- Screen reader: "Your goal, 78 percent complete. Priya's goal, 64 percent complete."

### 5.3 Seam
- 1 px vertical line, inset 24 top and bottom, running the height of the paired card.
- **Broken:** 6 px dashes in `hairlineLit` when neither person has a logged day. **Half-lit:** solid from the top to the midpoint in the **finished person's** identity hue, plus a 5 px dot on their side. **Fused:** full solid line with a 2 px glow gradient (iris at top to teal at bottom), sweeping in from both ends to the middle over `seam`.
- A 13 px caption fades in under the card: "Both of you logged today. Day 12." No modal, no confetti.
- "Logged day" is the PRD 7.4 rule (at least 2 entries and 50% of the calorie target), so the seam fuses automatically.
- Screen reader: "Neither of you has finished logging today." / "Both of you logged today."

### 5.4 PersonColumn and reflow
- Avatar 36 with 2 px identity ring, name `label`, percent `numeral-m`, steps as a thin bar, then four meal rows (Breakfast, Lunch, Dinner, Snacks), each 24 high with a 14 px status glyph on the side facing the seam. Logged = filled dot in the person's hue; not logged = open 1.5 px circle in `hairlineLit`. Never a cross, never strikethrough, never "missed".
- Long-press a logged meal to open the partner's entry (if shared). Tap the dot to react.
- **Reflow:** at text scale ≥ 1.5 or width < 340, the card stacks the two columns vertically, the seam becomes a horizontal rule, and the PairRing becomes two single arcs.
- Hidden or unshared data shows `CMP-25`, not zero.

### 5.5 NudgeButton
44 pill centred on the seam at the card's midpoint, `s2` fill with `hairlineLit` edge, a tap glyph, no text. Press: medium haptic, brief fill in the partner's hue. Limits per PRD SOC-1 (2 per recipient per day); a tap beyond the limit shows "You nudged Priya earlier. You can nudge again tomorrow."
