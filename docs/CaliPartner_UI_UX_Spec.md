# CaliPartner — UI/UX Master Spec

**Version 1.0 draft · 18 Oct 2026 · aligned to PRD v0.4 · for React Native + Expo (iOS and Android)**

This is the one file to finalise the look, the layout and every screen before building. Read Part 0 first (decisions to confirm), then pick screens to approve or change by their ID (for example `J01`, `D03`). Every screen carries the PRD requirement IDs it satisfies, so nothing is built that the PRD does not ask for and nothing in the PRD is left without a screen.

> **About your design skills.** You mentioned an Apple-design skill and "UI UX Pro Max". I cannot load those in this session, so none of this was produced with them. The spec is written so you can hand it to them: Parts 2 to 5 are tokens and components, Part 7 is the screen inventory, Appendix A is the adapted build prompt. Where they disagree with this file, decide per screen and tell me which won.

---

## Part 0 — Read this first

### 0.1 What you asked, in one paragraph
All screens of the app, what goes in each and where it sits; a verdict on your colour theme (taken from your Create Challenge screenshot) with its cons; a better palette if there is one; typography; what to change in the earlier Flutter "Duo" design prompt; and a final UI that is premium, aesthetic and has the best UX.

### 0.2 Verdicts in five lines
1. **Your theme (warm near-black + apricot) is good. Keep it.** It is distinctive in a category full of blue, green and neon, it suits a food-first app, and it is not Strava orange.
2. **Five fixes make it ship-ready** (section 2.2): lift the surfaces and use lit edges, always put dark text on apricot, retire the amber "over goal" colour, add a cool Iris + Teal pair for the two people, and plan a cream light theme.
3. **Typography:** Bricolage Grotesque for numerals and titles, Figtree for interface text, Anek Devanagari for Hindi.
4. **Screen count:** 180 entries in total: 38 "hero" screens specified in full and 142 sheets, secondary screens and states in compact tables. About 20 of the 180 are states or sheets rather than full-page screens, so the number of full pages is closer to 150.
5. **From the old prompt:** keep the ideas (seam, identity colour, percent not calories, one motion moment), replace the stack, palette, fonts and pricing (Appendix A).

### 0.3 Decisions I made that you should confirm

| # | Decision | Why | Alternative |
|---|---|---|---|
| D1 | Warm dark theme is the default; a cream light theme follows after launch | Matches your taste; OLED-friendly at night | Ship light at launch (costs about 1 week) |
| D2 | Two people = **Iris** (A) and **Teal** (B); apricot is the app, not a person | A warm second hue cannot be told apart from apricot | Iris + Rose if you want warmer pairs |
| D3 | **No amber/gold over-goal colour.** Over goal = a cream second lap + the words "over" | Gold sits at ΔE 7.8 from apricot (too close) | Olive gold #D3C730 (ΔE 10.7, looks muddy) |
| D4 | Fonts: Bricolage Grotesque + Figtree + Anek Devanagari, **static weights** | Variable `wdth` axis does not work on Android in Expo | Manrope alone (cleaner, less character) |
| D5 | Tabs: Today · Room · **＋** · Progress · Me (as PRD 6.26) | Matches PRD | Rename Progress to "Ranks" (old prompt) |
| D6 | **Friend challenges** (1, 7, 30 days) are added to the PRD as `CHL-5`, because your screenshot shows them and PRD CHL-1 only has 30/60/90-day seasonal challenges | Short challenges are the easiest way to get two people talking | Drop 1/7-day options |
| D7 | Challenge activity tiles map to PRD metrics: Walking = steps, Studying = Focus minutes, Gym = workout days, Running/Cycling = distance (needs Health import in v1, GPS later), Custom = a habit tick. **No calorie-based tile, ever** | PRD CHL-1 and healthy-use rules | — |
| D8 | "Day complete" is not a button. It is automatic when a **logged day** is reached (PRD 7.4: at least 2 entries and 50% of the calorie target) | The PRD has no "close day" action; I will not invent one | Add an explicit "Done for today" button |
| D9 | Extra is the fifth meal section on Today and in the Log sheet; the room side-by-side card shows the four main meals only | PRD LOG-6 and RV-3 | Show five rows in the room card |

### 0.4 How each screen is written
Hero screens use this block. Compact tables use the same columns in short form.

- **ID · Name · PRD refs · Priority**
- **Purpose** — the one job of the screen.
- **Layout** — zones from top to bottom with sizes.
- **Components** — from Part 5.
- **Interactions** — taps, gestures, haptics, transitions.
- **States** — only those that differ from the global patterns in 6.5.
- **Copy** — exact strings where tone matters.
- **A11y** — only what is specific.

---

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

---

## Part 2 — Colour

### 2.1 Verdict on your theme

I sampled your screenshot: background about `#0F0C07`, card about `#1D1914`, surface about `#24201C`, accent about `#F4B67D` (OKLCH L 0.82, C 0.10, H 63°), tan `#BB8661`, cream `#EAC4A1`, deep copper `#76513A`.

**Good:**
- **Distinct.** Fitness apps are blue, green or neon; warm apricot on espresso-black stands apart and feels premium, like a watch face or a coffee brand.
- **Fits the product.** The app is half food. Warm tones make food photos and recipe cards look appetising.
- **Strong contrast where it counts.** Apricot on the background is 11.0 to 1, on a card 9.9 to 1; dark text on apricot is 10.4 to 1.
- **Not a clone.** Strava orange `#FC4C02` is ΔE 21 away; Swiggy orange `#FC8019` is ΔE 12 away (a softer, peachier hue).

