alter table public.avatar_profiles add column custom_base_url text;
alter table public.avatar_profiles add column custom_base_request_id uuid;
alter table public.avatar_profiles add column custom_base_gender text check (custom_base_gender in ('m', 'f'));
alter table public.avatar_profiles add column custom_base_deleting boolean not null default false;
revoke select on public.avatar_profiles from public, anon, authenticated;
grant select (user_id, gender, skin_tone_id, created_at, updated_at, tz_changed_at)
  on public.avatar_profiles to authenticated;
grant select on public.avatar_profiles to service_role;

create table public.avatar_generation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  photo_hash text not null,
  gender text not null check (gender in ('m', 'f')),
  lease_id uuid not null,
  expires_at timestamptz not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.avatar_generation_requests enable row level security;
create policy avatar_generation_service on public.avatar_generation_requests for all to service_role
  using (true) with check (true);
revoke all on public.avatar_generation_requests from public, anon, authenticated;

create function public.get_custom_avatar(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'gender', a.gender,
    'request_id', case when a.gender = a.custom_base_gender then a.custom_base_request_id end,
    'period_end', e.period_end
  )
  from public.entitlements e
  join public.avatar_profiles a on a.user_id = e.user_id
  where e.user_id = p_user_id and e.tier = 'pro' and e.status in ('paid', 'grace')
    and not a.custom_base_deleting
    and (e.period_end is null or e.period_end > now())
    and exists (select 1 from public.avatar_config where key = 'avatar_enabled' and value = 'true'::jsonb);
$$;

create function public.begin_custom_avatar(p_user_id uuid, p_request_id uuid, p_photo_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  avatar jsonb;
  existing public.avatar_generation_requests;
  lease uuid := gen_random_uuid();
begin
  if p_user_id is null or p_request_id is null or coalesce(p_photo_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_AVATAR_REQUEST';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':custom-avatar', 41));
  avatar := public.get_custom_avatar(p_user_id);
  if avatar is null then return jsonb_build_object('code', 'UPGRADE_REQUIRED'); end if;
  select * into existing from public.avatar_generation_requests
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    if existing.photo_hash <> p_photo_hash or existing.gender <> avatar->>'gender' then
      return jsonb_build_object('code', 'REQUEST_CONFLICT');
    end if;
    if existing.status = 'completed' then
      return jsonb_build_object('replay', true);
    end if;
  end if;
  if exists (select 1 from public.avatar_generation_requests
    where user_id = p_user_id and status = 'pending' and expires_at > now()) then
    return jsonb_build_object('code', 'REQUEST_IN_PROGRESS');
  end if;
  if not public.check_rate_limit('custom_avatar:' || p_user_id::text, 30, 3600) then
    return jsonb_build_object('code', 'RATE_LIMITED');
  end if;
  insert into public.avatar_generation_requests (user_id, request_id, photo_hash, gender, lease_id, expires_at, status)
    values (p_user_id, p_request_id, p_photo_hash, avatar->>'gender', lease, now() + interval '5 minutes', 'pending')
    on conflict (user_id, request_id) do update
    set lease_id = excluded.lease_id, expires_at = excluded.expires_at, status = 'pending';
  return jsonb_build_object('lease_id', lease, 'gender', avatar->>'gender');
end;
$$;

create function public.finish_custom_avatar(
  p_user_id uuid, p_request_id uuid, p_lease_id uuid, p_url text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  attempt public.avatar_generation_requests;
  previous_id uuid;
  avatar jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':custom-avatar', 41));
  select * into attempt from public.avatar_generation_requests
    where user_id = p_user_id and request_id = p_request_id and lease_id = p_lease_id
      and status = 'pending' and expires_at > now();
  if not found then return jsonb_build_object('code', 'REQUEST_EXPIRED'); end if;
  if p_url is null then
    update public.avatar_generation_requests set status = 'failed'
      where user_id = p_user_id and request_id = p_request_id;
    return jsonb_build_object('released', true);
  end if;
  avatar := public.get_custom_avatar(p_user_id);
  if avatar is null then return jsonb_build_object('code', 'UPGRADE_REQUIRED'); end if;
  select custom_base_request_id into previous_id from public.avatar_profiles
    where user_id = p_user_id and gender = attempt.gender and not custom_base_deleting for update;
  if not found then return jsonb_build_object('code', 'REQUEST_CONFLICT'); end if;
  update public.avatar_profiles set custom_base_url = p_url,
    custom_base_request_id = p_request_id, custom_base_gender = attempt.gender
    where user_id = p_user_id;
  update public.avatar_generation_requests set status = 'completed'
    where user_id = p_user_id and request_id = p_request_id;
  return jsonb_build_object('saved', true, 'previous_id', previous_id);
end;
$$;

revoke all on function public.get_custom_avatar(uuid), public.begin_custom_avatar(uuid, uuid, text),
  public.finish_custom_avatar(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.get_custom_avatar(uuid), public.begin_custom_avatar(uuid, uuid, text),
  public.finish_custom_avatar(uuid, uuid, uuid, text) to service_role;
