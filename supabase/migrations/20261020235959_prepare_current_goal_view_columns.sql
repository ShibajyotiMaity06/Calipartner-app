-- Fresh replay fix: the next goal-view migration inserts a column in the middle
-- of the view. PostgreSQL cannot replace that shape in place. Already-upgraded
-- views are untouched; later migrations restore security_invoker and grants.
do $$
begin
  if to_regclass('public.current_goal_profiles') is not null and not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='current_goal_profiles' and column_name='target_calories'
  ) then
    drop view public.current_goal_profiles;
  end if;
end; $$;
