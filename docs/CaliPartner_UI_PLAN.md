# CaliPartner — UI Polish Plan (phases for your coding agent)

**For:** an app already built up to about Phase 13 · **Spec:** `CaliPartner_UI_UX_Spec.md` · **Date:** 18 Oct 2026

This is the same style as your BUILD_PLAN: one phase at a time, each with a prompt you paste into Antigravity, a "done when" checklist, and a commit message. The difference is that the app already exists, so the plan **re-skins first, then polishes screen by screen**, and never rewrites working logic.

---

## 0. How this works (read once)

### 0.1 The idea in three lines
1. The spec is the **design source of truth**. The plan is the **order of work**. `AGENT_RULES.md` is the **guard rail**.
2. Phase UI-1 puts the new tokens in with a **compatibility layer**, so the whole app turns warm apricot immediately with no screen edits. After that, each phase brings one area up to the spec.
3. Every phase ends with screenshots and a short checklist, so you can verify the result before moving to the next phase.

### 0.2 Your working loop for every phase (about 5 steps)
1. **Paste the phase prompt** into Antigravity on your `main` branch (work happens directly on `main`, no feature branches needed). Ask it to show its plan first. Read the plan; reject it if it touches logic, the database or `/packages/core`.
2. **Let it build.** If it can run an emulator or simulator, let it capture the screenshots; otherwise you run the app and take them.
3. **Review** against the spec IDs listed in the phase, using the checklist and the review prompt in 0.4.
4. **Fix** with short follow-ups ("J01: the seam caption is 11 sp, should be 13").
5. **Verify and commit** directly on `main` when the checklist is green, then start the next phase in a **fresh conversation** (the agent forgets less when each phase starts clean).

### 0.3 Keep context small (this matters)
The spec is large (about 117 KB). Do not paste the whole thing every time. Phase UI-0 splits it into small files under `docs/ui/`. Every later prompt names the exact files to read, so the agent loads only what it needs.

### 0.4 Where your Apple-design skill and UI UX Pro Max fit
Use them as **reviewers**, not as authors of tokens. After each phase, give them the screenshots and this prompt:

```text
Review these screens against docs/ui/ (tokens, components and the screen IDs named below).
List only: (1) violations of the spec, (2) issues of hierarchy, spacing, alignment or touch size,
(3) anything that feels cheap or cluttered. Do not suggest new colours, fonts or radii:
the tokens in docs/ui/ are fixed. Give each issue a severity (must fix, should fix, nice to have).
Screens: <IDs>
```

If a skill's taste disagrees with the spec, decide once, write the decision in `docs/ui/DECISIONS.md`, and keep going. Do not let two sources of design truth coexist.

### 0.5 Rules that apply to every phase (the agent must follow these)
- Do not change business logic, database schema, RLS, `/packages/core` calculators or entitlement checks. UI only.
- No hard-coded hex, font names, spacing or radius outside `packages/ui/tokens`. (A lint rule enforces this from UI-1.)
- Dark text on apricot, never white. One apricot action per screen.
- Keep every screen working while you change it: offline logging, empty states, error states.
- Every interactive element: 44×44 hit area, an accessibility label, a visible focus state.
- Respect Reduce Motion and Reduce Transparency.
- If the spec and the existing app disagree on **behaviour**, stop and ask. If they disagree on **looks**, the spec wins.
- Finish each phase with: typecheck, lint, tests, screenshots, and a list of what was **not** done.

### 0.6 Screenshot protocol (use in every phase)
For each screen in the phase, capture **before** and **after**:
- Android 360×640 at 1.3× font scale (the hardest case), dark theme.
- The empty, loading and error variants where the spec defines them.
- Hindi where a phase asks for it, and for every screen in UI-12.
Save as `docs/ui/shots/<phase>/<ID>-before.png` and `<ID>-after.png`.

