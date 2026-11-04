-- Indian web subscriptions use Razorpay. Existing store/Dodo subscriptions keep their provider.
alter table public.entitlements drop constraint entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check
 check(source in ('apple','google','dodo','razorpay','none'));

create table public.web_billing_checkouts (
 id uuid primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 provider text not null check(provider in ('dodo','razorpay')),
 product_key text not null check(product_key in ('plus_monthly','plus_annual','pro_monthly','pro_annual')),
 product_id text not null,
 subscription_id text unique,
 state text not null default 'reserved' check(state in ('reserved','ready','active','closed')),
 trial_end timestamptz,
 paid_until timestamptz,
 revoked_until timestamptz,
 last_event_at timestamptz,
 cancel_requested_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index web_billing_one_open_checkout on public.web_billing_checkouts(user_id) where state<>'closed';
alter table public.web_billing_checkouts enable row level security;
create policy web_billing_checkouts_owner_read on public.web_billing_checkouts for select to authenticated using(user_id=auth.uid());
create policy web_billing_checkouts_service on public.web_billing_checkouts for all to service_role using(true) with check(true);

create function public.reserve_web_checkout(p_user_id uuid,p_id uuid,p_provider text,p_product_key text,p_product_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.web_billing_checkouts; e public.entitlements; country text; v_trial_end timestamptz;
begin
 if p_user_id is null or p_id is null or p_provider not in ('dodo','razorpay') or p_provider is null
  or p_product_key is null or p_product_key not in ('plus_monthly','plus_annual','pro_monthly','pro_annual')
  or nullif(p_product_id,'') is null then raise exception 'INVALID_CHECKOUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,907));
 select * into c from public.web_billing_checkouts where id=p_id;
 if found then
  if c.user_id<>p_user_id or c.provider<>p_provider or c.product_key<>p_product_key or c.product_id<>p_product_id then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if c.state='closed' then raise exception 'CHECKOUT_CLOSED';end if;
  return to_jsonb(c)||jsonb_build_object('cached',true);
 end if;
 select upper(trim(p.country)) into country from public.profiles p where id=p_user_id;
 if country is null or country !~ '^[A-Z]{2}$' then raise exception 'BILLING_COUNTRY_REQUIRED';end if;
 if (country='IN')<>(p_provider='razorpay') then raise exception 'WRONG_BILLING_PROVIDER';end if;
 select * into e from public.entitlements where user_id=p_user_id for update;
 if e.period_end>now() and e.status in ('paid','grace','trial') then raise exception 'MANAGE_EXISTING_SUBSCRIPTION';end if;
 if exists(select 1 from public.web_billing_checkouts where user_id=p_user_id and state<>'closed') then raise exception 'CHECKOUT_PENDING';end if;
 if p_provider='razorpay' and p_product_key like 'plus_%' and e.trial_started_at is null
  and not exists(select 1 from public.web_billing_checkouts where user_id=p_user_id and trial_end is not null and state<>'closed') then
  v_trial_end:=date_trunc('second',now())+interval '7 days';
 end if;
 insert into public.web_billing_checkouts(id,user_id,provider,product_key,product_id,trial_end)
 values(p_id,p_user_id,p_provider,p_product_key,p_product_id,v_trial_end) returning * into c;
 return to_jsonb(c)||jsonb_build_object('cached',false);
end;$$;
revoke all on function public.reserve_web_checkout(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_web_checkout(uuid,uuid,text,text,text) to service_role;

-- Extend the established entitlement writer without changing native/Dodo behavior.
do $$ declare body text;begin
 body:=pg_get_functiondef('public.apply_revenuecat_event(text,text,uuid,text,text,timestamptz,timestamptz,jsonb)'::regprocedure);
 if position('elsif p_store ilike ''%dodo%'' then' in body)=0 then raise exception 'UNEXPECTED_BILLING_WRITER';end if;
 body:=replace(body,'elsif p_store ilike ''%dodo%'' then','elsif p_store = ''razorpay'' then v_source := ''razorpay''; elsif p_store ilike ''%dodo%'' then');
 execute body;
end;$$;

create function public.apply_razorpay_event(
 p_event_id text,p_event_type text,p_checkout_id uuid,p_subscription_id text,p_plan_id text,
 p_kind text,p_period_end timestamptz,p_event_timestamp timestamptz,p_provider_status text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.web_billing_checkouts;e public.entitlements;result jsonb;event_type text;period_end timestamptz;trial_payload jsonb;
begin
 if nullif(p_event_id,'') is null or p_event_timestamp is null or p_event_timestamp>now()+interval '5 minutes'
  or p_kind is null or p_kind not in ('paid','trial','retain','revoke') or nullif(p_subscription_id,'') is null
  or p_provider_status not in ('created','authenticated','active','pending','halted','paused','cancelled','completed','expired')
  or p_provider_status is null then raise exception 'INVALID_RAZORPAY_EVENT';end if;
 select * into c from public.web_billing_checkouts where id=p_checkout_id and provider='razorpay';
 if not found or c.product_id<>p_plan_id then raise exception 'INVALID_RAZORPAY_CHECKOUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,907));
 select * into c from public.web_billing_checkouts where id=p_checkout_id for update;
 if c.subscription_id is not null and c.subscription_id<>p_subscription_id then raise exception 'INVALID_RAZORPAY_SUBSCRIPTION';end if;
 if exists(select 1 from public.processed_webhook_events where event_id='razorpay:'||p_event_id) then return jsonb_build_object('status','already_processed');end if;
 select * into e from public.entitlements where user_id=c.user_id for update;
 if e.period_end>now() and e.status in ('paid','grace','trial') and (e.source<>'razorpay' or e.original_transaction_id is distinct from p_subscription_id) then
  raise exception 'CONFLICTING_ACTIVE_SUBSCRIPTION';
 end if;
 -- Refunds cannot revoke a newer paid billing period. Refunded periods cannot be re-granted.
 if p_kind='paid' then
  if p_period_end is null then raise exception 'INVALID_RAZORPAY_PERIOD';end if;
  if p_period_end<=coalesce(c.revoked_until,'-infinity'::timestamptz) or p_period_end<coalesce(c.paid_until,'-infinity'::timestamptz) then return jsonb_build_object('status','ignored_old_period');end if;
  period_end:=p_period_end;event_type:='INITIAL_PURCHASE';
 elsif p_kind='trial' then
  if c.product_key not like 'plus_%' or c.trial_end is null or p_period_end is distinct from c.trial_end then raise exception 'INVALID_RAZORPAY_TRIAL';end if;
  if c.paid_until is not null or c.revoked_until is not null then return jsonb_build_object('status','ignored_trial');end if;
  period_end:=c.trial_end;event_type:='INITIAL_PURCHASE';
 elsif p_kind='revoke' then
  if p_period_end is null then raise exception 'INVALID_RAZORPAY_PERIOD';end if;
  update public.web_billing_checkouts set revoked_until=greatest(revoked_until,p_period_end) where id=c.id;
  if p_period_end<coalesce(c.paid_until,'-infinity'::timestamptz) then return jsonb_build_object('status','ignored_old_refund');end if;
  period_end:=now();event_type:='REVOCATION';
 else
  if e.source is distinct from 'razorpay' or e.original_transaction_id is distinct from p_subscription_id then
   update public.web_billing_checkouts set subscription_id=p_subscription_id,state=case when p_provider_status in ('cancelled','completed','expired') then 'closed' else 'ready' end where id=c.id;
   return jsonb_build_object('status','awaiting_verified_payment');
  end if;
  period_end:=e.period_end;event_type:=case when p_provider_status in ('cancelled','completed','expired') or c.cancel_requested_at is not null then 'CANCELLATION' else 'INITIAL_PURCHASE' end;
 end if;
 if period_end<=now() and event_type<>'REVOCATION' then event_type:='EXPIRATION';end if;
 if p_kind='trial' or (p_kind='retain' and e.status='trial') then
  trial_payload:=jsonb_build_object('period_type','TRIAL','purchased_at_ms',extract(epoch from (c.trial_end-interval '7 days'))*1000);
 else trial_payload:='{}'::jsonb;end if;
 result:=public.apply_revenuecat_event('razorpay:'||p_event_id,event_type,c.user_id,c.product_key,'razorpay',period_end,
  greatest(p_event_timestamp,coalesce(e.last_event_timestamp,p_event_timestamp)),
  jsonb_build_object('provider_event',p_event_type,'event',trial_payload||jsonb_build_object('original_transaction_id',p_subscription_id)));
 update public.web_billing_checkouts set subscription_id=p_subscription_id,
  state=case when p_provider_status in ('cancelled','completed','expired') then 'closed' else 'active' end,
  paid_until=case when p_kind='paid' then greatest(paid_until,p_period_end) else paid_until end,
  last_event_at=greatest(last_event_at,p_event_timestamp) where id=c.id;
 if c.cancel_requested_at is not null or p_provider_status in ('cancelled','completed','expired') then
  update public.entitlements set cancel_at_period_end=true where user_id=c.user_id and source='razorpay' and original_transaction_id=p_subscription_id;
 end if;
 return result;
end;$$;
revoke all on function public.apply_razorpay_event(text,text,uuid,text,text,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_razorpay_event(text,text,uuid,text,text,text,timestamptz,timestamptz,text) to service_role;

-- Release shared checkout reservations only following a verified Dodo lifecycle event.
do $$ declare body text;begin
 body:=pg_get_functiondef('public.apply_dodo_event(text,text,text,timestamptz,timestamptz,text,text,text,uuid,jsonb)'::regprocedure);
 if position('return v_result;' in body)=0 then raise exception 'UNEXPECTED_DODO_WRITER';end if;
 body:=replace(body,'return v_result;','update public.web_billing_checkouts set state=case when p_event_type in (''EXPIRATION'',''REVOCATION'',''CANCELLATION'') then ''closed'' else ''active'' end, subscription_id=p_subscription_id where id=p_checkout_id and provider=''dodo''; return v_result;');
 execute body;
end;$$;
notify pgrst,'reload schema';
