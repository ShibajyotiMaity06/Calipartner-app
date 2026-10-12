-- Migration: 20261008000011_phase9b_focus_maintenance_cron.sql
-- Schedules public.process_focus_maintenance() every minute via pg_cron (if available).

do $$
begin
  -- 1. Enable pg_cron if supported by the Postgres environment
  if exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    create extension if not exists pg_cron;

    -- 2. Clean up any existing job with the same identifier (idempotent migration)
    perform cron.unschedule('process_focus_maintenance_job')
    where exists (
      select 1 from cron.job where jobname = 'process_focus_maintenance_job'
    );

    -- 3. Schedule maintenance job every minute: '* * * * *'
    perform cron.schedule(
      'process_focus_maintenance_job',
      '* * * * *',
      'select public.process_focus_maintenance();'
    );

    raise notice 'Scheduled process_focus_maintenance_job every minute with pg_cron';
  else
    raise notice 'pg_cron extension is not present in pg_available_extensions; cron-focus-maintenance edge function or dashboard schedule should be used.';
  end if;
exception
  when others then
    raise notice 'Notice during pg_cron configuration: %', sqlerrm;
end;
$$;
