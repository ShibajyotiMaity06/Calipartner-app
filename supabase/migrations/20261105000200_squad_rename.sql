-- Host-owned metadata updates with acknowledged, replay-safe request IDs.
create table public.room_name_changes (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  requested_name text not null check (char_length(requested_name) between 1 and 100),
  created_at timestamptz not null default now()
);
alter table public.room_name_changes enable row level security;
revoke all on public.room_name_changes from public, anon, authenticated;
grant all on public.room_name_changes to service_role;
create policy room_name_changes_service on public.room_name_changes
  for all to service_role using (true) with check (true);

create function public.rename_room(p_client_id uuid, p_room_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  target public.rooms;
  previous public.room_name_changes;
  new_name text := btrim(p_name);
begin
  if actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or new_name is null or char_length(new_name) not between 1 and 100 then
    raise exception 'INVALID_ROOM_NAME';
  end if;
  select * into target from public.rooms where id = p_room_id for update;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  perform 1 from public.room_members where room_id = p_room_id and user_id = actor
    and role = 'host' and status in ('active', 'paused', 'locked') for update;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  if target.state = 'archived' then raise exception 'ROOM_ARCHIVED'; end if;
  select * into previous from public.room_name_changes where id = p_client_id;
  if found then
    if previous.actor_id <> actor or previous.room_id <> p_room_id or previous.requested_name <> new_name then
      raise exception 'NOT_AUTHORIZED';
    end if;
    -- A late retry must not undo a newer rename, including after a lost response.
    return jsonb_build_object('request_id', p_client_id, 'room_id', target.id, 'name', target.name);
  end if;
  update public.rooms set name = new_name, updated_at = now() where id = p_room_id;
  insert into public.room_name_changes(id, room_id, actor_id, requested_name)
    values(p_client_id, p_room_id, actor, new_name);
  return jsonb_build_object('request_id', p_client_id, 'room_id', p_room_id, 'name', new_name);
end; $$;
revoke all on function public.rename_room(uuid, uuid, text) from public, anon;
grant execute on function public.rename_room(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';