**Cons, and what to do about each:**

| # | Con | Evidence | Fix in this spec |
|---|---|---|---|
| 1 | **Surfaces are too close.** Card vs background is 1.12 to 1, so cards can melt into the background on dim LCD panels and in sunlight. | Measured | Lift surfaces slightly; give every card a 1 px hairline and a top inner highlight; any boundary needed to find a control (input, unselected chip) uses a lit edge at 4.1 to 1. |
| 2 | **White text fails on apricot** (1.77 to 1). Any default white label on a primary button is unreadable. | Measured | A fixed `onBrand` token `#1C1109` on all apricot fills (10.4 to 1). Lint rule: no white on apricot. |
| 3 | **It collides with the amber "over goal" signal** from the old prompt (ΔE 5.8; gold at the best alternative is still ΔE 7.8). Users would read "over" as "brand". | Measured | Retire amber. Over goal = cream second lap + the words "over". |
| 4 | **You cannot make two people out of two warm hues.** Person A and B must be told apart by colour-blind users too; warm hues merge. | CVD simulation | Cool identity pair Iris + Teal. Apricot stays "the app and the warmth between you". |
| 5 | **Regional associations.** Saffron `#FF9933` is ΔE 7.7 from apricot; strong orange in India can read as political or as a food-delivery app. | Measured | Apricot is lighter and softer than both, and is used only for actions, never as large fills. Do not use green or white next to it in a row (tricolour). |
| 6 | **Dark-only fails in sunlight and for some users.** Many Indian users log outdoors or at lunch. | Context | Ship the cream light theme (2.6) after launch; the tokens are already paired. |
| 7 | **Warm brown-black can look muddy** if surfaces are too brown. | Visual check | Keep surfaces desaturated (chroma under 0.02) so they read as espresso, not mud. |

### 2.2 Recommended palette: "Apricot on Espresso"

Every value below was checked by script (contrast = WCAG relative luminance).

**Surfaces (dark, default)**

| Token | Hex | Use | Contrast note |
|---|---|---|---|
| `bg0` | `#0E0B08` | App background (not pure black: avoids OLED smear) | — |
| `s1` | `#1A1511` | Cards | step from bg0 1.08:1 (decorative, so edges carry it) |
| `s2` | `#241E18` | Raised: inputs, sheets, selected rows | step 1.10:1 |
| `s3` | `#2F2821` | Pressed states, tab bar fill fallback | step 1.14:1 |
| `hairline` | `#3A3228` | Decorative 1 px lines | 1.44:1 on s1 |
| `hairlineLit` | `#85755F` | Required control edges, focus, seam, empty circles | **4.06:1 on s1, 3.69:1 on s2** (passes 3:1) |

**Text**

| Token | Hex | Use | On bg0 / s1 / s2 |
|---|---|---|---|
| `textHi` | `#F7F0E7` | Numerals, headings | 17.4 / 16.0 / 14.6 |
| `textMid` | `#C9BCAC` | Body, labels | 10.5 / 9.7 / 8.9 |
| `textLo` | `#9A8E7F` | Placeholders, axes, captions | 6.1 / 5.7 / 5.1 |
| `textOff` | `#6F6558` | **Disabled only** | 3.4 / 3.2 / 2.9 |

**Brand (the app, not a person)**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `apricot` | `#F4B67D` | One primary button per screen, active tab, selected chip, links, the ＋ button | 11.1 on bg0, 10.2 on s1, 9.3 on s2 |
| `apricotPressed` | `#E19A5C` | Pressed state | 7.7 on s1 |
| `copper` | `#BB8661` | Secondary accents, illustrations, chart gridline accents | 5.8 on s1 |
| `onBrand` | `#1C1109` | Text and icons on apricot | **10.4 on apricot, 7.9 on pressed** |

**Identity hues (luminance-matched at 0.40, so neither person looks "bigger")**

| Token | Hex | OKLCH | On s1 / s2 | Role |
|---|---|---|---|---|
| `iris` | `#B49AFC` | 0.75 / 0.14 / 295° | 7.7 / 7.0 | **Person A (default: you)** |
| `teal` | `#1FBDB6` | 0.72 / 0.12 / 190° | 7.8 / 7.1 | **Person B (default: partner)** |
| `rose` | `#F885B5` | 0.76 / 0.15 / 355° | 7.8 / 7.1 | Optional |
| `mint` | `#2EC083` | 0.72 / 0.15 / 160° | 7.8 / 7.1 | Optional |
| `sky` | `#5EAFFE` | 0.74 / 0.14 / 250° | 7.8 / 7.1 | Optional |
| `orchid` | `#E48ADD` | 0.75 / 0.15 / 330° | 7.7 / 7.1 | Optional |

Apricot is at least ΔE 16 from every identity hue (closest: rose 16.0).

**Colour-blind check (ΔE in OKLab ×100, worst of normal, deuteranopia, protanopia, tritanopia).** Only these pairs may be assigned together in a room (minimum ΔE ≥ 8):

| Pair | Normal | Deut | Prot | Trit | Allowed |
|---|---|---|---|---|---|
| **Iris + Teal (default)** | 20.8 | 9.8 | 13.0 | 12.6 | Yes |
| Iris + Rose | 14.5 | 12.7 | 10.4 | 16.3 | Yes |
| Iris + Mint | 26.9 | 16.7 | 20.1 | 13.1 | Yes |
| Sky + Rose | 23.0 | 14.4 | 10.6 | 28.1 | Yes (gender-coded, not default) |
| Mint + Orchid | 30.2 | 11.3 | 17.0 | 24.0 | Yes |
| Teal + Rose, Teal + Orchid, Teal + Mint, Teal + Sky, Iris + Sky, Iris + Orchid, Rose + Mint, Rose + Orchid, Sky + Mint, Sky + Orchid | — | — | — | worst 1.6 to 6.1 | **No.** The colour picker greys these out. |

