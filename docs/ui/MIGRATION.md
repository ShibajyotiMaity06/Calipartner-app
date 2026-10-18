# CaliPartner — Phase UI-1 Migration & Token Compatibility

**Date:** 18 Oct 2026  
**Phase:** UI-1 · Tokens, fonts, theme  
**Spec References:** `docs/ui/02-colour.md`, `docs/ui/03-type.md`, `docs/ui/04-layout-motion.md`, `docs/ui/appendix-b-tokens.md`

---

## 1. Overview

Phase UI-1 establishes the single source of design truth in `@calipartner/ui` (`packages/ui/tokens`) and implements a seamless backwards-compatibility layer in `app/src/theme/tokens.ts` and `app/src/theme/useTheme.ts`. This instantly transforms the entire application into the **Apricot on Espresso** palette with zero screen rewrites, while enforcing strict linting against new hard-coded styling literals.

---

## 2. Token Compatibility Mapping

All legacy constants in `app/src/theme/tokens.ts` are marked `@deprecated` and mapped to their exact modern counterparts from `@calipartner/ui`:

### 2.1 Palette & Color Mappings

| Legacy Color Property | Old Value (Dark) | New Token | New Value (Hex) | Rationale & Contrast |
|---|---|---|---|---|
| `background` | `#0B0F19` | `dark.bg0` | `#0E0B08` | Espresso black base. Avoids OLED smearing. |
| `surface` | `#131B2E` | `dark.s1` | `#1A1511` | Card surface. 1.08:1 step from bg0. |
| `surfaceAlt` | `#1E293B` | `dark.s2` | `#241E18` | Raised surface: inputs, sheets, selected rows. |
| `border` | `#2A364F` | `dark.hairline` | `#3A3228` | Decorative 1 px borders (1.44:1 on s1). |
| `text` | `#F8FAFC` | `dark.textHi` | `#F7F0E7` | Primary text, titles, numbers (16.0:1 on s1). |
| `textMuted` | `#94A3B8` | `dark.textMid` | `#C9BCAC` | Body text, secondary labels (9.7:1 on s1). |
| `accent` | `#38BDF8` | `dark.apricot` | `#F4B67D` | Single primary action, active tab, fab (10.2:1 on s1). |
| `onAccent` | `#0B0F19` | `dark.onBrand` | `#1C1109` | Dark text on apricot. **10.4:1 contrast** (never white). |
| `danger` | `#F87171` | `dark.danger` | `#F65C58` | Destructive actions and errors only (5.7:1 on s1). |
| `primary` | `#60A5FA` | `dark.apricot` | `#F4B67D` | Mapped to primary brand apricot. |
| `macroCalories` | `#FB923C` | `dark.apricot` | `#F4B67D` | Main calorie ring fill. |
| `macroProtein` | `#60A5FA` | `dark.iris` | `#B49AFC` | Identity hue A (7.7:1 on s1). |
| `macroCarbs` | `#FBBF24` | `dark.teal` | `#1FBDB6` | Identity hue B (7.8:1 on s1). |
| `macroFat` | `#F472B6` | `dark.rose` | `#F885B5` | Identity hue (7.8:1 on s1). |
| `macroFiber` | `#34D399` | `dark.mint` | `#2EC083` | Identity hue (7.8:1 on s1). |
| `syncSynced` | `#34D399` | `dark.mint` | `#2EC083` | Offline sync success indicator. |
| `syncPending` | `#FBBF24` | `dark.apricot` | `#F4B67D` | Outbox syncing in-flight indicator. |
| `syncFailed` | `#F87171` | `dark.danger` | `#F65C58` | Outbox failure indicator. |
| `cardHighlight` | `#1E2945` | `dark.s2` | `#241E18` | Raised card highlight surface. |

### 2.2 New Modern Tokens Available on `useTheme().colors`

In addition to legacy properties, all 22 modern tokens are directly accessible:
- Surfaces: `bg0`, `s1`, `s2`, `s3`, `hairline`, `hairlineLit` (`#85755F`, 4.06:1 on s1)
- Typography: `textHi`, `textMid`, `textLo` (`#9A8E7F`, 5.7:1 on s1), `textOff` (`#6F6558`)
- Brand: `apricot`, `apricotPressed` (`#E19A5C`), `copper` (`#BB8661`), `onBrand` (`#1C1109`)
- Identity Hues: `iris` (`#B49AFC`), `teal` (`#1FBDB6`), `rose` (`#F885B5`), `mint` (`#2EC083`), `sky` (`#5EAFFE`), `orchid` (`#E48ADD`)
- Signals: `danger` (`#F65C58`), `cream` (`#F7F0E7`)

### 2.3 Spacing, Radius & Type Scale Mappings

| Legacy Token | Mapped Value | Modern Spec Equivalent |
|---|---|---|
| `spacing.xs` | `4` | `space[1]` |
| `spacing.sm` | `8` | `space[2]` |
| `spacing.md` | `16` | `space[4]` |
| `spacing.lg` | `24` | `space[6]` |
| `spacing.xl` | `32` | `space[7]` |
| `radius.sm` | `8` | (Legacy helper, modern `control` is `12`) |
| `radius.md` | `16` | `radius.button` (`16`) |
| `radius.lg` | `20` | `radius.card` (`20`) |
| `radius.pill` | `999` | `radius.full` (`999`) |
| `fontSize.xs` | `11` | `type.micro.fontSize` |
| `fontSize.sm` | `13` | `type.label.fontSize` |
| `fontSize.md` | `16` | `type.body.fontSize` |
| `fontSize.lg` | `20` | `type.title2.fontSize` |
| `fontSize.xl` | `28` | `type.title1.fontSize` (approx) |
| `fontSize.xxl` | `34` | `type.numeralL.fontSize` |

