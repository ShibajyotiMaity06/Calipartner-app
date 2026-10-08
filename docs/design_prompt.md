# Design + build prompt — partner accountability fitness app

> Paste everything below the line into Claude or Cursor as your opening message.
> Replace `[APP_NAME]` with your app name before pasting. Working name used throughout: **Duo**.

---

You are the design lead and senior mobile engineer on a new fitness app called **[APP_NAME]**. Build the design system first, then the screens. Your output is production Flutter code (single codebase, Android + iOS) with a token layer that a designer could lift into Figma.

Do not start coding until you have written the token file. Do not use a UI kit, Material defaults, or Cupertino defaults as your visual language — only as behavioral primitives.

## 1. What this product actually is

A calorie and habit tracker whose entire reason to exist is **one other person**. Two people pair into a private "room" and see each other's day side by side: rings, steps, and which meals got logged. That paired view is the product. Everything else is support.

The emotional job is **companionship, not competition**. The user should feel "someone is in this with me," never "I am losing." Two people at very different calorie goals — a 1,600 kcal cut and a 3,100 kcal bulk — must be able to look at the same card and both feel seen. This single constraint drives most of the design decisions below.

Audience: 18–32, India-first (Hindi + English at launch), phone-only, mid-range Android is the majority device. They are already using MyFitnessPal or HealthifyMe and find them lonely and cluttered.

### Non-negotiable product facts

Navigation is five tabs, identical on both platforms: **Today**, **Room**, **+ Log** (center), **Ranks**, **Me**.

Basic solo logging is **free forever**. Rooms are paid, per user, not per room. New users get a 3-day window with one 2-person room and streaks unlocked. Pricing: ₹99/month or ₹249/3 months in India; $4.99/month or $12.99/3 months internationally; regional pricing elsewhere. Billing goes through Google Play Billing and Apple IAP. iOS must show **Restore purchases**.

If one partner's plan lapses, the room goes inactive for both. The lapsed partner gets a dedicated rejoin screen, not a generic paywall.

Ranking is by **consistency and percentage of personal goal achieved** — never by lowest calories eaten, never by weight lost. This rule must be visible in the UI.

## 2. Design thesis — "two halves, one seam"

Spend all the boldness in one place: the paired view. Everything else stays quiet so that view lands.

Brand colour. The app's identity is violet (brand) and its signature is the duoGradient, rose through violet to aqua, which is what the two people become when they fuse. Use brand for primary buttons (one per view), the active tab, selected chips and the logo. Use brandLight for links and active icons. Use duoGradient only for the logo, the fused seam, the onboarding target ring and the paywall hero. Never use brand or the gradient to show performance, and never on the paired arcs.

The structural idea is a **seam** — a vertical hairline that runs down the center of the Room screen, splitting it into two equal halves, you on the left and your partner on the right. The seam is not decoration; it carries state. It is dim and broken when only one of you has logged, and it fuses into one continuous lit line when both of you have closed the day. That fusing is the app's one moment of celebration. No confetti, no trophies, no badges raining down.

The second idea is **identity color instead of score color**. Each person in a room is assigned one of two hues for the life of the room. Neither hue means good or bad. Green-means-winning and red-means-losing are banned everywhere performance is shown, because they turn a friend into a scoreboard. Red exists in this app only for destructive actions like deleting an account.

The third idea is **percent, not calories**. Every comparison is expressed as percent of that person's own goal. Raw calorie counts appear only inside your own column, never in a side-by-side position where they invite comparison.

Premium here means restraint and material quality: deep cold slate, one layer of real glass where depth is functional, hairlines that catch light like a machined edge, and numerals that are large, confident, and perfectly aligned. It does not mean gradients on every card.

## 3. Tokens

Write these to `lib/design/tokens.dart` first. Every widget reads from here. No hardcoded hex, no hardcoded padding, anywhere in the app.


### 3.1 Color 

// Base — deep indigo ink (tinted, not neutral)
ink950  #0B0A1F   app background
ink900  #131230   card / primary surface
ink800  #1B1A40   raised surface, inputs, tab bar fill
ink700  #26245A   pressed states
hairline    #2D2B5E   1px structural lines
hairlineLit #6B66A3   active / focused line        3.50:1 on ink900

