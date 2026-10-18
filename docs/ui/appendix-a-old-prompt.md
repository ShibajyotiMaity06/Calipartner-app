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
