# CaliPartner: Product Requirements Document (PRD)


| Field | Detail |
|---|---|
| Product | CaliPartner: an all-in-one fitness app (food, water, steps, workouts, fasting, recipes, progress, room chat and a premium AI coach) built around partners, friends and groups |
| Version / status | v0.3, draft for team review |
| Date | 7 October 2026 |
| Platforms | Android and iOS (single cross-platform codebase recommended) |
| Related documents | CaliPartner Build Plan (phase-by-phase agent prompts); App Layout and Navigation Plan (superseded by Section 6.24); design prompts (maintained separately) |
| Priority legend | P0 = required for launch<br>P1 = Phase 2 (fast follow)<br>P2 = later / nice to have |


### Change log


| Version | Changes |
|---|---|
| v0.1 | First draft: nutrition tracking, rooms, privacy, leaderboards, subscription. |
| v0.2 | Added deterministic calorie, macro and weekly-rate calculation (7.2) with worked example; workout tracker (6.6); unique usernames with invitations and join requests (6.7); room-only chat with image sharing (6.10); progress graphs for individuals and rooms (6.15); five meal sections (Breakfast, Lunch, Dinner, Snacks, Extra); "Previously logged foods" quick-add; detailed water and steps trackers; derived-metric formulas (7.8); updated navigation, data model, timeline, risks and open questions. |
| v0.3 | Added premium AI coach (no free trial); fasting tracker; our own recipe library; "Rate us" prompt; annual plan; tech stack finalised (React Native + Expo, Supabase, email-code login with no phone OTP, Cloudflare R2 for images, store billing with Dodo for web later); trial now starts at first room use (proposed); build phases replace week-based timeline. |


> Metrics, thresholds, prices and timelines in this document are starting hypotheses. Items marked "proposed" are recommendations that the team should confirm. Legal, tax and nutrition-safety items should be validated with a lawyer, a CA and a registered dietitian before launch.


## 1. Product Overview


### 1.1 Summary

CaliPartner is a single app where people track everything about their fitness journey in one place: food, water, steps, workouts, fasting and body progress, backed by a library of our own recipes and a premium AI coach. Its difference is the shared layer. Two or more people join a private "room", see each other's day side by side, chat with each other, and compare progress charts. Each person has their own goal (one can be cutting while another is bulking), and the room shows how everyone is doing against their own goal, not against each other's numbers. A weekly leaderboard, seasonal challenges and occasion plans (Winter Arc, birthday, New Year) add motivation.


### 1.2 Problem

- Most people quit calorie trackers within the first few weeks. Logging is tedious and there is no one to keep them accountable.
- Gym-goers, couples and friend groups already motivate each other informally, but they do it across several apps (a calorie tracker, a workout log, a step counter, WhatsApp). Existing trackers (MyFitnessPal, Lose It!, Cal AI and others) are built for one person, and their social features are secondary and weak.
- Sharing food data raises real privacy and unhealthy-comparison concerns that generic social features do not handle.

### 1.3 Vision and positioning

"One app for you and your people." Solo logging is a commodity; CaliPartner wins on the shared experience: a fast partner side-by-side view, shared meals, room chat, shared progress charts, one-tap invites and healthy, consistency-based competition, with no need for a second app.


### 1.4 Key differentiators

- **Partner and room tracking as the core product, **not an add-on.
- **All-in-one: **food, water, steps, workouts, fasting, recipes, progress graphs, chat and an AI coach live inside one app.
- **Our own recipe library: **original, nutrition-calculated recipes with Indian and regional focus, loggable in one tap.
- **Premium AI coach: **answers questions using the user's own data, with numbers coming from our deterministic calculators.
- **Goal-relative comparison: **everyone is measured against their own goal.
- **Shared meals: **log once, tag others, each person sets their own portion.
- **Safe competition: **rankings are based on consistency and goal achievement, never on lowest calories or most weight lost.
- **Per-person privacy controls **with conservative defaults.
- **Transparent, formula-based targets: **calorie and macro targets come from fixed, explainable formulas, not black-box AI.
- **Regional food coverage, **including Indian foods and household measures.

## 2. Goals, Non-Goals and Success Metrics


### 2.1 Goals

- Make logging fast enough that users keep doing it after week one.
- Make "add your partner" (by username, link or code) the most natural next step after the first logged meal.
- Keep rooms alive: a room should stay useful even when one member goes quiet, and chat and progress charts give people reasons to open the app daily.
- Let a user run their entire fitness routine inside CaliPartner without needing other apps.
- Reach a sustainable subscription business with per-user pricing.

### 2.2 Non-goals for launch

- GPS route tracking for runs and rides (steps and distance come from sensors, Health Connect and HealthKit).
- Chat outside rooms: no global chat, no public feed, no direct messages between users who do not share a room.
- Voice or video calls, voice notes, GIF libraries and link previews in chat.
- Meal planning, grocery lists, user-submitted recipes or a recipe marketplace, dietitian or human-coach accounts.
- Web app and home-screen widgets.
- Medical or clinical nutrition use cases (diabetes, pregnancy, eating-disorder treatment).

### 2.3 Success metrics (initial hypotheses)


| Metric | Definition | Initial target |
|---|---|---|
| North star: Weekly Active Rooms | Rooms where at least 2 members each logged on 4+ days in the week | 40% of rooms by week 4 |
| Activation | New users who log a first meal in their first session | 70% or more |
| Invite rate | New users who send at least 1 invite or request within 48 hours | 50% or more |
| Invite acceptance | Invites or requests that result in a joined member within 7 days | 35% or more |
| Room activation | Rooms where 2+ members log on the same day within 7 days of creation | 60% or more |
| Chat adoption | Rooms with at least 20 chat messages in their first 14 days | 50% or more |
| Workout logging | Weekly active users who log at least 1 workout in a week | 30% or more |
| Retention (rooms) | D7 and D30 retention of users who are in a room | 35% D7 / 15% D30 |
| Paired retention | Both members of a 2-person room active in week 4 | 50% or more |
| Trial to paid | Users reaching day 4 who start a paid plan | 8% or more |
| Paid retention | Paid users still subscribed after month 2 | 60% or more |
| AI cost control | AI photo-logging and AI coach cost as a share of net revenue | Below 15% |
| Annual plan share | Share of new paid users who choose the annual plan | 25% or more |
| Store rating | Average rating on Google Play and the App Store after 100+ ratings | 4.3 or higher |
| AI coach engagement | Paid users who send at least 1 coach message per week | 30% or more |
| Recipe use | Weekly active users who log at least 1 recipe per week | 15% or more |


## 3. Target Users and Personas

CaliPartner is not limited to couples. Any group of 2 to 10 people can share a room.


| Persona | Description | What they need |
|---|---|---|
| Gym partners | Two friends (e.g., two guys or two girls), one cutting and one bulking, who train together. | Side-by-side view with separate goals, workout log, chat, progress charts, friendly weekly ranking. |
| Couples | Partners who eat many meals together and want to support each other. | Shared meals with individual portions, privacy controls, gentle reminders, chat. |
| Friend or challenge groups | 4 to 10 friends doing a Winter Arc, New Year or pre-event challenge. | Group room, group chat, consistency leaderboard, challenge milestones, group progress charts. |
| Solo users | People who have no partner yet, or are waiting for one to join. | Great solo tracking of food, water, steps and workouts, personal progress charts, and an easy way to add someone later. |

Primary audience at launch: adults 18+, gym-going and fitness-motivated, India first, then international English-speaking markets.


## 4. Product Principles

- **One app for everything. **A user should never need a second app for food, water, steps, workouts, progress or talking to their partner.
- **Compare to your own goal, **not to other people's numbers.
- **Private by default. **Users opt in to sharing calories, weight and meals.
- **Never reward undereating. **No ranking, badge or streak should be won by eating less.
- **Logging must take seconds. **Every extra tap costs retention; repeat foods should be one tap.
- **A room should survive absence. **One quiet member should not kill the room.
- **Explainable numbers. **Targets and estimates come from published formulas the user can see.
- **Calm, supportive tone. **Nudges and chat prompts encourage; they never shame.
- **Safe by design. **Fasting, the AI coach and rankings never push people towards unhealthy behaviour.

## 5. Scope and Release Phases


| Phase | Includes |
|---|---|
| Phase 1: Launch (P0) | Email-code, Google and Apple login; unique usernames; onboarding and deterministic calorie, macro and weekly-rate targets; food logging in 5 sections with search, barcode, AI photo, custom foods and "previously logged" quick-add; Today diary; water, steps and weight trackers; workout tracker; fasting tracker; our own recipe library; rooms with invitations and join requests; side-by-side room view; room-only chat with images; shared meals; nudges and reactions; privacy controls; streaks and weekly consistency score; individual and room progress graphs; weekly leaderboard; premium AI coach; subscriptions (monthly, 3-month, annual) and paywall; push notifications; rate-us prompt; account and settings. |
| Phase 2 (P1) | Adaptive calorie recalibration; workout routines, rest timer, personal records and shared workouts; chat replies, read receipts, typing indicator and editing; coach food logging by chat; recipe collections and "fits my day" suggestions; seasonal challenges and occasion plans; weekly room summary; body measurements and progress photos; streak freezes; data export; more nutrients; more languages; home-screen widget. |
| Phase 3 (P2) | Web app with Dodo Payments checkout, GPS run and ride tracking, workout programs, sleep and mood, meal planning and grocery list, dietitian or human-coach rooms, voice notes and GIFs in chat, coach insights by push, chat search. |


> Scope warning: the product is now broad (workouts, chat, fasting, recipes and an AI coach on top of the core partner experience). Build in the order given in Section 13 so that the core loop (food, rooms, side-by-side view) can be tested with real friends early, before the extra modules are finished.


## 6. Functional Requirements


### 6.1 Account, Authentication and Profile


| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | Sign up and sign in with a 6-digit email code (passwordless), Google and Apple. There is no phone number or SMS login. Email codes are sent through a third-party email provider over custom SMTP from a verified domain. Sign in with Apple is offered because Google sign-in is offered on iOS. | P0 |
| AUTH-2 | Guest start: a new user can finish onboarding and log meals before creating an account. Local data migrates to the account on signup. An account (and username) is required before creating, joining or being invited to a room, and at the latest at the end of day 1. | P0 |
| AUTH-3 | Age gate: date of birth is collected and users under 18 are blocked (see Section 8). | P0 |
| AUTH-4 | Profile with a display nickname, a unique @username (see 6.7), avatar and optional photo. Rooms and chat show nickname plus @username; leaderboards show nickname only. | P0 |
| AUTH-5 | In-app account deletion that removes personal data, removes the user from rooms, and shows how to cancel store subscriptions. | P0 |
| AUTH-6 | Export my data (CSV or JSON). | P1 |
| AUTH-7 | Trial-abuse controls: block disposable email domains, allow one room trial per account and per device (hashed device identifier), and cap AI scans per device. The trial costs little, so controls stay light. | P0 |


