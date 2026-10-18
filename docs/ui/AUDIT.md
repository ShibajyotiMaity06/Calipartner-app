# CaliPartner — UI Audit (Phase UI-0)

**Date:** 18 Oct 2026  
**Auditor:** Antigravity Coding Agent  
**Baseline commit:** Pre-UI Polish (Phases 1–13 completed)  
**Spec Reference:** `docs/ui/CaliPartner_UI_UX_Spec.md` / `docs/ui/`

---

## 1. Styling Architecture & Theme Tokens

### 1.1 Styling Method
- **Method in use:** Pure React Native `StyleSheet.create()` and dynamic inline style compositions (`style={[styles.base, { backgroundColor: colors.surface }]}`).
- **No external CSS/utility frameworks:** No NativeWind, Tailwind, Tamagui, or styled-components are installed.
- **Icons:** `@expo/vector-icons` (`Ionicons`).
- **Vector Graphics:** `react-native-svg` (15.15.4) used for ring charts (`CalorieMacroRing`, `GoalProgressRing`).
- **Safe Area:** `react-native-safe-area-context` (`SafeAreaView`, `SafeAreaProvider`).

### 1.2 Current Theme & Token Location
- **Theme tokens file:** [`app/src/theme/tokens.ts`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/app/src/theme/tokens.ts)
  - Exports:
    - `lightColors`: Light theme palette (sapphire blue `#2563EB`, sky cyan `#0284C7`, orange `#F97316`).
    - `darkColors`: Dark obsidian navy palette (`#0B0F19`, slate navy `#131B2E`, electric cyan `#38BDF8`).
    - `spacing`: `{ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }`.
    - `radius`: `{ sm: 8, md: 14, lg: 22, pill: 999 }`.
    - `fontSize`: `{ xs: 11, sm: 13, md: 16, lg: 20, xl: 28, xxl: 34 }`.
    - `colorsFor(scheme: ColorScheme): ThemeColors`.
