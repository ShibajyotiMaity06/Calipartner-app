-- Live cutover: sandbox checkouts are not purchases and must not unlock AI.
-- Match the original transaction, so an old test checkout can never revoke a
-- newer live/store purchase. These public product IDs belong only to test mode.
do $$
declare v_user uuid;
begin
  for v_user in
    update public.entitlements e set status='lapsed', period_end=now(), updated_at=now()
    where e.source='dodo' and e.status in ('paid','grace','trial')
      and exists (
        select 1 from public.dodo_subscriptions s
        join public.dodo_checkouts c on c.id=s.checkout_id
        where s.user_id=e.user_id and s.subscription_id=e.original_transaction_id
          and c.product_id in (
            'pdt_0NqcXeau9oaqYVASpZcsU',
            'pdt_0NqcXeeLDhY3qoeNR2ReD',
            'pdt_0NqcXehxY6YAVkRCitxTw',
            'pdt_0NqcXelIZAyFcdi7QqLFp',
            'pdt_0NqcXepf1xeBlaUcXIsgB',
            'pdt_0NqcXeuCnhL9HHqTPPbb1',
            'pdt_0NqcXexg89DlSvF6TIWV7',
            'pdt_0NqcXf1Awz8qkaBnTgGKW'
          )
      )
    returning e.user_id
  loop
    perform public.recompute_room_state(id) from public.rooms where plan_holder_id=v_user and state<>'archived';
  end loop;
end; $$;
