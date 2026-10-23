-- =============================================================================
-- Migration: 20261021000002_grant_pro_entitlement_vip_users.sql
-- Description: Grant 1-year Pro subscription to VIP team / founder emails:
--              - shibajyoti.maity06@gmail.com
--              - nav71063@gmail.com
--              - naveennav6227@gmail.com
--              - fathimarida220@gmail.com
-- =============================================================================

create or replace function public.grant_vip_pro_for_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is not null then
    insert into public.entitlements (
      user_id,
      plan,
      source,
      status,
      tier,
      period_end,
      updated_at
    )
    values (
      v_uid,
      'annual',
      'promotional',
      'paid',
      'pro',
      now() + interval '1 year',
      now()
    )
    on conflict (user_id) do update set
      plan = 'annual',
      source = 'promotional',
      status = 'paid',
      tier = 'pro',
      period_end = now() + interval '1 year',
      updated_at = now();
  end if;
end;
$$;

-- Grant immediately to any registered users
select public.grant_vip_pro_for_email('shibajyoti.maity06@gmail.com');
select public.grant_vip_pro_for_email('nav71063@gmail.com');
select public.grant_vip_pro_for_email('naveennav6227@gmail.com');
select public.grant_vip_pro_for_email('fathimarida220@gmail.com');

-- Trigger to grant automatically on user sign-up
create or replace function public.trig_handle_vip_user_pro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  v_email := lower(coalesce(new.email, ''));
  if v_email in (
    'shibajyoti.maity06@gmail.com',
    'nav71063@gmail.com',
    'naveennav6227@gmail.com',
    'fathimarida220@gmail.com'
  ) then
    insert into public.entitlements (
      user_id,
      plan,
      source,
      status,
      tier,
      period_end,
      updated_at
    )
    values (
      new.id,
      'annual',
      'promotional',
      'paid',
      'pro',
      now() + interval '1 year',
      now()
    )
    on conflict (user_id) do update set
      plan = 'annual',
      source = 'promotional',
      status = 'paid',
      tier = 'pro',
      period_end = now() + interval '1 year',
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vip_pro on auth.users;
create trigger on_auth_user_created_vip_pro
  after insert on auth.users
  for each row execute function public.trig_handle_vip_user_pro();
