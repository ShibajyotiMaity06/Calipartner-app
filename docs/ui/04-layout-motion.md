## Part 4 — Layout, spacing, shape, motion

### 4.1 Grid and spacing
- Base unit **4**. Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Screen side padding **20** (16 on screens narrower than 360 dp). Card inner padding 16. Gap between cards 12. Section gap 24.
- **Thumb zone:** primary actions in the bottom 40% of the screen. Titles and read-only data above.
- Safe areas always respected. Bottom tab bar floats 12 above the safe area.
- Design for **360×640 dp** first, check 390×844 (iPhone), then tablets (centre column max 560, scale up only the margins).

### 4.2 Radius, borders and elevation

| Element | Radius |
|---|---|
| Chips, inputs, small buttons | 12 |
| Buttons (primary) | 16 |
| Cards | 20 |
| Sheets (top corners) | 28 |
| Rings, avatars, pills, tab ＋ | full |

Borders: 1 px `hairline` on cards; `hairlineLit` on controls that need to be found. Elevation is made with surface steps (`s1`→`s2`→`s3`), not shadows.

### 4.3 Motion

| Token | Duration | Curve | Use |
|---|---|---|---|
| `fast` | 120 ms | (0.2, 0, 0, 1) | Taps, toggles, chips |
| `base` | 220 ms | (0.2, 0, 0, 1) | Sheets, tab changes, counters |
| `ring` | 680 ms | (0.32, 0, 0.1, 1) | Ring fill on data change |
| `seam` | 900 ms | (0.4, 0, 0.2, 1) | The day-complete fuse |

Rules: motion answers an action or a data change, nowhere else. No entrance animations on every card, no looping gradients, no confetti. **One orchestrated moment:** the seam fuse. With Reduce Motion on, replace the sweep with a 120 ms crossfade. Use `react-native-reanimated` worklets; animate transforms and opacity only.

### 4.4 Glass and performance budget
- Glass (blur) only on the tab bar and the Log sheet. On iOS 26 prefer the system's native glass for bars. On Android use `expo-blur` only if a startup benchmark keeps 55+ fps; otherwise opaque `s2`. Respect **Reduce Transparency** (opaque).
- No blur on scrolling lists. No shadows on list rows. Images: WebP, sized to the container, cached.

### 4.5 Haptics

| Event | Haptic |
|---|---|
| Log saved, toggle, chip select | Light |
| Nudge sent, focus start | Medium |
| Seam fuse, challenge complete | Success notification |
| Error | Error notification (rare) |
| Nothing else vibrates | — |

Settings has a master "Haptics" switch.

### 4.6 Iconography
- One family, 24 px grid, 1.75 px stroke, rounded caps (Phosphor "regular" or Lucide; pick one and do not mix).
- Filled variants only for the **active tab** and selected states.
- Every icon-only button has an accessibility label and a 44×44 hit area.

### 4.7 Imagery and illustration
- No cartoon mascots, no illustrated "empty" people. Empty states are an invitation with the action beside it.
- Photos: recipes (original), avatars (illustrated set plus optional photo after acceptance in Partner Finder).
- Avatars: a set of 24 abstract, warm illustrated avatars (no faces needed) in identity hues.

### 4.8 Sound
Off by default. Optional soft tick on log and a chime on seam fuse, behind a setting.
