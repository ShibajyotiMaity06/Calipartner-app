-- Shared avatars expose cosmetic state only, never exact activity-derived XP or account timing.
create or replace function public.get_avatar_public(p_user_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor();begin
 if coalesce(array_length(p_user_ids,1),0)>20 then raise exception 'TOO_MANY_USERS'; end if;
 return coalesce((select jsonb_agg(public.avatar_snapshot(a.user_id)-'xp'-'created_at') from public.avatar_profiles a where a.user_id=any(p_user_ids) and (a.user_id=u or (
 not exists(select 1 from public.blocks b where (b.blocker_id=u and b.blocked_id=a.user_id) or (b.blocker_id=a.user_id and b.blocked_id=u)) and (
 exists(select 1 from public.friend_requests f where f.status='accepted' and f.pair_low=least(u,a.user_id) and f.pair_high=greatest(u,a.user_id)) or
 exists(select 1 from public.room_members mine join public.room_members peer on peer.room_id=mine.room_id where mine.user_id=u and peer.user_id=a.user_id and mine.status='active' and peer.status='active' and public.room_is_usable(mine.room_id)))))), '[]');
end $$;
revoke all on function public.get_avatar_public(uuid[]) from public,anon;
grant execute on function public.get_avatar_public(uuid[]) to authenticated,service_role;