// Text — measured on ink900
textHi   #F2F0FF   numerals, headings      16.15:1
textMid  #AEA9D6   labels, secondary        8.16:1
textLo   #8B86B8   placeholders, axis       5.36:1
textOff  #6B66A3   disabled controls only   3.50:1

// Brand — the app's own colour
brand       #6F52F2   primary button, active tab, logo      white text 5.04:1, 3.60:1 on ink900
brandLight  #A895FF   links, active icons and text          7.27:1 on ink900
duoGradient #FB75A7 → #A895FF → #05B0D3   (rose → violet → aqua)

// Identity hues — user-chosen per room, luminance-matched at 0.36 (~7.1:1 on ink900)
rose    #FB75A7   default person A
aqua    #05B0D3   default person B
orchid  #CE83F8
sky     #78A0FC
lime    #81B014

// Signals
amber   #F2B13C   over goal, attention, lapsed plan   9.62:1
danger  #FF5A5A   destructive only, never performance 5.93:1

The base is a cold slate with a deliberate blue-green undertone — the color of a gym at 6am before the lights warm up. It is not a neutral tinted black.

```
// Base — cold slate
slate950  #090D11   app background
slate900  #10161C   card / primary surface
slate800  #182028   raised surface, input fields, tab bar fill
slate700  #212B35   pressed states
hairline  #2A353F   1px structural lines, decorative
hairlineLit #5A6B78 active / focused / informational line  (3.30:1 on slate900)

// Text  — measured contrast against slate900
textHi    #EDF2F6   numerals, headings            16.15:1
textMid   #94A3B1   labels, secondary              7.05:1
textLo    #7A8B98   placeholders, axis, glyphs     5.18:1
textOff   #5C6B78   disabled controls only         3.32:1

// Identity hues — assigned per person per room, never by performance
voltA     #B3DE3E   person A  (electric lime)   L 0.622  11.65:1
glacierB  #50E0FA   person B  (ice cyan)        L 0.619  11.60:1
voltAGlow     #B3DE3E @ 18%
glacierBGlow  #50E0FA @ 18%

// Signals
amber     #F2B13C   over goal, attention, lapsed plan
amberDim  #F2B13C @ 12% fill
danger    #FF5A5A   destructive only: delete account, leave room. Never performance.
```

Rules for use:

Volt and glacier are deliberately luminance-matched — 0.622 and 0.619 relative luminance, 11.65:1 and 11.60:1 on `slate900`. That matters: if one person's arc were brighter, their half of the card would read as more important. Keep this property if you ever retune the hues, and re-measure rather than eyeballing, because a saturated lime is naturally far brighter than a cyan and the obvious pairing gets this wrong.

For rooms of three or more, person C gets `#B494FF` and person D `#FFB47A`. These sit darker (0.381 and 0.553) because no saturated violet reaches lime's luminance without turning grey. That is acceptable only because two arcs are ever drawn at once, so C and D appear in member strips, feed rows and avatar rings rather than adjacent on a shared ring. When C or D becomes the active comparison, their arc renders at 1px heavier stroke to hold equal visual weight.

Macros do not get their own rainbow. Protein, carbs and fat render as three steps of the **owning person's** identity hue — 100%, 55% and 28% opacity. This keeps identity readable and stops the app looking like a pie chart demo.

Over-goal is amber, not red. Copy says "320 over", not "exceeded".

### 3.2 Type

One family, two widths. Use **Archivo** variable (free, Google Fonts) — `wght` 400–700, `wdth` 62–125.

```
display   Archivo wdth 115, wght 600, -2% tracking   — ring numerals, 44 / 34
title     Archivo wdth 100, wght 600                  — screen titles, 22
heading   Archivo wdth 100, wght 600                  — card titles, 17
body      Archivo wdth 100, wght 400, 1.45 line       — 15
label     Archivo wdth 100, wght 500                  — 13, sentence case
micro     Archivo wdth 100, wght 500                  — 11, used sparingly
```

All numerals use **tabular figures** (`fontFeatures: [FontFeature.tabularFigures()]`) so counts don't jitter as they animate. For the Hindi locale, swap to **Anek Devanagari** variable at the same weights and keep the same scale; do not let the line-height shift between locales.

