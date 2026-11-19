-- Migration: 20261119000100_deduplicate_exercises.sql
-- Deduplicate library exercises and normalize titles to Title Case.

-- 1. Standardize library exercise names to Title Case
update public.exercises
set name = initcap(name), updated_at = now()
where owner_id is null and name <> initcap(name);

-- 2. Deduplicate library exercises where names match after stripping whitespace, plural 's'/'es', and punctuation
delete from public.exercises e1
where e1.owner_id is null
  and exists (
    select 1 from public.exercises e2
    where e2.owner_id is null
      and e2.id <> e1.id
      and lower(regexp_replace(regexp_replace(e1.name, 'e?s$', ''), '[^a-zA-Z0-9]', '', 'g')) =
          lower(regexp_replace(regexp_replace(e2.name, 'e?s$', ''), '[^a-zA-Z0-9]', '', 'g'))
      and (
        (e2.created_at < e1.created_at) or
        (e2.created_at = e1.created_at and e2.id < e1.id)
      )
  );

notify pgrst, 'reload schema';