### 6.2 Onboarding and Goals


| ID | Requirement | Priority |
|---|---|---|
| ONB-1 | User picks a goal: cut (lose fat), bulk (gain), or maintain. | P0 |
| ONB-2 | Collect sex (male, female or other), date of birth, height, weight, activity level, optional body-fat %, and optional target weight and target date. | P0 |
| ONB-3 | Show the user's estimated maintenance calories, then let them pick a weekly rate (e.g., 0.25, 0.5, 0.75 or 1 kg/week for a cut) and see the exact daily calories for each. All numbers use the deterministic rules in Section 7.2. | P0 |
| ONB-4 | Rates that break a safety rule (calorie floor or weekly cap) are shown as unavailable, with the reason and the fastest allowed rate. | P0 |
| ONB-5 | If the user enters a target weight and date, compute the required weekly rate. If it exceeds the cap, show the earliest realistic date instead. | P0 |
| ONB-6 | Show a "how we calculated this" screen with the formula, inputs and result so the number is transparent. | P0 |
| ONB-7 | Ask for permissions (notifications, health data) at the moment they are useful, not all upfront. | P0 |
| ONB-8 | After onboarding, land on Today with a prominent "Add your partner" card. Skipping is allowed. | P0 |
| ONB-9 | Invited-user variant: show a preview of the room first ("Rahul is waiting for you"), then quick signup, then goal setup, then drop into the room. | P0 |
| ONB-10 | Edit goal, rate, targets, step goal and water goal later from Me. Changes take effect from the current day and do not rewrite history. | P0 |
| ONB-11 | Optional private health-screening questions (pregnant or breastfeeding, diabetes or medication affecting food, history of an eating disorder). Answers are used only to hide fasting and show cautions, are never shared with rooms, and can be changed later. | P0 |


### 6.3 Food Logging


| ID | Requirement | Priority |
|---|---|---|
| LOG-1 | Search foods. Result order: Previously logged, My Foods, then database results. Previously logged items and My Foods must work offline. | P0 |
| LOG-2 | Barcode scan using Open Food Facts and other configured sources. If a barcode is not found, offer to create a custom food and attach the barcode to it. | P0 |
| LOG-3 | AI photo logging: user takes a photo, the app suggests foods and portions, and the user reviews and edits before saving. Results are labelled as estimates. Daily caps apply (Section 7.7). | P0 |
| LOG-4 | Custom foods: name, serving size and unit, calories, protein, carbs, fat (fibre optional). Saved to My Foods and reusable later with a changed quantity. | P0 |
| LOG-5 | Quantity screen supports grams, millilitres, pieces, and household units (bowl/katori, cup, tablespoon, slice). Nutrients rescale live. | P0 |
| LOG-6 | Five meal sections: Breakfast, Lunch, Dinner, Snacks and Extra. Extra is for anything outside the main mealtimes (pre or post-workout shake, supplements, late-night items). The default section is chosen from the time of day. | P0 |
| LOG-7 | Edit or delete any entry. Copy a meal or an entire day to another meal or date. | P0 |
| LOG-8 | My meals: combine several foods into one reusable personal item. (Our own recipe library is covered in 6.21.) | P0 |
| LOG-9 | Logging works offline and syncs when the connection returns. | P0 |
| LOG-10 | Each entry stores a snapshot of its nutrient values so later database corrections or custom-food edits do not change history. | P0 |
| LOG-11 | Indian and regional foods are included via IFCT and curated additions, with common household portions. | P0 |
| LOG-12 | Previously logged foods: a dedicated tab in the Log sheet listing every food the user has logged before (custom foods and database foods). Sort by Recent, Frequent or A to Z, filter by meal section, and search within it. | P0 |
| LOG-13 | One-tap re-log: each row shows the last-used quantity and calories and has a + button that adds the food immediately with that quantity to the selected section. Tapping the row opens the quantity screen to change it. | P0 |
| LOG-14 | Smart suggestions: at the top of each meal section, show the foods the user logged most often in that section over the last 30 days (a deterministic frequency count, not AI). | P0 |
| LOG-15 | Remove a food from history (swipe) without deleting past diary entries. Edit or delete a custom food from this list. | P0 |
| LOG-16 | Optional extra nutrients (fibre, sugar, sodium). | P1 |


### 6.4 Today (Daily Diary)


| ID | Requirement | Priority |
|---|---|---|
| DIA-1 | Calorie ring (eaten vs target) and macro bars, with remaining amounts. | P0 |
| DIA-2 | Five meal sections (Breakfast, Lunch, Dinner, Snacks, Extra) with an add button on each, showing entries and subtotals. | P0 |
| DIA-3 | Cards for water, steps and distance, today's workouts (with "Add workout"), and the fasting timer if the user has turned fasting on. | P0 |
| DIA-4 | Top strip showing room members' avatars with a marker for who has logged today, and an unread-chat indicator. | P0 |
| DIA-5 | Date navigation to view and edit previous days. | P0 |
| DIA-6 | Exercise calories are not added back to the daily calorie target (the activity level already accounts for exercise). | P0 |
| DIA-7 | Entry points to Recipes and to the AI coach (locked preview for non-premium users). | P0 |


### 6.5 Water, Steps and Weight Trackers


### Water intake


| ID | Requirement | Priority |
|---|---|---|
| WAT-1 | Quick-add buttons (glass 250 ml, bottle 500 ml, large 1 L) plus a custom amount. Undo the last add and edit or delete any entry. | P0 |
| WAT-2 | Daily goal defaults to 35 ml per kg of body weight, rounded to the nearest 250 ml (minimum 1,500 ml, maximum 4,000 ml). The user can edit it. | P0 |
| WAT-3 | Progress display (bottle or ring) on Today, with units in ml or fl oz. | P0 |
| WAT-4 | Optional reminders at user-set intervals or times, respecting quiet hours. | P0 |
| WAT-5 | Water history appears in progress graphs (6.15) and can be shared in rooms (default shared, see 6.13). | P0 |
| WAT-6 | Workout-day goal bump (for example +500 ml on days with a logged workout), user-controlled. | P2 |


### Steps and distance (the "steps calculator")


| ID | Requirement | Priority |
|---|---|---|
| STP-1 | Step source priority: Health Connect (Android) or HealthKit (iOS) if permitted; otherwise the phone's built-in step sensor or pedometer; otherwise manual entry. Sources are de-duplicated so steps are never double-counted. | P0 |
| STP-2 | Distance is calculated from steps and the user's stride length (formula in 7.8) unless the health platform provides measured distance, which takes priority. | P0 |
| STP-3 | Show steps, distance, and an informational calorie estimate (7.8) on Today, with a daily step goal (default 8,000, editable). | P0 |
| STP-4 | Steps work with the app closed (via platform background APIs) and show a clear explanation if battery optimisation or permissions block counting. | P0 |
| STP-5 | Step history and weekly averages appear in progress graphs (6.15). | P0 |
| STP-6 | GPS-based route tracking for walks, runs and rides. | P2 |


### Weight and body


| ID | Requirement | Priority |
|---|---|---|
| TRK-1 | Weight: manual log with a trend line (7-day moving average). Other room members never see the weight number unless the user explicitly opts in. | P0 |
| TRK-2 | Weekly weigh-in reminder. Entries can be back-dated and edited. | P0 |
| TRK-3 | Body measurements (waist, chest, arms, etc.) and progress photos (private by default). | P1 |


### 6.6 Workout Tracker

Users log what they trained today, inside the same app. The tracker covers strength training, cardio and other activities.


| ID | Requirement | Priority |
|---|---|---|
| WRK-1 | Log a workout for any date: type (Strength, Cardio, Sports, Yoga or Mobility, Walk or Run, Other), optional name, start time, duration, notes and optional effort rating (1 to 10). | P0 |
| WRK-2 | Strength workouts: add exercises from the library, then add sets with reps and weight (kg or lb). Add, edit, delete and reorder exercises and sets. | P0 |
| WRK-3 | Cardio workouts: duration, optional distance, and average pace or speed calculated automatically. | P0 |
| WRK-4 | Exercise library: at least 300 exercises at launch with muscle group and equipment, searchable and filterable. Users can create custom exercises. | P0 |
| WRK-5 | Previous performance is shown next to each exercise ("Last time: 3 x 8 at 40 kg") to guide the user. | P0 |
| WRK-6 | Copy a previous workout to today, so users can repeat a routine in two taps. | P0 |
| WRK-7 | Workout history as a list and a calendar, with edit and delete. | P0 |
| WRK-8 | Per-workout summary: duration, total volume (7.8) and an informational calorie estimate (MET-based, 7.8). The estimate is never added to the calorie target. | P0 |
| WRK-9 | Workout status appears in the room: "Worked out today" with type and duration, plus a feed event, according to privacy settings (6.13). | P0 |
| WRK-10 | Workout works offline and syncs later. A simple running timer is available during a session. | P0 |
| WRK-11 | Saved routines (templates) and starting a workout from a routine. | P1 |
| WRK-12 | Rest timer between sets with a notification. | P1 |
| WRK-13 | Automatic personal-record detection (heaviest weight, best estimated 1RM, most reps) with a celebration in the room feed. | P1 |
| WRK-14 | Shared workouts: tag room members who trained with you. Each person receives a card and logs their own sets, the same way as shared meals. | P1 |
| WRK-15 | Import workouts from Health Connect and HealthKit, with duplicate detection. | P1 |
| WRK-16 | Workout programs (multi-week plans) and workout consistency inside the weekly score. | P2 |


### 6.7 Usernames, Invitations and Join Requests

Every user has a unique @username. People can be added to rooms by username, and every connection needs consent from the other side.


