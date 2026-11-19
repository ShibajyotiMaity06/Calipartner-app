-- Allow members (including free users) to read their own squad member details (meals and workouts)
create or replace function public.get_squad_member_details(p_room_id uuid,p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare day text;
begin
  perform public.assert_squad_access(p_room_id);
  if public.active_room_tier(auth.uid())='free' and auth.uid() <> p_member_id then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,p_member_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_member_id) or (blocked_id=auth.uid() and blocker_id=p_member_id)) then raise exception 'USER_BLOCKED'; end if;
  select (now() at time zone timezone)::date::text into day from public.profiles where id=p_member_id;
  return jsonb_build_object(
    'meals',(select coalesce(jsonb_agg(to_jsonb(meal) order by section),'[]'::jsonb) from (
      select e.meal_section section,sum(e.calories) calories,sum(e.protein) protein,sum(e.carbs) carbs,sum(e.fat) fat,
        jsonb_agg(jsonb_build_object('id',e.id,'name',e.food_name,'quantity',e.quantity,'unit',e.unit) order by e.logged_at,e.id) items
      from public.food_entries e where e.user_id=p_member_id and e.local_date::text=day and e.deleted_at is null group by e.meal_section
    ) meal),
    'workouts',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',coalesce(w.name,w.type),'type',w.type,'duration_minutes',w.duration_minutes,
      'exercises',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.exercise_name,'sets',(
        select coalesce(jsonb_agg(jsonb_build_object('set_number',s.set_number,'reps',s.reps,'weight_kg',s.weight_kg,'duration_seconds',s.duration_seconds,'distance_meters',s.distance_meters) order by s.set_number,s.id),'[]'::jsonb)
        from public.workout_sets s where s.workout_exercise_id=e.id and s.user_id=p_member_id and s.workout_id=w.id and s.completed and s.deleted_at is null
      )) order by e.order_in_workout,e.id),'[]'::jsonb) from public.workout_exercises e where e.workout_id=w.id and e.user_id=p_member_id and e.deleted_at is null)
    ) order by w.start_time,w.id),'[]'::jsonb) from public.workouts w where w.user_id=p_member_id and w.local_date::text=day and w.deleted_at is null)
  );
end; $$;
revoke all on function public.get_squad_member_details(uuid,uuid) from public,anon;
grant execute on function public.get_squad_member_details(uuid,uuid) to authenticated;