Sentence case everywhere. No all-caps labels, no letter-spaced eyebrow text above headings, no monospace for data labels — the expanded Archivo width already does that job with more character.

### 3.3 Space, radius, elevation

Base unit 4. Spacing scale: 4, 8, 12, 16, 24, 32, 48. Screen horizontal padding 20. Card inner padding 16.

Radius is a hierarchy, not one value: controls and chips 10, cards 18, bottom sheets 28 (top corners only), rings and pills fully round. Never apply the same radius to everything.

Elevation is expressed with light, not shadow. Dark UIs read as cheap when you stack grey drop shadows. Instead:

Every card gets a 1px `hairline` border plus a top inner highlight — a 1px line at `#FFFFFF @ 7%` along the top edge only, so the card looks like a milled plate catching light from above. Shadows are allowed only under truly floating things (tab bar, bottom sheet) at `rgba(0,0,0,0.5)` blur 32, y-offset 8, no spread.

**Glass appears in exactly two places**: the floating tab bar and the Log bottom sheet. Both use a 24px backdrop blur over `slate900 @ 72%` with a 1px `hairline` border. Resist putting blur on cards — when everything is glass, nothing reads as elevated. On low-end Android, fall back to opaque `slate800` if the blur drops frames; check for this and degrade gracefully.

### 3.4 Motion

```
fast    120ms  cubic-bezier(0.2, 0, 0, 1)    taps, toggles, chips
base    220ms  cubic-bezier(0.2, 0, 0, 1)    sheets, tab changes, counters
ring    680ms  cubic-bezier(0.32, 0, 0.1, 1) ring fill on data change
seam    900ms  cubic-bezier(0.4, 0, 0.2, 1)  the day-complete fuse
```

Motion happens in response to an action or a data change, and nowhere else. No fade-and-slide entrance on every card, no hover-equivalent shimmer, no looping gradient animation. There is **one** orchestrated moment in the whole app: the seam fuse. Respect `MediaQuery.disableAnimations` — when reduced motion is on, the seam changes state with a 120ms crossfade instead of the sweep.

Haptics: light impact on log saved and on toggle, medium impact on nudge sent, success notification on seam fuse. Nothing else vibrates.

## 4. Signature components

Build these as standalone widgets before any screen.

### 4.1 PairRing — the thing people screenshot

Two arcs on **one shared circle**, so the two people are literally on the same track rather than in separate charts.

The outer arc is you, in your identity hue, 10px stroke, round cap. The inner arc is your partner, in theirs, 7px stroke, 6px gap between the two. Both arcs are percent of that person's own goal, starting at -90° and sweeping clockwise. The track behind each arc is `slate800` at 1px. Diameter 184 on the Room screen, 120 in the compact Today strip.

The center holds your percent in `display` 44 with a 13px `label` beneath reading your remaining calories, for example "1,180 left". The partner's percent sits as a small pill tucked against the outside of their arc at the arc's current end point, so the number travels with the arc — that's what makes the component feel alive rather than charted.

At 100% the arc gets a 12px outer glow in its own hue at 18%. Past 100% the arc continues in amber over the top of itself, one extra lap maximum, then stops. Never let an arc wrap more than twice.

Animate with `ring` easing from the previous value. On first paint, animate from zero once, then never again on that session.

### 4.2 The Seam

A 1px vertical line at `hairline`, inset 24 from top and bottom of the paired card, running floor to ceiling of the comparison area.

States: **broken** — the line renders as 6px dashes in `hairline` when neither person has logged today. **Half-lit** — when one person has closed their day and the other hasn't, the line goes solid from the top down to the midpoint, drawn in the **finished person's identity hue** rather than grey, so the color says who. Because a vertical line has no left or right, the hue is what carries the identity; back it up with a 5px dot on the finished person's side of the midpoint and the filled dots already visible in their column, so the information survives without color. **Fused** — the full line turns solid and takes a 2px glow that is a vertical gradient from `voltA` at the top to `glacierB` at the bottom, animating in over `seam` with a sweep from both ends toward the middle, meeting in the center. A single 13px label fades in under the card: "Both of you closed today. Day 12." No modal, no overlay, no confetti.

### 4.3 PersonColumn