| ID | Requirement | Priority |
|---|---|---|
| USR-1 | Each user chooses a unique @username during account creation. Rules: 3 to 20 characters; letters, numbers, underscore and period; cannot start or end with a period or underscore; no consecutive periods. Uniqueness is case-insensitive. Reserved and offensive words are blocked. Availability is checked live as the user types. | P0 |
| USR-2 | A username can be changed once every 30 days (proposed). A released username is held for 30 days before others can claim it, to prevent impersonation. | P0 |
| USR-3 | Search by username: minimum 3 characters, prefix match, at most 10 results, showing avatar, nickname and @username only. Searching is rate-limited to prevent scraping. | P0 |
| USR-4 | Discoverability setting: "Who can find me by username" with options Everyone (default) or Nobody (only people with the invite link or code can reach me). | P0 |
| USR-5 | Room invitation: from a room, search a username and send an invitation. The recipient gets a push notification and an in-app request, and can Accept or Decline. Accepting adds them to the room (subject to room access, see SUB rules). | P0 |
| USR-6 | Join request: a user can search a person's @username or enter a room code and send a request to join that person's room. The room host (or the person, if the room has two members) approves or declines. | P0 |
| USR-7 | Requests inbox with Incoming and Outgoing tabs and statuses (Pending, Accepted, Not accepted, Expired, Cancelled). A declined request is shown to the sender neutrally as "Not accepted". | P0 |
| USR-8 | Pending invitations and requests expire after 14 days. The sender can cancel a pending request. Limits: 20 pending requests per user and 10 new requests per hour. | P0 |
| USR-9 | Block and report: a blocked user cannot find, invite or request the blocker. Users can report a username or profile. | P0 |
| USR-10 | Invite by link or code remains available as an alternative (see ROOM-2), for people who are not yet on the app. | P0 |
| USR-11 | Optional contacts-based "find friends" suggestion (explicit permission required). | P2 |


### 6.8 Rooms


| ID | Requirement | Priority |
|---|---|---|
| ROOM-1 | A user with room access (trial or paid) can create a room with a name. Maximum 10 members per room (proposed; configurable). | P0 |
| ROOM-2 | Ways to join: invitation by username (6.7), join request, shareable link, or short code. Links use Android App Links and iOS Universal Links with deferred deep linking, so the invite survives app installation. | P0 |
| ROOM-3 | Roles: Host and Member. Host can rename the room, regenerate or revoke the invite link, approve join requests, remove members, transfer hosting, and delete the room. Any member can leave. | P0 |
| ROOM-4 | If the host leaves, hosting transfers automatically to the longest-standing active member. | P0 |
| ROOM-5 | A user can belong to up to 3 rooms at once (proposed). | P0 |
| ROOM-6 | Room states: Active, Dormant and Archived (see Section 7.6). | P0 |
| ROOM-7 | A member whose access has lapsed sees a clear, non-shaming "Rejoin your room" screen. Other members see "Waiting for [name] to rejoin", never the reason. | P0 |
| ROOM-8 | Report, mute and block another member. Muting hides nudges, reactions and chat from that person for the muting user. | P0 |
| ROOM-9 | Room setting "Who can invite": Host only (default) or Any member. | P0 |
| ROOM-10 | "Pause my participation" (travel, illness): the user is excluded from room streak calculations and nudges for a chosen period without leaving. | P1 |


### 6.9 Room View (Partner Side-by-Side)


| ID | Requirement | Priority |
|---|---|---|
| RV-1 | The Room screen has four sections: Today (side-by-side), Chat, Progress and Members. | P0 |
| RV-2 | Header with room name, room streak and member avatars. | P0 |
| RV-3 | Side-by-side card for two people (me on the left, partner on the right): goal-completion ring (% of their own goal), steps, water, workout status, and a meal checklist for Breakfast, Lunch, Dinner and Snacks (logged or not). Extra is optional and is never shown as missing. | P0 |
| RV-4 | In rooms with more than 2 people, tapping or swiping an avatar switches the comparison to "me vs this person". An overview row shows everyone's completion at a glance. | P0 |
| RV-5 | Only data the other person has chosen to share is displayed. Hidden items show a neutral lock icon, never an empty or zero value. | P0 |
| RV-6 | Quick actions: nudge, react to a meal, log a shared meal, open chat. | P0 |
| RV-7 | Activity feed: logged meals, goals reached, workouts finished, streak milestones, challenge milestones. | P0 |
| RV-8 | Neutral colours: no red/green "winning/losing" styling between people. | P0 |
| RV-9 | Weekly room summary card every Monday (consistency, streak, highlights). | P1 |


### 6.10 Room Chat

Chat exists only inside a room and only room members can read or send. There is no global chat and no direct messaging outside rooms. In a two-person room, the room chat is effectively the partner chat.


| ID | Requirement | Priority |
|---|---|---|
| CHT-1 | One chat per room. Members can send text messages (up to 2,000 characters). | P0 |
| CHT-2 | Members can send images from the camera or gallery. Up to 5 images per message, each up to 10 MB original (JPEG, PNG, HEIC, WebP). Images are compressed on the device before upload (longest side about 1,600 px) and show upload progress with retry. | P0 |
| CHT-3 | Location data (EXIF) is stripped from every uploaded image on the device and again on the server. | P0 |
| CHT-4 | Full-screen image viewer with pinch to zoom and save to gallery. | P0 |
| CHT-5 | Messages show sender nickname and avatar, timestamp, and delivery status (sending, sent, failed with retry). Messages are queued offline and sent when the connection returns. | P0 |
| CHT-6 | Real-time delivery to online members; push notifications to offline members, with a per-room mute and an unread badge on the Room tab. | P0 |
| CHT-7 | A user can delete their own messages. A deleted message shows "Message deleted" to others and the stored image is removed. | P0 |
| CHT-8 | Report a message, and block or mute a member. Reported content goes to a moderation queue. Terms of use are accepted before the first message. | P0 |
| CHT-9 | Automatic system messages inside chat: member joined or left, room created, streak milestones. These can be muted in room settings. | P0 |
| CHT-10 | Only active members with room access can read or send. A member who leaves loses access immediately; their past messages remain visible to the room (shown with their nickname) unless they delete them first. | P0 |
| CHT-11 | Rate limits: 20 messages per minute per user and 30 images per hour per user. | P0 |
| CHT-12 | In a Dormant room (7.6), chat is read-only. | P0 |
| CHT-13 | Reply to a specific message, emoji reactions on messages, typing indicator, read receipts (user can turn them off), and editing within 15 minutes. | P1 |
| CHT-14 | Share a meal, workout or progress chart card into chat (respecting privacy settings). | P1 |
| CHT-15 | Search inside chat, voice notes and GIFs. | P2 |


> Because chat accepts user-uploaded images, both Apple and Google require reporting, blocking, content filtering and published contact information. These are included above and must pass store review.


### 6.11 Shared Meals


| ID | Requirement | Priority |
|---|---|---|
| SHR-1 | When logging, the user can tag room members who ate the same meal ("someone else ate this too"). | P0 |
| SHR-2 | Each tagged member receives a card: "[Name] logged Dinner with you. Add to your diary?" with the portion defaulting to the same quantity, which they can change before accepting. | P0 |
| SHR-3 | Accepting creates an independent entry in the member's own diary, in the same meal section by default, linked to the shared meal. Editing one person's entry never changes another's. | P0 |
| SHR-4 | Declining or ignoring has no negative effect and no notification to the creator beyond the status "pending". | P0 |
| SHR-5 | Optional auto-accept for specific members (e.g., a partner you always eat with). | P1 |


### 6.12 Nudges, Reactions and Notifications


| ID | Requirement | Priority |
|---|---|---|
| SOC-1 | Nudge: a one-tap, pre-written, friendly message (e.g., "Rahul logged lunch. Time for yours?"). Limit: 2 nudges per recipient per day; the recipient can mute nudges per room. | P0 |
| SOC-2 | Reactions on shared items (meals, workouts, milestones) from a fixed set of 5 reactions. | P0 |
| NTF-1 | Notification types: meal reminders (user-set times), water reminders, fasting reminders (start, end, eating window closing), partner logged, partner finished a workout, nudge received, chat message, invitation or join request received and accepted, streak at risk (evening), weekly summary, leaderboard result, trial ending (days 2 and 3), subscription lapse or payment issue. | P0 |
| NTF-2 | Per-type toggles, per-room chat mute, quiet hours, and a single "pause all" option. | P0 |
| NTF-3 | Notification copy is supportive and never reveals another person's calorie numbers; chat notifications can hide message previews. | P0 |


### 6.13 Privacy Controls

Sharing is configured per room and per data type. Defaults are conservative. The same settings control the room view, the feed and the room progress charts.


| Data type | Default in a room | Options |
|---|---|---|
| Logged-today status and streak | Shared | Shared / hidden |
| Goal completion (% of own goal) | Shared | Shared / hidden |
| Steps and distance | Shared (proposed) | Shared / hidden |
| Water intake | Shared (proposed) | Shared / hidden |
| Workout done today (type, duration) | Shared (proposed) | Shared / hidden |
| Workout details (exercises, sets, weights) | Hidden | Shared / hidden |
| Calories and macros totals | Hidden | Shared / hidden |
| Individual meals and photos | Hidden | Share per meal / always / never |
| Weight number | Hidden | Hidden by default; sharing is an explicit opt-in |
| Weight progress (change and % towards goal) | Hidden | Shared / hidden |
| Fasting status and history | Hidden | Hidden / share "fasting now or completed today" |
| AI coach conversations | Private to the user | Never visible to room members; user can delete history |
| Who can find me by username | Everyone | Everyone / Nobody |
| Chat images | Visible only to room members | Not configurable; deleted on request |


| ID | Requirement | Priority |
|---|---|---|
| PRV-1 | Privacy settings screen under Me and a quick eye icon on shared items showing what the other person can see. | P0 |
| PRV-2 | Changes apply immediately and retroactively hide previously shared items from the room view, feed and charts. | P0 |
| PRV-3 | A user can see exactly what each room member currently sees about them ("preview as partner"). | P1 |


### 6.14 Streaks and Consistency


| ID | Requirement | Priority |
|---|---|---|
| STR-1 | Personal streak: consecutive logged days (definition in Section 7.4). | P0 |
| STR-2 | Room streak: consecutive days on which every active, non-paused member had a logged day. | P0 |
| STR-3 | Weekly Consistency Score (0 to 100) per user using the formula in Section 7.3. | P0 |
| STR-4 | Streak freeze: one per week to protect a streak on a missed day. | P1 |


### 6.15 Progress Graphs

Progress is shown for the user individually and for everyone in a room. All graphs read from precomputed daily summaries so they load quickly.


### Individual progress (Progress tab)


