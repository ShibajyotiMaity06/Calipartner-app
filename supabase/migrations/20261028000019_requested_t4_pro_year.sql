-- Explicit owner grant for this existing account only. No signup allowlist,
-- no renewal billing, and no change to the purchased-Pro-only AI rule.
do $$
declare v_user uuid;
begin
  select id into v_user from auth.users
    where lower(email)='shibajyoti.maity06+t4@gmail.com';
  if v_user is null then
    -- Fresh/local databases need no copy of a real user's Auth account.
    return;
  end if;
  insert into public.entitlements(user_id,plan,source,status,tier,period_end,updated_at)
    values(v_user,'annual','none','paid','pro',now()+interval '1 year',now())
  on conflict(user_id) do update set
    plan='annual', source='none', status='paid', tier='pro',
    period_end=greatest(public.entitlements.period_end,excluded.period_end),updated_at=now();
end; $$;