### 0.7 What you decide before UI-1 (from the spec, Part 9.3)
1. Iris + Teal as the default pair (recommended) or Iris + Rose.
2. Hindi at launch, or one release later (changes whether UI-12 is in or out).
3. Add friend challenges (`CHL-5`) to the PRD, yes or no (changes UI-9).
4. Light theme at launch or after (UI-13 is optional).

---

## 1. Rules block to add to `AGENT_RULES.md`

Paste this at the end of your AGENT_RULES.md in UI-0 (the prompt does it for you).

```md
## UI rules (from CaliPartner_UI_UX_Spec.md)
U1. Design source of truth is docs/ui/. Tokens live only in packages/ui/tokens. No hex, font name, spacing or radius literals elsewhere.
U2. Apricot is the app, not a person. One apricot action per screen. Text and icons on apricot use onBrand (#1C1109), never white.
U3. Two people = identity hues (default Iris and Teal). Identity colour never means good or bad. Only the pairs in allowedPairs may be used together.
U4. No red or green for performance. Over goal = cream second lap + the word "over". danger colour only for destructive actions and errors.
U5. Percent of own goal in any side-by-side view. Raw calories only in a person's own view. Hidden data shows a lock, never zero.
U6. Fonts: Bricolage Grotesque (numbers, titles), Figtree (UI), Anek Devanagari (Hindi). Static weights only. Tabular numerals on every number that changes.
U7. Glass only on the tab bar and the Log sheet, with opaque fallback for Reduce Transparency and low-end Android.
U8. One orchestrated motion moment: the seam fuse. All other motion answers an action. Respect Reduce Motion.
U9. Every tappable element is at least 44x44. Every icon button has an accessibility label. Text scales to 200% without clipping.
U10. Copy: plain, warm, second person, sentence case, no emoji, no exclamation marks, no guilt. Verb names the object ("Add to lunch").
U11. Logging never blocks and works offline. Show status, not spinners.
U12. UI work never changes logic, schema, RLS, packages/core or entitlement checks.
```

---

## 2. The phases

| Phase | Name | Spec parts and IDs | Result you can see |
|---|---|---|---|
| UI-0 | Audit and setup | All (split only) | An audit file and a screen-to-spec map |
| UI-1 | Tokens, fonts, theme | Parts 2, 3, 4, Appendix B | Whole app turns apricot-on-espresso |
| UI-2 | Core components | CMP-01 to 08, 15 to 18, 23 to 25 | A component gallery screen |
| UI-3 | Signature components | CMP-09 to 13, 21 (PairRing, Seam, Columns, Rings) | Gallery of the paired view in every state |
| UI-4 | Navigation shell | CMP-05, Part 6 | Floating tab bar, ＋ sheet, back behaviour |
| UI-5 | Onboarding and account | A, B | The first minute |
| UI-6 | Today and logging | C, D | The daily loop |
| UI-7 | Trackers, workouts, fasting | E, F | Water, steps, weight, workouts |
| UI-8 | Room, chat, requests | J, K | The hero screens |
| UI-9 | Progress, leaderboard, challenges | M | Charts and challenges |
| UI-10 | Me, privacy, plans, paywall | N, O | Settings and money screens |
| UI-11 | Focus, recipes, coach, Partner Finder | G, H, I, L | The remaining features |
| UI-12 | Hindi and text-scale pass | Part 8.2 | Every screen in Hindi at 130% and 200% |
| UI-13 | Accessibility, performance, QA | Parts 8.1, 8.3, 8.4 | A bug list and fixes |
| UI-14 | Cleanup and (optional) light theme | 2.6 | Compatibility layer removed |

If a feature (Focus, Partner Finder, challenges, coach) is **not built yet**, UI-11 and parts of UI-9 build the screens with fixtures and wait for the feature phase from your BUILD_PLAN; do not build logic in a UI phase.

---

### UI-0 · Audit and setup

**Goal:** understand what exists and make the spec cheap to use. No visual changes.