Even for allowed pairs, **colour is never the only signal**: position (left or right), avatar, and name label always accompany it.

**Signals**

| Token | Hex | Use | Contrast on s1 |
|---|---|---|---|
| `danger` | `#F65C58` | Destructive actions and errors only (delete, leave, failed). **Never performance.** | 5.7 (ΔE 19 from apricot) |
| `cream` | `#F7F0E7` (= textHi) | "Over goal" second lap, success tick | 16.0 |
| `info` | uses `textMid` + icon | No separate blue | — |

There is **no green for good, no red for bad, no amber for over**.

### 2.3 Colour rules
1. **One apricot action per view.** Everything else secondary is outline (`hairlineLit` edge) or text.
2. **Identity hue marks a person** (arc, dot, name ring, chart line). It never means good or bad.
3. **Macros** use three steps of the owner's identity hue (100%, 55%, 28% opacity). Values are always printed as numbers, so the lightest step is decorative.
4. **Glass** only on the floating tab bar and the Log sheet. On low-end Android, replace blur with opaque `s2` (see 4.4).
5. **Imagery and gradients** only on challenge cards and the paywall hero. Gradient: `iris → apricot → teal` at low saturation, used for the logo, the fused seam and the target ring.
6. **No white-on-apricot, no pure black, no pure white.**
7. **Food photos** sit on `s1` with a 1 px inner `hairline`; never tint them.

### 2.4 Alternatives considered

| Option | Feel | Verdict |
|---|---|---|
| **A. Apricot on Espresso (recommended)** | Warm, premium, food-friendly | Chosen |
| B. Cold Slate + Volt/Glacier (old prompt) | Athletic, techy, "gym at 6 am" | Strong but generic; many fitness apps look like this |
| C. Deep Indigo + Violet (old prompt v1) | Calm, premium, common in wellness | Safe; weaker link to food; violet is already used by many apps |
| D. Forest green + cream | Natural, health | Green means "good" to users, which breaks the no-performance-colour rule |

### 2.5 Dark-mode craft
- Prefer `s1`, `s2` steps over drop shadows. Shadows only under floating things (tab bar, sheets): colour `#000` at 50%, blur 32, y 8.
- Cards get a **top inner highlight**: 1 px line at white 7% on the top edge, so cards look like milled plates.
- Large apricot areas feel loud; limit fills to buttons, the ＋ button, chips and selected states.

### 2.6 Light theme (post-launch, measured)

| Token | Hex | Contrast |
|---|---|---|
| `bg0` | `#FBF6EF` | — |
| `s1` / `s2` | `#FFFFFF` / `#F3EBE0` | — |
| `textHi` / `textMid` / `textLo` | `#2A2118` / `#5E5246` / `#7A6D60` | 14.7 / 7.1 / 4.7 on bg0 |
| `hairlineLit` | `#9A8B78` | 3.1 on bg0 |
| `apricot` | `#F4B67D` (fill only; 1.65 on bg0, so **never** as text) | `onBrand` on it 10.4 |
| `brandInk` | `#8F4A0C` (links, active icons, text) | 6.2 on bg0, 6.7 on white |
| Identity (darker, lum 0.15) | Iris `#7B56C8`, Teal `#217874`, Sky `#016EBE`, Rose `#BA3C78`, Mint `#167B52`, Orchid `#A745A1` | about 5.2 on white |

Rule: on light, brand text uses `brandInk`; apricot is a fill only.

---

## Part 3 — Typography

### 3.1 Recommendation

| Role | Font | Why |
|---|---|---|
| **Display and numerals** (ring numbers, big stats, screen titles) | **Bricolage Grotesque** 600 and 700 | Warm, slightly quirky grotesque with character; numerals look confident at large sizes; has tabular figures |
| **Interface text** (body, labels, buttons, lists) | **Figtree** 400, 500, 600 | Friendly, very legible at 13 to 17 sp, good on 720p screens, has tabular figures |
| **Hindi (Devanagari)** | **Anek Devanagari** 400, 500, 600 | Matches the geometry of Figtree, comes with matching Latin, tabular figures in its Latin subset |

I rendered five pairings on the apricot theme with Devanagari; Bricolage + Figtree was the most characterful without losing legibility; Manrope and Plus Jakarta Sans were cleaner but plainer; Fraunces (serif) looked editorial but less sporty. **Fallback if you want calmer:** Manrope for everything.

I checked the font files: Bricolage Grotesque, Figtree, Anek Devanagari (Latin), Manrope, Plus Jakarta Sans and Instrument Sans carry `tnum` (tabular numbers). **Noto Sans Devanagari does not**, which is why Hindi uses Anek Devanagari.

### 3.2 Technical rules (React Native + Expo)
- **Use static weights, not variable fonts.** On Android, Expo supports only the `wght` axis and only from Android 10; on iOS only named instances. So the old prompt's Archivo `wdth` axis (width) is unsafe. Embed static files with the `expo-font` config plugin so there is no flash of fallback font.
- **Files to bundle (8):** Bricolage 600, 700; Figtree 400, 500, 600; Anek Devanagari 400, 500, 600. Load the Anek files only when the language is Hindi.
- **Tabular numbers:** `fontVariant: ['tabular-nums']` on every number that changes (rings, timers, kcal, weights). Numerals in Hindi UI stay Latin digits in Bricolage or Figtree.
- **Scaling:** `allowFontScaling` stays on. Cap `maxFontSizeMultiplier` at 1.3 for ring centres, tab labels and chips; allow up to 2.0 for body text. At 1.5× and above, layouts reflow (paired card stacks, see 5.4).
- **Hindi line height** is 1.15× the English value for the same size so matras never clip.
- **Sentence case everywhere.** No all-caps labels, no letter-spaced eyebrows.

