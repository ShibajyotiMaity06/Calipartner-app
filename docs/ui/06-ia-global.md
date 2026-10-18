## Part 6 — Information architecture and global patterns

### 6.1 Navigation map

```
Launch → Welcome → Onboarding (A) → Today
                   └ Invite link → Invite preview (A15) → sign in (B) → goals → Room

TAB 1  Today        diary, rings, meals, water, steps, workouts, fasting, focus, room strip
TAB 2  Room         segments: Today · Focus · Chat · Progress · Members; inbox; invites
TAB 3  ＋ Log        sheet: Food · Workout · Water · Weight · Fast · Focus
TAB 4  Progress     segments: My progress · Leaderboard · Challenges
TAB 5  Me           profile, goals, privacy, plan, Find a partner, settings, support
```

Entry points that are not tabs: Recipes and Ask Coach (from Today, the Log sheet and Me); Requests inbox (Room header and Me); Partner Finder (Today room strip when you have no room, empty Room tab, Me, end of onboarding).

### 6.2 Navigation rules
- Tabs keep their own stack and scroll position; tapping the active tab scrolls to top.
- Maximum depth from a tab root: 3 levels. Sheets over pushes for quick tasks.
- Back is always available; never intercept the Android back gesture except to confirm discarding unsaved edits.
- Deep links: `calipartner://room/<code>`, universal links for invites, `/focus/<id>`, `/request/<id>`, `/challenge/<id>`; unauthenticated users are routed through B then returned to the target.
- State survives backgrounding (timers, drafts, in-progress workout).

### 6.3 Screen IDs
`A` Launch and onboarding · `B` Account · `C` Today · `D` Log and food · `E` Water, steps, weight, workouts · `F` Fasting · `G` Focus · `H` Recipes · `I` AI coach · `J` Room · `K` Requests and invites · `L` Partner Finder · `M` Progress, leaderboard, challenges · `N` Me and settings · `O` Plans and paywall · `P` System and global.

### 6.4 Global content rules
- **Voice:** plain, warm, specific, second person, active verbs, sentence case. No exclamation marks, no emoji in system copy, no coach persona, no guilt.
- **Names things the way people say them:** "Add to lunch", "Logged lunch", "Your room".
- **Numbers:** percent of own goal for comparisons; raw calories only in your own view.
- **Dates and units:** local time zone; kg/cm by default for India with an imperial toggle; ml.
- **Never display:** another person's calorie numbers, weight (unless opted in), or any "you are behind" message.

| Write | Not |
|---|---|
| Add to lunch | Submit |
| Added to lunch | Success! |
| 320 over | Calorie limit exceeded |
| Priya hasn't logged yet today | Priya is falling behind |
| Both of you logged today. Day 12. | Streak maintained! |
| Keep your room going | Unlock premium |
| Couldn't reach the server. Your log is saved on this phone. | Something went wrong |

### 6.5 Global states (apply to every screen unless a screen says otherwise)

| State | Pattern |
|---|---|
| **Loading** | Skeleton matching final geometry (`CMP-18`), no spinners except inside buttons. |
| **Empty** | `CMP-17`: one line what, one line why, the action. |
| **Offline** | Top sync pill "Saved on this phone. Will sync."; logging, workouts, focus and water keep working; chat shows "Sending…" then "Failed, tap to retry". Rooms and Partner Finder show last cached data with "Updated 2 h ago". |
| **Error (recoverable)** | Inline message that says what happened and the next step, plus Retry. |
| **Permission denied** | Explains what stops working and a button to open system settings (P02). |
| **Locked room (plan ended)** | "This room is paused" screen, no blame (J20). |
| **Dormant room** | Chat read-only; banner explains and offers to restart (J21). |
| **Partner not logged** | Open circles, muted 0%, one neutral line. |
| **Over capacity / full** | Host sees upgrade; others see "This room is full" (J22). |
| **Reduced motion / transparency** | Crossfades and opaque surfaces. |

### 6.6 Notifications (copy only; behaviour is in the PRD NTF section)
Supportive, no calorie numbers of other people, previews can be hidden.
- Meal reminder: "Time to log lunch?" · Water: "A glass of water?" · Partner logged: "Rahul logged lunch."
- Nudge: "Rahul logged lunch. Time for yours?" · Focus: "Priya started a focus session. Join?"
- Request: "Priya wants to be your workout partner." · Fasting: "Your eating window closes in 30 minutes."
