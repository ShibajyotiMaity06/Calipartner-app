-- Owner chat follow-up: safe concurrent cursors, short-lived typing, media access.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.get_chat_messages(uuid,integer,timestamptz,timestamptz)'::regprocedure) into v_def;
  v_def:=regexp_replace(v_def,'(?s)CREATE OR REPLACE FUNCTION public\.get_chat_messages\(.*?\)\s+RETURNS',
    'CREATE OR REPLACE FUNCTION public.get_chat_messages_v2(p_room_id uuid,p_limit integer default 50,p_before_created_at timestamptz default null,p_after_created_at timestamptz default null,p_before_id uuid default null,p_after_id uuid default null) RETURNS');
  v_def:=replace(v_def,'m.created_at < p_before_created_at','(m.created_at < p_before_created_at or (m.created_at=p_before_created_at and p_before_id is not null and m.id<p_before_id))');
  v_def:=replace(v_def,'m.created_at > p_after_created_at','(m.created_at > p_after_created_at or (m.created_at=p_after_created_at and p_after_id is not null and m.id>p_after_id))');
  v_def:=replace(v_def,'order by m.created_at desc','order by case when p_after_created_at is not null then m.created_at end asc,case when p_after_created_at is not null then m.id end asc,m.created_at desc,m.id desc');
  v_def:=replace(v_def,'order by (row_data->>''created_at'')::timestamptz asc','order by (row_data->>''created_at'')::timestamptz asc,row_data->>''id'' asc');
  execute v_def;
end; $$;
revoke all on function public.get_chat_messages_v2(uuid,integer,timestamptz,timestamptz,uuid,uuid) from public,anon;
grant execute on function public.get_chat_messages_v2(uuid,integer,timestamptz,timestamptz,uuid,uuid) to authenticated;

create table public.chat_typing (
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  primary key(room_id,user_id)
);
alter table public.chat_typing enable row level security;
create index chat_typing_room_expiry on public.chat_typing(room_id,expires_at);
create or replace function public.can_read_chat_typing(p_room_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and public.is_room_member(p_room_id,auth.uid())
    and public.is_room_member(p_room_id,p_user_id) and public.room_is_usable(p_room_id)
    and public.active_room_tier(auth.uid())<>'free' and public.active_room_tier(p_user_id)<>'free'
    and not exists(select 1 from public.member_mutes where user_id=auth.uid() and muted_user_id=p_user_id)
    and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_user_id) or (blocked_id=auth.uid() and blocker_id=p_user_id));
$$;
revoke all on function public.can_read_chat_typing(uuid,uuid) from public,anon;
grant execute on function public.can_read_chat_typing(uuid,uuid) to authenticated;
create policy typing_paid_members on public.chat_typing for select to authenticated using(public.can_read_chat_typing(room_id,user_id));
create policy typing_no_direct_writes on public.chat_typing for all to authenticated using(false) with check(false);
create or replace function public.set_chat_typing(p_room_id uuid,p_is_typing boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if p_is_typing and not public.has_accepted_chat_terms(auth.uid()) then raise exception 'TERMS_REQUIRED'; end if;
  insert into public.chat_typing(room_id,user_id,expires_at) values(p_room_id,auth.uid(),now()+case when p_is_typing then interval '8 seconds' else interval '-1 second' end)
  on conflict(room_id,user_id) do update set expires_at=excluded.expires_at;
end; $$;
create or replace function public.get_chat_typing(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.can_read_chat_typing(p_room_id,auth.uid()) then raise exception 'PLUS_REQUIRED'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'nickname',p.nickname) order by p.nickname,p.id),'[]'::jsonb)
    from public.chat_typing t join public.profiles p on p.id=t.user_id
    where t.room_id=p_room_id and t.user_id<>auth.uid() and t.expires_at>now() and public.can_read_chat_typing(t.room_id,t.user_id));
end; $$;
revoke all on function public.set_chat_typing(uuid,boolean),public.get_chat_typing(uuid) from public,anon;
grant execute on function public.set_chat_typing(uuid,boolean),public.get_chat_typing(uuid) to authenticated;
alter publication supabase_realtime add table public.chat_typing;

create table public.chat_media_uploads (
  storage_key text primary key,
  temporary_key text not null unique,
  room_id uuid references public.rooms on delete set null,
  user_id uuid not null references auth.users on delete cascade,
  mime_type text not null,
  size integer not null check(size between 1 and 10485760),
  state text not null default 'pending' check(state in ('pending','processing','approved','blocked')),
  processing_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.chat_media_uploads enable row level security;
create policy chat_media_no_app_access on public.chat_media_uploads for all to authenticated using(false) with check(false);
create index chat_media_uploads_owner on public.chat_media_uploads(user_id);
create or replace function public.claim_chat_media_upload(p_room_id uuid,p_user_id uuid,p_storage_key text,p_mime_type text,p_size integer)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.chat_media_uploads;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_storage_key,54));
  if not public.is_room_member(p_room_id,p_user_id) or public.active_room_tier(p_user_id)<>'pro' or not public.room_is_usable(p_room_id) then raise exception 'PRO_REQUIRED'; end if;
  if exists(select 1 from public.chat_attachments where storage_key=p_storage_key) then raise exception 'MEDIA_ALREADY_PUBLISHED'; end if;
  select * into r from public.chat_media_uploads where storage_key=p_storage_key;
  if found then
    if r.user_id<>p_user_id or r.room_id<>p_room_id or r.mime_type<>p_mime_type or r.size<>p_size or r.state<>'pending' then raise exception 'NOT_AUTHORIZED'; end if;
    return r.temporary_key;
  end if;
  insert into public.chat_media_uploads(storage_key,temporary_key,room_id,user_id,mime_type,size)
  values(p_storage_key,'pending/'||p_user_id::text||'/'||gen_random_uuid()::text,p_room_id,p_user_id,p_mime_type,p_size) returning * into r;
  return r.temporary_key;
end; $$;
revoke all on function public.claim_chat_media_upload(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_chat_media_upload(uuid,uuid,text,text,integer) to service_role;

create or replace function public.can_read_chat_media(p_room_id uuid,p_storage_key text,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_room_member(p_room_id,p_user_id) and public.active_room_tier(p_user_id)<>'free' and public.room_is_usable(p_room_id)
    and exists(select 1 from public.chat_attachments a join public.chat_messages m on m.id=a.message_id
      where a.storage_key=p_storage_key and m.room_id=p_room_id and m.deleted_at is null
        and a.moderation_status='ok'
        and not exists(select 1 from public.blocks b where (b.blocker_id=p_user_id and b.blocked_id=m.sender_id) or (b.blocked_id=p_user_id and b.blocker_id=m.sender_id))
        and not exists(select 1 from public.member_mutes cm where cm.user_id=p_user_id and cm.muted_user_id=m.sender_id));
$$;
revoke all on function public.can_read_chat_media(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.can_read_chat_media(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
