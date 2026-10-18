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
