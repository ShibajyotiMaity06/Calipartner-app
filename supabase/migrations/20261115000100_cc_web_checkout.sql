create table public.cc_web_checkouts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  pack_id text not null references public.cc_packs,
  cc integer not null check (cc > 0),
  provider text not null check (provider in ('dodo','razorpay')),
  product_id text not null,
  currency text not null check (currency in ('INR','USD')),
  amount integer not null check (amount > 0),
  provider_ref text unique,
  checkout_url text,
  payment_id text unique,
  state text not null default 'pending' check (state in ('pending','ready','paid','refunded')),
  created_at timestamptz not null default now()
);
alter table public.cc_web_checkouts enable row level security;
revoke all on public.cc_web_checkouts from anon, authenticated;
grant select on public.cc_web_checkouts to authenticated;
grant all on public.cc_web_checkouts to service_role;
create policy cc_web_owner_read on public.cc_web_checkouts for select to authenticated using (user_id=auth.uid());

create function public.reserve_cc_web_checkout(p_id uuid,p_user uuid,p_pack text,p_provider text,p_product text,p_currency text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.cc_web_checkouts; pack public.cc_packs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,151));
  select * into c from public.cc_web_checkouts where id=p_id;
  if found then
    if c.user_id<>p_user or c.pack_id<>p_pack then raise exception 'CHECKOUT_CONFLICT'; end if;
    return jsonb_build_object('fresh',false,'checkout',to_jsonb(c));
  end if;
  select * into pack from public.cc_packs where id=p_pack and active;
  if not found then raise exception 'UNKNOWN_PACK'; end if;
  insert into public.cc_web_checkouts(id,user_id,pack_id,cc,provider,product_id,currency,amount)
  values(p_id,p_user,p_pack,pack.cc,p_provider,p_product,p_currency,p_amount) returning * into c;
  return jsonb_build_object('fresh',true,'checkout',to_jsonb(c));
end $$;

-- Only verified provider webhooks call this function. Refund tombstones win over late success.
create function public.apply_cc_web_event(p_id uuid,p_provider text,p_ref text,p_payment text,p_refund boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.cc_web_checkouts; txn text;
begin
  select * into c from public.cc_web_checkouts where id=p_id for update;
  if not found or c.provider<>p_provider or c.provider_ref is distinct from p_ref or
     p_payment is null or length(p_payment) not between 1 and 200 or
     (c.payment_id is not null and c.payment_id<>p_payment) then raise exception 'INVALID_CC_RECEIPT'; end if;
  txn := p_provider||':'||p_payment;
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,130));
  if p_refund then
    if c.state='paid' then
      insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key)
      values(c.user_id,'purchased',-c.cc,'pack_refund','refund:'||txn) on conflict do nothing;
    end if;
    update public.cc_web_checkouts set state='refunded',payment_id=p_payment where id=c.id;
  elsif c.state not in ('paid','refunded') then
    insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key)
    values(c.user_id,'purchased',c.cc,'pack_purchase','pack:'||txn) on conflict do nothing;
    update public.cc_web_checkouts set state='paid',payment_id=p_payment where id=c.id;
  end if;
end $$;
revoke all on function public.reserve_cc_web_checkout(uuid,uuid,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.apply_cc_web_event(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_cc_web_checkout(uuid,uuid,text,text,text,text,integer) to service_role;
grant execute on function public.apply_cc_web_event(uuid,text,text,text,boolean) to service_role;