| ID | Requirement | Priority |
|---|---|---|
| PRG-1 | Date ranges for every graph: 7 days, 30 days, 90 days, 6 months, 1 year and All time. | P0 |
| PRG-2 | Weight: raw points plus 7-day moving average, a goal line, and a summary of start weight, current weight, total change (kg and %), weekly pace and projected date to reach the target (7.8). | P0 |
| PRG-3 | Calories: daily intake vs target, weekly average, and adherence (goal days out of logged days). | P0 |
| PRG-4 | Macros: average protein, carbs and fat per day vs targets. | P0 |
| PRG-5 | Steps and distance vs goal, with weekly averages. | P0 |
| PRG-6 | Water intake vs goal. | P0 |
| PRG-7 | Workouts: sessions per week, total duration, total volume, and per-exercise progression (heaviest weight and estimated 1RM over time). | P0 |
| PRG-8 | Consistency score history and streak history. | P0 |
| PRG-9 | Goal progress: percentage of the way from starting weight to target weight (7.8). | P0 |
| PRG-10 | Tap a point to see that day's details. Clear empty states explain what to log to see a chart. | P0 |
| PRG-11 | Auto-generated weekly and monthly summary text built from the numbers (for example average calories vs target, days logged, weight change, workouts). | P1 |
| PRG-12 | Body measurement charts and progress photo comparison (private). | P1 |
| PRG-13 | Shareable progress card image with privacy-safe contents. | P1 |


### Room progress (Room > Progress)


| ID | Requirement | Priority |
|---|---|---|
| RPG-1 | A metric selector (Consistency, Weight change, Calories vs target, Steps, Water, Workouts) draws one line or bar per member. Member chips let the user show or hide people. | P0 |
| RPG-2 | Weight is shown as change since each person's own start (kg and %) and as progress towards their own goal (%), never as the raw weight number unless that member opted in. Progress towards own goal is the default comparable metric because members may have opposite goals. | P0 |
| RPG-3 | Only shared data is drawn. A member who hides a metric appears with a lock on that metric and is left out of that chart. Hidden values cannot be inferred from other charts. | P0 |
| RPG-4 | A summary table for the chosen period shows each member's weight change, average calories vs target, average steps, workouts, and consistency. The default order is me first, then alphabetical. Sorting by rank is allowed only on Consistency; the table never ranks by weight lost or calories eaten. | P0 |
| RPG-5 | Same date ranges as individual graphs, plus "Since the room started". | P0 |
| RPG-6 | Milestone markers on charts (joined room, started challenge, hit streak). | P1 |


### 6.16 Leaderboards


| ID | Requirement | Priority |
|---|---|---|
| RNK-1 | Weekly leaderboard ranked by Weekly Consistency Score. Never ranked by weight lost, calories eaten, or body measurements. | P0 |
| RNK-2 | Divisions: Cutting, Bulking, Maintain, and Beginner (first 28 days). | P0 |
| RNK-3 | Users are placed into cohorts of about 100 within a division (matched by time zone and region where possible) so new users do not compare themselves with the global top 1%. | P0 |
| RNK-4 | Display top 10 plus the user's own position, showing nickname, avatar and score only. | P0 |
| RNK-5 | Weekly reset on Monday with a results recap. Ties are broken by logged days, then earliest completion. | P0 |
| RNK-6 | Opt out of leaderboards in settings. Opted-out users are hidden entirely. | P0 |
| RNK-7 | A short info note explains the ranking rules (consistency, not restriction). | P0 |
| RNK-8 | Room-only leaderboard for rooms with 3+ members. | P1 |


### 6.17 Challenges and Occasion Plans


| ID | Requirement | Priority |
|---|---|---|
| CHL-1 | Seasonal challenges (Winter Arc, New Year, summer cut, etc.): fixed duration (30, 60 or 90 days), joined individually or as a room, scored on consistency, steps, workout days or protein-goal days. Never on lowest calories. | P1 |
| CHL-2 | Occasion plans: the user chooses an event (birthday, wedding, trip, New Year) and a date. The app creates a gentle timeline with weekly targets inside the safe rate caps of Section 7.2 and turns it into a room challenge. | P1 |
| CHL-3 | If the requested change is unrealistic for the time available, the app says so honestly and proposes a realistic plan instead of a crash plan. | P1 |
| CHL-4 | Admin tools to create, schedule and retire challenges without an app release. | P1 |


### 6.18 Subscription and Paywall


| Region | Monthly | 3 months | Annual |
|---|---|---|---|
| India | ₹99 | ₹249 | ₹799 (proposed) |
| International | $4.99 | $12.99 | $34.99 (proposed) |
| Lower-income countries | Regional pricing set per country in Play Console and App Store Connect | Regional pricing | Regional pricing |


| ID | Requirement | Priority |
|---|---|---|
| SUB-1 | Pricing is per user, not per room. Premium (any paid plan) includes rooms, room chat, room progress and the AI coach. Only users with room access (active room trial or Premium) can create, join, be invited to, chat in, or view rooms. | P0 |
| SUB-2 | Every new user gets one 3-day free trial of room features. The trial starts the first time the user creates or joins a room (proposed; previously it started at account creation). It includes one room of 2 people, room chat and streaks. It does not include the AI coach. | P0 |
| SUB-3 | After the trial, all personal tracking (food, water, steps, workouts, fasting, recipes, weight and personal progress graphs) stays free (proposed). Rooms, room chat, room progress and the AI coach require Premium. | P0 |
| SUB-4 | Purchases use Google Play Billing and Apple In-App Purchase only (not Apple Pay). RevenueCat (recommended) provides the SDK and webhooks, and a single server-side entitlements table (with a source column) is the source of truth. Stores take about 15% (Apple Small Business Program; Google subscription rate), so prices are set accordingly. | P0 |
| SUB-5 | Paywall appears when a user without access taps Room, accepts an invitation, or tries to create or join a room (from day 4), with soft banners on days 2 and 3 showing days left. For invited users the paywall is shown after the room preview, not before. | P0 |
| SUB-6 | Paywall shows the monthly, 3-month and annual plans with localised prices, billing terms, "Restore purchases", and what stays free. | P0 |
| SUB-7 | Payment grace: if a renewal fails, access continues during the store's grace period and the user sees a clear payment-fix message. | P0 |
| SUB-8 | Subscription management and cancellation link in Me. | P0 |
| SUB-9 | Entitlement checks happen on the server for every room, chat and progress read and write, not only in the app. | P0 |
| SUB-10 | Promotional and gift codes. | P1 |
| SUB-11 | Annual plan available at launch, shown as the best-value option with the saving against 12 monthly payments. | P0 |
| SUB-12 | The AI coach is Premium-only with no free trial. Free and trial users see a locked preview and the paywall. The server rejects every coach request without Premium. | P0 |
| SUB-13 | Web checkout through Dodo Payments (merchant of record) once a web app exists. Dodo webhooks write to the same entitlements table. The app does not link or steer users to web checkout except where store rules allow it. | P2 |


> India note: UPI autopay failures cause involuntary churn. The 3-month and annual prepaid plans reduce repeated autopay dependency and should be promoted as better value. Margin check: after GST and a 15% store fee, ₹799 a year nets roughly ₹48 a month, and that must also cover infrastructure and AI costs. Validate with real AI cost data before fixing the annual price.


### 6.19 Settings and Support


| ID | Requirement | Priority |
|---|---|---|
| SET-1 | Units (metric or imperial), language, time zone, notification settings, health sync status, username and discoverability. | P0 |
| SET-2 | Help centre, contact support, report a problem (with log attachment), and report a wrong food entry. | P0 |
| SET-3 | Privacy policy, terms, health disclaimer, community guidelines, and data-source attributions (e.g., Open Food Facts). | P0 |


### 6.20 Fasting Tracker

An optional timer for people who follow an eating window. It is off by default and hidden for users whose screening answers say fasting is not suitable.


| ID | Requirement | Priority |
|---|---|---|
| FST-1 | Fasting is optional and off by default. The user turns it on from Me or from a Today card, shown only if screening (ONB-11) allows it. | P0 |
| FST-2 | Protocols: 12:12, 14:10, 16:8, 18:6, 20:4, and a custom eating window. The longest planned fast at launch is 20 hours; OMAD and multi-day fasts are not offered (proposed). | P0 |
| FST-3 | Start and end a fast with one tap, with elapsed and remaining time on Today. Start and end times can be edited afterwards. | P0 |
| FST-4 | Scheduled mode: the user sets a daily eating window and the app works out fasting and eating states automatically. | P0 |
| FST-5 | Logging food while fasting shows a gentle, non-blocking prompt ("Log this and end your fast?"). Logging is never blocked. | P0 |
| FST-6 | Reminders for fast start, fast end and eating window closing, using local notifications and respecting quiet hours. | P0 |
| FST-7 | History and stats: list of fasts, average duration, completion rate, and a fasting-hours graph in Progress. | P0 |
| FST-8 | Fasting streak is personal only. Fasting is never part of the consistency score, leaderboards or challenges. | P0 |
| FST-9 | Fasting data is hidden from rooms by default; the user may opt in to share "fasting now" or "completed today". | P0 |
| FST-10 | No health claims in copy: no fat-burning zones, ketosis or autophagy stages. | P0 |
| FST-11 | Safety: 18+ only; check-in when a fast runs past its plan or 20 hours; strong end-fast prompt at 24 hours; fasting features pause if the low-intake check-in triggers; calorie floors and targets are unchanged by fasting. | P0 |
| FST-12 | Timers use stored UTC timestamps, not counters, so they stay correct when the app is closed, the phone restarts or the time zone changes. | P0 |


### 6.21 Recipe Library

A library of original recipes written by the CaliPartner team. It is not user-generated content.


| ID | Requirement | Priority |
|---|---|---|
| RCP-1 | Launch library of at least 150 original recipes (proposed), focused on Indian and regional food, high-protein, cutting-friendly and bulking-friendly meals, with vegetarian, eggetarian, vegan and non-vegetarian tags. | P0 |
| RCP-2 | Each recipe has a title, photo, description, cuisine, diet tags, meal type, prep and cook time, difficulty, servings, ingredients (grams and household measures), steps, tips and nutrition per serving (calories, protein, carbs, fat, fibre). | P0 |
| RCP-3 | Nutrition per serving is calculated automatically from the linked ingredient foods and quantities when the recipe is published, and stored as a snapshot. Manual overrides require a written reason. | P0 |
| RCP-4 | Browse and search by name, ingredient and tag. Filters: meal type, diet, calorie range, minimum protein, time and cuisine. | P0 |
| RCP-5 | Servings scaler: changing servings scales the ingredient amounts; nutrition per serving stays the same. | P0 |
| RCP-6 | "Log this recipe": choose servings (for example 1.5) and a meal section, creating a diary entry with a nutrient snapshot. Shared-meal tagging works as for any food. | P0 |
| RCP-7 | Favourites and recently viewed. Saved recipes work offline (text cached locally, images cached after first view). | P0 |
| RCP-8 | Authoring workflow: the team writes recipes in a structured file (JSON or CSV) or admin tool. A validation script checks that every ingredient maps to a food, units are valid, nutrition computes and an image exists. Recipes have draft and published status and appear without an app update. | P0 |
| RCP-9 | Report an error in a recipe. | P0 |
| RCP-10 | All recipes are free for every user (proposed). The AI coach can recommend them. | P0 |
| RCP-11 | Only original text and original photos are used; nothing is copied from other sites or books. | P0 |
| RCP-12 | Recipe collections (for example "High-protein breakfasts") and "fits my day" suggestions that filter recipes to the user's remaining calories and protein. | P1 |


