-- Phase 1: Authentication, Profiles, Usernames, Age Gate, Disposable Email Block, RLS
-- Adheres to PRD 6.1 (AUTH-1..7), 6.7 (USR-1..4, 9), 8.1, 8.2 and AGENT_RULES.md

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- 1. Reserved usernames & offensive words
-- -----------------------------------------------------------------------------
create table if not exists public.reserved_usernames (
  word citext primary key
);

alter table public.reserved_usernames enable row level security;

-- Only service role can modify; authenticated/anon can select to check
create policy reserved_usernames_select on public.reserved_usernames
  for select
  to anon, authenticated
  using (true);

insert into public.reserved_usernames (word) values
  ('admin'), ('administrator'), ('calipartner'), ('official'), ('root'),
  ('support'), ('help'), ('mod'), ('moderator'), ('system'), ('api'),
  ('test'), ('security'), ('info'), ('team'), ('staff'), ('billing'),
  ('null'), ('undefined'), ('bot'), ('welcome'), ('feedback'), ('terms'),
  ('privacy'), ('everyone'), ('nobody'),
  -- Abusive / offensive words
  ('abuse'), ('asshole'), ('bitch'), ('bastard'), ('cunt'), ('dick'),
  ('fuck'), ('fucker'), ('fucking'), ('nigger'), ('nigga'), ('pussy'),
  ('shit'), ('slut'), ('whore'), ('twat'), ('fag'), ('faggot')
on conflict (word) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Disposable email domains blocklist
-- -----------------------------------------------------------------------------
create table if not exists public.disposable_email_domains (
  domain citext primary key,
  created_at timestamptz not null default now()
);

alter table public.disposable_email_domains enable row level security;

create policy disposable_email_domains_no_client on public.disposable_email_domains
  for all to anon, authenticated using (false);

insert into public.disposable_email_domains (domain) values
  ('10minutemail.com'), ('10minutemail.net'), ('guerrillamail.com'),
  ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamailblock.com'),
  ('sharklasers.com'), ('grr.la'), ('mailinator.com'), ('mailin8r.com'),
  ('dispostable.com'), ('yopmail.com'), ('yopmail.net'), ('trashmail.com'),
  ('trashmail.net'), ('trashmail.org'), ('tempmail.com'), ('temp-mail.org'),
  ('tempail.com'), ('throwawaymail.com'), ('fakeinbox.com'), ('getairmail.com'),
  ('nada.ltd'), ('mohmal.com'), ('crazymailing.com'), ('mytemp.email'),
  ('burnermail.io'), ('inboxkitten.com')
on conflict (domain) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Rate limit buckets for functions
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

create policy rate_limit_buckets_no_client on public.rate_limit_buckets
  for all to anon, authenticated using (false);

create or replace function public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket record;
begin
  select count, window_start into v_bucket
  from public.rate_limit_buckets
  where bucket_key = p_key
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, count, window_start)
    values (p_key, 1, v_now)
    on conflict (bucket_key) do update
    set count = public.rate_limit_buckets.count + 1;
    return true;
  end if;

  if v_now > (v_bucket.window_start + (p_window_seconds || ' seconds')::interval) then
    update public.rate_limit_buckets
    set count = 1, window_start = v_now
    where bucket_key = p_key;
    return true;
  else
    if v_bucket.count >= p_max_requests then
      return false;
    else
      update public.rate_limit_buckets
      set count = v_bucket.count + 1
      where bucket_key = p_key;
      return true;
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Released usernames (held for 30 days)
-- -----------------------------------------------------------------------------
create table if not exists public.released_usernames (
  username citext primary key,
  released_by uuid not null references auth.users(id) on delete cascade,
  released_at timestamptz not null default now()
);

alter table public.released_usernames enable row level security;

create policy released_usernames_no_client on public.released_usernames
  for all to anon, authenticated using (false);

-- -----------------------------------------------------------------------------
-- 5. User blocks table
-- -----------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy blocks_select on public.blocks
  for select to authenticated
  using (auth.uid() = blocker_id);

create policy blocks_insert on public.blocks
  for insert to authenticated
  with check (auth.uid() = blocker_id);

create policy blocks_delete on public.blocks
  for delete to authenticated
  using (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- 6. Profiles table
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  nickname text not null,
  avatar_url text,
  date_of_birth date not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm numeric(5,2) not null check (height_cm between 50 and 300),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  timezone text not null default 'UTC',
  country text,
  discoverable boolean not null default true,
  username_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Username constraints
  constraint check_username_length check (char_length(username) >= 3 and char_length(username) <= 20),
  constraint check_username_chars check (username ~ '^[a-zA-Z0-9_.]+$'),
  constraint check_username_no_leading_trailing check (username !~ '^[._]' and username !~ '[._]$'),
  constraint check_username_no_double_periods check (username !~ '\.\.')
);

alter table public.profiles enable row level security;

-- RLS: Each user can only read, insert, update, or delete their own profile directly.
-- Other users MUST use search_users or explicit privacy-respecting views.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 7. Age gate trigger (18+ required)
-- -----------------------------------------------------------------------------
create or replace function public.check_profile_dob()
returns trigger
language plpgsql
as $$
begin
  if NEW.date_of_birth is null then
    raise exception 'Date of birth is required' using errcode = '23502';
  end if;

  if NEW.date_of_birth > (current_date - interval '18 years') then
    raise exception 'Users must be at least 18 years old' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists tr_check_profile_dob on public.profiles;
