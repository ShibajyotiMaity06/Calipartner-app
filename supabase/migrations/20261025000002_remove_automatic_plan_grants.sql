-- Purchases must never be simulated by client code or an email allowlist.
-- Preserve previously issued entitlements; stop automatic future grants.
drop trigger if exists on_auth_user_created_vip_pro on auth.users;
do $$ begin
  if to_regprocedure('public.grant_vip_pro_for_email(text)') is not null then
    revoke all on function public.grant_vip_pro_for_email(text) from public,anon,authenticated;
  end if;
  if to_regprocedure('public.trig_handle_vip_user_pro()') is not null then
    revoke all on function public.trig_handle_vip_user_pro() from public,anon,authenticated;
  end if;
end; $$;
