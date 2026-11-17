-- Skip idle HTTP requests while preserving signed push transport.
-- Managed pg_net grants can expose pending request headers to database roles.
-- Queue only a short-lived HMAC, never the long-lived credential stored in Vault.
create or replace function public.process_push_notifications_cron()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_url text; v_secret text; v_request bigint; v_timestamp text; v_signature text;
  v_body jsonb := '{"limit":50}'::jsonb;
begin
  if not exists (select 1 from public.push_notification_queue where status='pending') then return null; end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='calipartner_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='calipartner_push_worker_secret';
  if v_url is null or v_secret is null then return null; end if;
  v_timestamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
  v_signature := encode(extensions.hmac(v_timestamp||'.'||v_body::text,v_secret,'sha256'),'hex');
  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-push-worker-timestamp',v_timestamp,'x-push-worker-signature',v_signature),
    body:=v_body,
    timeout_milliseconds:=10000
  ) into v_request;
  return v_request;
end; $$;
revoke all on function public.process_push_notifications_cron() from public,anon,authenticated;
grant execute on function public.process_push_notifications_cron() to service_role;

-- Reward refreshes never transport catalog definitions, products or the ledger.
create function public.get_avatar_reward_state() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor(); d date;
begin
 perform public.avatar_reconcile_rewards();
 select (now() at time zone p.timezone)::date into d from public.profiles p where p.id=u;
 return jsonb_build_object('profile',public.avatar_snapshot(u),'balances',public.avatar_balances(u),
  'daily_drop',jsonb_build_object('available',exists(select 1 from public.avatar_qualifying_days(u) where day=d),'claimed',exists(select 1 from public.cc_ledger where user_id=u and idempotency_key='daily_drop:'||u||':'||d),'amount',(select cc from public.cc_earn_rules where action='daily_drop')),
  'starter_progress',coalesce((select jsonb_agg(step_key) from public.starter_path_progress where user_id=u),'[]'::jsonb));
end $$;
revoke all on function public.get_avatar_reward_state() from public,anon;
grant execute on function public.get_avatar_reward_state() to authenticated;