create trigger tr_check_profile_dob
before insert or update of date_of_birth on public.profiles
for each row
execute function public.check_profile_dob();

-- -----------------------------------------------------------------------------
-- 8. Username verification & change trigger
-- -----------------------------------------------------------------------------
create or replace function public.check_profile_username()
returns trigger
language plpgsql
as $$
declare
  v_norm text;
begin
  v_norm := lower(trim(NEW.username));

  -- Check reserved usernames
  if exists (select 1 from public.reserved_usernames r where r.word = v_norm) then
    raise exception 'This username is reserved' using errcode = 'P0001';
  end if;

  -- Check released usernames within 30 days
  if exists (
    select 1 from public.released_usernames ru
    where ru.username = v_norm
      and ru.released_at > now() - interval '30 days'
      and ru.released_by <> NEW.id
  ) then
    raise exception 'This username is temporarily held and unavailable' using errcode = 'P0001';
  end if;

  if TG_OP = 'UPDATE' and NEW.username is distinct from OLD.username then
    -- Rule: username can only be changed once every 30 days
    if OLD.username_changed_at is not null and OLD.username_changed_at > (now() - interval '30 days') then
      raise exception 'Username can only be changed once every 30 days' using errcode = 'P0001';
    end if;

    -- Store old username into released_usernames
    insert into public.released_usernames (username, released_by, released_at)
    values (OLD.username, OLD.id, now())
    on conflict (username) do update
    set released_by = OLD.id, released_at = now();

    NEW.username_changed_at := now();
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists tr_check_profile_username on public.profiles;
create trigger tr_check_profile_username
before insert or update on public.profiles
for each row
execute function public.check_profile_username();

-- -----------------------------------------------------------------------------
-- 9. Disposable email sign-up block trigger
-- -----------------------------------------------------------------------------
create or replace function public.check_disposable_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text;
begin
  if NEW.email is not null then
    v_domain := lower(split_part(NEW.email, '@', 2));
    if exists (select 1 from public.disposable_email_domains d where d.domain = v_domain) then
      raise exception 'Disposable email addresses are not permitted' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists tr_check_disposable_email on auth.users;
    create trigger tr_check_disposable_email
    before insert on auth.users
    for each row
    execute function public.check_disposable_email();
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Public RPC: is_username_available(text)
-- -----------------------------------------------------------------------------
create or replace function public.is_username_available(check_username text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_norm text;
  v_caller_id uuid;
  v_bucket_key text;
begin
  if check_username is null then
    return false;
  end if;

  v_norm := lower(trim(check_username));
  v_caller_id := auth.uid();

  -- Rate limit: 60 checks per minute
  v_bucket_key := 'avail_user:' || coalesce(v_caller_id::text, 'anon');
  if not public.check_rate_limit(v_bucket_key, 60, 60) then
    raise exception 'Rate limit exceeded for username availability check' using errcode = 'P0001';
  end if;

  -- Format checks: 3 to 20 chars, regex, no leading/trailing dot/underscore, no double periods
  if char_length(v_norm) < 3 or char_length(v_norm) > 20 then
    return false;
  end if;

  if v_norm !~ '^[a-z0-9_.]+$' then
    return false;
  end if;

  if v_norm ~ '^[._]' or v_norm ~ '[._]$' then
    return false;
  end if;

  if v_norm ~ '\.\.' then
    return false;
  end if;

  -- Reserved word check
  if exists (select 1 from public.reserved_usernames r where r.word = v_norm) then
    return false;
  end if;

  -- Active profile check
  if exists (
    select 1 from public.profiles p
    where p.username = v_norm
      and (v_caller_id is null or p.id <> v_caller_id)
  ) then
    return false;
  end if;

  -- Released username check (30-day hold)
  if exists (
    select 1 from public.released_usernames ru
    where ru.username = v_norm
      and ru.released_at > now() - interval '30 days'
      and (v_caller_id is null or ru.released_by <> v_caller_id)
  ) then
    return false;
  end if;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Public RPC: search_users(prefix)
-- -----------------------------------------------------------------------------
create or replace function public.search_users(prefix text)
returns table (
  avatar_url text,
  nickname text,
  username citext
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_bucket_key text;
  v_clean_prefix text;
begin
  if prefix is null then
    return;
  end if;

  v_clean_prefix := lower(trim(prefix));
  if char_length(v_clean_prefix) < 3 then
    return;
  end if;

  v_caller_id := auth.uid();

  -- Rate limit: 30 searches per minute
  v_bucket_key := 'search_users:' || coalesce(v_caller_id::text, 'anon');
  if not public.check_rate_limit(v_bucket_key, 30, 60) then
    raise exception 'Rate limit exceeded for search_users' using errcode = 'P0001';
  end if;

  return query
  select
    p.avatar_url,
    p.nickname,
    p.username
  from public.profiles p
  where p.discoverable = true
    and p.username like (v_clean_prefix || '%')
    and (v_caller_id is null or p.id <> v_caller_id)
    and (v_caller_id is null or not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v_caller_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = v_caller_id)
    ))
  order by p.username asc
  limit 10;
end;
$$;
