# CaliPartner

hi ra
Monorepo (npm workspaces):

| Path             | What                                                            |
| ---------------- | --------------------------------------------------------------- |
| `app/`           | Expo + React Native app (TypeScript strict, Expo Router)        |
| `packages/core/` | Pure TypeScript shared logic + Vitest tests (no React/Supabase) |
| `supabase/`      | Config, migrations, Edge Functions, seed, SQL tests             |
| `docs/`          | PRD, build plan                                                 |

Status: **Phase 1 (Auth, Profiles, Usernames, Age Gate, RLS test harness)**.

## Prerequisites

Node 20+ (22 recommended), Git, Docker Desktop (for local Supabase), Android Studio with an emulator (AVD) and `adb` on PATH, JDK 17+. The Supabase CLI is installed per-repo via `npx supabase` (no global install needed).

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Configuration

### For the Mobile App (`app/.env.local`)

Create `app/.env.local` from `app/.env.example`:

```bash
# Windows PowerShell
Copy-Item app/.env.example app/.env.local
# macOS/Linux
cp app/.env.example app/.env.local
```

Populate the non-secret environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
EXPO_PUBLIC_APP_ENV=development
```

_(Never put service-role keys or secrets in the mobile app or git)_

---

## 3. Manual Dashboard Steps

### A. Custom SMTP with Resend (for passwordless 6-digit email OTP)

In your Supabase Dashboard:

1. Navigate to **Project Settings** > **Authentication** > **SMTP Settings** (or **Email Settings**).
2. Enable **Custom SMTP**.
3. Fill in the following details:
   - **Sender Email**: `noreply@yourdomain.com` (must be a domain verified in your Resend account with SPF/DKIM/DMARC).
   - **Sender Name**: `CaliPartner`
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **Username**: `resend`
   - **Password**: `<YOUR_RESEND_API_KEY>` (e.g. `re_12345...`)
4. In **Authentication** > **Email Templates** > **Magic Link / Confirmation**:
   - Customize the template to display the 6-digit token using `{{ .Token }}`.
5. In **Authentication** > **Providers** > **Email**:
   - Ensure **Confirm email** is enabled.
   - Set OTP expiration to 3600 seconds (1 hour).

### B. Google OAuth Configuration

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create an **OAuth 2.0 Client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard > **Authentication** > **Providers** > **Google**:
   - Enable Google.
   - Enter your Google **Client ID** and **Client Secret**.
   - Add redirect URL: `calipartner://auth/callback`.

### C. Apple OAuth Configuration

1. In [Apple Developer Portal](https://developer.apple.com/):
   - Register an **App ID** and a **Services ID** (e.g., `com.calipartner.app`).
   - Enable **Sign In with Apple**.
   - Set Return URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Create and download a private key (`.p8`). Note Key ID and Team ID.
2. In Supabase Dashboard > **Authentication** > **Providers** > **Apple**:
   - Enable Apple.
   - Enter **Services ID**, **Key ID**, **Team ID**, and the secret key from `.p8`.

### D. Supabase Secrets for Edge Functions

When deploying Edge Functions to Supabase Cloud, set the required secrets:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
```

### E. Returning-user sessions

The app persists encrypted native sessions (including large OAuth sessions), refreshes tokens when
the app is active, and retains cached targets during offline use. After 30 consecutive days without
a successful sign-in or token refresh, it requests **sign in**, preserving saved targets and logs.

For the hosted project, check **Authentication > Settings > Sessions**:

- Disable the absolute session timebox and single-session restriction, so normal daily use or
  another device does not force a new OTP.
- Set the inactivity timeout to **30 days / 720 hours** when the project plan supports it.
- Keep JWT expiry at **3600 seconds**; refresh tokens maintain the session without another OTP.

`supabase/config.toml` sets the local inactivity timeout to `720h`; it does not update a hosted
project automatically. Hosted session limits require Supabase Pro or above. See
[Supabase session settings](https://supabase.com/docs/guides/auth/sessions).

Verify on a development build: sign in, record custom targets, restart, then reopen offline and
confirm the targets remain. Test walking with the phone stationary and with sensor access denied;
the count must stay unchanged without hardware events. Android historical step queries are not
supported by Expo Pedometer; live walking sessions record measured steps, with manual entry
available when a sensor is unavailable. The explicit fresh start below removes old tracking data;
the app does not estimate a step count when the sensor is unavailable.

### F. Requested fresh start (24 October 2026)

`supabase/maintenance/fresh_start_20261023.sql` is a one-time, explicitly requested data cleanup.
It preserves auth identities/sessions, profiles, rooms, room memberships, entitlement and billing
records, and trial-abuse/security records. It clears personal tracking, targets, preferences,
consents and room activity/chat data. Its fixed reset epoch prevents a repeat run from erasing
newly entered data.

On the updated app's next online check, stale local tracking and queued writes are cleared once
before synchronization; login tokens are retained and accounts return to goal setup. After saving
new targets, future restarts and logins retain them. Server guards reject queued records created
before the reset, including uploads from older installed clients. A failed network check keeps
cached access and pending local saves available without uploading unchecked data.

The hosted project is currently on Supabase Free: updating the server inactivity timeout returns
HTTP 402. Its existing settings already have no timebox/single-session restriction and enable
refresh rotation. The app implements the requested 30-day offline reauthentication window;
server-enforced inactivity limits require a separate Supabase hosting upgrade, unrelated to users'
CaliPartner Pro subscriptions.

The live migration ledger is behind several older repository migrations. Do not blindly apply
all pending migrations: `20261021000003_fix_progress_target_calories_and_leave_room.sql` includes
membership deletions. The targeted `20261024035839_fix_saved_target_queries.sql` and
`20261024040216_reject_stale_tracking_after_reset.sql` repairs are applied separately and do not
alter subscriptions or memberships.

Cleanup status: the two backend repairs are deployed, but the destructive all-account cleanup
was rejected by automatic approval review and has **not** run. An administrator can review and
execute `supabase/maintenance/fresh_start_20261023.sql` in the Supabase SQL editor. A verified
recovery backup is stored outside the repository under the user's local AppData directory.

---

## 4. Supabase Local Development & Migrations

```bash
npx supabase start                 # Starts local containers
npx supabase status                # Shows URLs and API keys
npx supabase db reset              # Applies migrations + seed
npx supabase functions serve       # Serves edge functions locally
```

### Running RLS & Database Tests

Run the pgTAP test suite against the local database:

```bash
npx supabase test db
```

---

## 5. Running the App

```bash
# Run on Android emulator
npm run app --workspace app
# or build dev client:
npm run android --workspace app
```

## 6. Automated Tests, Lint & Typecheck

```bash
npm run lint          # ESLint with strict TypeScript rules
npm run typecheck     # Typecheck across app and core
npm test              # Run Vitest test suites (core + app)
npm run check         # Runs lint, typecheck, and all test suites
```

## Conventions & Rules

- Source of truth: `docs/prd.md` and `AGENT_RULES.md`.
- No direct schema modifications: all database changes are versioned SQL migrations in `supabase/migrations/`.
- Local SQLite migrations are strictly appended in `app/src/db/migrations.ts`.
- All user-facing strings are localized via `app/src/i18n/en.ts`.