```text
Task: UI-0 audit and setup for CaliPartner. Do NOT change app behaviour or visuals.

1. Copy CaliPartner_UI_UX_Spec.md into the repo at docs/ui/CaliPartner_UI_UX_Spec.md.
2. Split it by its headings into small files in docs/ui/: 00-decisions.md (Part 0),
   01-principles.md (Part 1), 02-colour.md (Part 2), 03-type.md (Part 3), 04-layout-motion.md (Part 4),
   05-components.md (Part 5), 06-ia-global.md (Part 6), screens-A-B.md, screens-C-D.md, screens-E-F.md,
   screens-G-H-I.md, screens-J-K-L.md, screens-M.md, screens-N-O-P.md (Part 7 subsections),
   08-a11y-perf.md (Part 8), 09-order.md (Part 9), appendix-a-old-prompt.md, appendix-b-tokens.md,
   appendix-c-prd.md. Keep the original file too. Add docs/ui/README.md listing every file and when to read it.
3. Append the "UI rules" block from CaliPartner_UI_PLAN.md section 1 to AGENT_RULES.md.
4. Audit the app. Write docs/ui/AUDIT.md with:
   a) How styling is done today (StyleSheet, NativeWind, Tamagui, other) and where the current theme/colour
      constants and fonts live.
   b) Counts: hard-coded hex colours, font names, numeric paddings/radii, per folder.
   c) A table of every screen that exists in the app: route file, name, the closest spec ID (A01..P08),
      and status: matches / partial / missing. List spec screens that do not exist yet.
   d) Components that are duplicated (several buttons, cards, sheets, inputs) and should be merged.
   e) Risks: places where logic and styling are tangled.
5. Do not fix anything. Stop after writing the audit and show me a summary.
```

**Done when:** `docs/ui/` has the split files, `AUDIT.md` exists with the screen map, AGENT_RULES has the U1 to U12 block, and no app files changed.
**Commit:** `docs(ui): add UI spec, audit and screen map`

---

### UI-1 · Tokens, fonts, theme (the big visible change)

**Goal:** the whole app takes the new palette and fonts with almost no screen edits.

```text
Task: UI-1 tokens, fonts and theme. Read docs/ui/02-colour.md, 03-type.md, 04-layout-motion.md, appendix-b-tokens.md and docs/ui/AUDIT.md.

1. Create packages/ui/tokens (or the equivalent your repo uses) with the exact values from appendix-b-tokens.md:
   dark colours, light colours (not yet enabled), allowedPairs, space, radius, motion, type scale.
2. Install and bundle static fonts with the expo-font config plugin: Bricolage Grotesque 600 and 700,
   Figtree 400, 500, 600, Anek Devanagari 400, 500, 600. No variable fonts. Load Anek only when the language is Hindi.
   Hold the splash until fonts are ready so there is no flash of fallback text.
3. Create a ThemeProvider and hooks: useTheme(), useReducedMotion(), useReduceTransparency(). Dark is the default.
   Light is a stub that falls back to dark for now.
4. Create Text helpers (Text variants from the type scale) that apply fontVariant tabular-nums on numeral variants,
   respect allowFontScaling, and cap maxFontSizeMultiplier at 1.3 for numeral and tab variants.
5. COMPATIBILITY LAYER: map every old colour/spacing/font constant used in the app to the nearest new token,
   mark them @deprecated, and make the old exports point to the new values, so the whole app re-skins without
   touching screens. List every mapping you made in docs/ui/MIGRATION.md.
6. Add an ESLint rule (or a script in CI) that fails on new hex literals, font-family strings and raw numeric
   radius/shadow values outside packages/ui. Existing violations are allowed for now but listed in docs/ui/MIGRATION.md.
7. Add a unit test that computes WCAG contrast for the token pairs below and fails under the minimum:
   textHi/textMid/textLo on s1 >= 4.5; onBrand on apricot >= 7; hairlineLit on s1 >= 3; hairlineLit on s2 >= 3;
   apricot on s1 >= 7; iris and teal on s1 >= 7; danger on s1 >= 4.5. Add a test that every pair in allowedPairs is
   present and that no other pair is selectable in the colour picker data.
8. Do not edit screens except where the compatibility layer cannot reach (for example inline hex values that break contrast).

Finish: typecheck, lint, tests pass. Capture before/after screenshots of Today, Room, Me and one sheet.
```

