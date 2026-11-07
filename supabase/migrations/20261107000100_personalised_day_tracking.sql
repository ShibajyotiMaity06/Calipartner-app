-- One-day onboarding plans retain the private, consented, retry-safe planning pipeline.
alter table public.personal_weekly_plans drop constraint personal_weekly_plans_content_check;
alter table public.personal_weekly_plans add constraint personal_weekly_plans_content_check
 check(jsonb_typeof(content->'days')='array' and jsonb_array_length(content->'days') in (1,7));

create or replace function public.get_personal_weekly_plan()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare plan public.personal_weekly_plans; paid boolean;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into plan from public.personal_weekly_plans where user_id=auth.uid();
 if not found then return null; end if;
 paid:=public.has_purchased_weekly_plan_access(auth.uid());
 return jsonb_build_object('id',plan.id,'preferences',plan.preferences-'plan_scope','revision',plan.revision,'full_access',paid,
  'scope',case when jsonb_array_length(plan.content->'days')=1 then 'day' else 'week' end,
  'days',case when paid then plan.content->'days' else jsonb_build_array(public.weekly_preview_day(plan.content->'days'->0)) end,
  'workout_tips',case when paid then plan.content->'workout_tips' else '[]'::jsonb end,
  'diet_tips',case when paid then plan.content->'diet_tips' else '[]'::jsonb end);
end; $$;

-- A free account can customise its initial onboarding targets. Later overrides retain paid gates.
-- Keep the existing safety checks and replay protection intact.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.guard_custom_macros()'::regprocedure) into definition;
 definition:=replace(definition,
  'if public.active_room_tier(new.user_id) not in (''plus'',''pro'') and not coalesce((',
  'if not coalesce((v_previous.id is null and new.recompute_reason=''initial_onboarding''),false) and public.active_room_tier(new.user_id) not in (''plus'',''pro'') and not coalesce((');
 execute definition;
end; $$;

-- Preferences never delete logs, change nutrient targets, privacy, or squad ranking.
create table public.tracking_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_id uuid not null,
 enabled jsonb not null check (
  jsonb_typeof(enabled)='object' and
  enabled ?& array['calories','protein','carbs','fat','steps','water'] and
  enabled-array['calories','protein','carbs','fat','steps','water']='{}'::jsonb and
  jsonb_typeof(enabled->'calories')='boolean' and jsonb_typeof(enabled->'protein')='boolean' and
  jsonb_typeof(enabled->'carbs')='boolean' and jsonb_typeof(enabled->'fat')='boolean' and
  jsonb_typeof(enabled->'steps')='boolean' and jsonb_typeof(enabled->'water')='boolean'
 )
);
alter table public.tracking_preferences enable row level security;
create policy tracking_preferences_read_own on public.tracking_preferences for select to authenticated using(user_id=auth.uid());
create policy tracking_preferences_insert_own on public.tracking_preferences for insert to authenticated with check(user_id=auth.uid());
create policy tracking_preferences_update_own on public.tracking_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.tracking_preferences from anon,authenticated;
grant select,insert,update on public.tracking_preferences to authenticated;
grant all on public.tracking_preferences to service_role;
notify pgrst,'reload schema';