### 3.3 Type scale (sp)

| Token | Font | Size / line | Use |
|---|---|---|---|
| `numeral-xl` | Bricolage 700, tabular | 48 / 52, −1% | Target reveal, ring centre (hero) |
| `numeral-l` | Bricolage 600, tabular | 34 / 38 | Ring centre (Today), timers |
| `numeral-m` | Bricolage 600, tabular | 20 / 24 | Card stats |
| `title-1` | Bricolage 600 | 26 / 32 | Screen titles |
| `title-2` | Bricolage 600 | 20 / 26 | Section titles, sheet titles |
| `heading` | Figtree 600 | 17 / 24 | Card titles, list titles |
| `body` | Figtree 400 | 16 / 24 | Body copy, inputs |
| `body-s` | Figtree 400 | 14 / 20 | Secondary text |
| `label` | Figtree 500 | 13 / 18 | Captions, chips, tab labels |
| `micro` | Figtree 500 | 11 / 14 | Smallest, never carries essential information |
| `button` | Figtree 600 | 16 / 20 | Buttons |

---

## Part 4 — Layout, spacing, shape, motion

### 4.1 Grid and spacing
- Base unit **4**. Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Screen side padding **20** (16 on screens narrower than 360 dp). Card inner padding 16. Gap between cards 12. Section gap 24.
- **Thumb zone:** primary actions in the bottom 40% of the screen. Titles and read-only data above.
- Safe areas always respected. Bottom tab bar floats 12 above the safe area.
- Design for **360×640 dp** first, check 390×844 (iPhone), then tablets (centre column max 560, scale up only the margins).

### 4.2 Radius, borders and elevation

| Element | Radius |
|---|---|
| Chips, inputs, small buttons | 12 |
| Buttons (primary) | 16 |
| Cards | 20 |
| Sheets (top corners) | 28 |
| Rings, avatars, pills, tab ＋ | full |

Borders: 1 px `hairline` on cards; `hairlineLit` on controls that need to be found. Elevation is made with surface steps (`s1`→`s2`→`s3`), not shadows.

### 4.3 Motion

| Token | Duration | Curve | Use |
|---|---|---|---|
| `fast` | 120 ms | (0.2, 0, 0, 1) | Taps, toggles, chips |
| `base` | 220 ms | (0.2, 0, 0, 1) | Sheets, tab changes, counters |
| `ring` | 680 ms | (0.32, 0, 0.1, 1) | Ring fill on data change |
| `seam` | 900 ms | (0.4, 0, 0.2, 1) | The day-complete fuse |

Rules: motion answers an action or a data change, nowhere else. No entrance animations on every card, no looping gradients, no confetti. **One orchestrated moment:** the seam fuse. With Reduce Motion on, replace the sweep with a 120 ms crossfade. Use `react-native-reanimated` worklets; animate transforms and opacity only.

### 4.4 Glass and performance budget
- Glass (blur) only on the tab bar and the Log sheet. On iOS 26 prefer the system's native glass for bars. On Android use `expo-blur` only if a startup benchmark keeps 55+ fps; otherwise opaque `s2`. Respect **Reduce Transparency** (opaque).
- No blur on scrolling lists. No shadows on list rows. Images: WebP, sized to the container, cached.

### 4.5 Haptics

| Event | Haptic |
|---|---|
| Log saved, toggle, chip select | Light |
| Nudge sent, focus start | Medium |
| Seam fuse, challenge complete | Success notification |
| Error | Error notification (rare) |
| Nothing else vibrates | — |

Settings has a master "Haptics" switch.

### 4.6 Iconography
- One family, 24 px grid, 1.75 px stroke, rounded caps (Phosphor "regular" or Lucide; pick one and do not mix).
- Filled variants only for the **active tab** and selected states.
- Every icon-only button has an accessibility label and a 44×44 hit area.

### 4.7 Imagery and illustration
- No cartoon mascots, no illustrated "empty" people. Empty states are an invitation with the action beside it.
- Photos: recipes (original), avatars (illustrated set plus optional photo after acceptance in Partner Finder).
- Avatars: a set of 24 abstract, warm illustrated avatars (no faces needed) in identity hues.

### 4.8 Sound
Off by default. Optional soft tick on log and a chime on seam fuse, behind a setting.

---

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

---

## Part 6 — Information architecture and global patterns

### 6.1 Navigation map

```
Launch → Welcome → Onboarding (A) → Today
                   └ Invite link → Invite preview (A15) → sign in (B) → goals → Room

TAB 1  Today        diary, rings, meals, water, steps, workouts, fasting, focus, room strip
TAB 2  Room         segments: Today · Focus · Chat · Progress · Members; inbox; invites
TAB 3  ＋ Log        sheet: Food · Workout · Water · Weight · Fast · Focus
TAB 4  Progress     segments: My progress · Leaderboard · Challenges
TAB 5  Me           profile, goals, privacy, plan, Find a partner, settings, support
```

Entry points that are not tabs: Recipes and Ask Coach (from Today, the Log sheet and Me); Requests inbox (Room header and Me); Partner Finder (Today room strip when you have no room, empty Room tab, Me, end of onboarding).

