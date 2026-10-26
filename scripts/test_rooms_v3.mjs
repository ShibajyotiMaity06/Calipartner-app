import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite({ extensions: { citext } });
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text, raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
create publication supabase_realtime;
grant usage on schema auth,public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to authenticated,service_role;
alter default privileges in schema public grant all on sequences to authenticated,service_role;`);
let migrations = 0;
for (const f of (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(await readFile(`supabase/migrations/${f}`, 'utf8'));
    migrations++;
  } catch (error) {
    throw new Error(`Migration ${f}: ${error.message}`, { cause: error });
  }
}
console.log(`Database migrations: ${migrations} passed`);
const { runRoomTests } = await import('./rooms_v3_cases.mjs');
try {
  await runRoomTests(db);
  const { runFriendTests } = await import('./friends_cases.mjs');
  await runFriendTests(db);
  const { runBillingGoalTests } = await import('./billing_goal_cases.mjs');
  await runBillingGoalTests(db);
} finally {
  await db.close();
}
