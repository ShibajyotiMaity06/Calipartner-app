-- Replies reference an existing visible message, never a caller-supplied quote.
alter table public.chat_messages add column reply_to_id uuid references public.chat_messages(id) on delete set null;
create index chat_messages_reply_to on public.chat_messages(reply_to_id) where reply_to_id is not null;

create function public.chat_reply_preview(p_room_id uuid,p_message_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',m.id,'sender_id',m.sender_id,'name',p.nickname,'text',left(m.text,240),'has_attachment',exists(select 1 from public.chat_attachments a where a.message_id=m.id and a.moderation_status in ('ok','approved')))
 from public.chat_messages m join public.profiles p on p.id=m.sender_id
 where m.id=p_message_id and m.room_id=p_room_id and m.message_type='user' and m.deleted_at is null
 and public.is_room_member(p_room_id,auth.uid()) and public.room_is_usable(p_room_id)
 and public.chat_sender_visible(p_room_id,m.sender_id);
$$;
revoke all on function public.chat_reply_preview(uuid,uuid) from public,anon,authenticated;

create function public.check_chat_reply_reference()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.reply_to_id is not distinct from old.reply_to_id and new.room_id=old.room_id then return new; end if;
 if tg_op='UPDATE' and old.reply_to_id is not null then raise exception 'REPLY_IMMUTABLE'; end if;
 if new.reply_to_id is not null and (new.reply_to_id=new.id or public.chat_reply_preview(new.room_id,new.reply_to_id) is null) then raise exception 'REPLY_UNAVAILABLE'; end if;
 return new;
end; $$;
revoke all on function public.check_chat_reply_reference() from public,anon,authenticated;
create trigger check_chat_reply_reference before insert or update of reply_to_id,room_id on public.chat_messages for each row execute function public.check_chat_reply_reference();

create function public.send_chat_reply(p_room_id uuid,p_client_id text,p_reply_to_id uuid,p_text text default null,p_attachments jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.chat_messages; result jsonb; quote jsonb;
begin
 perform public.assert_squad_access(p_room_id);
 if p_client_id is null or p_reply_to_id is null then raise exception 'INVALID_MESSAGE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,91));
 select * into existing from public.chat_messages where client_id=p_client_id;
 if found then
  if existing.sender_id<>auth.uid() or existing.room_id<>p_room_id or existing.reply_to_id is distinct from p_reply_to_id or existing.text is distinct from nullif(btrim(p_text),'') then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 else
  -- Lock the original against concurrent deletion while validating and saving.
  perform 1 from public.chat_messages where id=p_reply_to_id and room_id=p_room_id for share;
  quote:=public.chat_reply_preview(p_room_id,p_reply_to_id);
  if quote is null then raise exception 'REPLY_UNAVAILABLE'; end if;
 end if;
 -- Retain the existing terms, room, rate, media and retry checks.
 result:=public.send_chat_message(p_room_id,p_client_id,p_text,p_attachments);
 update public.chat_messages set reply_to_id=p_reply_to_id where id=(result->>'id')::uuid and reply_to_id is null;
 return result||jsonb_build_object('reply_to_id',p_reply_to_id,'reply',public.chat_reply_preview(p_room_id,p_reply_to_id));
end; $$;
revoke all on function public.send_chat_reply(uuid,text,uuid,text,jsonb) from public,anon;
grant execute on function public.send_chat_reply(uuid,text,uuid,text,jsonb) to authenticated;

-- Extend current projections without losing cursor, free-chat or privacy repairs.
do $$
declare f record; definition text;
begin
 for f in select pg_get_functiondef(p.oid) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('get_chat_messages','get_chat_messages_v2') loop
  definition:=replace(f.body,'''client_id'', m.client_id,','''client_id'', m.client_id, ''reply_to_id'', case when m.deleted_at is null then m.reply_to_id end, ''reply'', case when m.deleted_at is null then public.chat_reply_preview(m.room_id,m.reply_to_id) end,');
  if definition=f.body then raise exception 'CHAT_PROJECTION_PATCH_MISSING'; end if;
  execute definition;
 end loop;
end; $$;
notify pgrst,'reload schema';
