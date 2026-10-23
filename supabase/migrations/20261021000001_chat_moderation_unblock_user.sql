-- =============================================================================
-- Migration: 20261021000001_chat_moderation_unblock_user.sql
-- Adds unblock_user RPC, get_blocked_users RPC, and ensures explicit permissions
-- for user blocking and content reporting (Apple App Store Guideline 1.2 UGC requirements)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UNBLOCK USER RPC
-- -----------------------------------------------------------------------------
create or replace function public.unblock_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_target_user_id is null then
    raise exception 'INVALID_ARGUMENT: target_user_id is required' using errcode = 'P0001';
  end if;

  delete from public.blocks
  where blocker_id = v_uid and blocked_id = p_target_user_id;

  return jsonb_build_object(
    'status', 'unblocked',
    'target_user_id', p_target_user_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. GET BLOCKED USERS RPC (Quick lookup for current caller)
-- -----------------------------------------------------------------------------
create or replace function public.get_blocked_users()
returns table (
  blocked_id uuid,
  blocked_at timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select blocked_id, created_at as blocked_at
  from public.blocks
  where blocker_id = auth.uid()
  order by created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- 3. EXPLICIT SECURITY GRANTS FOR BLOCKING AND REPORTING
-- -----------------------------------------------------------------------------
grant execute on function public.block_user(uuid) to authenticated, service_role, postgres;
revoke execute on function public.block_user(uuid) from anon, public;

grant execute on function public.unblock_user(uuid) to authenticated, service_role, postgres;
revoke execute on function public.unblock_user(uuid) from anon, public;

grant execute on function public.get_blocked_users() to authenticated, service_role, postgres;
revoke execute on function public.get_blocked_users() from anon, public;

grant execute on function public.report_chat_message(uuid, text, text) to authenticated, service_role, postgres;
revoke execute on function public.report_chat_message(uuid, text, text) from anon, public;

grant execute on function public.mute_chat_member(uuid) to authenticated, service_role, postgres;
revoke execute on function public.mute_chat_member(uuid) from anon, public;

grant execute on function public.unmute_chat_member(uuid) to authenticated, service_role, postgres;
revoke execute on function public.unmute_chat_member(uuid) from anon, public;
