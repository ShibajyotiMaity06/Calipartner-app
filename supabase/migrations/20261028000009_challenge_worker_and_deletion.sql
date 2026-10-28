-- Prevent daily-summary triggers recreating rows during an Auth cascade delete.
-- Preserve the existing calculator and permissions; add only the missing parent guard.
do $$ declare definition text;begin
 select pg_get_functiondef('public.recompute_daily_summary(uuid,text)'::regprocedure) into definition;
 if definition not like '%CHALLENGE_DELETE_GUARD%' then
  definition:=regexp_replace(definition,'(?i)\mBEGIN\M',E'BEGIN\n  -- CHALLENGE_DELETE_GUARD\n  if not exists(select 1 from auth.users where id=p_user_id) then return;end if;');
  execute definition;
 end if;
end;$$;

-- Queue a short-lived HMAC, never a reusable worker credential in pg_net headers.
create or replace function public.process_challenges_cron()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenge_job_config;stamp text;signature text;body jsonb:='{"action":"maintenance"}';
begin
 select * into c from public.challenge_job_config where id;if not found then return;end if;
 if exists(select 1 from pg_extension where extname='pg_net') then
  stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature:=encode(extensions.hmac(stamp||'.'||body::text,c.worker_secret,'sha256'),'hex');
  execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=10000)' using c.worker_url,jsonb_build_object('Content-Type','application/json','x-challenge-worker-timestamp',stamp,'x-challenge-worker-signature',signature),body;
 end if;
end;$$;
