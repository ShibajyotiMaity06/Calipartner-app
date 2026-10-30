import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFile, readdir } from 'node:fs/promises';
import { runPairInvitePreviewTests } from './pair_invite_preview_cases.mjs';
import {
  seedActivityRetirementHistory,
  runActivityRetirementTests,
} from './activity_retirement_cases.mjs';
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
    if (f === '20261029000031_retire_focus_time.sql') await seedActivityRetirementHistory(db);
    await db.exec(await readFile(`supabase/migrations/${f}`, 'utf8'));
    migrations++;
  } catch (error) {
    throw new Error(`Migration ${f}: ${error.message}`, { cause: error });
  }
}
console.log(`Database migrations: ${migrations} passed`);
const { runRoomTests } = await import('./rooms_v3_cases.mjs');
try {
  await runActivityRetirementTests(db);
  const { runCommunityLimitTests } = await import('./community_limit_cases.mjs');
  await runCommunityLimitTests(db);
  const { runRoomMatrixTests } = await import('./room_matrix_cases.mjs');
  await runRoomMatrixTests(db);
  const { runChatConcurrencyTests } = await import('./chat_concurrency_cases.mjs');
  await runChatConcurrencyTests(db);
  await runPairInvitePreviewTests(db);
  const { runLoggingSettingsTests } = await import('./logging_settings_cases.mjs');
  await runLoggingSettingsTests(db);
  await runRoomTests(db);
  const { runFriendTests } = await import('./friends_cases.mjs');
  await runFriendTests(db);
  const { runSocialDiscoveryTests } = await import('./social_discovery_cases.mjs');
  await runSocialDiscoveryTests(db);
  const { runBillingGoalTests } = await import('./billing_goal_cases.mjs');
  await runBillingGoalTests(db);
  const { runFoodCaptureTests } = await import('./food_capture_cases.mjs');
  await runFoodCaptureTests(db);
  const { runPushDeliveryTests } = await import('./push_delivery_cases.mjs');
  await runPushDeliveryTests(db);
  const { runScanRepairTests } = await import('./scan_repair_cases.mjs');
  await runScanRepairTests(db);
  const { runPaidFeatureTests } = await import('./paid_feature_cases.mjs');
  await runPaidFeatureTests(db);
  const { runLiveBillingTransitionTests } = await import('./live_billing_transition_cases.mjs');
  await runLiveBillingTransitionTests(db);
  const { runRoomRepairTests } = await import('./room_repair_cases.mjs');
  await runRoomRepairTests(db);
  const { runChatAccessTests } = await import('./chat_access_cases.mjs');
  await runChatAccessTests(db);
  const { runSnapshotRepairTests } = await import('./room_snapshot_repair_cases.mjs');
  await runSnapshotRepairTests(db);
  const { runChallengeTests } = await import('./challenges_cases.mjs');
  await runChallengeTests(db);
} finally {
  await db.close();
}