### 6.2 Navigation rules
- Tabs keep their own stack and scroll position; tapping the active tab scrolls to top.
- Maximum depth from a tab root: 3 levels. Sheets over pushes for quick tasks.
- Back is always available; never intercept the Android back gesture except to confirm discarding unsaved edits.
- Deep links: `calipartner://room/<code>`, universal links for invites, `/focus/<id>`, `/request/<id>`, `/challenge/<id>`; unauthenticated users are routed through B then returned to the target.
- State survives backgrounding (timers, drafts, in-progress workout).

### 6.3 Screen IDs
`A` Launch and onboarding · `B` Account · `C` Today · `D` Log and food · `E` Water, steps, weight, workouts · `F` Fasting · `G` Focus · `H` Recipes · `I` AI coach · `J` Room · `K` Requests and invites · `L` Partner Finder · `M` Progress, leaderboard, challenges · `N` Me and settings · `O` Plans and paywall · `P` System and global.

### 6.4 Global content rules
- **Voice:** plain, warm, specific, second person, active verbs, sentence case. No exclamation marks, no emoji in system copy, no coach persona, no guilt.
- **Names things the way people say them:** "Add to lunch", "Logged lunch", "Your room".
- **Numbers:** percent of own goal for comparisons; raw calories only in your own view.
- **Dates and units:** local time zone; kg/cm by default for India with an imperial toggle; ml.
- **Never display:** another person's calorie numbers, weight (unless opted in), or any "you are behind" message.

| Write | Not |
|---|---|
| Add to lunch | Submit |
| Added to lunch | Success! |
| 320 over | Calorie limit exceeded |
| Priya hasn't logged yet today | Priya is falling behind |
| Both of you logged today. Day 12. | Streak maintained! |
| Keep your room going | Unlock premium |
| Couldn't reach the server. Your log is saved on this phone. | Something went wrong |

### 6.5 Global states (apply to every screen unless a screen says otherwise)

| State | Pattern |
|---|---|
| **Loading** | Skeleton matching final geometry (`CMP-18`), no spinners except inside buttons. |
| **Empty** | `CMP-17`: one line what, one line why, the action. |
| **Offline** | Top sync pill "Saved on this phone. Will sync."; logging, workouts, focus and water keep working; chat shows "Sending…" then "Failed, tap to retry". Rooms and Partner Finder show last cached data with "Updated 2 h ago". |
| **Error (recoverable)** | Inline message that says what happened and the next step, plus Retry. |
| **Permission denied** | Explains what stops working and a button to open system settings (P02). |
| **Locked room (plan ended)** | "This room is paused" screen, no blame (J20). |
| **Dormant room** | Chat read-only; banner explains and offers to restart (J21). |
| **Partner not logged** | Open circles, muted 0%, one neutral line. |
| **Over capacity / full** | Host sees upgrade; others see "This room is full" (J22). |
| **Reduced motion / transparency** | Crossfades and opaque surfaces. |

### 6.6 Notifications (copy only; behaviour is in the PRD NTF section)
Supportive, no calorie numbers of other people, previews can be hidden.
- Meal reminder: "Time to log lunch?" · Water: "A glass of water?" · Partner logged: "Rahul logged lunch."
- Nudge: "Rahul logged lunch. Time for yours?" · Focus: "Priya started a focus session. Join?"
- Request: "Priya wants to be your workout partner." · Fasting: "Your eating window closes in 30 minutes."

---

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

---

## Part 8 — Accessibility, language, performance and testing