---

## 3. Static Fonts & Hydration Gate

### 3.1 Bundled Static Fonts
Static TTF assets bundled in `app/assets/fonts/` and registered with the `expo-font` config plugin:
1. `BricolageGrotesque_600SemiBold.ttf` (`Bricolage_600`): Display numbers, titles, card stats.
2. `BricolageGrotesque_700Bold.ttf` (`Bricolage_700`): Hero ring numbers, target reveals.
3. `Figtree_400Regular.ttf` (`Figtree_400`): Body text, secondary text, input fields.
4. `Figtree_500Medium.ttf` (`Figtree_500`): Labels, captions, chips.
5. `Figtree_600SemiBold.ttf` (`Figtree_600`): Headings, card titles, buttons.
6. `AnekDevanagari_400Regular.ttf` (`AnekDevanagari_400`): Hindi body text (loaded on demand).
7. `AnekDevanagari_500Medium.ttf` (`AnekDevanagari_500`): Hindi labels (loaded on demand).
8. `AnekDevanagari_600SemiBold.ttf` (`AnekDevanagari_600`): Hindi headings/buttons (loaded on demand).

### 3.2 Splash Gate Protocol
- `SplashScreen.preventAutoHideAsync()` holds native splash screen on app boot.
- `AppInitializationGate` in `app/src/app/_layout.tsx` awaits both `getDb()` (SQLite) and `loadAppFonts()` (`expo-font`).
- Native splash hides cleanly with `hideSplashScreen()` only after fonts and database are ready, eliminating any flash of unstyled system text.

---

## 4. Grandfathered Style Violations Inventory

The following 271 existing literal occurrences across `app/src` were recorded as baseline violations. Any **new** hard-coded hex literal, `fontFamily` string, or numeric radius/shadow will trigger an immediate build failure via ESLint and `scripts/lint_tokens.mjs`.

### 4.1 Summary by Violation Type
- **Hex Colors (`hex`):** 216 occurrences
- **Hard-coded Font Families (`fontFamily`):** 1 occurrence
- **Numeric Radii (`radius`):** 52 occurrences
- **Elevation / Shadows (`shadow`):** 2 occurrences

### 4.2 Grandfathered Files
- `app/src/app/(tabs)/room.tsx` (remaining non-contrast hexes)
- `app/src/components/chat/*` (`ChatMessageMenuModal`, `ChatImageViewerModal`, `ChatMediaPickerModal`, `ChatTermsModal`, `ChatReportModal`, `ChatView`)
- `app/src/components/coach/*` (`CoachConsentModal`, `CoachReportModal`, `CoachSuggestionCard`)
- `app/src/components/diary/*` (`BarcodeScannerModal`, `CalorieMacroRing`, `CopyMealModal`, `MealSectionCard`, `QuantityModal`)
- `app/src/components/focus/*` (`FocusCard`, `FocusProgressChart`, `FocusRunningModal`, `FocusSettingsModal`, `FocusStartModal`, `FocusingNowStrip`, `RoomFocusSegment`, `RoomProgressFocusView`)
- `app/src/components/food_photo/*` (`FoodPhotoCameraModal`, `FoodPhotoReviewModal`)
- `app/src/components/notifications/*` (`NotificationPrimerModal`, `NotificationSettingsScreen`)
- `app/src/components/onboarding/*` (`RatePickerStep`, `SummaryStep`)
- `app/src/components/progress/*` (`DayDetailModal`, `GoalProgressRing`, `LeaderboardView`)
- `app/src/components/recipes/*` (`RecipeCard`, `RecipeDetailModal`)
- `app/src/components/rooms/*` (`BlockUserModal`, `CreateRoomModal`, `DormantWaitingState`, `InviteUserModal`, `JoinByCodeModal`, `LockedFeaturePreviewCards`, `LockedRoomPausedState`, `MeRoomPlanCard`, `MembersTab`, `NudgeModal`, `OverCapacityBanner`, `PaywallModal`, `ReactionModal`, `ReportModal`, `RequestsInboxModal`, `RoomFullNotice`, `RoomHeader`, `RoomProgressView`, `SharedMealCard`, `TrialBanner`)
- `app/src/components/trackers/*` (`WaterHistoryModal`, `WeightHistoryModal`)
- `app/src/components/workouts/*` (`CardioForm`, `ExercisePickerModal`, `RunningTimerBar`, `TodayWorkoutCard`, `WorkoutDetailModal`, `WorkoutFinishSummaryModal`, `WorkoutHistoryCalendarModal`, `WorkoutLoggerModal`)

---

## 5. Verification Checklist

- [x] `@calipartner/ui` created with `tokens` (colors, pairs, space, radius, motion, type, typeHindi).
- [x] Static fonts bundled in `app/assets/fonts/` and configured in `app.config.ts`.
- [x] `ThemeProvider`, `useTheme()`, `useReducedMotion()`, `useReduceTransparency()` created.
- [x] `Text` helper with type scale variants and tabular figures created.
- [x] Compatibility layer mapped in `app/src/theme/tokens.ts` and `app/src/theme/useTheme.ts`.
- [x] ESLint rule and CI token linter added to prevent new styling literals.
- [x] Unit test computes WCAG contrast and validates allowedPairs (18 tests passing).
- [x] Zero white-on-apricot text on primary buttons.
