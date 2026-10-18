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
