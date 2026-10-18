# CaliPartner — UI Specification Index

This directory contains the split parts of the **CaliPartner UI/UX Master Spec** (v1.0 draft, aligned to PRD v0.4) for React Native + Expo.

Keeping the spec split into targeted modules keeps context small, token-efficient, and fast for coding agents during each implementation phase.

---

## Master Spec

| File | Description | When to Read |
|---|---|---|
| [`CaliPartner_UI_UX_Spec.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/CaliPartner_UI_UX_Spec.md) | Full, unsplit original design specification. | Reference only or when full unbroken context is required. |

---

## Foundation & Design System

| File | Contents & Key Topics | When to Read |
|---|---|---|
| [`00-decisions.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/00-decisions.md) | **Part 0:** Confirmed product decisions (D1–D9), verdicts on theme, Iris + Teal partner colors, static fonts, tab hierarchy, challenge rules, hero screen structure. | Orientation; read before starting UI work or when confirming architecture choices. |
| [`01-principles.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/01-principles.md) | **Part 1:** Design philosophy (5 principles), HCI laws (Fitts, Hick, Miller, Doherty, etc.), behavioral UX, iOS 26 Liquid Glass / Android predictive back guidance, target demographic (India mid-range Android). | When designing layouts, interaction models, or auditing UX. |
| [`02-colour.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/02-colour.md) | **Part 2:** "Apricot on Espresso" dark palette, surface lit edges, brand rules (dark text on apricot), identity pairs (Iris & Teal), contrast ratios, dark-mode craft, measured light theme spec. | **UI-1** (Tokens & Theme), **UI-13** (Contrast QA), **UI-14** (Light theme). |
| [`03-type.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/03-type.md) | **Part 3:** Typography pairings (Bricolage Grotesque, Figtree, Anek Devanagari), static font weights, tabular numbers rule, type scale table (hero to caption2). | **UI-1** (Fonts & Typography), **UI-12** (Hindi & Text Scaling). |
| [`04-layout-motion.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/04-layout-motion.md) | **Part 4:** 4pt/8pt grid spacing, 22pt card radius, elevation borders, spring motion curves, seam fuse duration, glass & performance budgets, haptics, iconography (Lucide / SF Symbols). | **UI-1** (Motion & Radius tokens), **UI-3** (Seam animation), **UI-4** (Navigation shell). |
| [`05-components.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/05-components.md) | **Part 5:** Component specifications for CMP-01 to CMP-25: Core controls (Button, Field, Card, Sheet), Signature components (PairRing, Seam, PersonColumn, NudgeButton, CalorieRing, MacroBar). | **UI-2** (Core Components), **UI-3** (Signature Components), **UI-4** (Floating Tab Bar & Sheets). |
| [`06-ia-global.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/06-ia-global.md) | **Part 6:** Information architecture map, tab and sheet stacks, screen naming index, global content rules, empty/loading/error/offline states, notification copy. | **UI-4** (Navigation), **UI-5** through **UI-11** (All screen work). |

---

## Screen Inventory (Part 7)

| File | Screens & Subsections | When to Read |
|---|---|---|
| [`screens-A-B.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-A-B.md) | **7.0, 7.A, 7.B:** Launch, Onboarding questions (A01–A15), Target Reveal, Invite Preview, Account setup & Auth (B01–B09). | **UI-5** (Onboarding and Account). |
| [`screens-C-D.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-C-D.md) | **7.C, 7.D:** Today view (C01–C07), Logging Hub (D01), Food search & recent (D02), Portion stepper & quick add (D03), Barcode/AI photo scanner (D04–D06), Custom food (D08). | **UI-6** (Today and Logging). |
| [`screens-E-F.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-E-F.md) | **7.E, 7.F:** Water tracker (E01–E04), Steps tracker & sync (E05–E08), Weight log (E09–E12), Workouts (E13–E17), Fasting tracker & timers (F01–F06). | **UI-7** (Trackers, Workouts, Fasting). |
| [`screens-G-H-I.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-G-H-I.md) | **7.G, 7.H, 7.I:** Focus Time timer & ambient running (G01–G08), Indian Recipe Browse & Cook Mode (H01–H06), AI Coach chat & suggestions (I01–I05). | **UI-11** (Focus, Recipes, Coach). |
| [`screens-J-K-L.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-J-K-L.md) | **7.J, 7.K, 7.L:** Room paired view (J01 hero), 3–12 member room carousel (J02–J03), Chat (J08), Nudge (J09), Requests inbox (K01–K08), Partner Finder cards & safety rules (L01–L12). | **UI-8** (Room, Chat, Requests), **UI-11** (Partner Finder). |
| [`screens-M.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-M.md) | **7.M:** Progress charts (M01–M10), Room leaderboard (M11), Monday recap (M12), Friend & room challenges (M13–M17). | **UI-9** (Progress, Leaderboard, Challenges). |
| [`screens-N-O-P.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/screens-N-O-P.md) | **7.N, 7.O, 7.P:** Me settings & privacy switches (N01–N16), RevenueCat Subscription Paywall & room plans (O01–O10), Offline sync pill, Error & Maintenance sheets (P01–P08). | **UI-10** (Me, Privacy, Paywall). |

---

## Quality, Execution & Appendices

| File | Contents & Key Topics | When to Read |
|---|---|---|
| [`08-a11y-perf.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/08-a11y-perf.md) | **Part 8:** Accessibility (WCAG 2.2 AA, touch targets, screen reader copy), Hindi Devanagari typography, performance budgets (FPS, frame times, memory, bundle size), automated UI test checklist. | **UI-12** (Hindi & Text Scaling), **UI-13** (Accessibility & Performance QA). |
| [`09-order.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/09-order.md) | **Part 9:** Decisions checklist, what to build first, high-level phasing rationale. | Strategic reference. |
| [`appendix-a-old-prompt.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/appendix-a-old-prompt.md) | **Appendix A:** Detailed comparison and changes against earlier Flutter "Duo" design prompts. | Historical reference on rejected ideas and adaptations. |
| [`appendix-b-tokens.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/appendix-b-tokens.md) | **Appendix B:** Exact TypeScript token code definitions (colors, dark surfaces, lit hairline borders, identity pairs, spacing, radii, motion curves, type scale). | **UI-1** (Token implementation source of truth). |
| [`appendix-c-prd.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/appendix-c-prd.md) | **Appendix C & Sources:** Proposed additions to PRD (CHL-5, Cook Mode, auto seam fuse, cream second lap) and citations of primary/secondary standards. | When checking PRD feature alignments. |

---

## UI Audit Document

| File | Description |
|---|---|
| [`AUDIT.md`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/docs/ui/AUDIT.md) | Baseline audit of the current application codebase: styling architecture, token locations, literal counts, complete route-to-spec screen mapping, component duplication inventory, and architecture risks. |
