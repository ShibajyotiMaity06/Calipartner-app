-- Room-member base-table RLS correctly exposes only one's own row. Count peers
-- inside this membership-checked projection, not with a client table query.
create or replace function public.get_my_rooms()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'code',r.code,'state',r.state,'created_at',r.created_at,
    'who_can_invite',r.who_can_invite,'plan_holder_id',r.plan_holder_id,
    'member_cap',public.room_cap(r.id),'role',own.role,'my_status',own.status,
    'member_count',(select count(*) from public.room_members m where m.room_id=r.id and m.status in ('active','paused','locked'))
  ) order by r.created_at,r.id),'[]'::jsonb)
  from public.room_members own join public.rooms r on r.id=own.room_id
  where own.user_id=auth.uid() and own.status in ('active','paused','locked') and r.state<>'archived');
end; $$;
revoke all on function public.get_my_rooms() from public,anon;
grant execute on function public.get_my_rooms() to authenticated;
notify pgrst,'reload schema';