**Done when:** the app is dark espresso with apricot accents, Bricolage and Figtree visible, numbers do not jitter, tests pass, lint blocks new hex.
**Check by eye:** no white text on apricot anywhere; buttons are readable; cards are visible against the background.
**Commit:** `feat(ui): tokens, fonts, theme provider and compat layer`

---

### UI-2 · Core components

**Goal:** one version of each basic piece, shown in a gallery.

```text
Task: UI-2 core components. Read docs/ui/05-components.md (CMP-01 to CMP-08, CMP-15 to CMP-18, CMP-23 to CMP-25) and docs/ui/AUDIT.md section d (duplicates).

1. Build in packages/ui: Button (primary, secondary, tertiary, destructive, sizes, loading), Chip and SegmentedControl,
   Card, Sheet (half, tall, full; drag to dismiss; grabber; inset on iOS), Field (text, numeric, stepper, error state),
   ListRow (with swipe actions), Avatar (with identity ring and presence dot), Toast (with Undo), Banner, SyncPill,
   SwitchRow (with consequence text), EmptyState, Skeleton, VisibilityEye, HiddenMetric, PermissionPrimer.
2. Follow the spec exactly for sizes, radius, colours, pressed/disabled/focus states, and accessibility.
3. Add a dev-only route /dev/gallery that shows every component in all states, in dark theme, with a toggle for
   Reduce Motion and a text-scale slider (1.0, 1.3, 2.0). Exclude it from production builds.
4. Replace the duplicated components found in the audit with these, one folder at a time, running the app after each.
   Keep props backwards-compatible with wrappers where a screen would otherwise break.
5. Write component tests for variants and accessibility labels.

Finish: gallery screenshots at 1.0 and 1.3 text scale, and a list of the duplicates removed.
```

**Done when:** gallery shows all components correctly; no screen has its own private button or card; targets are at least 44×44.
**Commit:** `feat(ui): core component library and gallery`

---

### UI-3 · Signature components (PairRing, Seam, PersonColumn)

```text
Task: UI-3 signature components. Read docs/ui/05-components.md sections 5.2 to 5.5 and 04-layout-motion.md.

Build with react-native-svg and Reanimated (UI-thread worklets, transform/opacity only):
1. PairRing: two arcs on one circle, outer you, inner partner, percent of each own goal, start -90 degrees, round caps,
   glow at 100 percent, cream second lap past 100 percent (max two laps), partner percent pill at the arc end,
   sizes 184 / 120 / 64. Animate with the ring motion token; first paint animates once per session.
2. Seam: broken, half-lit (finished person's hue, dot on their side) and fused (gradient glow, sweep from both ends over the seam duration).
   Reduce Motion = 120 ms crossfade. Caption "Both of you logged today. Day N."
3. PersonColumn (mirrored) with the four meal rows (logged = filled dot, not logged = open circle, never a cross), steps bar, percent,
   HiddenMetric when data is not shared.
4. NudgeButton on the seam with the limit message from the spec.
5. CalorieRing and MacroBar (three steps of the owner's identity hue) for Today; TimerDisplay for Focus and fasting
   (computed from stored UTC timestamps, never a counter).
6. Layout: reflow to stacked columns, horizontal seam and two single arcs at text scale >= 1.5 or width < 340.
7. Accessibility labels exactly as the spec: "Your goal, 78 percent complete. Priya's goal, 64 percent complete."
   The seam announces its state.
8. Add all states to /dev/gallery: no partner (dashed placeholder half), partner not logged, half-lit, fused, over goal,
   hidden data, paused participation, 3+ people selector, reflow at 200 percent. Use fixtures only. No data or logic changes.

Finish: gallery screenshots for every state at 360x640, 1.3 and 2.0 text scale; a 10-second screen recording of the fuse.
```