### 6.22 AI Coach (Premium)

A chat assistant inside the app for nutrition and fitness questions. It is available only on a paid plan, with no free trial.


| ID | Requirement | Priority |
|---|---|---|
| AIC-1 | Premium only. The server checks entitlement on every request; trial and free users get a locked preview and the paywall. | P0 |
| AIC-2 | Chat screen with conversation history and suggested prompts (for example "How am I doing this week?", "What should I eat tonight to hit my protein?", "Explain my calorie target"). | P0 |
| AIC-3 | The coach knows the user's own data through a compact server-built summary: goal, targets, today's totals, 7-day averages, weight trend, workouts, steps and water. It never receives other users' or room members' data. | P0 |
| AIC-4 | All numbers come from the app's deterministic calculators and database tools (targets, remaining macros, recipe nutrition). The model must not invent or recompute targets; if a tool fails it says it cannot work the number out. | P0 |
| AIC-5 | The coach can suggest recipes from our library and foods from the database, with a "Log it" button. | P0 |
| AIC-6 | Safety policy: never suggests intake below the calorie floor; declines crash diets, extended fasting, purging, laxatives and weight-loss supplements; responds supportively with resources to signs of disordered eating or self-harm; advises a professional for medical conditions; no diagnosis. | P0 |
| AIC-7 | Limits: 30 messages per user per day (proposed), a maximum message length, and a capped context window. A clear message appears when the limit is reached. Limits are remotely configurable. | P0 |
| AIC-8 | Cost controls: calls are server-side only, tokens are logged per user and day, and a global monthly budget triggers a cheaper model and then a safe shutdown with a friendly message. | P0 |
| AIC-9 | Consent screen before first use explaining what data is sent to the AI provider. The provider's terms must exclude training on user data (to verify). Users can delete their conversation history. Conversations are never visible to room members. | P0 |
| AIC-10 | Responses stream in, with a first token typically under 3 seconds. Each answer has thumbs up/down and a report button, and is labelled as AI that can make mistakes and is not medical advice. | P0 |
| AIC-11 | Logging food by chatting ("I ate 2 rotis and dal"), with a confirmation step before saving. | P1 |
| AIC-12 | Proactive weekly insights by push, and photos in coach chat. | P2 |


### 6.23 Ratings and Feedback


| ID | Requirement | Priority |
|---|---|---|
| RAT-1 | "Rate us": the native in-app review prompt appears at the end of onboarding, right after the user sees their personal targets (the earliest point where they have received value). | P0 |
| RAT-2 | A second opportunity after a positive moment (for example 7 days after install with 5 or more logged days, or a first 3-day room streak), only if the prompt has been shown fewer than twice. | P0 |
| RAT-3 | A permanent "Rate CaliPartner" item in Me. | P0 |
| RAT-4 | Use only the platform review APIs (StoreKit review request on iOS, Google Play In-App Review on Android). No custom star prompts that route unhappy users elsewhere, no rewards for ratings, and no nagging. The OS may choose not to show the prompt, which is fine. | P0 |
| RAT-5 | Never prompt during logging, chat, a paywall, or straight after an error. | P0 |
| RAT-6 | A separate, optional "Send feedback" form in Me. It is not tied to the rating prompt. | P0 |


### 6.24 Navigation and Information Architecture Update

Five tabs remain. Recipes and the AI coach are reached from Today, the Log sheet and Me rather than from new tabs.


| Tab | Contents |
|---|---|
| Today | Diary with 5 meal sections, calorie and macro rings, cards for water, steps and distance, workouts and fasting; room avatar strip; entry points to Recipes and Ask Coach. |
| Room | Segments: Today (side-by-side), Chat, Progress, Members. Requests inbox and invite actions. |
| + Log (center) | Quick add sheet: Food (Search, Scan, Photo, Previously logged, My Foods, Recipes), Workout, Water, Weight, Fast. |
| Progress | Segments: My Progress (graphs), Leaderboard, Challenges. |
| Me | Profile and username, goals and rate, privacy, subscription and plans, fasting settings, AI coach history and consent, rate us and feedback, settings, requests inbox. |


### 6.25 Acceptance Criteria for Core Flows

- **First log: **a new user can open the app, complete onboarding, and save a first meal within 90 seconds without creating an account.
- **Targets: **for the same inputs, the app always produces the same maintenance calories, daily calories per rate and macros, matching the worked example in Section 7.2 to the nearest kcal.
- **Previously logged: **after logging a custom food once, it appears in Previously logged, and a single tap on + adds it again with the last-used quantity to the chosen section.
- **Username request: **searching an exact @username, sending an invitation, and accepting it on the other phone puts both users in the same room within 5 seconds of acceptance (subject to room access).
- **Invite link: **tapping an invite link on a device without the app opens the store, and after installation lands the user on the room preview with the inviter's name.
- **Side-by-side: **when one member logs a meal and shares it, the other member's room view updates within 5 seconds when both are online.
- **Chat: **a text or image message sent by one member appears for an online member within 2 seconds; a non-member can never fetch the message or the image URL.
- **Privacy: **a hidden data type never appears in any API response to other room members, including in room progress charts, not just in the UI.
- **Workout: **logging a strength workout with sets works offline, shows last-time performance for each exercise, and appears as "worked out today" in the room once online.
- **Shared meal: **tagging a partner creates a pending card for them; accepting with a different quantity creates a separate entry with correctly scaled nutrients.
- **Entitlement: **after a subscription lapses, the user keeps personal tracking, loses room and chat access immediately on the server, and sees the rejoin screen; the room moves to the correct state for the other members.
- **AI coach: **a user in the 3-day trial or on the free plan cannot get a coach reply (the server rejects it) and sees the locked preview; a Premium user gets a streamed answer built only from their own data; asked for an 800 kcal day, the coach declines and offers a safe alternative.
- **Fasting: **a 16:8 fast started at 8 PM shows the correct elapsed time after the app is killed and reopened, and an end-of-fast reminder fires on time.
- **Recipes: **publishing a recipe calculates its nutrition automatically; logging 1.5 servings creates an entry with 1.5 times the per-serving nutrition.
- **Ratings: **the native review prompt appears at most once during onboarding and never in the flows listed in RAT-5.
- **Plans: **the paywall shows monthly, 3-month and annual plans with localised prices; buying annual grants one year of access, and restore purchases works.

## 7. Business Rules and Logic


### 7.1 Access and entitlement states


| State | Rooms and chat | Personal tracking | AI coach | Transition |
|---|---|---|---|---|
| Free (trial not started) | Can create or join a room, which starts the trial | Yes | No (locked preview) | First room create or join starts the 3-day trial |
| Trial (3 days) | Full room and chat access (one room of 2) | Yes | No (locked preview) | Ends after 3 days unless the user subscribes |
| Free (trial used) | No create, join, view or chat | Yes (proposed) | No (locked preview) | Subscribes to move to Paid |
| Paid | Full access | Yes | Yes (daily cap) | Cancels or payment fails: moves to Grace, then Free |
| Grace | Full access | Yes | Yes | Payment recovered: Paid. Grace expires: Free |


### 7.2 Calorie, macro and weekly-rate calculation (deterministic)

Targets are calculated with fixed formulas. The same inputs always give the same outputs, and no AI is involved.


### Step 1: Maintenance calories (TDEE)

Age comes from the date of birth. Convert pounds, feet and inches to kg and cm first. BMR uses the Mifflin-St Jeor equation:


| Sex | BMR formula |
|---|---|
| Male | BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age + 5 |
| Female | BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age - 161 |
| Other / prefer not to say | BMR = 10 x weight(kg) + 6.25 x height(cm) - 5 x age - 78 (average of the two constants) |
| If body-fat % is entered | Katch-McArdle: BMR = 370 + 21.6 x lean body mass (kg), where lean mass = weight x (1 - body-fat%) |


| Activity level | Description | Multiplier |
|---|---|---|
| Sedentary | Desk job, little or no exercise | 1.2 |
| Light | Exercise 1 to 3 days per week | 1.375 |
| Moderate | Exercise 3 to 5 days per week | 1.55 |
| Very active | Exercise 6 to 7 days per week | 1.725 |
| Extra active | Physical job plus training | 1.9 |

**TDEE = BMR x activity multiplier** (rounded to the nearest kcal). The activity question tells users to choose based on a typical week including their workouts, because exercise calories are not added back later.


### Step 2: Calories for a weekly rate

One kilogram of body weight change is treated as 7,700 kcal (3,500 kcal per lb).

**Daily change = rate (kg/week) x 7,700 / 7 = rate x 1,100**


| Weekly rate | Daily change from maintenance | In pounds |
|---|---|---|
| 0.25 kg/week | 275 kcal | about 0.55 lb |
| 0.5 kg/week | 550 kcal | about 1.1 lb |
| 0.75 kg/week | 825 kcal | about 1.65 lb |
| 1.0 kg/week | 1,100 kcal | about 2.2 lb |

- Cut: daily target = TDEE minus the daily change. Bulk: daily target = TDEE plus the daily change. Maintain: daily target = TDEE.
- Preset rates offered: Cut 0.25, 0.5, 0.75, 1.0 kg/week; Bulk 0.25, 0.5 kg/week and higher up to the cap. Pound-based users see 0.5, 1, 1.5 and 2 lb/week equivalents.

### Step 3: Safety rules applied to every plan