- **Theme hook:** [`app/src/theme/useTheme.ts`](file:///c:/Users/shibajyoti%20maity/Downloads/projects/calipartner-app/app/src/theme/useTheme.ts)
  - Reads system scheme via React Native's `useColorScheme()` and returns `{ scheme, colors }`.

### 1.3 Font Handling Today
- `expo-font` (~57.0.4) is present in `package.json` and in `app.config.ts` plugins, but **no custom static fonts are currently bundled or loaded**.
- All text currently renders with system default sans-serif fonts.
- Neither `Bricolage Grotesque` (titles, numbers) nor `Figtree` (UI text) nor `Anek Devanagari` (Hindi) are installed yet.
- Splash screen does not hold for font hydration (`SplashScreen.preventAutoHideAsync()` is not configured in `_layout.tsx`).

---

## 2. Quantitative Literal Audit

A comprehensive scan of all 210 TypeScript/TSX source files across `app/src` was performed to identify hard-coded styling literals.

### 2.1 Literals by Folder

| Folder | Files | Hard-coded Hex Colors | Hard-coded Font Names | Numeric Paddings | Numeric Radii |
|---|---|---|---|---|---|
| `app/(tabs)` | 6 | 7 | 0 | 23 | 4 |
| `app/auth` | 2 | 0 | 0 | 10 | 0 |
| `app/coach` | 1 | 0 | 0 | 0 | 0 |
| `app/notifications` | 1 | 0 | 0 | 0 | 0 |
| `app/onboarding` | 1 | 0 | 0 | 0 | 0 |
| `app/profile` | 1 | 0 | 0 | 7 | 0 |
| `app/recipes` | 1 | 0 | 0 | 1 | 0 |
| `app` (root layout & index) | 2 | 0 | 0 | 0 | 0 |
| `components/chat` | 11 | 31 | 0 | 7 | 2 |
| `components/coach` | 11 | 7 | 0 | 14 | 6 |
| `components/diary` | 9 | 12 | 0 | 67 | 0 |
| `components/focus` | 11 | 7 | 0 | 53 | 2 |
| `components/food_photo` | 7 | 18 | 0 | 27 | 4 |
| `components/notifications` | 4 | 1 | 0 | 0 | 1 |
| `components/onboarding` | 11 | 1 | 1 | 8 | 0 |
| `components/progress` | 15 | 17 | 0 | 2 | 2 |
| `components/recipes` | 9 | 10 | 0 | 41 | 4 |
| `components/rooms` | 29 | 65 | 0 | 89 | 33 |
| `components/trackers` | 11 | 3 | 0 | 23 | 0 |
| `components/workouts` | 10 | 3 | 0 | 64 | 5 |
| `components` (general) | 4 | 0 | 0 | 0 | 0 |
| `theme` (tokens definition) | 2 | 38 | 0 | 0 | 0 |
| `contexts`, `db`, `hooks`, `lib`, `services` | 90 | 0 | 0 | 0 | 0 |
| **Total** | **210** | **220** | **1** | **436** | **63** |

### 2.2 Most Frequent Hard-Coded Hex Occurrences
1. `#FFFFFF` / `#000` / `#000000`: 132 occurrences (mostly white text on colored buttons, dark overlays, or card backgrounds).
2. Tailwind-style color literals: `#10B981` (emerald green, 7), `#EF4444` (red danger, 7), `#64748B` (slate 500, 6), `#94A3B8` (slate 400, 5), `#3B82F6` (blue 500, 4), `#F59E0B` (amber 500, 4), `#8B5CF6` (violet, 3), `#06B6D4` (cyan, 3), `#EC4899` (pink, 3).
3. These hard-coded literals will be captured and mitigated by the UI-1 Compatibility Layer and ESLint rule.

---

## 3. Screen Inventory & Route-to-Spec Mapping

The Master Spec defines **180 screen entries** (38 hero screens + 142 compact sheets/states). Below is the status of every route and screen in the application.

### 3.1 Existing App Routes & Primary Surfaces

| Route / File | Route Name | Closest Spec ID | Spec Title | Status | Notes |
|---|---|---|---|---|---|
| `app/index.tsx` | Entry / Gate | `A01` | Launch | Matches | Redirects to `/today`. |
| `app/_layout.tsx` | Root Layout | Global | Root Layout | Matches | Handles DB initialization gate, AuthProvider, SafeArea, StatusBar. |
| `app/(tabs)/_layout.tsx` | Tab Bar | `CMP-05` / `Part 6` | Main Navigation Shell | Matches | 5 tabs: Today, Room, Log (+), Progress, Me. Standard bar (needs UI-4 floating glass polish). |
| `app/(tabs)/today.tsx` | Today View | `C01` | Today (Hero) | Matches | Calorie & macro ring, 4 meal cards, tracker cards, workout card, focus card. |
| `app/(tabs)/room.tsx` | Room View | `J01` | Room (Hero) | Partial | SideBySide paired card, members carousel, room chat, progress segment. Awaiting UI-3 PairRing/Seam. |
| `app/(tabs)/log.tsx` | Quick Log Sheet | `D01` | Log Hub Sheet | Matches | 4 options: Food, Workout, Focus, Recipe. Opens respective modal flows. |
| `app/(tabs)/progress.tsx` | Progress Hub | `M01` | Progress Hub | Matches | Segments: My Progress, Leaderboard, Challenges. 7 charts + day recap modal. |
| `app/(tabs)/me.tsx` | Me / Settings Hub | `N01` | Me (Hero) | Matches | Profile card, plan card, coach link, focus settings, notification settings, sign out. |
| `app/onboarding/index.tsx` | Onboarding Flow | `A04`–`A11` | Onboarding Linear Flow | Matches | 7 linear steps: Goal, Stats, Activity, Rate, Target Date, Screening, Summary reveal. |
| `app/auth/sign-in.tsx` | Auth Screen | `B01`–`B03` | Sign in / up, Email, OTP | Matches | Email entry, 6-digit OTP verification, Google, Apple, Guest mode. |
| `app/auth/profile-setup.tsx` | Profile Setup | `B04`, `A03` | Username, Nickname, Age Gate | Matches | Debounced username check, 18+ age validation, sex, height, units. |
| `app/recipes/index.tsx` | Recipe Browse | `H01` | Recipe Browse / Search | Matches | Category filter, search, recipe cards, servings scaler, diary logger. |
| `app/coach/index.tsx` | AI Coach | `I01` | AI Coach Chat | Matches | Plan-gated chat view, consent modal, history, quick prompt suggestions. |
| `app/profile/edit.tsx` | Edit Profile | `N03` | Edit Profile | Matches | Nickname, height, units, privacy toggle, save outbox sync. |
| `app/notifications/settings.tsx`| Notification Settings | `N06` | Notification Settings | Matches | Granular switches: meal reminders, water reminders, weigh-in, room chats. |

---

### 3.2 Modal Sheets & Sub-Screens Inventory

| Component File | Nearest Spec ID | Spec Title | Status | Notes |
|---|---|---|---|---|
| `components/diary/FoodLogModal.tsx` | `D02` | Food Search / Recent | Matches | Debounced SQLite food search, recent foods, quick add. |
| `components/diary/QuantityModal.tsx` | `D03` | Portion Stepper / Units | Matches | Quantity stepper, serving unit picker, live macro preview. |
| `components/diary/BarcodeScannerModal.tsx` | `D04`, `D05` | Barcode Scanner & Not Found | Matches | Camera view with viewfinder overlay, local SQLite barcode lookup. |
| `components/food_photo/FoodPhotoCameraModal.tsx` | `D06` | AI Photo Camera | Matches | Camera capture flow for AI meal estimation. |
| `components/food_photo/FoodPhotoResultsEditor.tsx` | `D06` | AI Photo Results Editor | Matches | Calorie & macro estimates with confidence breakdown. |
| `components/food_photo/AiConsentSheet.tsx` | `D07` | AI Photo Consent | Matches | Explicit AI photo disclaimer and opt-in. |
| `components/food_photo/FoodPhotoDailyLimitModal.tsx` | `D07` | AI Photo Daily Limit | Matches | Tier limit reached notice. |
| `components/diary/CustomFoodModal.tsx` | `D08`, `D09` | Custom Food Create & Edit | Matches | Custom food entry form with serving size & macros. |
| `components/diary/CopyMealModal.tsx` | `D11`, `D12` | Copy Meal / Day | Matches | Date picker to copy meals from previous days. |
| `components/diary/SyncStatusBanner.tsx` | `P01`, `P04` | Offline Sync Pill & Banner | Matches | Outbox count, pending/synced/failed states. |
| `components/trackers/WaterCard.tsx` | `E01`, `E02` | Water Tracker & Quick Add | Matches | 250ml quick-add buttons + custom amount trigger. |
| `components/trackers/CustomWaterModal.tsx` | `E02` | Custom Water Entry | Matches | Numeric water logger. |
| `components/trackers/WaterHistoryModal.tsx` | `E03` | Water History | Matches | Hourly water consumption log. |
| `components/trackers/StepsCard.tsx` | `E05` | Steps Tracker | Matches | Daily steps progress bar, source indicator. |
| `components/trackers/ManualStepsModal.tsx` | `E06` | Manual Step Entry | Matches | Manual steps override input. |
| `components/trackers/HealthPermissionModal.tsx` | `E07`, `A14` | Step Source / Health Primer | Matches | Apple Health & Health Connect permission primer. |
| `components/trackers/WeightCard.tsx` | `E09` | Weight Tracker | Matches | Current weight, delta vs goal, 7-day average. |
| `components/trackers/WeightEntryModal.tsx` | `E10` | Log Weight | Matches | Weight decimal stepper and note input. |
| `components/trackers/WeightHistoryModal.tsx` | `E11` | Weight History | Matches | Historical weight entries with delete option. |
| `components/workouts/TodayWorkoutCard.tsx` | `E13` | Workouts Card | Matches | Logged workouts summary for today. |
| `components/workouts/WorkoutLoggerModal.tsx` | `E14` | Workout Logger | Matches | Exercise sets logger, reps, weight, RPE. |
| `components/workouts/ExercisePickerModal.tsx` | `E15` | Exercise Picker | Matches | Searchable exercise list by muscle group. |
| `components/workouts/CardioForm.tsx` | `E16` | Cardio Form | Matches | Distance, duration, calorie burn inputs. |
| `components/workouts/WorkoutHistoryCalendarModal.tsx` | `E17` | Workout Calendar History | Matches | Monthly workout dot calendar. |
| `components/focus/FocusCard.tsx` | `G01` | Focus Card | Matches | Today's focus minutes vs daily goal. |
| `components/focus/RoomFocusSegment.tsx` | `G02` | Room Focus Segment | Matches | Room focus leaderboard and session feed. |
| `components/focus/FocusingNowStrip.tsx` | `G03` | Focusing Now Strip | Matches | Ambient presence strip of members currently focusing. |
| `components/focus/FocusStartModal.tsx` | `G04` | Focus Start Modal | Matches | Mode selector (pomodoro, stopwatch, countdown), tags. |
| `components/focus/FocusRunningModal.tsx` | `G05`, `G06` | Focus Running & Summary | Matches | Ambient full-screen timer, cancel, finish summary. |
| `components/focus/FocusSettingsModal.tsx` | `G08` | Focus Settings | Matches | Sound toggles, duration defaults, room visibility. |
| `components/recipes/RecipeDetailModal.tsx` | `H02` | Recipe Detail | Matches | Ingredients, nutrition facts, cooking instructions. |
| `components/recipes/RecipeServingsScaler.tsx` | `H03` | Servings Scaler | Matches | Scaled ingredients and macro recalculation. |
| `components/recipes/LogRecipeModal.tsx` | `H05` | Log Recipe to Diary | Matches | Meal section selector and portion scaling. |
| `components/recipes/RecipeReportModal.tsx` | `H06` | Report Recipe | Matches | Community content flag and report reasons. |
| `components/coach/CoachConsentModal.tsx` | `I02` | Coach Consent Modal | Matches | AI data usage consent dialog. |
| `components/coach/CoachHistoryModal.tsx` | `I04` | Coach History Modal | Matches | Past advice history and archive. |
| `components/coach/CoachReportModal.tsx` | `I05` | Coach Report Modal | Matches | Report AI hallucination / safety issue. |
| `components/rooms/SideBySideCard.tsx` | `J01` | Room Paired View | Partial | Side-by-side comparison. Needs PairRing/Seam in UI-3. |
| `components/rooms/RoomOverviewRow.tsx` | `J02` | 3–12 Member Room Carousel | Matches | Horizontal room members list with today's status. |
| `components/rooms/MembersTab.tsx` | `J03`, `J04` | Member List & Profiles | Matches | Complete room roster, roles, invite trigger. |
| `components/rooms/CreateRoomModal.tsx` | `J05` | Create Room | Matches | Room name, privacy type, initial invite code. |
| `components/rooms/JoinByCodeModal.tsx` | `J06` | Join Room by Code | Matches | 6-character room invite code input. |
| `components/rooms/InviteUserModal.tsx` | `J07` | Invite Member | Matches | Shareable invite code & direct username search. |
| `components/chat/ChatView.tsx` | `J08` | Room Chat | Matches | Realtime message feed, optimistic sends, media. |
| `components/rooms/NudgeModal.tsx` | `J09` | Nudge Modal | Matches | Quick friendly nudge triggers (max 1/day). |
| `components/rooms/ReactionModal.tsx` | `J10` | Reaction Modal | Matches | Emoji reactions for shared meals & achievements. |
| `components/rooms/RoomProgressView.tsx` | `J12`, `J13` | Room Progress & History | Matches | Neutral room adherence history and member rings. |
| `components/rooms/RoomSettingsModal.tsx` | `J14`–`J16` | Room Settings / Ownership | Matches | Room rename, code reset, transfer owner, leave room. |
| `components/rooms/BlockUserModal.tsx` | `J17` | Block Member | Matches | Block user confirmation dialog. |
| `components/rooms/ReportModal.tsx` | `J18` | Report Member / Room | Matches | Content moderation report modal. |
| `components/rooms/DormantWaitingState.tsx` | `J19` | Dormant Waiting State | Matches | Empty room state waiting for partner to join. |
| `components/rooms/LockedRoomPausedState.tsx` | `J20` | Locked Room Paused State | Matches | Subscription lapse or paused room banner. |
| `components/rooms/OverCapacityBanner.tsx` | `J21` | Room Capacity Notice | Matches | Warning when room reaches plan limit. |
| `components/rooms/RoomFullNotice.tsx` | `J22` | Room Full Notice | Matches | Join blocked because room has reached capacity. |
| `components/rooms/RequestsInboxModal.tsx` | `K01`, `K04` | Requests Inbox & Accept | Matches | Incoming and outgoing partner/room invitations. |
| `components/rooms/SharedMealCard.tsx` | `K05`, `K06` | Shared Meal Card | Matches | Feed card showing partner's meal with "Log this too". |
| `components/chat/ChatMediaPickerModal.tsx` | `K07` | Chat Media Picker | Matches | Photo picker for meal chat. |
| `components/chat/ChatImageViewerModal.tsx` | `K08` | Chat Image Viewer | Matches | Fullscreen zoomable photo viewer. |
| `components/progress/DayDetailModal.tsx` | `M10` | Day Detail Recap | Matches | Historical day breakdown with macro distribution. |
| `components/progress/LeaderboardView.tsx` | `M11` | Room Leaderboard | Matches | Neutral adherence-ranked member list. |
| `components/progress/ChallengesComingSoon.tsx` | `M13` | Challenges Tab | Partial | Placeholder teaser for seasonal & friend challenges. |
| `components/rooms/MeRoomPlanCard.tsx` | `N02`, `O01` | Plan & Room Status Card | Matches | Active tier, room capacity badge, upgrade action. |
| `components/rooms/PrivacySettingsModal.tsx` | `N05` | Privacy Settings Modal | Matches | Granular toggles: share calories, foods, workouts. |
| `components/notifications/NotificationPrimerModal.tsx`| `A13`, `P08` | Notification Primer | Matches | Pre-permission contextual explanation modal. |
| `components/rooms/PaywallModal.tsx` | `O02`, `O05` | Paywall Modal | Matches | Tier comparison (Basic, Plus, Pro), Restore purchases. |
| `components/ErrorBoundary.tsx` | `P02` | Fullscreen Error State | Matches | Global React error boundary with fallback view. |
| `components/LoadingState.tsx` | `P03` | Loading State | Partial | Spinner-based loading indicator (needs skeleton). |

---

### 3.3 Spec Screens That Do Not Exist Yet (Missing / Scheduled for Later Phases)

| Spec ID | Name | Category | Scheduled Phase | Description & Notes |
|---|---|---|---|---|
| `A02` | Welcome | Onboarding | **UI-5** | First-minute pitch screen before entering questions. |
| `A12` | Find-a-partner offer | Onboarding | **UI-5** | Onboarding offer to match with an accountability partner. |
| `A15` | Invite preview | Onboarding | **UI-5** | Blurred partner invite preview card shown before final step. |
| `B05` | Avatar picker | Account | **UI-5** | Dedicated avatar color ring / photo upload. |
| `B06` | Guest data merge sheet | Account | **UI-5** | Visual diff review when guest creates an account. |
| `B07` / `B08` | Delete account confirm & complete | Account | **UI-5** / **UI-10** | Formal 2-step deletion confirmation and feedback screen. |
| `B09` | Export my data UI | Account | **UI-5** / **UI-10** | CSV/JSON download share sheet trigger. |
| `C02` | Calories & macros detail sheet | Today | **UI-6** | Dedicated bottom sheet for detailed macro gram targets. |
| `C03` | Meal section detail sheet | Today | **UI-6** | Deep-dive meal inspection sheet. |
| `C05` | Date picker / calendar sheet | Today | **UI-6** | Full monthly calendar bottom sheet to jump to any past date. |
| `D10` | Quick calorie add | Logging | **UI-6** | Direct "+250 kcal" / quick macro number adder without food name. |
| `E04` | Water settings sheet | Trackers | **UI-7** | Target adjustment and container size presets. |
| `E08` | Fix step counting guide | Trackers | **UI-7** | Platform-specific background step troubleshooting guide. |
| `E12` | Target weight editor | Trackers | **UI-7** | Dedicated target weight goal & timeline updater. |
| `F01` | Fasting tracker card | Fasting | **UI-7** | Fasting window card on Today (core logic exists, UI pending). |
| `F02` | Start fast sheet | Fasting | **UI-7** | Protocol picker (16:8, 14:10, custom) and start time. |
| `F03` | Fasting running timer | Fasting | **UI-7** | Running fast circle timer and elapsed/remaining display. |
| `F04` | Fasting stage detail | Fasting | **UI-7** | Gentle stage explanations (ketosis, autophagy disclaimer). |
| `F05` | Fasting history | Fasting | **UI-7** | Past fasts log and completion rates. |
| `F06` | Fasting settings | Fasting | **UI-7** | Health screening check and notification toggles. |
| `H04` | Cook mode | Recipes | **UI-11** | Full-screen step-by-step cooking interface with large timer. |
| `L01`–`L12` | Partner Finder (12 screens) | Partner Finder | **UI-11** | Banded stranger match cards, safety rules, match filters, request cards. |
| `M09` | Fasting progress chart | Progress | **UI-9** | Weekly fasting consistency bar chart. |
| `M12` | Monday recap | Progress | **UI-9** | Weekly summary card with partner comparison and highlight. |
| `M14` | Challenge detail sheet | Challenges | **UI-9** | Challenge rules, activity requirements, leaderboard. |
| `M15` | Create challenge sheet | Challenges | **UI-9** | Activity tiles (Walking, Gym, Study, etc.), target, duration. |
| `M16` | Challenge progress screen | Challenges | **UI-9** | Daily habit ticks and days remaining. |
| `M17` | Challenge complete moment | Challenges | **UI-9** | Completion celebratory card (no medals/red-green). |
| `N04` | Change avatar sheet | Me | **UI-10** | Avatar editor from settings. |
| `N10` | Storage & offline cache | Me | **UI-10** | SQLite database size, food cache purge action. |
| `N11` | Help & support | Me | **UI-10** | FAQs and support email trigger. |
| `N13` | About & licenses | Me | **UI-10** | Open-source attribution and app version info. |
| `N16` | Delete account confirm sheet | Me | **UI-10** | In-app account deletion flow. |
| `O04` | Purchase success moment | Paywall | **UI-10** | Celebratory unlocked room animation. |
| `O07` | Downgrade warning sheet | Paywall | **UI-10** | Consequences explanation when switching to smaller plan. |
| `O08` | Promo code entry sheet | Paywall | **UI-10** | Redemption input for discount codes. |
| `O09` | Plan comparison table | Paywall | **UI-10** | Side-by-side Basic vs Plus vs Pro feature table. |
| `O10` | Subscription FAQ sheet | Paywall | **UI-10** | Store renewal and cancellation policy Q&A. |
| `P05` | App update forced | System | **UI-13** | Blocking update screen for deprecated schema versions. |
| `P06` | App update recommended | System | **UI-13** | Non-blocking update prompt banner. |
| `P07` | Maintenance mode screen | System | **UI-13** | Server maintenance announcement screen. |

---

## 4. Component Duplication Inventory

The audit revealed that many common UI primitives have been independently re-implemented across different modules. In **UI-2** and **UI-3**, these will be merged into unified `packages/ui` components.

### 4.1 Buttons
- **Current state:** At least 18 separate definitions of `primaryButton`, `secondaryButton`, and `segmentButton` styles across:
  - `SignInScreen`, `ProfileSetupScreen`, `OnboardingScreen`, `MeScreen`, `CustomFoodModal`, `CreateRoomModal`, `JoinByCodeModal`, `PaywallModal`, `FoodPhotoResultsEditor`.
- **Target (CMP-01, CMP-02):** Unified `<Button variant="primary" | "secondary" | "tertiary" | "danger" size="sm" | "md" | "lg" loading={...} />` and `<SegmentedControl />`.
- **Requirements:** Minimum 44×44 pt touch target, accessibility labels, unified focus and pressed state styling.

### 4.2 Cards
- **Current state:** Over 15 independent `styles.card` implementations:
  - `MealSectionCard`, `WaterCard`, `StepsCard`, `WeightCard`, `TodayWorkoutCard`, `FocusCard`, `MeRoomPlanCard`, `SideBySideCard`, `RecipeCard`, `ChartContainer`.
  - Inconsistent radii (varying between 8, 12, 14, 16, 22), inconsistent surface elevations, and hard-coded border colors.
- **Target (CMP-03):** Unified `<Card elevation="s1" | "s2" radius="md" | "lg" />` with standardized lit hairline edges (`hairlineLit`).

### 4.3 Sheets and Modals
- **Current state:** Over 25 distinct `Modal` components wrapping custom backdrops and slide containers:
  - `FoodLogModal`, `QuantityModal`, `BarcodeScannerModal`, `CopyMealModal`, `CustomFoodModal`, `CreateRoomModal`, `JoinByCodeModal`, `InviteUserModal`, `NudgeModal`, `ReactionModal`, `PrivacySettingsModal`, `RoomSettingsModal`, `WorkoutLoggerModal`, `FocusStartModal`, `FocusRunningModal`, `RecipeDetailModal`, `CoachConsentModal`, `PaywallModal`, etc.
  - None currently support unified drag-to-dismiss gestures, grabber handles, or inset half-sheet behavior.
- **Target (CMP-04):** Unified `<Sheet snapPoints={['half', 'tall', 'full']} grabber />` component with consistent gesture dismissal and safe area insets.

### 4.4 Form Fields and Steppers
- **Current state:** `TextInput` wrappers with ad-hoc styling in 12 files:
  - `input` styles in `SignInScreen`, `ProfileSetupScreen`, `CustomFoodModal`, `ManualStepsModal`, `WeightEntryModal`, `CreateRoomModal`, `CardioForm`.
  - Steppers and portion counters in `QuantityModal`, `InteractiveDobPicker`, `RecipeServingsScaler`.
- **Target (CMP-06, CMP-07):** Unified `<Field label="..." error="..." />` and `<NumericStepper min={...} max={...} step={...} />`.

### 4.5 Empty & Status States
- **Current state:** Multiple disparate empty views:
  - `ChatEmptyState`, `DormantWaitingState`, `ChallengesComingSoon`, and plain text placeholders in lists.
- **Target (CMP-17, CMP-18):** Unified `<EmptyState icon={...} title={...} subtitle={...} action={...} />` and `<Skeleton />`.

---

## 5. Architectural & Tangling Risks

1. **Direct Service & DB Calls inside Modal Views:**
   - Several modal components (`RoomSettingsModal`, `FoodLogModal`, `WorkoutLoggerModal`) instantiate data mutations, handle network retry logic, and display alerts directly inside UI code instead of delegating to domain hooks.
   - *Mitigation:* In UI phases, strictly adhere to rule **U12** (do not change logic/hooks/contracts). Modify only the JSX and styling layer without altering event handlers or data contracts.
2. **Dynamic Inline SVG Pathing on JS Thread:**
   - Rings in `CalorieMacroRing.tsx` and `GoalProgressRing.tsx` perform arc geometry math on every render pass.
   - *Mitigation:* In UI-3, signature components (`PairRing`, `Seam`) will be implemented using Reanimated worklets (`react-native-reanimated`) to run smoothly on the UI thread at 60 fps.
3. **Hard-coded `#FFFFFF` text on variable backgrounds:**
   - 109 instances of `#FFFFFF` text currently exist. If surfaces are switched or apricot accent fills are introduced, white text on apricot fails WCAG AA contrast (must use `onBrand: #1C1109`).
   - *Mitigation:* UI-1's compatibility layer and contrast tests will ensure `onBrand` is applied to all brand-accented buttons.
4. **Platform font fallback and layout jitter:**
   - Currently, numbers change widths dynamically because system fonts lack tabular numeral settings (`fontVariant: ['tabular-nums']`).
   - *Mitigation:* UI-1 will configure static fonts with `tabular-nums` for all changing numerals.

---

## 6. Audit Conclusion & Readiness for UI-1

- **Audit status:** Complete.
- **Repository baseline:** All 786 automated tests pass (41 files in `app`, 32 in `packages/core`).
- **Spec split status:** 18 split documentation files in `docs/ui/` + `docs/ui/README.md`.
- **Agent rules status:** UI rules U1–U12 appended to `AGENTS.md` and `AGENT_RULES.md`.
- **Readiness for UI-1:** Codebase is fully ready for Phase UI-1 (Tokens, Fonts, Theme, and Compatibility Layer).