### 8.1 Accessibility (target: WCAG 2.2 AA plus platform guidance)
- **Contrast:** body text 4.5:1 or more (our `textMid` and `textLo` are 5.1 to 10.5 on surfaces); large text and non-text indicators 3:1 or more (arcs, empty circles, the seam and control edges use `hairlineLit` at 3.7 to 4.1). `textOff` is for disabled controls only.
- **Targets:** at least 44×44 pt / 48×48 dp for every tappable element, 8 dp between neighbours. (WCAG 2.2's minimum is 24 px, but 44 is the platform norm.)
- **Text scaling:** supports 200% without clipping; the paired card reflows to stacked columns at 150% and above; tab labels and ring numbers are capped at 130% but never truncated.
- **Colour is never the only signal:** identity hue is always paired with position, avatar and name; over-goal uses a second lap and the word "over"; chart series also differ by line dash or marker; every chart has "View as table".
- **Screen readers:** labels for rings and arcs ("Your goal, 78 percent complete"), seam states, switch rows with their consequence line, grouped meal rows, headings on every section. Timers announce on request. Streaming AI text announces on completion.
- **Focus:** visible focus ring 2 px in the identity hue or apricot on controls (keyboard, switch access); focus order matches visual order; sheets trap focus and return it on close.
- **Motion and transparency:** Reduce Motion replaces the seam sweep with a crossfade and stops ring animations; Reduce Transparency makes the tab bar and Log sheet opaque.
- **Forms:** labels above fields, errors in text with an icon, never colour alone; numeric keypads for numbers.
- **Haptics:** a setting to turn them off; nothing important is conveyed by haptics alone.
- **Time-based UI:** toasts last 4 s and have Undo; timers (Focus, fasting) never auto-submit.

### 8.2 Language and region
- **English and Hindi at launch** (Hindi is first-class). Budget +30% width for Hindi and +15% line height; test every screen in both.
- **Indian foods and household units** (katori, roti, glass) are first-class in search and quantity.
- **Numbers:** tabular numerals in Latin digits in both languages; Indian digit grouping only where the number can exceed 99,999.
- **Dates:** day-month order; 12-hour clock with am/pm by default, 24-hour from system.
- **Currency:** from the store region; the spec's rupee figures are proposals.
- **Tone:** copy is translated by a person, not only by machine; no idioms that do not travel.

### 8.3 Performance budgets (mid-range Android first)
- Cold start under 2.5 s to an interactive Today on a Redmi/Vivo-class phone; warm start under 1 s.
- 60 fps scrolling on lists up to 500 rows (virtualised, no per-row shadows or blur).
- A log saves optimistically in under 100 ms and syncs in the background.
- Images WebP, sized to container; recipe photos 800 px wide; avatars bundled.
- Animations on the UI thread (Reanimated worklets); animate transform and opacity only.
- Blur only on the tab bar and Log sheet, and only when a startup benchmark passes; otherwise opaque.
- Bundle fonts (8 files) with the app; Hindi fonts load only on Hindi.

### 8.4 Testing matrix
- **Devices:** 360×640 Android at 1.3× text, a 720p LCD Android (Redmi/Vivo/OPPO class), Samsung A-series, iPhone SE and a current iPhone, one tablet.
- **OS:** Android 10 to the current version; iOS current and previous; test Android predictive back.
- **Assistive:** TalkBack and VoiceOver on the ten key flows; Switch Access spot checks; 200% text; Reduce Motion; Reduce Transparency; colour-blind simulation on every chart and ring.
- **Conditions:** outdoor sunlight, airplane mode logging, slow 3G, low battery mode.
- **Usability test (5 people, 3 tasks):** (1) onboard to a target, (2) log a repeat lunch and a new food, (3) invite a friend and understand what they can see. Success bars: first target in under 90 s; repeat food in under 6 s; 4 of 5 can state what their partner sees.

### 8.5 Product metrics that tell you the UI is working
Time to first log; share of logs through Recent or ＋ re-log; onboarding completion by step; invite preview → join rate; seam-fuse days per pair per week; nudge sent vs muted; paywall view → trial start (reported separately by trigger); crash-free sessions; screen-reader session share. (Events live in PRD section 12.)

---

## Part 9 — What to finalise first, and the build order

### 9.1 Approve these 14 screens first
They define 80% of the look. After you approve them the rest follows.
`A02`, `A10`, `A15`, `C01`, `D01`, `D02`, `D03`, `E01`, `J01`, `J08`, `L05`, `M11`, `M15`, `O02`.

### 9.2 Build order for the UI
1. **Tokens and fonts** (Appendix B), theme provider, Reduce Motion/Transparency hooks.
2. **Components** CMP-01 to CMP-08, CMP-15 to CMP-18, then CMP-09 to CMP-13 (PairRing, Seam, PersonColumn, rings).
3. **A, B, C, D** (onboarding, account, Today, logging): the core loop.
4. **E, F** (water, steps, weight, workouts, fasting).
5. **J, K** (Room, requests): the differentiator.
6. **M, N** (Progress, Me, privacy).
7. **O** (plans and paywall).
8. **G, H, I** (Focus, recipes, coach).
9. **L** (Partner Finder), **challenges** (M13 to M17).
10. **P7 widgets** and the light theme.
(The order of 3 to 9 follows your existing build phases; adjust to match where you are.)

### 9.3 Open design questions for you
1. Keep Iris + Teal as the default pair, or prefer Iris + Rose (warmer)?
2. Hindi at launch, or English first with Hindi one release later?
3. Add friend challenges (CHL-5, 1/7/30 days) to the PRD as shown in your screenshot?
4. Add Cook mode (H04) and Explain-my-target (A11) as P0 or P1?
5. Light theme at launch or after?

---

## Appendix A — Changes to the earlier Flutter "Duo" design prompt

### A.1 What stays (it is good)
"Two halves, one seam"; identity colour instead of score colour; percent not calories; PairRing and the Seam with three states; one orchestrated motion moment; glass only on the tab bar and the Log sheet; no red or green for performance; plain-spoken copy; 44×44 targets and 3:1 non-text contrast; the 360×640 at 1.3× test; text scaling to 200%; "Do not" list.

### A.2 What changes

| # | Old prompt | Change to | Why |
|---|---|---|---|
| 1 | Flutter widgets, `lib/design/tokens.dart` | React Native + Expo, `packages/ui/tokens.ts` | Your stack |
| 2 | Brand name "Duo" | CaliPartner | Name |
| 3 | `FontFeature.tabularFigures()` | `fontVariant: ['tabular-nums']` | RN |
| 4 | `MediaQuery.disableAnimations` | `AccessibilityInfo` / Reanimated `useReducedMotion` | RN |
| 5 | `BackdropFilter` glass | `expo-blur` or native iOS 26 glass; opaque fallback | Performance on Android |
| 6 | **Two contradictory palettes in the same file** (an indigo "ink" base and a cold slate base, then lime/cyan identities and a violet brand) | One palette: Apricot on Espresso (Part 2) | Your chosen theme |
| 7 | Brand violet; duoGradient rose → violet → aqua | Brand apricot; gradient `iris → apricot → teal` used only on logo, fused seam, target ring, paywall hero | New brand |
| 8 | Identity: lime `#B3DE3E` and cyan `#50E0FA`; C and D `#B494FF` `#FFB47A` | Iris `#B49AFC` and Teal `#1FBDB6` as A and B (luminance-matched 0.40); optional Rose, Mint, Sky, Orchid; colour picker blocks pairs that fail the colour-blind check (2.2) | Apricot cannot also be a person; measured for colour-blind users |
| 9 | Over goal: amber `#F2B13C` | Cream second lap + "320 over" | Amber is ΔE 5.8 from apricot |
| 10 | Text and surface values | Replace with Part 2 tokens (all re-measured) | New base |
| 11 | Type: **Archivo variable `wdth` 62 to 125** | Bricolage Grotesque + Figtree (+ Anek Devanagari), **static weights** | Android supports only `wght` (Android 10+) and iOS only named instances |
| 12 | Hindi: "Anek Devanagari variable" | Anek Devanagari static 400/500/600 | Same reason; Noto Sans Devanagari lacks tabular figures |
| 13 | Radius 10 / 18 / 28 | 12 / 16 / 20 / 28 (Part 4.2) | Softer, matches your reference |
| 14 | Four meal sections | Five: Breakfast, Lunch, Dinner, Snacks, **Extra** (room card still shows four) | PRD LOG-6 |
| 15 | "Both of you closed today" | "Both of you logged today" (fuses on the PRD logged-day rule) | PRD 7.4; no invented "close day" action |
| 16 | Tab named "Ranks" with seasonal cards first | Tab named **Progress** with segments My progress, Leaderboard, Challenges | PRD 6.26; leaderboard is only one part |
| 17 | Leaderboard "division selector" and info | Keep, with PRD divisions, cohorts of ~100, top 10 + your row, Monday reset, opt-out | PRD RNK |
| 18 | Onboarding: four steps, then a paired-card empty state | One question per screen; add the private health check, the Partner Finder offer and a notification primer; keep the dashed placeholder as Today's empty state | PRD ONB-7, 11, 12 |
| 19 | Invite preview then paywall | Invite preview then sign-up; **joining is free**; the paywall appears only for hosts and plan holders | Host-pays room billing |
| 20 | Paywall: two per-person plan cards (3-month preselected), trial on day 4 | Room-plan size picker (Basic, Plus, Pro), monthly, 3-month, annual; trial starts when the first room is created; triggers per SUB-9; quiet banners on days 2 and 3 | PRD 6.18 |
| 21 | Lapsed state names the partner: "Priya's plan ended, so your room is paused" | "This room is paused." Nobody is told who stopped paying; any member can press "Keep this room going" | PRD ROOM-7 (non-shaming) |
| 22 | No Partner Finder, Focus, fasting, recipes, coach, chat, requests, challenge creation | Added as screens (7.E to 7.O) | PRD v0.4 |
| 23 | Challenge cards allowed gradients | Gradients and imagery allowed only on challenge cards, the paywall hero and the logo | Keeps restraint |
| 24 | Sign-in unspecified | Email 6-digit code + Google + Apple (Apple first on iOS); no phone login | PRD AUTH-1 |
| 25 | Platform note | Add Android **predictive back**, iOS 26 Liquid Glass guidance, App Links / Universal Links with deferred deep links, Health Connect and HealthKit in context | Platform changes |
| 26 | "No Inter, Poppins, Montserrat, SF Pro" | Keep, plus: no white text on apricot, no pure black or white | New palette |
| 27 | Home widget after MVP | Keep | — |
| 28 | Build order | Replace with 9.2 | Matches your phases |

### A.3 Ready-to-paste adapted prompt (for your design skills)

```text
You are designing and building the UI for CaliPartner, a partner accountability app for
nutrition, steps, workouts, fasting and Focus Time, India first, English and Hindi.
Stack: React Native + Expo (TypeScript, Expo Router, Reanimated). iOS and Android.

Read CaliPartner_UI_UX_Spec.md in full. It is the source of truth for tokens, components
and every screen. Do not hard-code hex values or spacing; read tokens from packages/ui/tokens.ts.

Design thesis: "two halves, one seam". Spend all boldness on the paired Room view. Everything else
is quiet. Identity colour (Iris and Teal), never score colour. Percent of own goal, never raw
calories side by side. Apricot is the app, not a person: one apricot action per screen.

Non-negotiables: dark text on apricot (never white); 44x44 targets; 3:1 for non-text; text
scaling to 200% with the paired card reflowing at 150%; screen-reader labels for rings and the seam;
Reduce Motion and Reduce Transparency respected; tabular numerals on every changing number;
static font weights only (Bricolage Grotesque, Figtree, Anek Devanagari); glass only on the tab
bar and Log sheet; one orchestrated motion moment (the seam fuse); sentence case; no emoji or
exclamation marks in system copy; no guilt copy; logging never blocks and works offline.

Build order: tokens and fonts, components, onboarding, Today and logging, trackers, Room,
Progress, Me, plans, then Focus, recipes, coach, Partner Finder, challenges.
Test on a 360x640 Android at 1.3x text and a 720p LCD phone before calling a screen done.
```

---

## Appendix B — Tokens (TypeScript starting point)

```ts
// packages/ui/tokens.ts
export const dark = {
  bg0: '#0E0B08', s1: '#1A1511', s2: '#241E18', s3: '#2F2821',
  hairline: '#3A3228', hairlineLit: '#85755F',
  textHi: '#F7F0E7', textMid: '#C9BCAC', textLo: '#9A8E7F', textOff: '#6F6558',
  apricot: '#F4B67D', apricotPressed: '#E19A5C', copper: '#BB8661', onBrand: '#1C1109',
  iris: '#B49AFC', teal: '#1FBDB6', rose: '#F885B5', mint: '#2EC083', sky: '#5EAFFE', orchid: '#E48ADD',
  danger: '#F65C58', cream: '#F7F0E7',
} as const;

export const light = {
  bg0: '#FBF6EF', s1: '#FFFFFF', s2: '#F3EBE0', s3: '#EADFD0',
  hairline: '#E6DCCD', hairlineLit: '#9A8B78',
  textHi: '#2A2118', textMid: '#5E5246', textLo: '#7A6D60', textOff: '#A89A8A',
  apricot: '#F4B67D', apricotPressed: '#E19A5C', brandInk: '#8F4A0C', onBrand: '#1C1109',
  iris: '#7B56C8', teal: '#217874', rose: '#BA3C78', mint: '#167B52', sky: '#016EBE', orchid: '#A745A1',
  danger: '#C23A36', cream: '#2A2118',
} as const; // s3, hairline, textOff, danger, cream for light are proposals: measure before use

// Colour-blind-safe pairs only (min ΔE >= 8 across normal, deuteranopia, protanopia, tritanopia)
export const allowedPairs = [
  ['iris', 'teal'], ['iris', 'rose'], ['iris', 'mint'], ['sky', 'rose'], ['mint', 'orchid'],
] as const;

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64] as const;
export const radius = { control: 12, button: 16, card: 20, sheet: 28, full: 999 } as const;
export const motion = {
  fast: { duration: 120, easing: [0.2, 0, 0, 1] },
  base: { duration: 220, easing: [0.2, 0, 0, 1] },
  ring: { duration: 680, easing: [0.32, 0, 0.1, 1] },
  seam: { duration: 900, easing: [0.4, 0, 0.2, 1] },
} as const;

export const type = {
  numeralXL: { fontFamily: 'Bricolage_700', fontSize: 48, lineHeight: 52, fontVariant: ['tabular-nums'] },
  numeralL:  { fontFamily: 'Bricolage_600', fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  numeralM:  { fontFamily: 'Bricolage_600', fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  title1:    { fontFamily: 'Bricolage_600', fontSize: 26, lineHeight: 32 },
  title2:    { fontFamily: 'Bricolage_600', fontSize: 20, lineHeight: 26 },
  heading:   { fontFamily: 'Figtree_600',   fontSize: 17, lineHeight: 24 },
  body:      { fontFamily: 'Figtree_400',   fontSize: 16, lineHeight: 24 },
  bodyS:     { fontFamily: 'Figtree_400',   fontSize: 14, lineHeight: 20 },
  label:     { fontFamily: 'Figtree_500',   fontSize: 13, lineHeight: 18 },
  micro:     { fontFamily: 'Figtree_500',   fontSize: 11, lineHeight: 14 },
  button:    { fontFamily: 'Figtree_600',   fontSize: 16, lineHeight: 20 },
} as const; // Hindi: same sizes, Anek Devanagari, lineHeight x 1.15
```

---

## Appendix C — Changes this spec asks for in the PRD (NEW items)

| # | Proposed change | Section |
|---|---|---|
| 1 | Add `CHL-5`: friend challenges, 1, 7 or 30 days, created by any user for a partner or a room, activities Walking, Running, Studying (Focus), Gym, Cycling, Custom (habit tick), scored on days the goal is reached; no calorie or weight activity | 6.17 |
| 2 | Add Cook mode (H04) as `RCP-13` (P1) | 6.21 |
| 3 | State in 6.9 that the seam fuses automatically on the "logged day" rule; no manual close action | 6.9, 7.4 |
| 4 | Replace "amber over goal" with "cream second lap and the word over" wherever the PRD or build plan mentions amber | 6.4 / design notes |
| 5 | Add the Colour and Typography decisions of this spec to AGENT_RULES.md as a UI rule block (static fonts, one apricot action, no white on apricot, allowed identity pairs) | AGENT_RULES |

---

## Sources and how reliable they are

- **Apple, "Adopting Liquid Glass"** (developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) and the Human Interface Guidelines: use glass sparingly, let system bars style themselves, test Reduce Transparency and Reduce Motion, inset half sheets. Primary source.
- **Android Developers, predictive back gesture** (developer.android.com/guide/navigation/custom-back/predictive-back-gesture): on by default, avoid intercepting the back event. Primary source. The API 36 mid-2027 enforcement point is from secondary sources; verify before you rely on it.
- **Expo documentation, fonts** (docs.expo.dev/develop/user-interface/fonts): on Android variable fonts support only the `wght` axis and only from Android 10; on iOS only named instances. Primary source.
- **W3C, WCAG 2.2** (w3.org/TR/WCAG22): contrast (1.4.3, 1.4.11), target size (2.5.8), focus (2.4.11). Primary source.
- **Laws of UX** (lawsofux.com) and **Nielsen Norman Group's ten heuristics**: Fitts, Hick, Miller, Jakob, Doherty, peak–end, Zeigarnik. Secondary summaries of well-established research.
- **CMR India, Q1 2026 smartphone market** (as reported when I researched it): Vivo 21%, Samsung 17%, OPPO 14%, Xiaomi 12%, Apple 9%; MediaTek 48%. Secondary report; Android vs iOS share was not given.
- **Onboarding paywall placement** (14 of 26 health-and-fitness flows, 54%, late position): a small public teardown sample; treat as directional only.
- **Brand colours** (Strava `#FC4C02`, Swiggy about `#FC8019`, saffron `#FF9933`): common published values; distances computed by me.
- **My own measurements** (all colour numbers, contrast ratios, colour-blind simulations, font tabular-figure checks): computed with scripts in this session using WCAG relative luminance, OKLCH/OKLab ΔE (×100) and Machado colour-vision-deficiency matrices. The simulation is an approximation, so look at the real screens with a simulator before finalising.
