-- Only this access-checked projection exposes tracking choices to squad members.
-- Disabled metrics do not reveal their stored totals. Logs and safety targets remain unchanged.
create or replace function public.get_squad_today(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_squad_access(p_room_id);
  return jsonb_build_object('room_id',p_room_id,'members',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',p.id,'username',p.username,'nickname',p.nickname,'avatar_url',p.avatar_url,
      'is_self',p.id=auth.uid(),'role',m.role,'status',m.status,
      'local_date',(now() at time zone p.timezone)::date,'goal',g.goal,
      'calories',case when coalesce((tp.enabled->>'calories')::boolean,true) then coalesce(f.calories,0) else null end,'protein',case when coalesce((tp.enabled->>'protein')::boolean,true) then coalesce(f.protein,0) else null end,'carbs',case when coalesce((tp.enabled->>'carbs')::boolean,true) then coalesce(f.carbs,0) else null end,'fat',case when coalesce((tp.enabled->>'fat')::boolean,true) then coalesce(f.fat,0) else null end,
      'tracking',coalesce(tp.enabled,'{"calories":true,"protein":true,"carbs":true,"fat":true,"steps":true,"water":false}'::jsonb),
      'steps',case when coalesce((tp.enabled->>'steps')::boolean,true) then coalesce(a.steps,0) else null end,'water',case when coalesce((tp.enabled->>'water')::boolean,false) then coalesce(h.water,0) else null end,
      'targets',case when g.id is null then null else jsonb_build_object('calories',g.daily_calorie_target,'protein',g.protein_grams,'carbs',g.carb_grams,'fat',g.fat_grams,'steps',g.step_goal,'water',g.water_ml_goal) end,
      'height_cm',case when p.id=auth.uid() or coalesce((m.privacy_settings->>'share_height')::boolean,false) then p.height_cm else null end,
      'weight_kg',case when p.id=auth.uid() or coalesce((m.privacy_settings->>'share_weight_number')::boolean,false) then coalesce(w.weight_kg,g.current_weight_kg) else null end
    ) order by p.id),'[]'::jsonb)
    from public.room_members m join public.profiles p on p.id=m.user_id
    left join public.tracking_preferences tp on tp.user_id=p.id
    left join lateral (select * from public.goal_profiles where user_id=p.id and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1) g on true
    left join lateral (select sum(calories) calories,sum(protein) protein,sum(carbs) carbs,sum(fat) fat from public.food_entries where user_id=p.id and deleted_at is null and local_date::text=(now() at time zone p.timezone)::date::text) f on true
    left join lateral (select sum(amount_ml) water from public.water_logs where user_id=p.id and deleted_at is null and local_date::text=(now() at time zone p.timezone)::date::text) h on true
    left join public.activity_days a on a.user_id=p.id and a.local_date::text=(now() at time zone p.timezone)::date::text and a.deleted_at is null
    left join lateral (select weight_kg from public.weight_logs where user_id=p.id and deleted_at is null and logged_at<=now() order by logged_at desc,id desc limit 1) w on true
    where m.room_id=p_room_id and m.status in ('active','paused','locked')
      and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocked_id=auth.uid() and b.blocker_id=p.id))
  ));
end; $$;
revoke all on function public.get_squad_today(uuid) from public,anon;
grant execute on function public.get_squad_today(uuid) to authenticated;
