# CaliPartner

Monorepo (npm workspaces):

| Path             | What                                                            |
| ---------------- | --------------------------------------------------------------- |
| `app/`           | Expo + React Native app (TypeScript strict, Expo Router)        |
| `packages/core/` | Pure TypeScript shared logic + Vitest tests (no React/Supabase) |
| `supabase/`      | Config, migrations, Edge Functions, seed, SQL tests             |
| `docs/`          | PRD, build plan                                                 |

Status: **Phase 0 (foundation)**. No auth, no real screens, no feature tables.

## Prerequisites

Node 20+ (22 recommended), Git, Docker Desktop (running), Android Studio with an emulator (AVD) and `adb` on PATH, JDK 17+. The Supabase CLI is installed per-repo via `npx supabase` (no global install needed).

## 1. Install

```bash
npm install
```

## 2. Run Supabase locally

```bash
npx supabase start                 # first run pulls Docker images
npx supabase status                # copy "API URL" and "anon key"
npx supabase db reset              # applies migrations + seed
npx supabase functions serve --no-verify-jwt   # serves `health` (keep running)
```

Quick check: `curl http://127.0.0.1:54321/functions/v1/health` returns `{"status":"ok","time":"..."}`.

SQL (pgTAP) tests: `npx supabase test db`.

## 3. Configure the app

```bash
cp app/.env.example app/.env.local     # Windows PowerShell: Copy-Item app/.env.example app/.env.local
```

Edit `app/.env.local` and set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the anon key from `supabase status`. Only `EXPO_PUBLIC_*` non-secret values belong here. The Android emulator reaches your machine at `10.0.2.2`; the app rewrites `127.0.0.1`/`localhost` automatically on Android.

## 4. Build and run the development build (Android emulator)

Start an emulator from Android Studio, then:

```bash
cd app
npx expo run:android          # first build generates /android, compiles, installs the dev client
```

Later runs only need the Metro server:

```bash
npm run app                   # from repo root (expo start --dev-client)
```

Open the app: the **Today** tab shows **Connected** when the `health` function is reachable.

### Cloud dev-client builds with EAS

```bash
npm install -g eas-cli
cd app
eas login
eas build --profile development --platform android   # also: preview, production
```

Profiles are in `app/eas.json`.

## 5. Tests, lint, typecheck

```bash
npm run lint
npm run typecheck      # app + core
npm test               # app + core (Vitest)
npm run format:check
npm run check          # lint + typecheck + test
```

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck and tests on every push/PR.

## Conventions

- Rules for contributors/agents: `AGENTS.md`. Requirements: `docs/prd.md`. Order of work: `docs/BUILD_PLAN.md`.
- Schema changes are new files in `supabase/migrations/` only. Local (SQLite) schema changes are appended to `app/src/db/migrations.ts`.
- All user-facing strings live in `app/src/i18n/en.ts`.