| Rule | Behaviour |
|---|---|
| Calorie floor (hard) | Daily target never below 1,200 kcal (female), 1,500 kcal (male) or 1,350 kcal (other). If a rate would go below, it is shown as unavailable with the fastest allowed rate. |
| Weekly rate cap (hard) | Rate is limited to 1% of current body weight per week for both cuts and bulks. |
| Lean-gain advisory | For bulks above 0.5% of body weight per week, show a notice that faster gain is mostly fat. Not blocked. |
| Large-deficit advisory | If the deficit is more than 25% of TDEE, show a notice. Not blocked unless the floor applies. |
| BMI guard | Cut plans are not offered when BMI is below 18.5; show a supportive message instead. |
| Target date check | Required rate = (target weight - current weight) / weeks until the target date. If it exceeds the cap, show the earliest realistic date = today + weight difference / cap. |
| Recompute triggers | Targets are recalculated when weight changes by 2 kg or more, or when the user edits goal, rate or activity level. The user confirms the new targets before they apply. |


### Step 4: Macro targets

- Protein: cut 2.0 g/kg, maintain 1.6 g/kg, bulk 1.8 g/kg of current body weight.
- Fat: 25% of daily calories, but never below 0.6 g/kg.
- Carbohydrates: the remaining calories. Energy values are 4 kcal/g for protein and carbs, 9 kcal/g for fat.
- Users can adjust macros within limits (protein not below 1.2 g/kg, fat not below 0.6 g/kg).

### Worked example

Male, 25 years, 175 cm, 70 kg, moderately active (1.55). BMR = 700 + 1,093.75 - 125 + 5 = 1,674 kcal. TDEE = 1,674 x 1.55 = 2,594 kcal.


| Goal and rate | Daily change | Target kcal | Result |
|---|---|---|---|
| Cut 0.25 kg/week | -275 | 2,319 | Available |
| Cut 0.5 kg/week | -550 | 2,044 | Available |
| Cut 0.75 kg/week | -825 | 1,769 | Available |
| Cut 1.0 kg/week | -1,100 | 1,494 | Unavailable: below the 1,500 kcal floor |
| Maintain | 0 | 2,594 | Available |
| Bulk 0.25 kg/week | +275 | 2,869 | Available |
| Bulk 0.5 kg/week | +550 | 3,144 | Available (advisory: above 0.5% body weight per week) |
| Bulk 0.75 kg/week | +825 | 3,419 | Unavailable: above the 1% cap (0.70 kg/week) |

Macros for the Cut 0.5 kg/week plan (2,044 kcal): protein 2.0 x 70 = 140 g (560 kcal); fat 25% = 511 kcal = 57 g; carbs = 2,044 - 560 - 511 = 973 kcal = 243 g.


### Step 5: Adaptive recalibration (P1)

Formulas give a good starting estimate, but real maintenance can differ by 10 to 15%. Every 14 days the app can compare what happened with what was expected:

- Eligibility: at least 10 logged days and at least 4 weigh-ins in the 14-day window.
- Observed TDEE = average daily calories logged - (change in 7-day-average weight in kg x 7,700 / days in the window).
- New TDEE = 0.7 x current TDEE + 0.3 x observed TDEE, with the change limited to 10% per update. The safety rules in Step 3 still apply.
- The app shows the old and new targets and the reason; the user must accept before the target changes.

### 7.3 Weekly Consistency Score

A logged day requires at least 2 food entries (in any of the five sections) and calories logged of at least 50% of the day's target. This stops one snack from counting as a full day.

A goal day is a logged day where calories fall inside the goal range for the user's goal:


| Goal | Goal range (share of daily target) |
|---|---|
| Cutting | 85% to 105% |
| Bulking | 95% to 115% |
| Maintain | 90% to 110% |

**Weekly Consistency Score = 100 x ( 0.4 x logged days / 7 + 0.6 x goal days / 7 )**

- Capped at 100. Overshooting a goal never earns extra points.
- Eating below the lower bound of the range does not count as a goal day, so undereating can never raise the score.
- Workout days and protein-target days are optional bonuses for later phases (P2).

### 7.4 Streak rules

- A personal streak continues when the user has a logged day. It resets at the end of the first day with no logged day (unless a freeze is applied).
- The room streak continues on days when all active, non-paused members have a logged day.
- Days are evaluated in each user's local time zone.

### 7.5 Leaderboard rules

- Weeks run Monday to Sunday in the user's local time zone. Results are finalised after a 24-hour grace period so late time zones are included.
- Eligibility: users with room access or an active trial who logged on at least 3 days in the week.
- Division is taken from the user's goal at the start of the week. Users in their first 28 days are placed in Beginner.

### 7.6 Room lifecycle


| State | Condition | Behaviour |
|---|---|---|
| Active | 2 or more members have room access | Everything works normally, including chat |
| Dormant | Fewer than 2 members have room access | Remaining member sees the room read-only (including chat) with a "Waiting for your partner" card and an invite button. Lapsed members' data is frozen. Lasts up to 30 days (proposed). |
| Archived | Dormant for more than 30 days or deleted by host | Hidden from lists. Data and chat images retained for 90 days (proposed) so a returning member can restore it, then deleted. |


### 7.7 AI photo logging limits

- Trial users: up to 3 AI scans per day. Paid users: up to 15 per day (both proposed and tunable by remote config).
- Free users after trial: manual, search, barcode and previously-logged foods only, or a small daily allowance if costs allow.
- AI calls go through the backend, never directly from the app. Food photos are deleted after processing unless the user chooses to share the photo to a room or chat.

### 7.8 Derived metrics and formulas


| Metric | Formula |
|---|---|
| Stride length | Height (cm) x 0.415 for male, x 0.413 for female, x 0.414 for other |
| Distance from steps | Steps x stride length (cm) / 100,000 = km |
| Walking calories (informational) | 0.5 x weight (kg) x distance (km); the constant is proposed and tunable |
| Workout calories (informational) | MET x weight (kg) x duration (hours), using standard MET values per activity type and intensity |
| Workout volume | Sum over all sets of (reps x weight) |
| Estimated 1RM (Epley) | Weight x (1 + reps / 30), used for sets of 12 reps or fewer |
| Default water goal | 35 ml x body weight (kg), rounded to the nearest 250 ml, minimum 1,500 ml, maximum 4,000 ml |
| Weight trend | 7-day moving average of weigh-ins (uses the raw value when fewer than 3 entries are in the window) |
| Weekly pace | (trend weight today - trend weight 14 days ago) / 2 weeks, in kg per week |
| Projected date to target | Today + (target weight - trend weight) / weekly pace, shown only when the pace points towards the target and is at least 0.05 kg/week; otherwise "not enough trend yet" |
| Goal progress % | (starting weight - current trend weight) / (starting weight - target weight) x 100, limited to 0 to 100; works for cuts and bulks |
| Calorie adherence % | Goal days / logged days x 100 |


> Calories burned by workouts and steps are shown for information only and are not added to the daily calorie target.


### 7.9 Fasting rules

- A fast is stored as a start timestamp, a planned duration and an optional end timestamp in UTC. Elapsed time is always computed from the clock, never from a counter.
- Planned fasts are limited to 20 hours at launch. If a fast runs more than 2 hours past plan, or past 20 hours, show a check-in. At 24 hours show a strong prompt to end the fast.
- A fast is Completed if it ends at or after its planned duration; otherwise it is shown neutrally as Ended early. There are no penalties or red warnings for ending early.
- The fasting streak counts consecutive days with a Completed planned fast and is personal only.
- Fasting never changes calorie targets, calorie floors or the consistency score.
- Fasting is hidden if screening shows pregnancy or breastfeeding, diabetes or medication affecting food, or a history of an eating disorder, and is paused if the low-intake check-in triggers.

### 7.10 AI coach rules

- Entitlement: the server allows requests only for Paid or Grace users and returns a standard "premium required" response otherwise.
- Limits (proposed, remotely configurable): 30 messages per user per day, 1,000 characters per message, and context limited to the last 20 messages plus the compact data summary.
- Data summary: goal and rate, daily targets, today's totals, 7-day averages, weight trend, workout count, steps and water averages. No names or data of other users.
- Tools: targets, remaining macros, food and recipe search and recipe nutrition are exposed as server tools. The model quotes tool results rather than doing the arithmetic itself.
- Safety policy: refuse or redirect crash diets and intake below the floor, extended fasting, purging or laxatives, and weight-loss supplements; respond with care and resources to disordered-eating or self-harm signals; recommend a professional for medical questions.
- Untrusted text (food names, recipe text, user notes) is treated as data, never as instructions.
- Budget: per-user daily token cap, a global monthly budget that first switches to a cheaper model and then disables the coach with a friendly message, and an alert to the team.
- Retention (proposed): conversations kept 90 days unless the user deletes them sooner; usage rows kept for cost tracking.

## 8. Privacy, Safety and Compliance


### 8.1 Healthy-use safeguards

- 18+ only for launch. This also avoids the stricter parental-consent rules for minors under India's DPDP Act (confirm with counsel).
- Calorie floors, rate caps and BMI guard from Section 7.2.
- No ranking, badge, challenge or celebration based on lowest calories, most weight lost or body measurements. No public display of body weight. Room progress charts use each person's own goal as the baseline.
- Low-intake check-in: if logged intake stays below the calorie floor on 5 of 7 days, show a non-judgmental message with support resources, and do not count those days as goal days.
- Supportive copy throughout; no shaming for missed days, no "you are behind" comparisons between people.
- Health disclaimer in onboarding and settings: the app is not medical advice; people who are pregnant, have a medical condition, or have or suspect an eating disorder should consult a professional.
- Region-appropriate support resources (eating-disorder and mental-health helplines), which the team must source and keep current.
- Fasting safeguards: optional, off by default, 18+, screening questions, 20-hour planned limit, no health claims, never part of rankings or challenges (see 6.20 and 7.9).
- AI coach safeguards: premium-only, calorie-floor and crash-diet refusals, supportive handling of disordered-eating signals, medical disclaimers, and no access to other users' data (see 6.22 and 7.10).

### 8.2 Privacy and data protection

- Collect only the data needed. Treat food, weight, workout, chat and health-sync data as sensitive.
- Explicit, itemised consent for health-data access (Health Connect / HealthKit) and for sharing with room members.
- Server-side access control so a room member can only retrieve fields the owner has chosen to share, and chat messages and images only if they are a current member.
- Chat images are stored privately and served through short-lived signed links; EXIF location data is removed.
- Health data is never used for advertising or sold.
- AI processing: explicit consent before the coach or AI photo logging sends data to an AI provider; send only the minimum needed; confirm the provider does not train on the data; allow history deletion.
- Retention and deletion: account deletion removes personal data within a stated period; room and chat data follow Section 7.6.

### 8.3 Chat and user-generated content safety

