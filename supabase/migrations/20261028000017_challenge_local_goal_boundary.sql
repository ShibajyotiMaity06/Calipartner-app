-- Resolve a day's protein goal at that user's local day boundary, including DST.
do $$ declare definition text;begin
 select pg_get_functiondef('public.challenge_source_days(uuid,date,date,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'effective_from<d::date+1 order by','effective_from<((d::date+1)::timestamp at time zone p.timezone) order by');
 execute definition;
end;$$;
