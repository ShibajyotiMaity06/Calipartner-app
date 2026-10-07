-- Sample migration (Phase 0). Proves the migration pipeline works.
-- Creates no feature tables. Adds a tiny, non-sensitive schema marker with RLS enabled.

create table if not exists public.app_meta (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;

-- Explicit policy: nobody (anon/authenticated) can read or write directly.
-- Only the service role (which bypasses RLS) may touch this table.
create policy app_meta_no_client_access on public.app_meta
  for all
  to anon, authenticated
  using (false)
  with check (false);

insert into public.app_meta (key, value) values ('schema_baseline', 'phase-0')
on conflict (key) do nothing;
