-- Restore the Phase 2 owner-filtered view after the rate precision change.
create view public.current_goal_profiles
with (security_invoker = true) as
select distinct on (user_id) *
from public.goal_profiles
order by user_id, effective_from desc;

-- Preserve the existing grants inspected on the live Supabase view. RLS on
-- goal_profiles still applies because this view runs as its caller.
grant all privileges on public.current_goal_profiles to anon, authenticated, service_role;
