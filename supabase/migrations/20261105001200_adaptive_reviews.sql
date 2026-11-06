-- Purchased-Pro reviews: private evidence, service-calculated proposals, explicit acceptance.
create table public.adaptive_review_proposals (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_goal_id uuid not null references public.goal_profiles(id) on delete cascade,
 evidence jsonb not null,
 proposal jsonb not null,
 applied_goal_id uuid,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.adaptive_review_proposals enable row level security;
create policy adaptive_review_no_direct_access on public.adaptive_review_proposals for all to authenticated using(false) with check(false);
revoke all on public.adaptive_review_proposals from anon,authenticated;
grant all on public.adaptive_review_proposals to service_role;
create index adaptive_reviews_owner on public.adaptive_review_proposals(user_id,created_at);

create function public.has_adaptive_review_access(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.entitlements where user_id=p_user_id and tier='pro' and status='paid' and (period_end is null or period_end>now()));
$$;
revoke all on function public.has_adaptive_review_access(uuid) from public,anon,authenticated;
grant execute on function public.has_adaptive_review_access(uuid) to service_role;

create function public.adaptive_review_context(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare g public.goal_profiles; p public.profiles; screened boolean; day date;
begin
 if not public.has_adaptive_review_access(p_user_id) then raise exception 'PURCHASED_PRO_REQUIRED'; end if;
 select * into p from public.profiles where id=p_user_id;
 select * into g from public.goal_profiles where user_id=p_user_id and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1;
 if g.id is null then raise exception 'GOALS_REQUIRED'; end if;
 select not (pregnant_or_breastfeeding or has_diabetes_or_medication or has_eating_disorder_history) into screened from public.health_screening where user_id=p_user_id;
 day:=(now() at time zone p.timezone)::date;
 return jsonb_build_object('now',now(),'age',extract(year from age(day,p.date_of_birth)),'sex',p.sex,'safe',coalesce(screened,false) and p.date_of_birth<=day-interval '18 years',
  'goal',to_jsonb(g)||jsonb_build_object('input_height_cm',coalesce(g.input_height_cm,p.height_cm)),
  'days',(select jsonb_agg(jsonb_build_object('date',d::date,'calories',coalesce(f.calories,0),'foods',coalesce(f.foods,0),'weight',w.weight) order by d) from generate_series(day-14,day-1,interval '1 day') d
   left join lateral (select sum(calories) calories,count(*) foods from public.food_entries where user_id=p_user_id and deleted_at is null and local_date::text=d::date::text) f on true
   left join lateral (select avg(weight_kg) weight from public.weight_logs where user_id=p_user_id and deleted_at is null and local_date::text=d::date::text) w on true));
end; $$;
revoke all on function public.adaptive_review_context(uuid) from public,anon,authenticated;
grant execute on function public.adaptive_review_context(uuid) to service_role;

create function public.store_adaptive_review(p_user_id uuid,p_id uuid,p_context jsonb,p_proposal jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actual jsonb; prior public.adaptive_review_proposals;
begin
 if p_id is null or p_proposal is null then raise exception 'INVALID_REVIEW'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,94));
 actual:=public.adaptive_review_context(p_user_id);
 if actual-'now' is distinct from p_context-'now' then raise exception 'REVIEW_STALE'; end if;
 if (actual#>>'{goal,confirmed_at}')::timestamptz>now()-interval '30 days' then raise exception 'REVIEW_NOT_DUE'; end if;
 if actual->>'safe'<>'true' or coalesce((actual#>>'{goal,custom_macros}')::boolean,false) then raise exception 'REVIEW_SAFETY'; end if;
 if p_proposal->>'source_goal_id' is distinct from actual#>>'{goal,id}' then raise exception 'REVIEW_STALE'; end if;
 select * into prior from public.adaptive_review_proposals where id=p_id;
 if found then
  if prior.user_id<>p_user_id or prior.proposal<>p_proposal then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('id',prior.id,'proposal',prior.proposal);
 end if;
 insert into public.adaptive_review_proposals(id,user_id,source_goal_id,evidence,proposal) values(p_id,p_user_id,(actual#>>'{goal,id}')::uuid,actual-'now',p_proposal);
 return jsonb_build_object('id',p_id,'proposal',p_proposal);
end; $$;
revoke all on function public.store_adaptive_review(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.store_adaptive_review(uuid,uuid,jsonb,jsonb) to service_role;

create function public.accept_adaptive_review(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.adaptive_review_proposals; actual jsonb; g public.goal_profiles; next_goal public.goal_profiles;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.has_adaptive_review_access(auth.uid()) then raise exception 'PURCHASED_PRO_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,94));
 select * into r from public.adaptive_review_proposals where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'REVIEW_UNAVAILABLE'; end if;
 if r.applied_goal_id is not null then
  return (select to_jsonb(saved) from public.goal_profiles saved where saved.id=r.applied_goal_id and saved.user_id=auth.uid());
 end if;
 actual:=public.adaptive_review_context(auth.uid());
 if r.expires_at<=now() or r.evidence is distinct from actual-'now' then raise exception 'REVIEW_STALE'; end if;
 if actual->>'safe'<>'true' or coalesce((actual#>>'{goal,custom_macros}')::boolean,false) then raise exception 'REVIEW_SAFETY'; end if;
 select * into g from public.goal_profiles where id=r.source_goal_id and user_id=auth.uid() for update;
 next_goal:=jsonb_populate_record(g,r.proposal||jsonb_build_object('id',r.id,'user_id',auth.uid(),'effective_from',now(),'confirmed_at',now(),'created_at',now(),'recompute_reason','recalibration'));
 if abs(next_goal.tdee-g.tdee)>g.tdee*0.1+1 or next_goal.current_weight_kg not between 20 and 500
  or abs(next_goal.daily_calorie_target-next_goal.tdee)>next_goal.current_weight_kg*0.01*1100+1
  or next_goal.daily_calorie_target<(case actual->>'sex' when 'male' then 1500 when 'female' then 1200 else 1350 end)
  or next_goal.protein_grams*4+next_goal.fat_grams*9>next_goal.daily_calorie_target+7
  or (next_goal.goal='cut' and (next_goal.daily_calorie_target>next_goal.tdee or next_goal.current_weight_kg/power((actual#>>'{goal,input_height_cm}')::numeric/100,2)<18.5))
  then raise exception 'REVIEW_SAFETY'; end if;
 insert into public.goal_profiles select (next_goal).*;
 update public.adaptive_review_proposals set applied_goal_id=next_goal.id where id=r.id;
 return to_jsonb(next_goal);
end; $$;
revoke all on function public.accept_adaptive_review(uuid) from public,anon;
grant execute on function public.accept_adaptive_review(uuid) to authenticated;
notify pgrst,'reload schema';