Used on both halves of the paired card, identical structure mirrored. Avatar 36px circle with a 2px ring in the person's identity hue, name in `label`, then their percent, then steps as a thin horizontal bar, then the meal checklist.

The checklist is four rows — breakfast, lunch, dinner, snacks — each a 24px row with a 14px status glyph on the inner side (facing the seam) and the meal name on the outer side. Logged is a filled round dot in the person's hue; not logged is an open 1.5px circle in `textLo`. Never a red cross, never a strikethrough, never the word "missed". An unlogged meal at 9pm is a neutral open circle, because the person may simply not have eaten yet.

Long-press any logged meal row to open the partner's entry for that meal, if they've shared it. Tap the dot to drop an emoji reaction — reactions appear as a 16px stack at the row's outer edge.

### 4.4 NudgeButton

A 44px pill centered **on the seam**, vertically at the card's midpoint, so the one social action lives exactly where the two people meet. Fill `slate800`, 1px `hairlineLit` border, a simple hand/tap glyph, no text. Press gives medium haptic and the pill briefly fills with the partner's hue. Rate-limit to one nudge per partner per 4 hours and show the remaining time in a toast if tapped again: "You nudged Priya an hour ago. You can nudge again at 6pm."

### 4.5 LogSheet

The single most used surface, so it opens fast and remembers everything. A glass bottom sheet at 92% height with a 28px top radius and a 36×4 grabber in `hairline`.

A segmented control across the top with Search, Scan, Photo, Recent. Default to Recent, not Search — most logging is repeat food, and opening onto a list of things you already eat is faster than opening onto an empty field with a keyboard. Search results are rows with food name in `body`, brand and serving in `label` `textMid`, kcal right-aligned in tabular figures.

After selection, a quantity step slides in from the right (it is a new step, not a new sheet): a large editable number, a serving-unit selector, a live macro preview using your three identity-hue steps, then two switches — **Share with my room** (default on) and **Someone else ate this too** which reveals room member chips so one log writes to two diaries. Primary button says **Add to lunch**, naming the actual meal, and the resulting toast says **Added to lunch**. Same verb through the whole flow.

Barcode scan is full-bleed camera with a 260×160 cutout, corner brackets only in `voltA`, nothing else drawn over the feed. Photo estimate shows its result with a confidence band and an editable value — never present an AI estimate as a certainty.

## 5. Screens

### Today

Your own day, calm and single-column.

Top row: greeting with first name in `title`, a date chip, and a 28px streak pill showing a flame glyph and the number. Under it, a 44px horizontal strip of room member avatars; a 6px dot in each person's identity hue sits on the avatar when they've logged today — identity hue, not green, so the dot never reads as a grade.

Then the hero: your calorie ring at 120px on the left, and to its right a stacked block with eaten, remaining, and a three-segment macro bar in your identity-hue steps with gram values beneath. One card, `slate900`.

Then four meal cards — breakfast, lunch, dinner, snacks — each showing the meal name, total kcal, up to three logged item names, and a 32px circular add button in the card's trailing edge. Empty meals show the add button and nothing else; no "no items logged yet" filler text.

Then two half-width cards: water as eight tappable 6px-radius bars that fill in `glacierB`, and steps as a number with a thin progress bar and the source attribution, for example "from Health Connect".

### Room — the hero screen

Header is the room name in `title`, a streak count, member avatars, and a settings glyph. Directly under it, one sentence of plain-language state: "You've both logged 11 days straight."

The paired card fills most of the screen. PairRing at the top, centered across both halves so the shared circle visually straddles the seam. Below it, two PersonColumns separated by the Seam, with the NudgeButton on the seam. Below the card, a row of three quick actions as text-labeled pills: **Log a shared meal**, **Send a photo**, **Room settings**.

Then the room feed — a chronological list of plain rows, each with a 24px avatar, a sentence, and a relative timestamp. "Priya logged lunch." "Rahul hit his protein goal." Feed rows have no cards and no borders, only 1px hairlines between them, so the feed recedes and the paired card stays the hero. Every shared item carries a 14px eye glyph; tapping it opens a sheet stating exactly what this person can see, in full sentences, with a link to privacy settings.

