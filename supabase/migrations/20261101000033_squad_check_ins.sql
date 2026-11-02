-- Explicit, offline-capable daily check-ins. Other members never read this base table.
alter table public.food_entries drop constraint food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check check(source in ('search','scan','photo','description','history','copy','recipe'));
create table public.squad_check_ins (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  local_date date not null,
  activities text[] not null default '{}',
  note text not null default '' check (length(note)<=500),
  share_with_squad boolean not null default true,
  occurred_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id,room_id,local_date),
  check (activities <@ array['ate','trained','walked','rest']::text[])
);
alter table public.squad_check_ins enable row level security;
create policy check_in_owner_read on public.squad_check_ins for select to authenticated using(user_id=auth.uid());
create policy check_in_owner_insert on public.squad_check_ins for insert to authenticated with check (
  user_id=auth.uid() and public.is_room_member(room_id,auth.uid()) and public.room_is_usable(room_id)
  and occurred_at<=now()+interval '5 minutes'
  and local_date=(occurred_at at time zone (select timezone from public.profiles where id=auth.uid()))::date
);
create policy check_in_owner_update on public.squad_check_ins for update to authenticated using(user_id=auth.uid()) with check (
  user_id=auth.uid() and public.is_room_member(room_id,auth.uid()) and public.room_is_usable(room_id)
  and occurred_at<=now()+interval '5 minutes'
  and local_date=(occurred_at at time zone (select timezone from public.profiles where id=auth.uid()))::date
);
grant select,insert,update on public.squad_check_ins to authenticated;
grant all on public.squad_check_ins to service_role;
create index squad_check_ins_room_day on public.squad_check_ins(room_id,local_date);

create or replace function public.get_squad_day(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.id,'nickname',p.nickname,'is_self',p.id=auth.uid(),
    'checked_in',case when c.share_with_squad=false and p.id<>auth.uid() then null else c.id is not null end,
    'activities',case when (c.share_with_squad or p.id=auth.uid()) and (p.id=auth.uid() or public.active_room_tier(auth.uid())<>'free') then to_jsonb(c.activities) else '[]'::jsonb end,
    'note',case when (c.share_with_squad or p.id=auth.uid()) and (p.id=auth.uid() or public.active_room_tier(auth.uid())<>'free') then c.note else null end,
    'occurred_at',case when c.share_with_squad or p.id=auth.uid() then c.occurred_at else null end
  ) order by p.id=auth.uid() desc,p.nickname,p.id),'[]'::jsonb)) into result
  from public.room_members m join public.profiles p on p.id=m.user_id
  left join public.squad_check_ins c on c.user_id=p.id and c.room_id=p_room_id
    and c.local_date=(now() at time zone p.timezone)::date
  where m.room_id=p_room_id and m.status in ('active','paused','locked')
    and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=auth.uid()));
  return result;
end; $$;
revoke all on function public.get_squad_day(uuid) from public,anon;
grant execute on function public.get_squad_day(uuid) to authenticated;
notify pgrst,'reload schema';