**Done when:** every state in the list renders correctly, identity colours are the luminance-matched pair, Reduce Motion works, 200% text does not clip.
**Commit:** `feat(ui): PairRing, Seam, PersonColumn and rings`

---

### UI-4 · Navigation shell

```text
Task: UI-4 navigation shell. Read docs/ui/05-components.md (CMP-04, CMP-05), docs/ui/06-ia-global.md, docs/ui/04-layout-motion.md.

1. Floating tab bar: Today, Room, plus button, Progress, Me. 64 high, inset 12, active tab filled icon plus apricot label,
   raised 56 apricot plus button, badge dot on Room. Labels always visible. Hide on full-screen flows (scan, focus running).
   Glass only here and on the Log sheet, using the native iOS 26 glass where available, expo-blur only if a startup benchmark
   keeps 55+ fps on a low-end Android, otherwise opaque s2. Honour Reduce Transparency.
2. Plus button opens the Log hub sheet (D01) with the six tiles. Only wire to existing screens; do not build new logic.
3. Standard header component (title, optional subtitle, actions), safe-area handling, large-title behaviour on tab roots.
4. Back behaviour: iOS edge swipe and chevron, Android system back with predictive back enabled. Do not intercept back
   except to confirm discarding unsaved edits.
5. Tab behaviour: each tab keeps its stack and scroll position; tapping the active tab scrolls to top.
6. Sheet stack rule: no more than one sheet over a sheet.

Finish: screenshots of the tab bar in all five states, the Log sheet open, and a note on the blur decision and benchmark result.
```

**Done when:** predictive back works on Android 14+, tab bar passes contrast, Reduce Transparency makes it opaque, no content is hidden behind the bar.
**Commit:** `feat(ui): floating tab bar, log hub and navigation behaviour`

---

### UI-5 · Onboarding and account (A, B)

```text
Task: UI-5 onboarding and account. Read docs/ui/screens-A-B.md, docs/ui/06-ia-global.md (copy rules) and docs/ui/AUDIT.md (screen map).

Bring these screens up to spec, keeping existing logic and validation: A01 to A15, B01 to B09.
Key points: one question per screen; progress bar; account only after value is shown (AUTH-2);
A04 goal cards; A09 rate cards with unavailable rates explained; A10 target reveal (single ring with the iris-apricot-teal gradient,
animated once, success haptic); A11 how it is calculated; A12 Partner Finder offer (off by default); A15 invite preview with blurred paired card and no paywall.
Sign in: Apple first on iOS, then Google, then email code. No phone login.
Use only components from packages/ui. If a screen is missing in the app, list it as missing rather than building logic.

Finish: before/after screenshots for each screen, the Hindi variants of A04, A09, A10 and B04, and a list of deviations from the spec with reasons.
```

**Done when:** onboarding feels like one calm flow, A10 is the memorable moment, keyboards never cover the primary button, copy matches the voice rules.
**Commit:** `feat(ui): onboarding and account polish`

---

### UI-6 · Today and logging (C, D)

```text
Task: UI-6 Today and logging. Read docs/ui/screens-C-D.md and docs/ui/05-components.md.

Bring up to spec: C01 to C07 and D01 to D13.
Key points: Today header, room strip, hero card with CalorieRing and macro bar, five meal cards (Breakfast, Lunch, Dinner, Snacks, Extra),
water and steps cards, optional cards in the specified order. D02 opens on Recent, not search; rows have last-used quantity and a one-tap plus;
D03 big editable number, units including katori, live macro preview, "Add to lunch" with the same verb in the toast; D04 scan with corner brackets only;
D06 AI estimate with confidence band and "Estimate" label. Offline pill and optimistic saves must keep working.
Measure: a repeat food should take two taps; add the interaction timings to the summary.

Finish: screenshots including empty, loading, offline, over-goal and 200% text for C01 and D03.
```

**Done when:** a repeat food is two taps, the keypad never hides the Add button, Today is single-column and calm at 200%.
**Commit:** `feat(ui): Today and logging polish`

---

### UI-7 · Trackers, workouts, fasting (E, F)