Rooms with three or more people: the PairRing shows you plus whoever you last compared against, and the avatar strip becomes the selector. Tapping an avatar swaps the inner arc and the right column with a 220ms crossfade. A small label under the ring names the comparison: "You and Priya". Never render three or more arcs on one ring.

### Ranks

Seasonal and occasion challenge cards first — full-width 18px-radius cards, each with its own duotone treatment built from the two identity hues, a name like "Winter Arc" or a personal occasion plan like "Priya's birthday, 6 weeks", a date range, and a join or progress state. These are the only place in the app where imagery or gradient is allowed, because a season should feel like an event.

Then the division selector as chips — cutting, bulking, beginner — and the weekly leaderboard. Rows show rank in `display` wdth 115 at 17, avatar, name, a consistency figure, and percent-of-goal. Your own row is pinned and gets a `hairlineLit` border and `slate800` fill rather than a different color, so being first and being fortieth look equally dignified.

A persistent single-line note sits above the table: **Ranked on consistency and how close you get to your own goal. Not on eating least.** Keep it visible, not behind an info icon.

### Me

Weight chart first — a thin 1.5px line in `voltA` on a `slate900` card, 7/30/90-day chips, dots only on tapped points, no area fill. Then measurements, then goal settings showing the target with an edit affordance and the formula used in plain words.

Privacy controls get real estate, not a buried row: a grouped list of switches with plain-language labels like "Partners can see my meal items" and "Partners can see my weight", each with one line of consequence text under it. Then subscription, then Health Connect / Apple Health sync with a last-synced timestamp, then notifications, then account.

### Onboarding

Four steps, no account required until the end. Goal choice as three large tappable cards — cut, bulk, maintain — each with a one-line plain description. Then body stats with a numeric keypad and sensible units for India (kg, cm, with an imperial toggle). Then the calculated target shown on a PairRing-styled single arc at 184px, with the reasoning in one sentence: "Based on your stats, 1,840 kcal a day puts you on track to lose 0.4 kg a week." Then Today, with a prominent **Invite your partner** card where the paired card will eventually live — the empty state is a preview of the real paired card with the right half rendered as a dashed-outline placeholder, so the user sees what they're missing. That placeholder is the most persuasive object in the app; make it beautiful.

Account creation is deferred until the user's first log is saved or they tap Room.

### Invite preview

Opened from a deep link. Shows the inviter's avatar at 72px, their first name, their streak, and one line: "Rahul is waiting for you." Below it, a live but blurred render of the paired card with the empty half highlighted. Primary button **Join Rahul's room**. The paywall comes **after** this screen, never before it.

### Paywall

Triggered on day 4 when Room is tapped, plus a soft inline banner on days 2 and 3 reading "2 days left in your room trial" with a quiet upgrade link.

Structure: one line of value in `title` — "Keep your room with Priya" with the actual partner's name when known. Then a compact three-row list of what the plan unlocks. Then two plan cards side by side, 3-month preselected with a quiet savings label, not a shouting badge. Then the primary CTA, then **Restore purchases** as a text button, then one small line stating clearly: "Logging, your diary and your streak stay free." Then links to terms and billing, and an explicit renewal sentence as the stores require.

Localize currency by store region. Never show a countdown timer or a fake discount.

## 6. States you must build

**No partner yet** — the dashed placeholder half described above, plus a share-sheet invite button. Never show a zero-state illustration of two cartoon people.

**Partner hasn't logged today** — their column shows open circles and a muted percent at 0, with one line in `textMid`: "Priya hasn't logged yet today." Neutral, factual, no nudge-shaming copy.

**Partner's plan lapsed** — the room enters an inactive state. Both halves desaturate to `textLo`, the seam goes fully dashed, and a card appears explaining what happened in the lapsed person's own terms. For the paying partner: "Priya's plan ended, so your room is paused. Your streak is saved for 30 days." For the lapsed person, a dedicated rejoin screen, not the generic paywall: their room, their streak number, their partner waiting, and one button **Rejoin your room**.

**Offline** — logging works offline and queues. A 28px pill at the top of Today reads "Saved on this phone. Will sync." Never block a log on connectivity.

**Loading** — skeletons that match the final layout's geometry in `slate800`, with no shimmer sweep. Rings render their track with no arc rather than spinning.

