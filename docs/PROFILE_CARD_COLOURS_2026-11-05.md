# Profile cards and Home Squad colours — 5 November 2026

## 1. Built

- Profile/member leaderboard cards show only `x%`, without the word completed.
- Home Squad Open/See all actions use their previous secondary outlined button style. Only the label is yellow; the green fill/outline override is removed.
- Every shared profile-picture outer ring uses the same chocolate brown, including avatars without an identity hue. Custom Squad check-in/feed avatar rings use the same token. Initials, presence indicators and chart identity colours keep their existing roles.
- Home Squad and create-card outlines use a stronger two-pixel copper border, making them visible against the dark card surface.

## 2. Files created/changed

- `app/src/components/rooms/HomeSquadLeaderboard.tsx`: outlined action with yellow label.
- `app/src/components/rooms/HomeSquads.tsx`: stronger Home card outlines.
- `app/src/components/rooms/SquadDayPanel.tsx`: chocolate check-in/feed avatar rings.
- `app/src/i18n/foodPolish.ts`: percentage-only card copy.
- `packages/ui/src/components/Avatar.tsx`: consistent outer profile-picture ring.
- `packages/ui/src/tokens/colors.ts`: paired chocolate tokens.
- `scripts/nov4_browser_audit.mjs`: rendered colour, outline and percentage assertions.
- `AGENT_RULES.md`, `docs/prd.md`, `docs/BUILD_PLAN.md`, `docs/ui/food-polish-2026-11-04.md`: newest owner correction and updated design notes.
- This report.

The pre-existing `app/.env.example` whitespace edit is excluded. No services, hooks, core calculations, database schema, permissions or subscription logic changed.

## 3. Verification

Extended the existing browser audit to check both members' actual rendered avatar-ring colours, percentage-only labels, the transparent See all surface with yellow text, and the stronger Home Squad outline. Kept existing loading, empty, error and navigation coverage. No implementation-mirroring unit tests were added for these styling edits.

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 72 existing warnings; no new style violations (252 grandfathered violations).
Typecheck: app, core and UI passed.
App: Test Files 126 passed (126); Tests 765 passed (765).
Core: Test Files 51 passed (51); Tests 567 passed (567).
UI: Test Files 7 passed (7); Tests 61 passed (61).
Database migrations: 96 passed; all SQL/RLS suites passed.
Edge: billing 29, food/photo 24, push/media 17, coach 14, weekly-plan 16, challenges 7 passed; 0 failed.
Browser audit passed at 375/390/844px, including the new rendered-style assertions.
Web production export, Android export and iOS export passed.
```

Browser requests are intercepted fixtures; no hosted writes, charges or messages occur. Native verification is an Expo production export rather than device installation.

## 4. Assumptions

“Dark/bright” Home Squad borders means a clearly visible, stronger warm-brown outline: two-pixel copper on the existing dark surface. Profile-picture rings use the deeper chocolate token throughout, independently of person identity hues. The percentage correction applies to member/profile score cards; challenge/workout completion copy is unrelated.

## 5. Manual steps

Reload the updated development frontend, or publish/install the normal refreshed web/native release. No new keys, accounts, migrations or console settings are required. Physical-device testing was not performed in this Windows session.

## 6. Later-phase observations

No later-phase feature was built. Existing unrelated warnings and the owner's local environment-file edit remain untouched.