```text
Task: UI-7 trackers, workouts and fasting. Read docs/ui/screens-E-F.md.
Bring up to spec: E01 to E17, F01 to F06 (skip any not built yet and list them).
Key points: water one-tap quick adds with undo; steps screen with source line and "Fix step counting"; weight chart with 7-day average and no area fill;
strength session with "Last time" hints and a rest timer; fasting is hidden when off or when screening forbids it, with no health claims in copy;
timers use stored UTC timestamps. Charts follow CMP-14 and have a "View as table".
Finish: screenshots incl. empty states and 200% text.
```

**Commit:** `feat(ui): trackers, workouts and fasting polish`

---

### UI-8 · Room, chat, requests (J, K) — the hero phase

```text
Task: UI-8 Room, chat and requests. Read docs/ui/screens-J-K-L.md (J and K only), docs/ui/05-components.md sections 5.2 to 5.5.

Bring up to spec: J01 to J23 and K01 to K08.
Key points: J01 paired card with PairRing, Seam, PersonColumns and NudgeButton, the dashed placeholder for "no partner yet",
the state sentence, feed rows without cards, the eye glyph on shared items; J02 avatar selector for 3 to 12 people
(never three arcs on a ring); J03 large-room overview; J08 chat with offline states; J12 room progress with neutral ordering;
J20 "This room is paused" (no blame); J22 room full variants; K01 requests inbox with neutral statuses.
Hidden data = lock, never zero. No red or green anywhere in the paired view.
Wire to existing data only. Seam fuses automatically on the logged-day rule; do not add a close-day button.

Finish: screenshots of every state listed in J01, at 360x640 at 1.3 and 2.0 text scale; a screen recording of the seam fuse;
a list of spec items you could not do and why.
```

