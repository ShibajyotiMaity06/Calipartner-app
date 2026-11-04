-- Enforce plan and safety on every save path, including direct writes and tracking upserts.
create or replace function public.enforce_paid_fasting()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_paid boolean; v_dob date; v_zone text; v_screen public.health_screening; v_low boolean; v_start integer; v_end integer; v_window integer; v_previous jsonb;
begin
  if coalesce(auth.jwt()->>'role','')='service_role' or (auth.uid() is null and current_user in ('postgres','supabase_admin')) then return new; end if;
  if auth.uid() is null or auth.uid()<>new.user_id then raise exception 'UNAUTHENTICATED'; end if;
  v_paid:=public.active_room_tier(new.user_id) in ('plus','pro');
  if tg_op='UPDATE' then v_previous:=to_jsonb(old);
  elsif tg_table_name='fasting_settings' then select to_jsonb(s) into v_previous from public.fasting_settings s where s.user_id=new.user_id;
  else select to_jsonb(s) into v_previous from public.fasting_sessions s where s.id=new.id and s.user_id=new.user_id; end if;
  if tg_table_name='fasting_settings' then
    if not v_paid then
      if new.enabled then raise exception 'PLUS_REQUIRED'; end if;
      if v_previous is not null and (to_jsonb(new)-array['enabled','updated_at']) is distinct from (v_previous-array['enabled','updated_at']) then raise exception 'PLUS_REQUIRED'; end if;
      if v_previous is null and (new.protocol<>'16:8' or new.eating_window_start<>'12:00' or new.eating_window_end<>'20:00' or new.custom_fasting_hours is not null) then raise exception 'PLUS_REQUIRED'; end if;
    end if;
    if new.eating_window_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.eating_window_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'INVALID_FASTING_SETTINGS'; end if;
    v_start:=split_part(new.eating_window_start,':',1)::int*60+split_part(new.eating_window_start,':',2)::int;
    v_end:=split_part(new.eating_window_end,':',1)::int*60+split_part(new.eating_window_end,':',2)::int;
    v_window:=(v_end-v_start+1440)%1440;
    if v_window<240 or v_window>1380 or (new.protocol='custom' and new.custom_fasting_hours is null) then raise exception 'INVALID_FASTING_SETTINGS'; end if;
    if not new.enabled then return new; end if;
  else
    if not v_paid then
      if v_previous is null then raise exception 'PLUS_REQUIRED'; end if;
      if (to_jsonb(new)-array['status','end_at','updated_at']) is distinct from (v_previous-array['status','end_at','updated_at']) then raise exception 'PLUS_REQUIRED'; end if;
      if v_previous->>'status'<>'active' and (new.status is distinct from v_previous->>'status' or new.end_at is distinct from (v_previous->>'end_at')::timestamptz) then raise exception 'PLUS_REQUIRED'; end if;
      if new.status='active' then raise exception 'PLUS_REQUIRED'; end if;
    end if;
    if new.start_at>now()+interval '1 minute' or (new.end_at is not null and (new.end_at<new.start_at or new.end_at>now()+interval '1 minute')) or (new.status='active')<>(new.end_at is null) then raise exception 'INVALID_FASTING_TIMES'; end if;
    if new.end_at is not null then
      new.status:=case when round(extract(epoch from (new.end_at-new.start_at))/60)>=new.planned_minutes then 'completed' else 'ended_early' end;
      if v_previous is not null and new.start_at=(v_previous->>'start_at')::timestamptz then new.local_date:=(v_previous->>'local_date')::date; return new; end if;
    end if;
    select timezone into v_zone from public.profiles where id=new.user_id;
    if v_previous is null or new.start_at is distinct from (v_previous->>'start_at')::timestamptz then new.local_date:=(new.start_at at time zone coalesce(v_zone,'UTC'))::date;
    else new.local_date:=(v_previous->>'local_date')::date; end if;
    if new.status<>'active' and v_previous is not null then return new; end if;
  end if;
  select date_of_birth,timezone into v_dob,v_zone from public.profiles where id=new.user_id;
  if v_dob is null or extract(year from age((now() at time zone coalesce(v_zone,'UTC'))::date,v_dob))<18 then raise exception 'UNDER_18_BLOCKED'; end if;
  select * into v_screen from public.health_screening where user_id=new.user_id;
  if not found then raise exception 'SCREENING_REQUIRED'; end if;
  if v_screen.pregnant_or_breastfeeding or v_screen.has_diabetes_or_medication or v_screen.has_eating_disorder_history then raise exception 'SCREENING_INELIGIBLE'; end if;
  select low_intake_flag into v_low from public.daily_summaries where user_id=new.user_id order by local_date desc limit 1;
  if coalesce(v_low,false) then raise exception 'LOW_INTAKE_PAUSED'; end if;
  return new;
end; $$;
-- Existing owner-only RLS and trigger names remain in place.
