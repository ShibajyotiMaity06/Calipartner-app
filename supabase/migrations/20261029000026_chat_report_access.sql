-- Chat reports apply the same room access boundary as message reading. Repeated
-- submissions of the same report reuse the original moderation work.
create or replace function public.report_chat_message(p_message_id uuid,p_reason text,p_details text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid;v_sender uuid;v_report uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_reason is null or p_reason not in ('inappropriate','harassment','spam','other') or length(coalesce(p_details,''))>2000 then raise exception 'INVALID_REASON';end if;
  select room_id,sender_id into v_room,v_sender from public.chat_messages where id=p_message_id;
  if v_room is null or not public.is_room_member(v_room,auth.uid()) or not public.room_is_usable(v_room) then raise exception 'NOT_ROOM_MEMBER';end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED';end if;
  if not public.chat_sender_visible(v_room,v_sender) then raise exception 'NOT_AUTHORIZED';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_message_id::text||p_reason,56));
  select id into v_report from public.reports where reporter_id=auth.uid() and target_type='message' and target_id=p_message_id::text and reason=p_reason and coalesce(details,'')=coalesce(nullif(trim(p_details),''),'') order by created_at limit 1;
  if v_report is not null then return v_report;end if;
  insert into public.reports(reporter_id,target_type,target_id,reason,details) values(auth.uid(),'message',p_message_id::text,p_reason,nullif(trim(p_details),'')) returning id into v_report;
  insert into public.moderation_queue(message_id,reporter_id,status,provider,details) values(p_message_id,auth.uid(),'pending','user_report',jsonb_build_object('reason',p_reason,'details',p_details));
  return v_report;
end;$$;
revoke all on function public.report_chat_message(uuid,text,text) from public,anon;
grant execute on function public.report_chat_message(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
