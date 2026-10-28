-- Sharing an onboarding invitation reserves no hosted-room slot.
-- Explicit acceptance creates both memberships and consumes exactly one slot atomically.
insert into public.remote_config(key,value) values('pair_invite_expiry_days','14'::jsonb) on conflict(key) do nothing;
create table public.onboarding_pair_invites (
  id uuid primary key,
  token uuid not null default gen_random_uuid() unique,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null check(length(trim(room_name)) between 1 and 100),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.onboarding_pair_invites enable row level security;
create policy pair_invites_no_direct_access on public.onboarding_pair_invites for all to authenticated using(false) with check(false);
create index onboarding_pair_invites_owner on public.onboarding_pair_invites(inviter_id,created_at desc);

create or replace function public.prepare_onboarding_pair_invite(p_client_id uuid,p_room_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.onboarding_pair_invites; v_days integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or p_room_name is null or length(trim(p_room_name)) not between 1 and 100 then raise exception 'INVALID_INVITE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  if not public.can_create_room(auth.uid()) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  select * into r from public.onboarding_pair_invites where id=p_client_id for update;
  if found and r.inviter_id<>auth.uid() then raise exception 'NOT_AUTHORIZED'; end if;
  if found and r.accepted_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if not public.check_rate_limit('onboarding_pair_invite:'||auth.uid()::text,20,3600) then raise exception 'RATE_LIMITED'; end if;
  select greatest(1,least(30,(value#>>'{}')::integer)) into v_days from public.remote_config where key='pair_invite_expiry_days';
  insert into public.onboarding_pair_invites(id,inviter_id,room_name,expires_at)
  values(p_client_id,auth.uid(),trim(p_room_name),now()+make_interval(days=>v_days))
  on conflict(id) do update set expires_at=case when onboarding_pair_invites.expires_at<=now() then excluded.expires_at else onboarding_pair_invites.expires_at end
  returning * into r;
  return jsonb_build_object('token',r.token,'expires_at',r.expires_at);
end; $$;

create or replace function public.accept_onboarding_pair_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.onboarding_pair_invites; v_count integer; v_code text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into r from public.onboarding_pair_invites where token=p_token;
  if not found then raise exception 'INVITE_UNAVAILABLE'; end if;
  if r.inviter_id=auth.uid() then raise exception 'SELF_INVITE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.inviter_id::text,31));
  select * into r from public.onboarding_pair_invites where token=p_token for update;
  if not found then raise exception 'INVITE_UNAVAILABLE'; end if;
  if r.accepted_at is not null then
    if r.accepted_by=auth.uid() and public.is_room_member(r.room_id,auth.uid()) then
      return jsonb_build_object('room_id',r.room_id);
    end if;
    raise exception 'INVITE_UNAVAILABLE';
  end if;
  if r.expires_at<=now() then raise exception 'INVITE_EXPIRED'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'PROFILE_REQUIRED'; end if;
  if exists(select 1 from public.blocks where (blocker_id=r.inviter_id and blocked_id=auth.uid()) or (blocked_id=r.inviter_id and blocker_id=auth.uid())) then raise exception 'USER_BLOCKED'; end if;
  if not public.can_create_room(r.inviter_id) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  if not public.check_rate_limit('accept_pair_invite:'||auth.uid()::text,20,3600) then raise exception 'RATE_LIMITED'; end if;
  select count(*) into v_count from public.rooms where plan_holder_id=r.inviter_id and state<>'archived';
  v_code:=public.generate_room_code();
  insert into public.rooms(id,name,code,state,who_can_invite,created_by,plan_holder_id,member_cap,requires_host_plan)
  values(r.id,r.room_name,v_code,'active','host_only',r.inviter_id,r.inviter_id,2,v_count>0);
  insert into public.room_members(room_id,user_id,role,status) values(r.id,r.inviter_id,'host','active'),(r.id,auth.uid(),'member','active');
  perform public.recompute_room_state(r.id);
  update public.onboarding_pair_invites set accepted_by=auth.uid(),room_id=r.id,accepted_at=now() where id=r.id;
  return jsonb_build_object('room_id',r.id);
end; $$;
revoke all on function public.prepare_onboarding_pair_invite(uuid,text),public.accept_onboarding_pair_invite(uuid) from public,anon;
grant execute on function public.prepare_onboarding_pair_invite(uuid,text),public.accept_onboarding_pair_invite(uuid) to authenticated;
notify pgrst,'reload schema';
