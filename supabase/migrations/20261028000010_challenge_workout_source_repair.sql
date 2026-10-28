-- Workout challenges must be able to ingest canonical workouts.name rows in shared rooms.
-- The old push trigger referenced a removed title column only when a partner was present.
do $$ declare definition text;begin
 select pg_get_functiondef('public.trg_workouts_after_insert_push()'::regprocedure) into definition;
 definition:=replace(definition,'NEW.title','NEW.name');
 execute definition;
end;$$;