**Done when:** J01 passes the "five-second test" (a new person can say who has logged and who hasn't); no raw calories are shown side by side; the stacked layout at 200% works.
**Commit:** `feat(ui): Room, chat and requests polish`

---

### UI-9 · Progress, leaderboard, challenges (M)

```text
Task: UI-9 Progress, leaderboard and challenges. Read docs/ui/screens-M.md.
Bring up to spec: M01 to M12 (hub, detail charts, leaderboard, Monday recap).
Challenges M13 to M17: build the screens only if the challenge feature exists; otherwise build them against fixtures behind a flag
and list the data they need. M15 (Create challenge) layout: activity tiles (Walking, Running, Studying, Gym, Cycling, Custom), goal field with
unit chip, duration chips 1, 7 and 30 days, optional partner row limited to people in your room or accepted list, pinned "Create challenge" button.
There must be no calorie or weight tile. Leaderboard: the one-line ranking rule is always visible; your row pinned with a lit edge, no medals.
Finish: screenshots of M01, M11, M15 and one chart with its "View as table".
```

**Commit:** `feat(ui): progress, leaderboard and challenges`

---

### UI-10 · Me, privacy, plans, paywall (N, O)

```text
Task: UI-10 Me, privacy, plans and paywall. Read docs/ui/screens-N-O-P.md.
Bring up to spec: N01 to N16 and O01 to O10.
Key points: N05 privacy with consequence text under every switch; the plan card on Me; O02 paywall: contextual title, size picker (Basic, Plus, Pro),
monthly / 3-month / annual toggle, quiet savings chip, one-line renewal sentence, Restore purchases, no countdown timers, no fake discounts;
J20 and O06 "Keep this room going". Do not change RevenueCat or entitlement logic.
Finish: screenshots of O02 in every context (room, add people, coach, Partner Finder) and N05.
```

**Commit:** `feat(ui): Me, privacy, plans and paywall polish`

---

### UI-11 · Focus, recipes, coach, Partner Finder (G, H, I, L)

```text
Task: UI-11 remaining features. Read docs/ui/screens-G-H-I.md and the L section of docs/ui/screens-J-K-L.md.
Bring up to spec the screens that exist: G01 to G08 (focus running is full-screen, tab bar hidden), H01 to H06 (recipe detail with sticky Log bar),
I01 to I05 (locked preview for non-plan holders, consent, chat with AI label), L01 to L12 (banded match cards only, no photo or @username before acceptance,
safety card once, no fake profiles, teaser count only when 5 or more).
For features not built yet, build the UI with fixtures behind a flag and list what is missing.
Finish: screenshots and a list of flagged-off screens.
```

**Commit:** `feat(ui): focus, recipes, coach and partner finder`

---

### UI-12 · Hindi and text-scale pass

```text
Task: UI-12 Hindi and text scale. Read docs/ui/03-type.md and docs/ui/08-a11y-perf.md section 8.2.
1. Switch the app to Hindi and walk every screen. Fix clipping, overlapping and wrong line height (Hindi line height is 1.15 times).
2. Use Anek Devanagari for Hindi text; numerals stay Latin digits in Bricolage or Figtree.
3. Test every screen at 1.3 and 2.0 text scale in English and Hindi. Paired card must stack at 1.5 and above.
4. Make sure every string is in the translation files, with no hard-coded text.
Finish: a table screen vs (English 1.3, English 2.0, Hindi 1.3, Hindi 2.0) with pass or fail and screenshots of the failures you fixed.
```

**Commit:** `fix(ui): Hindi and text scale pass`

---

### UI-13 · Accessibility, performance, QA

```text
Task: UI-13 accessibility, performance and QA. Read docs/ui/08-a11y-perf.md.
1. Run the ten key flows with TalkBack and VoiceOver (onboarding, log a food, log water, start focus, open Room, nudge, send chat, open Progress, upgrade, delete an entry). Fix labels, order and focus.
2. Check contrast of every screen against the tokens, colour-blind simulation on charts and rings, Reduce Motion, Reduce Transparency.
3. Performance on a low-end Android: cold start, scroll fps on the food list and chat, blur on or off, image sizes. Report numbers against the budgets in 8.3.
4. Remove any remaining shadow or blur on list rows.
5. Produce docs/ui/QA.md with every issue, severity and status.
Finish: fix all must-fix items; list the rest.
```

**Commit:** `fix(ui): accessibility and performance pass`

---

### UI-14 · Cleanup (and optional light theme)

```text
Task: UI-14 cleanup. 
1. Remove the compatibility layer from UI-1. Replace every remaining deprecated token with the new one. Turn the lint rule from warning to error.
2. Delete unused components, old assets and old font files.
3. Update docs/ui/DECISIONS.md with anything we changed from the spec.
4. OPTIONAL: enable the light theme (docs/ui/02-colour.md section 2.6). Measure every light token pair; use brandInk for text on light, apricot as fill only.
Finish: bundle size before and after, lint clean, screenshots of Today and Room in light and dark.
```

**Commit:** `chore(ui): remove compat layer and finish theme`

---

## 3. Tips for working with the agent

- **Small asks beat big asks.** If a phase is too big for one conversation (UI-8 usually is), split it: "UI-8a: J01 and J02 only", then "UI-8b: chat", "UI-8c: requests".
- **Ask for the plan first, then approve.** If the plan includes migrations, RLS, or changes under `/packages/core`, stop it.
- **Always ask for "what you did not do".** It surfaces skipped screens early.
- **Use fixtures for states.** The paired view is hard to test with live data; keep a fixtures file (`no partner`, `half-lit`, `fused`, `over goal`, `hidden`).
- **Judge on a real phone** (a mid-range Android if you have one) before concluding the hero phases.
- **If something looks "off" and you cannot say why,** run the review prompt in 0.4; it usually names it (spacing, hierarchy, touch size).

## 4. A suggested order if you have limited time
UI-0 → UI-1 → UI-2 → UI-3 → UI-4 → UI-6 → UI-8 → UI-5 → UI-10 → UI-9 → UI-7 → UI-11 → UI-12 → UI-13 → UI-14.
After UI-1 the app already looks new; after UI-8 the product's signature (the paired Room) is done; the rest is polish.