**Over goal** — amber arc, amber count, and copy that states the fact: "320 over your target." No warning icon, no red, no advice unless the user asks.

## 7. Platform behavior

Structure is identical; behavior is native. Do not reimplement either platform's back navigation — Android uses the system back gesture and predictive back, iOS uses the left-edge swipe plus a leading back chevron. Modals dismiss with a drag on both.

Health data comes from Health Connect on Android and HealthKit on iOS, with permission requested in context — when the user first taps the steps card, not at onboarding. Explain what you read and write before the system sheet appears.

If you offer Google sign-in on iOS, you must also offer Sign in with Apple, and it should be ordered first on iOS. Invite links use each platform's native share sheet. Subscriptions use Google Play Billing and Apple IAP with no external payment links inside the app, and iOS surfaces Restore purchases on both the paywall and the subscription row in Me.

The tab bar is the same five-tab floating glass bar on both platforms, with safe-area insets respected and a slightly taller center button. Build the "you vs partner today" home widget only after the MVP ships.

## 8. Copy voice

Plain, warm, specific, second person. Active verbs. Sentence case. No exclamation marks, no emoji in system copy, no coach persona, no guilt. Name things the way a user would say them out loud.

Write these, not these:

| Write | Not |
|---|---|
| Add to lunch | Submit |
| Added to lunch | Success! |
| 320 over your target | Calorie limit exceeded |
| Priya hasn't logged yet today | Priya is falling behind |
| Both of you closed today. Day 12. | Streak maintained! 🔥 |
| Keep your room with Priya | Unlock premium features |
| Couldn't reach the server. Your log is saved on this phone. | Something went wrong |
| Invite your partner | Get started |
| Ranked on consistency and how close you get to your own goal. | Leaderboard rankings |

Errors say what happened and what to do next, in the interface's voice. Empty screens are an invitation to act, with the action right there.

## 9. Quality floor

Minimum tap target 44×44. The palette in 3.1 is already measured against `slate900`, so use those pairings as given: `textOff` at 3.32:1 is for disabled controls only, and anything that carries meaning uses `textLo` or above. Non-text indicators — arcs, the open meal circles, the seam, focus rings — must clear 3:1, which is why `hairlineLit` is `#5A6B78` and not darker. Visible keyboard and switch-access focus is a 2px ring in the person's identity hue, never a color-only fill change.

Never encode meaning in hue alone: every identity hue is paired with position (left or right of the seam), the avatar, and a name label, so the screen still reads for a colorblind user. Support text scaling to 200% without clipping — the paired card reflows to stacked columns above 150%, with the seam becoming a horizontal rule between them and the PairRing splitting into two separate single arcs.

Screen readers get meaningful labels for rings and arcs: "Your goal, 78 percent complete. Priya's goal, 64 percent complete." Dashed seam announces as "Neither of you has finished logging today." Respect reduced motion as described. Test on a 360×640 Android at 1.3× text scale before you call anything done.

## 10. Do not

No red or green to express performance. No trophies, medals, confetti, or badge showers. No cartoon mascot or illustrated empty states. No gradient washes outside the Ranks challenge cards. No glass on cards. No identical drop shadow under every surface. No all-caps or letter-spaced eyebrow labels. No monospace data labels. No arrows appended to button text. No middle-dot meta strings. No numbered 01/02/03 markers unless the content is genuinely a sequence. No fade-up entrance animation on every section. No raw calorie numbers positioned for direct comparison between two people. No streak-loss guilt copy. No Inter, Poppins, Montserrat, or SF Pro as the brand face. No fake urgency on the paywall.

## 11. Build order

Start with `tokens.dart`, then the primitives — `AppCard`, `AppPill`, `SeamLine`, `StatBar`. Then `PairRing` and `PersonColumn` in isolation on a gallery screen with mock data covering 0%, 64%, 100%, and 118%. Then the Room screen, because it is the product. Then LogSheet, Today, Ranks, Me. Then onboarding, invite, paywall, and all the states in section 6. Mock the data layer behind repository interfaces so screens can be built and reviewed before any backend exists.

Before you write screen code, show me the token file and a short written design plan, including how you will render the seam in its three states. After each screen, render it and critique your own output against sections 2, 9 and 10, then fix what you find and tell me what you changed.
