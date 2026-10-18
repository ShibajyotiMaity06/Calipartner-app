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
