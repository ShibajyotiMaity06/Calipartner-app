-- Hosted push delivery. Only a scoped worker secret crosses the HTTP boundary.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
  end if;
end $$;

create or replace function public.configure_push_delivery(p_worker_url text,p_worker_secret text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_worker_url is null or p_worker_url !~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/send-push$'
    or p_worker_secret is null or length(p_worker_secret) not between 40 and 256 then
    raise exception 'INVALID_PUSH_CONFIGURATION';
  end if;
  if to_regclass('vault.secrets') is null then raise exception 'PUSH_VAULT_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('calipartner-push-configuration',0));
  select id into v_id from vault.secrets where name='calipartner_push_url';
  if v_id is null then
    perform vault.create_secret(p_worker_url,'calipartner_push_url','Push worker URL');
  else
    perform vault.update_secret(v_id,p_worker_url,'calipartner_push_url','Push worker URL');
  end if;
  select id into v_id from vault.secrets where name='calipartner_push_worker_secret';
  if v_id is null then
    perform vault.create_secret(p_worker_secret,'calipartner_push_worker_secret','Scoped push worker credential');
  else
    perform vault.update_secret(v_id,p_worker_secret,'calipartner_push_worker_secret','Scoped push worker credential');
  end if;
end; $$;
revoke all on function public.configure_push_delivery(text,text) from public,anon,authenticated;
grant execute on function public.configure_push_delivery(text,text) to service_role;

create or replace function public.process_push_notifications_cron()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_url text; v_secret text; v_request bigint;
begin
  -- Portable migrations also run in local test databases without hosted extensions.
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='calipartner_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='calipartner_push_worker_secret';
  if v_url is null or v_secret is null then return null; end if;
  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object('Content-Type','application/json','x-push-worker-secret',v_secret),
    body:='{"limit":50}'::jsonb,
    timeout_milliseconds:=10000
  ) into v_request;
  return v_request;
end; $$;
revoke all on function public.process_push_notifications_cron() from public,anon,authenticated;
grant execute on function public.process_push_notifications_cron() to service_role;

do $$ begin
  if to_regclass('cron.job') is not null and to_regnamespace('net') is not null then
    perform cron.schedule('calipartner_push_delivery','* * * * *','select public.process_push_notifications_cron();');
  end if;
end $$;
