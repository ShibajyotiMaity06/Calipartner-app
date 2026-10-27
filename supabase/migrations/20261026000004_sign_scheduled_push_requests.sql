-- Managed pg_net grants can expose pending request headers to database roles.
-- Queue only a short-lived HMAC, never the long-lived credential stored in Vault.
create or replace function public.process_push_notifications_cron()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_url text; v_secret text; v_request bigint; v_timestamp text; v_signature text;
  v_body jsonb := '{"limit":50}'::jsonb;
begin
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