- Terms of use and community guidelines accepted before first message; zero tolerance for harassment, explicit or illegal content.
- Report message or user, block, mute, host removal of members, and a moderation queue with response targets (proposed: 24 hours for reports).
- Automated scan of uploaded images for explicit content using a moderation provider (to be selected), plus a takedown process.
- Spam and abuse controls: rate limits on messages, images, invitations and username searches.
- Legal review of intermediary and user-content obligations in India and target markets.

### 8.4 Regulatory and store requirements to plan for


| Area | What to do |
|---|---|
| India: DPDP Act 2023 | Consent notice in plain language, purpose limitation, deletion and correction rights, grievance contact. |
| EU / UK: GDPR | Health data is a special category requiring explicit consent; data subject rights; lawful basis and DPA records. |
| Google Play | Health apps and Health Connect permission declarations, data safety form, user-generated content policy, in-app account deletion, Play Billing for subscriptions. |
| Apple App Store | HealthKit usage rules, privacy nutrition labels, user-generated content rules (filtering, reporting, blocking, contact info), in-app account deletion, Sign in with Apple, IAP for subscriptions, restore purchases. |
| Subscription rules | Clear price, billing period and cancellation info on the paywall. |
| Ratings and reviews | Use only the native review prompts. No incentives for ratings and no filtering of who is asked. |
| Tax (India) | GST treatment and store payouts to be confirmed with a CA. |
| Content licences | Open Food Facts (ODbL) requires attribution and share-alike obligations; verify IFCT, exercise library and any paid API terms. |


## 9. Non-Functional Requirements


| Area | Requirement |
|---|---|
| Performance | Cold start under 2.5 seconds on a mid-range Android phone. Re-logging a previously logged food in 2 taps or fewer. Search results in under 500 ms (p95) with instant local history. Room screen loads in under 1.5 seconds. Progress graphs for 90 days load in under 1.5 seconds. |
| Realtime | A partner's shared log appears within 5 seconds when both users are online. Chat messages are delivered within 2 seconds to online members. |
| AI coach latency | First streamed token typically under 3 seconds; a full answer within about 15 seconds; clear states when offline or rate limited. |
| Offline | Diary, previously logged foods, custom foods, water, workouts and logging work offline; sync with last-write-wins per entry and conflict-safe merges. Chat messages queue offline. |
| Reliability | API availability of 99.5% or better. Daily backups. Idempotent sync endpoints. |
| Security | TLS everywhere, encryption at rest, token-based auth with refresh, rate limiting on all endpoints (especially invites, searches, chat, nudges and AI), secrets never in the app binary, regular dependency scans. |
| Media storage | Chat images in private object storage with signed URLs and a CDN, lifecycle rules for deletion, and storage cost monitoring. |
| Scalability | Design for 100,000 users at launch scale; scheduled jobs for weekly scores and notifications must run in batches; chat tables designed for pagination (50 messages per page). |
| Battery and sensors | Step counting uses platform step APIs, not continuous GPS, to limit battery use. |
| Accessibility | Dynamic text sizes, screen-reader labels (TalkBack / VoiceOver), WCAG AA contrast, charts with text summaries, no meaning conveyed by colour alone. |
| Localisation | English at launch. Strings externalised from day one so Hindi, Telugu, Tamil and others can follow. Metric and imperial units; regional serving units. |
| Device support | Android 8.0 (API 26) and above; iOS 16 and above (confirm against the chosen framework). |
| Analytics and monitoring | Event tracking (Section 12), crash reporting, performance monitoring, and cost dashboards for AI, chat storage and database usage. |


## 10. Data Model (High Level)


| Entity | Key fields |
|---|---|
| User | id, username (unique, case-insensitive), nickname, avatar, date of birth, sex, height, goal type, time zone, country, trial_ends_at, leaderboard_opt_in, discoverable |
| GoalProfile | user_id, activity multiplier, weekly rate, calorie target, protein/carb/fat targets, step goal, water goal, target weight, target date, effective_from |
| Entitlement | user_id, plan, store (Play/Apple), status (trial/paid/grace/free), current_period_end, grace_until |
| Food | id, source (OFF/USDA/IFCT/user), name, brand, barcode, serving units, nutrients per 100 g, owner_id for custom foods |
| FoodEntry | id, user_id, food_id, meal section (breakfast/lunch/dinner/snacks/extra), quantity, unit, nutrient snapshot, logged_at, source (search/scan/photo/history/copy), shared_meal_id |
| UserFoodStats | user_id, food_id, use_count, last_used_at, last_quantity, last_unit, last_meal_section (powers Previously logged and suggestions) |
| WeightLog / WaterLog / ActivityDay | user_id, date, value; ActivityDay holds steps, distance, source |
| Exercise | id, name, muscle group, equipment, type, source (library/custom), owner_id |
| Workout | id, user_id, date, type, name, start time, duration, effort, notes, volume, estimated calories |
| WorkoutExercise / WorkoutSet | workout_id, exercise_id, order; set order, reps, weight, duration, distance |
| Room | id, name, host_id, invite_code, state, max_members, who_can_invite, created_at |
| RoomMember | room_id, user_id, role, status (active/locked/paused/left), joined_at, privacy settings per data type |
| RoomRequest | id, type (invitation/join_request), room_id, from_user, to_user, status, created_at, expires_at |
| ChatMessage | id, room_id, sender_id, text, created_at, deleted_at, reply_to (P1), edited_at (P1) |
| ChatAttachment | id, message_id, storage_path, width, height, size, moderation_status |
| ChatReadState | room_id, user_id, last_read_message_id (unread counts, receipts) |
| Report / Block | reporter_id, target type and id, reason, status; blocker_id, blocked_id |
| SharedMeal | id, room_id, creator_id, base_entry_id, participants with status (pending/accepted/declined) |
| RoomEvent | id, room_id, actor_id, type, payload, created_at (feed items) |
| Reaction / Nudge | id, room_id, from_user, to_user, target, type, created_at |
| DailySummary | user_id, date, calories, macros, steps, water, workout minutes, weight, logged_day flag, goal_day flag (precomputed for graphs) |
| WeeklyScore | user_id, week_start, score, division, cohort_id |
| Challenge / Participant | id, name, type, start/end, scope (room/global), rules; participant progress |
| Device / Notification settings | user_id, push token, platform, per-type toggles, per-room chat mute, quiet hours |
| FastingSettings / FastingSession | user_id, protocol, eating window; session start_at (UTC), planned_minutes, end_at, status (active/completed/ended_early) |
| Recipe / RecipeIngredient | recipe: id, title, description, cuisine, diet tags, meal type, times, servings, steps, image, status (draft/published), nutrition snapshot per serving; ingredient: recipe_id, food_id, quantity, unit, note |
| RecipeFavorite | user_id, recipe_id, created_at |
| CoachConversation / CoachMessage | conversation: id, user_id, created_at; message: role, content, tokens, feedback (up/down), created_at |
| AIUsage | user_id, day, feature (photo/coach), request count, tokens, estimated cost |
| ConsentRecord | user_id, type (health data, AI processing, chat terms), version, accepted_at |
| RatingPromptState | user_id, times_shown, last_shown_at, trigger |
| DeviceTrial | hashed device id, user_id, trial_started_at (trial-abuse control) |


## 11. Technical Approach and Integrations


| Area | Decision |
|---|---|
| Mobile app | React Native with Expo (TypeScript, Expo Router) using EAS development builds for Android and iOS. Health and sensor libraries need development builds, not Expo Go. |
| On-device data | SQLite with an outbox queue so logging is offline-first from the first feature, with idempotent client-generated IDs. |
| Backend and database | Supabase: Postgres, Auth, Realtime, Storage and Edge Functions. Create the project in the Mumbai region if most users are in India. Upgrade to Pro before charging real users (backups, no pausing). |
| Security model | Row Level Security on every table. Privacy toggles, room membership and entitlement checks are enforced in the database and server functions, never only in the app. Automated RLS tests are mandatory. |
| Login | Supabase Auth with email code, Google and Apple. No phone OTP. Custom SMTP through a transactional email provider (Resend or Brevo) with a verified domain, because the built-in sender is development-only. |
| Chat and realtime | Supabase Realtime channel per room; messages stored in Postgres with pagination; membership and entitlement checked on every read and write. |
| Images | Cloudflare R2 private bucket with signed links issued by an Edge Function after a membership check. Compress and make thumbnails on the phone and strip EXIF. Recipe photos use a public bucket with a CDN. |
| Subscriptions | Google Play Billing and Apple IAP through RevenueCat (free below $2,500 monthly tracked revenue, then 1%). Webhooks write to our own entitlements table. Dodo Payments is added later for web, writing to the same table. |
| Push and reminders | Firebase Cloud Messaging (Android, and iOS through APNs) for server-triggered pushes; local notifications for meal, water and fasting reminders. |
| Food data | Compact bundled Indian and popular foods for instant offline search, plus Open Food Facts, USDA FoodData Central and IFCT lookups cached in our database. Do not load the full public databases into Postgres. |
| Recipes | Postgres tables with nutrition calculated from linked foods at publish time; authored through an import and validation script or admin tool; images in R2. |
| AI | Server-side Edge Functions call a vision model (photo logging) and a text model (coach). API keys live in server secrets. Per-user caps, cost logging and a global budget switch. Coach uses tool calls into the deterministic calculators. |
| Calculations | A shared pure-TypeScript package (targets, macros, derived metrics) with golden tests that include the worked example in 7.2, used by both the app and the server. |
| Health and steps | Health Connect (Android) and HealthKit (iOS) through community libraries, with the phone's step sensor as a fallback. |
| Background jobs | Scheduled database or Edge Function jobs for daily summaries, streaks, weekly scores, request expiry and notification batches. |
| Charts | A React Native SVG-based charting library with text summaries for accessibility. |
| Analytics and quality | PostHog or Firebase Analytics, plus Sentry or Crashlytics. Admin tasks use Supabase Studio and scripts at first. |
| Deep links | Android App Links and iOS Universal Links. Deferred deep linking through a provider (for example Branch or AppsFlyer) is added during production preparation. Firebase Dynamic Links no longer exists. |
| Development workflow | AI coding agents in Antigravity (Sonnet 5.5 for build, Gemini Flash for UI), an independent GPT review after each phase, and real-device testing. See the Build Plan. |


## 12. Analytics Events


