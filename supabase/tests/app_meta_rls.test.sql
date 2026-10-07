-- pgTAP test: app_meta is locked down for client roles (run with `supabase test db`).
begin;
select plan(3);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_meta'::regclass),
  'RLS is enabled on public.app_meta'
);

set local role anon;
select is((select count(*)::int from public.app_meta), 0, 'anon cannot read app_meta');

set local role authenticated;
select is((select count(*)::int from public.app_meta), 0, 'authenticated cannot read app_meta');

select * from finish();
rollback;
