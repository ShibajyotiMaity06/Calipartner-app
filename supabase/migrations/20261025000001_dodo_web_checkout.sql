-- Account-bound Dodo checkout records. Client applications cannot grant access.
create table public.dodo_checkouts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_key text not null check(product_key in ('plus_monthly','plus_annual','pro_monthly','pro_annual')),
  product_id text not null,
  session_id text,
  checkout_url text,
  created_at timestamptz not null default now()
);
alter table public.dodo_checkouts enable row level security;
create policy dodo_checkouts_owner_read on public.dodo_checkouts for select to authenticated using(user_id=auth.uid());
create policy dodo_checkouts_service on public.dodo_checkouts for all to service_role using(true) with check(true);

create table public.dodo_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id text not null,
  checkout_id uuid not null references public.dodo_checkouts(id),
  updated_at timestamptz not null default now()
);
alter table public.dodo_subscriptions enable row level security;
create policy dodo_subscriptions_service on public.dodo_subscriptions for all to service_role using(true) with check(true);

create or replace function public.apply_dodo_event(
  p_event_id text, p_event_type text, p_product_key text, p_period_end timestamptz,
  p_event_timestamp timestamptz, p_subscription_id text, p_customer_id text,
  p_product_id text, p_checkout_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid; v_checkout public.dodo_checkouts; v_result jsonb;
begin
  if p_product_key not in ('plus_monthly','plus_annual','pro_monthly','pro_annual') or p_product_key is null
    or p_event_type not in ('INITIAL_PURCHASE','CANCELLATION','EXPIRATION','REVOCATION')
    or p_event_type is null or p_event_timestamp is null or p_subscription_id is null or p_customer_id is null then
    raise exception 'INVALID_DODO_EVENT';
  end if;
  -- Bind a subscription once to a checkout created by our authenticated server.
  perform pg_advisory_xact_lock(hashtextextended(p_subscription_id,68));
  select user_id into v_owner from public.dodo_subscriptions where subscription_id=p_subscription_id;
  if v_owner is null then
    select * into v_checkout from public.dodo_checkouts where id=p_checkout_id;
    if not found or v_checkout.product_id<>p_product_id or v_checkout.product_key<>p_product_key then
      raise exception 'INVALID_DODO_CHECKOUT';
    end if;
    v_owner:=v_checkout.user_id;
    insert into public.dodo_subscriptions(subscription_id,user_id,customer_id,checkout_id)
      values(p_subscription_id,v_owner,p_customer_id,p_checkout_id);
  elsif not exists(select 1 from public.dodo_subscriptions where subscription_id=p_subscription_id and customer_id=p_customer_id) then
    raise exception 'INVALID_DODO_CUSTOMER';
  end if;
  if p_event_type in ('INITIAL_PURCHASE','CANCELLATION') and (p_period_end is null or p_period_end<=now()) then
    raise exception 'INVALID_DODO_PERIOD';
  end if;
  if p_event_type in ('EXPIRATION','REVOCATION') and not exists(select 1 from public.entitlements where user_id=v_owner and source='dodo' and original_transaction_id=p_subscription_id) then
    return jsonb_build_object('status','ignored_unrelated_subscription');
  end if;
  v_result:=public.apply_revenuecat_event('dodo:'||p_event_id,p_event_type,v_owner,p_product_key,'dodo',p_period_end,p_event_timestamp,p_payload);
  return v_result;
end; $$;
revoke all on function public.apply_dodo_event(text,text,text,timestamptz,timestamptz,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_dodo_event(text,text,text,timestamptz,timestamptz,text,text,text,uuid,jsonb) to service_role;
