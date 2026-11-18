create table public.coin_referral_links (
  inviter_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.coin_referral_claims (
  invitee_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);

alter table public.coin_referral_links enable row level security;
alter table public.coin_referral_claims enable row level security;
revoke all on public.coin_referral_links,public.coin_referral_claims from public,anon,authenticated,service_role;

create function public.get_coin_referral_link() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := auth.uid(); code uuid;
begin
  if actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.goal_profiles where user_id=actor) then raise exception 'SETUP_REQUIRED'; end if;
  insert into public.coin_referral_links(inviter_id) values(actor)
    on conflict(inviter_id) do nothing;
  select token into code from public.coin_referral_links where inviter_id=actor;
  return code;
end;
$$;

create function public.award_referral_purchase(p_entitlement public.entitlements) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key)
  select inviter_id,'earned',100,'referral_purchase','referral:purchase:'||invitee_id
    from public.coin_referral_claims where invitee_id=p_entitlement.user_id
      and p_entitlement.tier in ('plus','pro') and p_entitlement.status='paid'
      and p_entitlement.source in ('apple','google','dodo','razorpay')
      and nullif(p_entitlement.original_transaction_id,'') is not null
      and nullif(p_entitlement.store_product_id,'') is not null
      and p_entitlement.last_event_timestamp is not null
      and p_entitlement.period_end > now()
  on conflict(idempotency_key) do nothing;
$$;

create function public.on_paid_referral_entitlement() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,907));
  perform public.award_referral_purchase(new);
  return new;
end;
$$;

create trigger reward_paid_referral after insert or update of status,period_end on public.entitlements
  for each row when (new.status='paid') execute function public.on_paid_referral_entitlement();

create function public.claim_coin_referral(p_token uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); link public.coin_referral_links;
  registered_at timestamptz; verified_at timestamptz; entitlement public.entitlements;
begin
  if actor is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,907));
  if exists(select 1 from public.coin_referral_claims where invitee_id=actor) then return 'claimed'; end if;
  select * into link from public.coin_referral_links where token=p_token;
  if not found or actor=link.inviter_id then return 'ineligible'; end if;
  select a.created_at, (to_jsonb(a)->>'email_confirmed_at')::timestamptz
    into registered_at,verified_at from auth.users a where id=actor;
  if registered_at is null or registered_at<link.created_at or registered_at<now()-interval '7 days'
    then return 'ineligible'; end if;
  if verified_at is null or not exists(select 1 from public.goal_profiles where user_id=actor)
    then return 'setup_required'; end if;
  insert into public.coin_referral_claims(invitee_id,inviter_id) values(actor,link.inviter_id);
  insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values
    (actor,'earned',15,'referral_new_member','referral:invitee:'||actor),
    (link.inviter_id,'earned',15,'referral_join','referral:inviter:'||actor)
    on conflict(idempotency_key) do nothing;
  select * into entitlement from public.entitlements where user_id=actor;
  if found then perform public.award_referral_purchase(entitlement); end if;
  return 'claimed';
end;
$$;

create function public.get_coin_earn_options() returns table(action text,amount integer)
language sql stable security definer set search_path=public,pg_temp as $$
  select items.* from (
    select
      case r.action when 'daily_drop' then 'meal' else r.action end,r.cc
    from public.cc_earn_rules r where r.active and r.cc>0
    union all
    select row->>'key',(row->>'cc')::integer from public.avatar_config c
      cross join lateral jsonb_array_elements(c.value) row
      where c.key='starter_path' and row->>'key' in ('create_character','first_log','first_workout','three_day_streak')
    union all
    values('referral_join',15),('referral_new_member',15),('referral_purchase',100)
  ) items where auth.uid() is not null;
$$;

revoke all on function public.get_coin_referral_link(),public.claim_coin_referral(uuid),public.get_coin_earn_options(),
 public.award_referral_purchase(public.entitlements),public.on_paid_referral_entitlement() from public,anon,authenticated;
grant execute on function public.get_coin_referral_link(),public.claim_coin_referral(uuid),
 public.get_coin_earn_options() to authenticated;
notify pgrst,'reload schema';
