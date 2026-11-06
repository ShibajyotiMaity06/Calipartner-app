-- Keep every alternative behind purchased access, including those attached to Monday.
create function public.weekly_preview_day(p_day jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select jsonb_set(p_day,'{meals}',(select coalesce(jsonb_agg(value-'alternatives' order by ord),'[]'::jsonb) from jsonb_array_elements(p_day->'meals') with ordinality a(value,ord)));
$$;
revoke all on function public.weekly_preview_day(jsonb) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.get_personal_weekly_plan()'::regprocedure) into definition;
 definition:=replace(definition,'jsonb_build_array(plan.content->''days''->0)','jsonb_build_array(public.weekly_preview_day(plan.content->''days''->0))');
 execute definition;
end; $$;
notify pgrst,'reload schema';
