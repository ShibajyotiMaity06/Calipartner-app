-- Existing room challenges keep their identity and consent; new clients use the unified engine.
do $$
declare legacy record;t public.challenge_templates;cfg jsonb;rules jsonb;u uuid;
begin
 select * into t from public.challenge_templates where slug='log-it';select value into cfg from public.challenge_config where key='rules';
 for legacy in select * from public.pair_challenges loop
  rules:=cfg||t.rule_overrides||jsonb_build_object('format',t.format,'tasks',to_jsonb(t.tasks),'duration_days',t.duration_options[1],'pass_days',t.duration_options[1],'weekly_days',t.duration_options[1],'allow_manual',t.allow_manual,'title_key',t.title_key,'desc_key',t.desc_key,'icon_key',t.icon_key,'chapters',t.chapters,'requested_start',coalesce(legacy.started_at::date+1,current_date+1),'minimum_meals',1);
  insert into public.challenges(id,template_id,template_version,rules_snapshot,creator_id,scope,start_date,end_date,duration_days,status,invite_expires_at,created_at)
  values(legacy.id,t.id,t.version,rules,legacy.creator_id,'pair',legacy.started_at::date,legacy.started_at::date+t.duration_options[1]-1,t.duration_options[1],case legacy.status when 'pending' then 'invited' when 'declined' then 'cancelled' else 'active' end,legacy.created_at+interval '48 hours',legacy.created_at) on conflict(id) do nothing;
  foreach u in array array[legacy.creator_id,legacy.partner_id] loop
   insert into public.challenge_participants(challenge_id,user_id,status,targets,benefits,tz,start_date,joined_at,comparison_opt_out)
   select legacy.id,u,case when u=legacy.partner_id and legacy.status='pending' then 'invited' when u=legacy.partner_id and legacy.status='declined' then 'declined' else 'joined' end,'{"food_log_days":1}',public.challenge_plan_config(u),p.timezone,(legacy.started_at at time zone p.timezone)::date,legacy.started_at,not coalesce((m.privacy_settings->>'share_streak')::boolean,true)
   from public.profiles p left join public.room_members m on m.room_id=legacy.room_id and m.user_id=u where p.id=u on conflict do nothing;
  end loop;
 end loop;
 update public.challenge_counters ctr set joined_count=(select count(*) from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where c.template_id=ctr.template_id and p.joined_at is not null);
end;$$;

-- Older installed clients retain their API contract, but cannot bypass the new quota.
create or replace function public.create_pair_challenge(p_client_id uuid,p_room_id uuid,p_partner_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.challenge_templates;existing public.pair_challenges;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if not public.is_room_member(p_room_id,auth.uid()) or not public.is_room_member(p_room_id,p_partner_id) or auth.uid()=p_partner_id then raise exception 'NOT_ROOM_MEMBER';end if;
 if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED';end if;
 if public.active_room_tier(auth.uid())='free' or public.active_room_tier(p_partner_id)='free' then raise exception 'BOTH_PLUS_REQUIRED';end if;
 select * into existing from public.pair_challenges where id=p_client_id;
 if found then
  if existing.creator_id<>auth.uid() or existing.room_id<>p_room_id or existing.partner_id<>p_partner_id then raise exception 'NOT_AUTHORIZED';end if;
  return p_client_id;
 end if;
 select * into t from public.challenge_templates where slug='log-it' and active;
 perform public.challenge_create_server(auth.uid(),p_client_id,t.id,'pair',t.duration_options[1],array[p_partner_id],'{"food_log_days":1}');
 insert into public.pair_challenges(id,room_id,creator_id,partner_id) values(p_client_id,p_room_id,auth.uid(),p_partner_id);
 return p_client_id;
end;$$;
create or replace function public.respond_pair_challenge(p_challenge_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.pair_challenges;
begin
 select * into c from public.pair_challenges where id=p_challenge_id for update;
 if not found or auth.uid() is distinct from c.partner_id then raise exception 'NOT_AUTHORIZED';end if;
 if not public.is_room_member(c.room_id,auth.uid()) or not public.is_room_member(c.room_id,c.creator_id) then raise exception 'NOT_ROOM_MEMBER';end if;
 perform public.challenge_respond_server(auth.uid(),p_challenge_id,p_accept,'{"food_log_days":1}');
 update public.pair_challenges set status=case when p_accept then 'active' else 'declined' end,started_at=case when p_accept then now() else null end where id=p_challenge_id and status='pending';
end;$$;
