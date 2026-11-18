alter table public.entitlements drop constraint entitlements_period_check;
alter table public.entitlements add constraint entitlements_period_check
  check (period in ('monthly','quarterly','semiannual','annual'));

alter table public.dodo_checkouts drop constraint dodo_checkouts_product_key_check;
alter table public.dodo_checkouts add constraint dodo_checkouts_product_key_check
  check (product_key in ('plus_monthly','plus_quarterly','plus_semiannual','plus_annual','pro_monthly','pro_quarterly','pro_semiannual','pro_annual'));

alter table public.web_billing_checkouts drop constraint web_billing_checkouts_product_key_check;
alter table public.web_billing_checkouts add constraint web_billing_checkouts_product_key_check
  check (product_key in ('plus_monthly','plus_quarterly','plus_semiannual','plus_annual','pro_monthly','pro_quarterly','pro_semiannual','pro_annual'));

update public.remote_config set value='0'::jsonb, description='New subscription trials are retired'
where key='trial_length_days';

-- Close the new trial entry points while preserving historical entitlement reads.
create or replace function public.get_plus_trial_offer(p_device_hash text default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('eligible',false,'active',false,'expired',false,'server_now',now());
$$;
create or replace function public.claim_plus_trial(p_client_id uuid,p_device_hash text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin raise exception 'TRIAL_NOT_ELIGIBLE'; end;
$$;
create or replace function public.start_trial_if_eligible(
  p_user_id uuid default null, p_device_hash text default null, p_room_id uuid default null
)
returns boolean language sql security invoker set search_path=public,pg_temp as $$
  select false;
$$;
revoke execute on function public.start_trial_if_eligible(uuid,text,uuid) from public,anon,authenticated;

-- Retain prior migrations' idempotency, country checks and refund logic.
do $migration$
declare
  definition text;
  legacy_keys constant text := '(''plus_monthly'',''plus_annual'',''pro_monthly'',''pro_annual'')';
  keys constant text := '(''plus_monthly'',''plus_quarterly'',''plus_semiannual'',''plus_annual'',''pro_monthly'',''pro_quarterly'',''pro_semiannual'',''pro_annual'')';
  needle text;
begin
  definition := pg_get_functiondef('public.reserve_web_checkout(uuid,uuid,text,text,text)'::regprocedure);
  needle := ' select upper(trim(p.country)) into country';
  if position(legacy_keys in definition)=0 or position(needle in definition)=0
    then raise exception 'UNEXPECTED_WEB_RESERVATION'; end if;
  definition := replace(definition, legacy_keys, keys);
  definition := replace(definition, needle,
    ' if p_product_key in (''plus_monthly'',''pro_monthly'') then raise exception ''INVALID_CHECKOUT''; end if;' || chr(10) || needle);
  execute definition;

  definition := pg_get_functiondef('public.apply_dodo_event(text,text,text,timestamptz,timestamptz,text,text,text,uuid,jsonb)'::regprocedure);
  if position(legacy_keys in definition)=0 then raise exception 'UNEXPECTED_DODO_WRITER'; end if;
  execute replace(definition,legacy_keys,keys);

  definition := pg_get_functiondef('public.apply_revenuecat_event(text,text,uuid,text,text,timestamptz,timestamptz,jsonb)'::regprocedure);
  needle := '    if p_product_id ilike ''%annual%'' or p_product_id ilike ''%yearly%'' then';
  if position(needle in definition)=0 then raise exception 'UNEXPECTED_ENTITLEMENT_WRITER'; end if;
  definition := replace(definition,needle,$period$
    if p_product_id ~* '(semi.?annual|half.?year|6[_-]?months?|six[_-]?months?|p6m)' then
      v_period := 'semiannual';
    elsif p_product_id ~* '(quarterly|3[_-]?months?|three[_-]?months?|p3m)' then
      v_period := 'quarterly';
    elsif p_product_id ilike '%annual%' or p_product_id ilike '%yearly%' then$period$);
  definition := replace(definition,
    'case when v_period = ''annual'' then interval ''365 days'' else interval ''30 days'' end',
    'case v_period when ''annual'' then interval ''1 year'' when ''semiannual'' then interval ''6 months'' when ''quarterly'' then interval ''3 months'' else interval ''30 days'' end');
  needle := '  if found and v_current_ent.last_event_timestamp is not null then';
  if position(needle in definition)=0 then raise exception 'UNEXPECTED_TRIAL_WRITER'; end if;
  definition := replace(definition,needle,$trial$
  if v_status='trial' and not coalesce(
    (v_current_ent.status='trial' and v_current_ent.period_end>now())
    or (v_source='razorpay' and exists (
      select 1 from public.web_billing_checkouts
      where user_id=p_user_id and provider='razorpay' and trial_end is not null
        and subscription_id=p_payload->'event'->>'original_transaction_id' and trial_end>now()
    )),false) then
    return jsonb_build_object('status','trial_retired');
  end if;
$trial$||needle);
  execute definition;
end;
$migration$;

notify pgrst,'reload schema';
