-- Cosmetic-only CC economy. All state changes are atomic server-authorized RPCs.
create table public.avatar_config(key text primary key,value jsonb not null);
create table public.avatar_collections(id text primary key,name text not null,tier_required text not null check(tier_required in ('free','plus','pro')),sort int not null default 0,earn_only boolean not null default false,bundle_discount_pct int not null default 15 check(bundle_discount_pct between 0 and 100),active boolean not null default true);
create table public.avatar_products(id text primary key,collection_id text not null references public.avatar_collections,definition jsonb not null,price_cc int not null check(price_cc>=0),active boolean not null default true);
create table public.avatar_tints(id text primary key,kind text not null check(kind in ('skin','hair','garment')),name text not null,hex text not null check(hex ~ '^#[0-9A-Fa-f]{6}$'),tier_required text not null check(tier_required in ('free','plus','pro')));
create table public.avatar_levels(level int primary key,xp_required int not null unique check(xp_required>=0),form int not null check(form between 1 and 3));
create table public.cc_earn_rules(action text primary key,cc int not null check(cc>=0),xp int not null check(xp>=0),daily_cap int not null check(daily_cap>0),active boolean not null default true);
create table public.cc_packs(id text primary key,store_product_id text not null unique,cc int not null check(cc>0),active boolean not null default true);
create table public.avatar_profiles(user_id uuid primary key references auth.users on delete cascade,gender text not null check(gender in ('m','f')),skin_tone_id text not null references public.avatar_tints,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),tz_changed_at timestamptz);
create table public.user_products(user_id uuid not null references auth.users on delete cascade,product_id text not null references public.avatar_products,source text not null check(source in ('starter','cc','earn')),price_paid_cc int not null default 0,acquired_at timestamptz not null default now(),primary key(user_id,product_id));
create table public.user_loadouts(user_id uuid primary key references auth.users on delete cascade,slots jsonb not null default '{}',tints jsonb not null default '{}',hash text not null default '',updated_at timestamptz not null default now());
create table public.cc_ledger(id bigint generated always as identity primary key,user_id uuid not null references auth.users on delete cascade,wallet text not null check(wallet in ('earned','purchased')),delta bigint not null,reason text not null,idempotency_key text not null unique,created_at timestamptz not null default now());
create index cc_ledger_owner on public.cc_ledger(user_id,created_at desc);
create table public.xp_ledger(id bigint generated always as identity primary key,user_id uuid not null references auth.users on delete cascade,delta int not null check(delta>=0),reason text not null,idempotency_key text not null unique,created_at timestamptz not null default now());
create index xp_ledger_owner on public.xp_ledger(user_id);
create table public.avatar_requests(user_id uuid not null references auth.users on delete cascade,request_id uuid not null,fingerprint text not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
create table public.cc_purchases(store_txn_id text primary key,user_id uuid not null references auth.users on delete cascade,pack_id text not null references public.cc_packs,cc_granted int not null,status text not null check(status in ('granted','refunded')),created_at timestamptz not null default now());
create table public.starter_path_progress(user_id uuid not null references auth.users on delete cascade,step_key text not null,completed_at timestamptz not null default now(),primary key(user_id,step_key));
create table public.avatar_wishlist(user_id uuid not null references auth.users on delete cascade,product_id text not null references public.avatar_products,primary key(user_id,product_id));
do $$ declare t text; begin
  foreach t in array array['avatar_config','avatar_collections','avatar_products','avatar_tints','avatar_levels','cc_earn_rules','cc_packs','avatar_profiles','user_products','user_loadouts','cc_ledger','xp_ledger','avatar_requests','cc_purchases','starter_path_progress','avatar_wishlist'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t=any(array['avatar_config','avatar_collections','avatar_products','avatar_tints','avatar_levels','cc_earn_rules','cc_packs']) then
      execute format('create policy catalogue_read on public.%I for select to authenticated using(auth.uid() is not null)',t);
    else
      execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
    end if;
  end loop;
end $$;
grant insert,delete on public.avatar_wishlist to authenticated;
create policy wishlist_insert on public.avatar_wishlist for insert to authenticated with check(user_id=auth.uid());
create policy wishlist_delete on public.avatar_wishlist for delete to authenticated using(user_id=auth.uid());

create function public.avatar_require_actor() returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'UNAUTHENTICATED'; end if;
 if not coalesce((select value='true'::jsonb from public.avatar_config where key='avatar_enabled'),false) then raise exception 'AVATAR_DISABLED'; end if;
 return u;
end $$;
create function public.avatar_tier_allows(required text,actor uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select case required when 'free' then true when 'plus' then public.active_room_tier(actor) in ('plus','pro') when 'pro' then public.active_room_tier(actor)='pro' else false end;
$$;
create function public.avatar_balances(actor uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('earned',coalesce(sum(delta) filter(where wallet='earned'),0),'purchased',coalesce(sum(delta) filter(where wallet='purchased'),0)) from public.cc_ledger where user_id=actor;
$$;
create function public.avatar_level_for(actor uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('xp',x.xp,'level',l.level,'form',l.form) from (select coalesce(sum(delta),0) xp from public.xp_ledger where user_id=actor) x cross join lateral(select * from public.avatar_levels where xp_required<=x.xp and level<=coalesce((select(value#>>'{}')::int from public.avatar_config where key='level_cap'),6) order by level desc limit 1) l;
$$;
create function public.avatar_snapshot(actor uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('user_id',a.user_id,'gender',a.gender,'skin_tone_id',a.skin_tone_id,'slots',l.slots,'tints',l.tints,'hash',l.hash,'created_at',a.created_at)||public.avatar_level_for(actor) from public.avatar_profiles a join public.user_loadouts l using(user_id) where a.user_id=actor;
$$;
create function public.avatar_qualifying_days(actor uuid) returns table(day date) language sql stable security definer set search_path=public,pg_temp as $$
 select local_date::date from public.food_entries where user_id=actor and deleted_at is null
 union select local_date::date from public.workouts where user_id=actor and deleted_at is null
 union select local_date::date from public.water_logs where user_id=actor and deleted_at is null
 union select local_date::date from public.activity_days where user_id=actor and deleted_at is null and steps>0;
$$;
create function public.avatar_reward(actor uuid,action_key text,ref text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cc_earn_rules; k text:=action_key||':'||actor||':'||ref;
begin
 select * into r from public.cc_earn_rules where action=action_key and active;
 if not found then return; end if;
 if r.cc>0 then insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(actor,'earned',r.cc,action_key,k) on conflict do nothing; end if;
 if r.xp>0 then insert into public.xp_ledger(user_id,delta,reason,idempotency_key) values(actor,r.xp,action_key,k) on conflict do nothing; end if;
end $$;
create function public.avatar_starter_reward(actor uuid,step text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare reward int; begin
 if not exists(select 1 from public.avatar_profiles where user_id=actor and created_at>now()-make_interval(days=>coalesce((select(value#>>'{}')::int from public.avatar_config where key='starter_days'),7))) then return; end if;
 select(x->>'cc')::int into reward from public.avatar_config c cross join lateral jsonb_array_elements(c.value) x where c.key='starter_path' and x->>'key'=step;
 if reward is null then return; end if;
 insert into public.starter_path_progress(user_id,step_key) values(actor,step) on conflict do nothing;
 insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(actor,'earned',reward,'starter_'||step,'starter:'||actor||':'||step) on conflict do nothing;
end $$;
create function public.avatar_reconcile_rewards() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor(); d date; has_meal boolean;has_workout boolean;has_steps boolean;has_water boolean;g public.goal_profiles; streak int:=0;i int;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,130));
 if not exists(select 1 from public.avatar_profiles where user_id=u) then return; end if;
 select(now() at time zone p.timezone)::date into d from public.profiles p where p.id=u;
 if d is null then return; end if;
 select * into g from public.goal_profiles where user_id=u and effective_from<=now() order by effective_from desc limit 1;
 select exists(select 1 from public.food_entries where user_id=u and local_date::date=d and deleted_at is null) into has_meal;
 select exists(select 1 from public.workouts where user_id=u and local_date::date=d and deleted_at is null) into has_workout;
 select g.step_goal>0 and coalesce(max(steps),0)>=g.step_goal into has_steps from public.activity_days where user_id=u and local_date::date=d and deleted_at is null;
 select g.water_ml_goal>0 and coalesce(sum(amount_ml),0)>=g.water_ml_goal into has_water from public.water_logs where user_id=u and local_date::date=d and deleted_at is null;
 if has_meal then perform public.avatar_reward(u,'meal',d::text); end if;
 if has_workout then perform public.avatar_reward(u,'workout',d::text); end if;
 if has_steps then perform public.avatar_reward(u,'steps_goal',d::text); end if;
 if has_water then perform public.avatar_reward(u,'water_goal',d::text); end if;
 if has_meal and has_workout and has_steps and has_water then perform public.avatar_reward(u,'all_rounder',d::text); end if;
 if exists(select 1 from public.avatar_qualifying_days(u) where day=d) then
   perform public.avatar_starter_reward(u,'first_log');
   if exists(select 1 from public.room_members mine join public.room_members peer on peer.room_id=mine.room_id and peer.user_id<>u and peer.status='active' join public.profiles p on p.id=peer.user_id where mine.user_id=u and mine.status='active' and public.room_is_usable(mine.room_id) and (select count(*) from public.room_members rm where rm.room_id=mine.room_id and rm.status='active')=2 and not exists(select 1 from public.blocks where (blocker_id=u and blocked_id=peer.user_id) or (blocker_id=peer.user_id and blocked_id=u)) and exists(select 1 from public.avatar_qualifying_days(peer.user_id) where day=(now() at time zone p.timezone)::date)) then perform public.avatar_reward(u,'pair_day',d::text); end if;
 end if;
 if exists(select 1 from public.workouts where user_id=u and deleted_at is null) then perform public.avatar_starter_reward(u,'first_workout'); end if;
 if exists(select 1 from public.challenge_participants where user_id=u and status in ('joined','completed','finished')) then perform public.avatar_starter_reward(u,'join_or_start_challenge'); end if;
 -- A streak requires actual qualifying days. Never a low-calorie or weight-loss ranking.
 for i in 0..3650 loop
  exit when not exists(select 1 from public.avatar_qualifying_days(u) where day=d-i);
  streak:=streak+1;
 end loop;
 if streak>=3 then perform public.avatar_starter_reward(u,'three_day_streak'); end if;
 if streak>=7 then perform public.avatar_reward(u,'streak_7',(d-streak+1)::text); end if;
 if streak>=30 then perform public.avatar_reward(u,'streak_30',(d-streak+1)::text); end if;
 if streak>=60 then insert into public.user_products(user_id,product_id,source) select u,id,'earn' from public.avatar_products where id='aura_flame' on conflict do nothing; end if;
end $$;

create function public.get_avatar_state() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); d date;begin
 if u is null then raise exception 'UNAUTHENTICATED'; end if;
 if not coalesce((select value='true'::jsonb from public.avatar_config where key='avatar_enabled'),false) then return jsonb_build_object('enabled',false); end if;
 select(now() at time zone p.timezone)::date into d from public.profiles p where p.id=u;
 return jsonb_build_object('enabled',true,'profile',public.avatar_snapshot(u),'balances',public.avatar_balances(u),'tier',public.active_room_tier(u),
 'config',(select jsonb_object_agg(key,value) from public.avatar_config),
 'levels',coalesce((select jsonb_agg(to_jsonb(l) order by level) from public.avatar_levels l),'[]'),
 'tints',coalesce((select jsonb_agg(to_jsonb(t)) from public.avatar_tints t),'[]'),
 'collections',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('price_to_complete',coalesce((select ceil(sum(p.price_cc)*coalesce((select(value#>>'{}')::numeric from public.avatar_config where key='price_multiplier'),1)*(1-coalesce((select(value->>public.active_room_tier(u))::numeric from public.avatar_config where key='tier_discount_pct'),0)/100)*(1-c.bundle_discount_pct::numeric/100)) from public.avatar_products p where p.collection_id=c.id and p.active and not coalesce((p.definition->>'earn_only')::boolean,false) and p.definition->'genders' ? (select gender from public.avatar_profiles where user_id=u) and not exists(select 1 from public.user_products o where o.user_id=u and o.product_id=p.id)),0)) order by sort) from public.avatar_collections c where active),'[]'),
 'products',coalesce((select jsonb_agg(p.definition||jsonb_build_object('price_cc',p.price_cc,'active',p.active,'owned',exists(select 1 from public.user_products o where o.user_id=u and o.product_id=p.id),'accessible',public.avatar_tier_allows(c.tier_required,u),'effective_price',ceil(p.price_cc*coalesce((select(value#>>'{}')::numeric from public.avatar_config where key='price_multiplier'),1)*(1-coalesce((select(value->>public.active_room_tier(u))::numeric from public.avatar_config where key='tier_discount_pct'),0)/100)))) from public.avatar_products p join public.avatar_collections c on c.id=p.collection_id),'[]'),
 'daily_drop',jsonb_build_object('available',exists(select 1 from public.avatar_qualifying_days(u) where day=d),'claimed',exists(select 1 from public.cc_ledger where user_id=u and idempotency_key='daily_drop:'||u||':'||d),'amount',(select cc from public.cc_earn_rules where action='daily_drop')),
 'starter_progress',coalesce((select jsonb_agg(step_key) from public.starter_path_progress where user_id=u),'[]'),
 'starter_active',exists(select 1 from public.avatar_profiles where user_id=u and created_at>now()-make_interval(days=>coalesce((select(value#>>'{}')::int from public.avatar_config where key='starter_days'),7))),
 'ledger',coalesce((select jsonb_agg(to_jsonb(h) order by created_at desc) from(select id,wallet,delta,reason,created_at from public.cc_ledger where user_id=u order by id desc limit 100)h),'[]'),
 'packs',coalesce((select jsonb_agg(to_jsonb(p) order by cc) from public.cc_packs p where active),'[]'),
 'wishlist',coalesce((select jsonb_agg(product_id) from public.avatar_wishlist where user_id=u),'[]'));
end $$;

create function public.avatar_create(p_gender text,p_skin_tone_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor();begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,130));
 if not exists(select 1 from public.profiles where id=u) then raise exception 'PROFILE_REQUIRED'; end if;
 if p_gender not in ('m','f') or not exists(select 1 from public.avatar_tints where id=p_skin_tone_id and kind='skin') then raise exception 'INVALID_AVATAR'; end if;
 insert into public.avatar_profiles(user_id,gender,skin_tone_id) values(u,p_gender,p_skin_tone_id) on conflict do nothing;
 -- Keep starter items for both models so changing model never loses a starter hairstyle.
 insert into public.user_products(user_id,product_id,source) select u,id,'starter' from public.avatar_products where (definition->>'starter')::boolean on conflict do nothing;
 insert into public.user_loadouts(user_id,slots) select u,jsonb_object_agg(definition->>'slot',id) from public.avatar_products where (definition->>'starter')::boolean and definition->'genders' ? p_gender on conflict do nothing;
 perform public.avatar_starter_reward(u,'create_character');
 return public.get_avatar_state();
end $$;

create function public.avatar_save(p_request_id uuid,p_gender text,p_skin_tone_id text,p_slots jsonb,p_tints jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor(); k text;v text;p public.avatar_products;fingerprint text;previous text;old_tints jsonb;old_slots jsonb;form text;
begin
 if p_request_id is null or p_gender not in ('m','f') or jsonb_typeof(p_slots)<>'object' or jsonb_typeof(p_tints)<>'object' or length(p_slots::text)>4000 or length(p_tints::text)>4000 then raise exception 'INVALID_AVATAR'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,130));
 fingerprint:=md5(jsonb_build_array('save',p_gender,p_skin_tone_id,p_slots,p_tints)::text);
 select r.fingerprint into previous from public.avatar_requests r where user_id=u and request_id=p_request_id;
 if found then if previous<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return public.get_avatar_state(); end if;
 if not public.check_rate_limit('avatar_save:'||u,60,60) then raise exception 'RATE_LIMITED'; end if;
 if not exists(select 1 from public.avatar_tints where id=p_skin_tone_id and kind='skin') then raise exception 'INVALID_SKIN'; end if;
 if not exists(select 1 from public.avatar_profiles where user_id=u) then raise exception 'AVATAR_REQUIRED'; end if;
 select slots,tints into old_slots,old_tints from public.user_loadouts where user_id=u;
 form:=public.avatar_level_for(u)->>'form';
 for k,v in select * from jsonb_each_text(p_slots) loop
  select * into p from public.avatar_products where id=v;
  if not found or p.definition->>'kind'<>'item' or p.definition->>'slot'<>k or not(p.definition->'genders' ? p_gender) or not(p.definition->'assets' ? (p_gender||':'||form)) or not exists(select 1 from public.user_products where user_id=u and product_id=v) then raise exception 'INVALID_LOADOUT'; end if;
 end loop;
 for k,v in select * from jsonb_each_text(p_tints) loop
  if right(k,7)='_finish' then
   if not(p_slots ? left(k,-7)) or not exists(select 1 from public.avatar_products p join public.user_products o on o.product_id=p.id and o.user_id=u where p.id=v and p.definition->>'kind'='finish') then raise exception 'INVALID_FINISH'; end if;
  else
   if not(p_slots ? k) or not exists(select 1 from public.avatar_tints t where t.id=v and t.kind=case when k in ('hair','facial') then 'hair' else 'garment' end and (public.avatar_tier_allows(t.tier_required,u) or (old_tints->>k=v and old_slots->>k=p_slots->>k))) then raise exception 'INVALID_TINT'; end if;
  end if;
 end loop;
 update public.avatar_profiles set gender=p_gender,skin_tone_id=p_skin_tone_id,updated_at=now() where user_id=u;
 update public.user_loadouts set slots=p_slots,tints=p_tints,hash=md5(jsonb_build_array(p_gender,form,p_skin_tone_id,p_slots,p_tints)::text),updated_at=now() where user_id=u;
 insert into public.avatar_requests values(u,p_request_id,fingerprint,now());
 return public.get_avatar_state();
end $$;

create function public.avatar_purchase(p_request_id uuid,p_product_id text,p_collection_id text,p_expected_price int) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor();g text;ids text[];price int;mult numeric;discount numeric;bundle numeric:=0;b jsonb;earned bigint;purchased bigint;take_e bigint;take_p bigint;fp text;previous text;
begin
 if p_request_id is null or (p_product_id is null)=(p_collection_id is null) then raise exception 'INVALID_PURCHASE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,130));
 fp:=md5(jsonb_build_array('buy',p_product_id,p_collection_id,p_expected_price)::text);
 select fingerprint into previous from public.avatar_requests where user_id=u and request_id=p_request_id;
 if found then if previous<>fp then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return public.get_avatar_state(); end if;
 if not public.check_rate_limit('avatar_buy:'||u,30,60) then raise exception 'RATE_LIMITED'; end if;
 select gender into g from public.avatar_profiles where user_id=u;
 if g is null then raise exception 'AVATAR_REQUIRED'; end if;
 if p_collection_id is not null then select bundle_discount_pct into bundle from public.avatar_collections where id=p_collection_id and active; end if;
 select array_agg(p.id),sum(p.price_cc) into ids,price from public.avatar_products p join public.avatar_collections c on c.id=p.collection_id where p.active and c.active and not c.earn_only and not coalesce((p.definition->>'earn_only')::boolean,false) and p.definition->'genders' ? g and (p.id=p_product_id or c.id=p_collection_id) and not exists(select 1 from public.user_products o where o.user_id=u and o.product_id=p.id);
 if ids is null then
  if p_product_id is not null and exists(select 1 from public.user_products where user_id=u and product_id=p_product_id) then return public.get_avatar_state(); end if;
  raise exception 'NO_PURCHASABLE_ITEMS';
 end if;
 if exists(select 1 from public.avatar_products p join public.avatar_collections c on c.id=p.collection_id where p.id=any(ids) and not public.avatar_tier_allows(c.tier_required,u)) then raise exception 'TIER_REQUIRED'; end if;
 select(value#>>'{}')::numeric into mult from public.avatar_config where key='price_multiplier';
 select(value->>public.active_room_tier(u))::numeric into discount from public.avatar_config where key='tier_discount_pct';
 price:=ceil(price*coalesce(mult,1)*(1-coalesce(discount,0)/100)*(1-coalesce(bundle,0)/100));
 if p_expected_price is null or price<>p_expected_price then raise exception 'PRICE_CHANGED'; end if;
 b:=public.avatar_balances(u);earned:=(b->>'earned')::bigint;purchased:=(b->>'purchased')::bigint;
 if purchased<0 then raise exception 'PURCHASED_BALANCE_NEGATIVE'; end if;
 if earned+purchased<price then raise exception 'INSUFFICIENT_CC'; end if;
 if (select value#>>'{}' from public.avatar_config where key='spend_order')='purchased_first' then take_p:=least(purchased,price);take_e:=price-take_p;else take_e:=least(earned,price);take_p:=price-take_e;end if;
 if take_e>0 then insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(u,'earned',-take_e,'cosmetics','spend:earned:'||u||':'||p_request_id);end if;
 if take_p>0 then insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(u,'purchased',-take_p,'cosmetics','spend:purchased:'||u||':'||p_request_id);end if;
 insert into public.user_products(user_id,product_id,source,price_paid_cc) select u,unnest(ids),'cc',price;
 insert into public.avatar_requests values(u,p_request_id,fp,now());
 return public.get_avatar_state();
end $$;
create function public.claim_daily_drop() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor();d date;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,130));
 if not exists(select 1 from public.avatar_profiles where user_id=u) then raise exception 'AVATAR_REQUIRED'; end if;
 select(now() at time zone timezone)::date into d from public.profiles where id=u;
 if not exists(select 1 from public.avatar_qualifying_days(u) where day=d) then raise exception 'LOG_REQUIRED'; end if;
 perform public.avatar_reward(u,'daily_drop',d::text);
 return public.get_avatar_state();
end $$;

create function public.get_avatar_public(p_user_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=public.avatar_require_actor();begin
 if coalesce(array_length(p_user_ids,1),0)>20 then raise exception 'TOO_MANY_USERS'; end if;
 return coalesce((select jsonb_agg(public.avatar_snapshot(a.user_id)) from public.avatar_profiles a where a.user_id=any(p_user_ids) and (a.user_id=u or (
 not exists(select 1 from public.blocks b where (b.blocker_id=u and b.blocked_id=a.user_id) or (b.blocker_id=a.user_id and b.blocked_id=u)) and (
 exists(select 1 from public.friend_requests f where f.status='accepted' and f.pair_low=least(u,a.user_id) and f.pair_high=greatest(u,a.user_id)) or
 exists(select 1 from public.room_members mine join public.room_members peer on peer.room_id=mine.room_id where mine.user_id=u and peer.user_id=a.user_id and mine.status='active' and peer.status='active' and public.room_is_usable(mine.room_id)))))), '[]');
end $$;

-- Verified webhook only. A refund tombstone prevents a late purchase event granting CC.
create function public.avatar_apply_store_event(p_user_id uuid,p_transaction_id text,p_pack_id text,p_refund boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare pack public.cc_packs;previous public.cc_purchases;begin
 if p_transaction_id is null or length(p_transaction_id) not between 1 and 256 then raise exception 'INVALID_TRANSACTION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_transaction_id,131));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,130));
 select * into previous from public.cc_purchases where store_txn_id=p_transaction_id;
 if found then
  if previous.user_id<>p_user_id or previous.pack_id<>p_pack_id then raise exception 'TRANSACTION_CONFLICT';end if;
  if p_refund and previous.status='granted' then
   insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(p_user_id,'purchased',-previous.cc_granted,'pack_refund','refund:'||p_transaction_id) on conflict do nothing;
   update public.cc_purchases set status='refunded' where store_txn_id=p_transaction_id;
  end if;
  return public.avatar_balances(p_user_id);
 end if;
 select * into pack from public.cc_packs where id=p_pack_id;
 if not found then raise exception 'UNKNOWN_PACK';end if;
 insert into public.cc_purchases values(p_transaction_id,p_user_id,p_pack_id,pack.cc,case when p_refund then 'refunded' else 'granted' end,now());
 if not p_refund then insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(p_user_id,'purchased',pack.cc,'pack_purchase','pack:'||p_transaction_id);end if;
 return public.avatar_balances(p_user_id);
end $$;

-- Prevent timezone hopping from manufacturing extra reward days.
create function public.avatar_timezone_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare changed timestamptz;begin
 if new.timezone is distinct from old.timezone and exists(select 1 from public.avatar_profiles where user_id=new.id) then
  select tz_changed_at into changed from public.avatar_profiles where user_id=new.id for update;
  if changed>now()-interval '7 days' then raise exception 'TIMEZONE_CHANGE_LIMIT';end if;
  update public.avatar_profiles set tz_changed_at=now() where user_id=new.id;
 end if;
 return new;
end $$;
create trigger avatar_timezone_guard before update of timezone on public.profiles for each row execute function public.avatar_timezone_guard();

-- Existing challenge scoring is the trusted source; user clients cannot write result rows.
create function public.avatar_challenge_reward() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenges;rule jsonb;k text;begin
 if new.status not in ('completed','finished') or new.status=old.status or new.summary->>'outcome' is distinct from new.status or not exists(select 1 from public.avatar_profiles where user_id=new.user_id) or not coalesce((select value='true'::jsonb from public.avatar_config where key='avatar_enabled'),false) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,130));
 select * into c from public.challenges where id=new.challenge_id;
 if new.status='completed' then
  select value->case when c.duration_days<=7 then 'short' when c.duration_days<=30 then 'medium' else 'long' end into rule from public.challenge_config where key='avatar_rewards';
  k:='challenge:'||new.user_id||':'||new.challenge_id;
  if rule is not null then
   insert into public.cc_ledger(user_id,wallet,delta,reason,idempotency_key) values(new.user_id,'earned',(rule->>'cc')::int,'challenge_completed',k) on conflict do nothing;
   insert into public.xp_ledger(user_id,delta,reason,idempotency_key) values(new.user_id,(rule->>'xp')::int,'challenge_completed',k) on conflict do nothing;
  end if;
 end if;
 if c.scope='season' then insert into public.user_products(user_id,product_id,source) select new.user_id,id,'earn' from public.avatar_products where id in ('backdrop_winterarc','frame_legendary') on conflict do nothing;end if;
 return new;
end $$;
create trigger avatar_challenge_reward after update of status on public.challenge_participants for each row execute function public.avatar_challenge_reward();

-- Explicitly revoke PostgreSQL's default PUBLIC function execution.
do $$ declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'avatar_%' or p.proname in ('get_avatar_state','get_avatar_public','claim_daily_drop')) loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
grant execute on function public.get_avatar_state(),public.get_avatar_public(uuid[]),public.avatar_create(text,text),public.avatar_save(uuid,text,text,jsonb,jsonb),public.avatar_purchase(uuid,text,text,int),public.claim_daily_drop(),public.avatar_reconcile_rewards() to authenticated;
