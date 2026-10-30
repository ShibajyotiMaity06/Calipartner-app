-- Check the JWT owner before the custom-target validator reads private plan state.
-- RLS still enforces writes; this also prevents using validation errors to probe peers.
create or replace function public.guard_goal_profile_owner()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.user_id then
    raise exception 'NOT_AUTHORIZED';
  end if;
  return new;
end; $$;
revoke all on function public.guard_goal_profile_owner() from public,anon,authenticated;
create trigger a0_guard_goal_profile_owner before insert or update on public.goal_profiles
for each row execute function public.guard_goal_profile_owner();
