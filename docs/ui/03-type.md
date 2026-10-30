> Owner correction, 30 October 2026: use bundled static Plus Jakarta Sans 400/500/600/700/800 for all English UI, titles and numerals. Keep Anek Devanagari for Hindi. This supersedes the older Bricolage/Figtree pairing below. Legacy aliases must resolve to Plus Jakarta Sans on every platform.

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
