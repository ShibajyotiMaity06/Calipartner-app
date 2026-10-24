-- The committed onboarding migration widens weekly_rate_kg. PostgreSQL requires
-- detaching this dependent view first. The next two migrations complete the
-- change and restore its invoker security and existing Supabase role grants.
-- Deploy all three onboarding migrations in one transaction.
drop view if exists public.current_goal_profiles;
