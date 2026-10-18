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