| Event | Key properties |
|---|---|
| onboarding_started / completed | goal type, rate chosen, time to complete |
| targets_calculated | goal, rate, floor_applied flag, cap_applied flag |
| first_meal_logged | method (search/scan/photo/custom/history), seconds since install |
| food_logged | method, meal section, room-shared flag |
| history_food_added | one-tap flag, sort mode, meal section |
| water_logged / steps_synced | amount, source |
| workout_logged | type, duration, exercises count, offline flag |
| username_set / changed | length, attempts |
| request_sent / accepted / declined / expired | type (invitation/join), time to respond |
| invite_created / invite_opened / invite_accepted | channel (username/link/code), room size, time to accept |
| room_created / room_joined / room_left | member count, role |
| chat_message_sent / chat_image_sent | room size, image count, length bucket |
| chat_reported / user_blocked | content type, reason |
| shared_meal_tagged / accepted / declined | participants, portion changed flag |
| nudge_sent / reaction_sent | room id, type |
| progress_viewed / room_progress_viewed | metric, date range |
| privacy_setting_changed | data type, new value |
| paywall_viewed / plan_selected / purchase_completed / purchase_failed | trigger, plan, region, day since signup |
| trial_day_n_active | day number, logged flag |
| subscription_lapsed / restored | reason, days subscribed |
| ai_scan_used / ai_result_edited | cap remaining, edit amount |
| leaderboard_viewed / opted_out | division, rank bucket |
| challenge_joined / completed (P1) | challenge id, scope |
| fast_started / ended / edited | protocol, planned minutes, completed flag |
| recipe_viewed / favorited / logged | recipe id, servings, meal section |
| coach_message_sent / coach_blocked_by_paywall / coach_limit_reached | tokens, safety flag, feedback |
| rating_prompt_requested | trigger (onboarding, day 7, streak), times shown |
| annual_plan_viewed / selected | region, price shown |


## 13. Build Phases and Milestones

The product will be built phase by phase with AI coding agents, with one independent review and a real-device test after each phase. Sizes are rough and depend on how many fix cycles each phase needs: S is a few days, M is 1 to 2 weeks, L is 2 to 4 weeks of focused work. The full prompts for each phase are in the CaliPartner Build Plan.


| Phase | Scope | Size |
|---|---|---|
| 0 | Foundation: monorepo, Expo app, Supabase project, tooling, CI, SQLite and navigation skeleton. | S |
| 1 | Login (email code, Google, Apple), profile, unique username, age gate, account deletion, RLS test harness. | M |
| 2 | Onboarding and the deterministic calorie, macro and weekly-rate calculator with golden tests. | M |
| 3 | Food database, food logging in 5 sections, previously logged, barcode, custom foods, offline-first sync layer. | L |
| 4 | Water, weight, steps and distance, with Health Connect and HealthKit. | M |
| 5 | Rooms: usernames, invitations and join requests, privacy controls, side-by-side view, shared meals, nudges and reactions, trial logic. Milestone: friends alpha. | L |
| 6 | Workout tracker and exercise library. | M |
| 7 | Progress graphs (personal and room), streaks, consistency score, leaderboards. | L |
| 8 | Room chat with images, reporting and blocking. | M |
| 9 | Push and local notifications. | M |
| 10 | Subscriptions: monthly, 3-month and annual plans, entitlements, paywall. Milestone: paid beta. | M |
| 11 | AI photo logging. | M |
| 12 | Recipe library (the team writes recipes in parallel). | M |
| 13 | Fasting tracker. | S |
| 14 | Premium AI coach. | M |
| 15 | Rate-us prompt, UI polish, accessibility, analytics and error monitoring. | M |
| 16 | Full review, security and privacy audit, hardening. | M |
| 17 | Production preparation and store submission. | M |

Milestones: friends alpha after Phase 5 (does the partner effect work?), paid beta after Phase 10, release candidate after Phase 16.

Beta exit criteria: at least 50 pairs or groups; paired retention at week 4 at or near target; no critical privacy, chat-access, entitlement or AI-safety bugs; crash-free sessions above 99%.

After launch (Phase 2 items): challenges and occasion plans, adaptive recalibration, routines, chat upgrades, coach food logging, widgets, more languages, and Dodo web checkout.


## 14. Risks and Mitigations


| Risk | Mitigation |
|---|---|
| Scope and timeline growth from building everything in one app | Core-loop alpha at week 14, strict P0/P1 split, shared calculation module, reuse components across food, workout and water logging. |
| One partner stops and the other loses interest | Useful solo mode, gentle nudges, chat, dormant-room design, pause option, "rejoin" screen, re-invite prompts. |
| Invited friend hits a paywall and leaves | Room preview before paywall, 3-day trial for every new user, clear free-versus-paid messaging. |
| Privacy concerns about sharing food, weight and photos | Conservative defaults, per-item controls, server-side enforcement, "preview as partner", private signed image links. |
| Chat abuse, harassment or unsafe images | Reporting, blocking, moderation queue, image scanning, rate limits, host removal, store UGC compliance. |
| Username spam or scraping | Prefix search minimum, result limits, rate limits, discoverability setting, request caps and expiry. |
| Unhealthy competition or disordered eating | Consistency-based ranking only, calorie floors, rate caps, low-intake check-in, supportive copy, mute and report tools. |
| Calculated targets feel wrong for some users | Transparent formula screen, safety rules, adaptive recalibration (P1), easy manual adjustment within limits. |
| Food and exercise data gaps and inaccuracies | Multiple sources, regional additions, user corrections and reports, nutrient snapshots in entries. |
| AI photo and chat storage costs | Daily caps, image compression, retention rules, cost dashboards, cache common results. |
| Step counting unreliable on some phones | Health platform first, sensor fallback, manual entry, clear permission and battery guidance. |
| Store review rejection (health data, chat, subscriptions) | Follow Health Connect, HealthKit, UGC and billing rules from the start; complete policy forms early. |
| Incumbents copy the social feature | Win on the quality of the all-in-one partner experience and regional food coverage; move quickly on retention data. |
| UPI autopay failures in India | Prepaid 3-month plan, grace period, payment-fix prompts. |
| Regulatory (DPDP, GDPR, user content rules) | Early legal review, data minimisation, deletion tooling, consent logs. |
| AI coach gives unsafe advice or costs too much | Premium-only, safety policy and refusal tests, numbers from tools, daily caps, token logging, global budget switch, thumbs-down review. |
| Fasting encourages disordered eating | Optional and off by default, screening, 20-hour limit, no health claims, excluded from rankings, paused by the low-intake check-in. |
| Recipe library takes longer than the app | Start writing recipes early in parallel, use the import template and validator, launch with a smaller set if needed. |
| Rating prompt breaks store policy or annoys users | Native prompts only, no incentives or filtering, limited triggers, never during sensitive flows. |
| Agent-written code has hidden security or logic bugs | One phase at a time, independent GPT review after each phase, mandatory automated RLS and calculation tests, real-device testing. |
| Annual plan margin too thin once AI costs are known | Track AI cost per paid user from the first beta, keep daily caps, and adjust the annual price or caps before launch. |
| Licence obligations of food and exercise data | Review ODbL and other terms before launch; show required attributions. |


## 15. Open Questions and Decisions Needed

This PRD assumes the recommendation shown for each item. Please confirm or change them.


| # | Question | Assumed in this PRD |
|---|---|---|
| 1 | Does personal tracking stay free after the trial? | Yes: food, water, steps, workouts, fasting, recipes, weight and personal graphs stay free |
| 2 | Which platform launches first? | Both from one codebase; Android beta first |
| 3 | Maximum members per room and rooms per user? | 10 members, 3 rooms per user |
| 4 | Can free (post-trial) users be on a leaderboard? | No, trial and Premium users only |
| 5 | Lapsed member's data in a room? | Frozen and hidden; restored on return within 90 days |
| 6 | Launch languages beyond English? | English first; Hindi and Telugu in Phase 2 |
| 7 | Annual plan price? | ₹799 and $34.99 (proposed); validate margins with real AI costs |
| 8 | Is the AI coach included in the single paid plan or a higher tier? | Included in the single plan with a daily cap; revisit after cost data |
| 9 | Which AI provider, and what caps? | Decide after a cost test; caps as in 7.7 and 7.10 |
| 10 | Age limit: 18+ or 16+ with parental consent? | 18+ |
| 11 | Username change policy? | Once every 30 days; old name held for 30 days |
| 12 | Who may invite people to a room? | Host only by default; room setting allows any member |
| 13 | Chat messages when a member leaves? | Remain visible with nickname unless the member deletes them first |
| 14 | Chat message and image retention? | Kept while the room exists; deleted 90 days after archiving |
| 15 | Exercise library source and image moderation provider? | Open dataset or curated list (licence check); provider chosen before Phase 8 |
| 16 | Do workout days count in the consistency score? | Not at launch |
| 17 | Are workout and step calories added to the calorie target? | No; informational only |
| 18 | When does the 3-day trial start? | At the first room create or join (changed from account creation) |
| 19 | Are recipes free for everyone? | Yes |
| 20 | Recipe count at launch and who writes and photographs them? | At least 150, written and photographed by the team; start early |
| 21 | Fasting scope? | Protocols up to 20 hours; no OMAD or multi-day fasts |
| 22 | Rate-us timing? | End of onboarding after the targets screen, plus a day-7 positive-moment prompt and a permanent Me item |
| 23 | AI coach conversation retention? | 90 days unless the user deletes sooner |
| 24 | When to add Dodo web checkout? | When the web app exists (Phase 3) |


## 16. Appendix


### Glossary


| Term | Meaning |
|---|---|
| Room | A private group of 2 to 10 people who track and chat together |
| Username | A unique @handle used to find and invite a person; different from the display nickname |
| Request | An invitation sent to a user to join a room, or a user's request to join someone's room; both require acceptance |
| TDEE | Total daily energy expenditure, the estimated maintenance calories |
| Logged day | A day with at least 2 entries and at least 50% of the calorie target logged |
| Goal day | A logged day within the goal range for the user's goal |
| Consistency Score | Weekly 0 to 100 score from logged days and goal days |
| Previously logged | The list of every food a user has logged before, with one-tap re-log |
| Shared meal | One meal logged once and tagged to other members, each with their own portion |
| Dormant room | A room with fewer than 2 members who have room access |
| Entitlement | The server-side record of whether a user can access paid features |
| Premium | Any paid plan (monthly, 3-month or annual). Includes rooms, room chat, room progress and the AI coach |
| Fast | A timed period without eating, started and ended by the user or by a scheduled eating window |
| AI coach | The premium in-app assistant that answers questions using the user's own data and our calculators |
| Recipe | An original CaliPartner recipe with nutrition calculated from its ingredients |


### Reference documents

- CaliPartner Build Plan: phase-by-phase agent prompts, review prompts and manual task checklists.
- CaliPartner App Layout and Navigation Plan (superseded by the navigation in Section 6.24).
- Design prompts (maintained separately by the team).