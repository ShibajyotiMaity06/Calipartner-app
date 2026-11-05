-- Account-owned Plus trials need no payment method, checkout or provider mandate.
create table public.plus_trial_claims (
  id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  check(ends_at = started_at + interval '7 days')
);
alter table public.plus_trial_claims enable row level security;
revoke all on public.plus_trial_claims from public, anon, authenticated;
grant select on public.plus_trial_claims to authenticated;
grant all on public.plus_trial_claims to service_role;
create policy plus_trial_claims_own_read on public.plus_trial_claims for select to authenticated using(user_id=auth.uid());
create policy plus_trial_claims_service on public.plus_trial_claims for all to service_role using(true) with check(true);

create function public.get_plus_trial_offer(p_device_hash text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.entitlements;c public.plus_trial_claims;active boolean;eligible boolean;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 select * into e from public.entitlements where user_id=auth.uid();
 select * into c from public.plus_trial_claims where user_id=auth.uid();
 active:=coalesce(e.source='none' and e.tier='plus' and e.status='trial' and e.period_end>now(),false);
 eligible:=e.trial_started_at is null and c.id is null and coalesce(e.source,'none')='none'
   and not (coalesce(e.status in ('paid','grace'),false) and (e.period_end is null or e.period_end>now()))
   and not exists(select 1 from public.web_billing_checkouts where user_id=auth.uid() and state<>'closed')
   and not exists(select 1 from public.device_trials where device_hash=p_device_hash and user_id<>auth.uid());
 return jsonb_build_object('eligible',eligible,'active',active,
   'expired',coalesce(c.ends_at<=now(),false) and public.active_room_tier(auth.uid())='free',
   'started_at',coalesce(c.started_at,e.trial_started_at),'ends_at',case when active then e.period_end else c.ends_at end,
   'claim_id',c.id,'server_now',now());
end;$$;

create function public.claim_plus_trial(p_client_id uuid,p_device_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();c public.plus_trial_claims;offer jsonb;started timestamptz:=now();
begin
 if actor is null then raise exception 'UNAUTHENTICATED';end if;
 if p_client_id is null or nullif(btrim(p_device_hash),'') is null or length(p_device_hash)>256 then raise exception 'INVALID_TRIAL_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,907));
 perform pg_advisory_xact_lock(hashtextextended(p_device_hash,908));
 select * into c from public.plus_trial_claims where id=p_client_id;
 if found and c.user_id<>actor then raise exception 'NOT_AUTHORIZED';end if;
 select * into c from public.plus_trial_claims where user_id=actor;
 if found then return public.get_plus_trial_offer(p_device_hash);end if;
 offer:=public.get_plus_trial_offer(p_device_hash);
 if not (offer->>'eligible')::boolean then raise exception 'TRIAL_NOT_ELIGIBLE';end if;
 insert into public.plus_trial_claims(id,user_id,started_at,ends_at) values(p_client_id,actor,started,started+interval '7 days');
 insert into public.device_trials(device_hash,user_id,trial_started_at) values(p_device_hash,actor,started)
 on conflict(device_hash) do nothing;
 insert into public.entitlements(user_id,tier,period,source,status,trial_started_at,period_end,cancel_at_period_end,updated_at)
 values(actor,'plus','monthly','none','trial',started,started+interval '7 days',true,started)
 on conflict(user_id) do update set tier='plus',period='monthly',source='none',status='trial',
   trial_started_at=excluded.trial_started_at,period_end=excluded.period_end,cancel_at_period_end=true,updated_at=excluded.updated_at;
 perform public.recompute_room_state(id) from public.rooms where plan_holder_id=actor and state<>'archived';
 return public.get_plus_trial_offer(p_device_hash);
end;$$;
revoke all on function public.get_plus_trial_offer(text),public.claim_plus_trial(uuid,text) from public,anon;
grant execute on function public.get_plus_trial_offer(text),public.claim_plus_trial(uuid,text) to authenticated;
-- The old helper is not a second app-facing route around the new claim record.
revoke execute on function public.start_trial_if_eligible(uuid,text,uuid) from public,anon,authenticated;

-- New web purchases charge their chosen paid plan; old reserved mandates keep their terms.
create or replace function public.reserve_web_checkout(p_user_id uuid,p_id uuid,p_provider text,p_product_key text,p_product_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.web_billing_checkouts;e public.entitlements;country text;
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
 if ((e.status in ('paid','grace') and (e.period_end is null or e.period_end>now()))
   or (e.status='trial' and e.source<>'none' and e.period_end>now())) then raise exception 'MANAGE_EXISTING_SUBSCRIPTION';end if;
 if exists(select 1 from public.web_billing_checkouts where user_id=p_user_id and state<>'closed') then raise exception 'CHECKOUT_PENDING';end if;
 insert into public.web_billing_checkouts(id,user_id,provider,product_key,product_id,trial_end)
 values(p_id,p_user_id,p_provider,p_product_key,p_product_id,null) returning * into c;
 return to_jsonb(c)||jsonb_build_object('cached',false);
end;$$;

-- A later store/provider intro cannot restart the account's already-used seven days.
do $$ declare body text;needle text;begin
 body:=pg_get_functiondef('public.apply_revenuecat_event(text,text,uuid,text,text,timestamptz,timestamptz,jsonb)'::regprocedure);
 body:=replace(body,'  select * into v_current_ent',E'  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,907));\n  select * into v_current_ent');
 needle:='  if found and v_current_ent.last_event_timestamp is not null then';
 if position(needle in body)=0 then raise exception 'UNEXPECTED_ENTITLEMENT_WRITER';end if;
 body:=replace(body,needle,$guard$
  if v_status='trial' and v_current_ent.trial_started_at is not null then
    v_trial_start:=v_current_ent.trial_started_at;
    v_period_end:=least(v_period_end,v_trial_start+interval '7 days');
    if v_period_end<=now() then v_status:='lapsed';end if;
  end if;
$guard$||needle);
 execute body;
end;$$;
notify pgrst,'reload schema';
