-- Read-only invitation state prevents a sender/member being offered Join.
create or replace function public.preview_onboarding_pair_invite(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.onboarding_pair_invites;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
  select * into r from public.onboarding_pair_invites where token=p_token;
  if not found then return jsonb_build_object('state','unavailable');end if;
  if r.accepted_at is not null then
    if (r.inviter_id=auth.uid() or r.accepted_by=auth.uid()) and public.is_room_member(r.room_id,auth.uid()) then
      return jsonb_build_object('state','member','room_id',r.room_id,'is_sender',r.inviter_id=auth.uid());
    end if;
    return jsonb_build_object('state','unavailable');
  end if;
  if r.inviter_id=auth.uid() then
    return jsonb_build_object('state','sender','can_share',r.expires_at>now() and public.can_create_room(auth.uid()),'reason',case when r.expires_at<=now() then 'expired' when not public.can_create_room(auth.uid()) then 'host_limit' else null end);
  end if;
  if r.expires_at<=now() or exists(select 1 from public.blocks where (blocker_id=r.inviter_id and blocked_id=auth.uid()) or (blocked_id=r.inviter_id and blocker_id=auth.uid())) then
    return jsonb_build_object('state','unavailable');
  end if;
  if not public.can_create_room(r.inviter_id) then return jsonb_build_object('state','unavailable','reason','host_limit');end if;
  return jsonb_build_object('state','joinable');
end;$$;
revoke all on function public.preview_onboarding_pair_invite(uuid) from public,anon;
grant execute on function public.preview_onboarding_pair_invite(uuid) to authenticated;
notify pgrst,'reload schema';
