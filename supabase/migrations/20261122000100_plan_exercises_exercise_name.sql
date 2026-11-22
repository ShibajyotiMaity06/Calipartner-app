-- Migration: Allow exercise_id to be nullable and add exercise_name to plan_exercises
-- Reason: Generated plans and custom routines may use catalog exercise identifiers or custom names before or alongside UUID foreign keys.

alter table public.plan_exercises alter column exercise_id drop not null;

alter table public.plan_exercises add column if not exists exercise_name text check (exercise_name is null or length(trim(exercise_name)) >= 1);

update public.plan_exercises pe
set exercise_name = e.name
from public.exercises e
where pe.exercise_id = e.id and pe.exercise_name is null;

notify pgrst, 'reload schema';
