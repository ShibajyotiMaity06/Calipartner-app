-- pg_net queues contain decrypted HTTP credentials until requests are sent.
-- Only server-owned functions and database administrators may inspect them.
do $$ begin
  if to_regclass('net.http_request_queue') is not null then
    execute 'revoke all on table net.http_request_queue from public,anon,authenticated';
  end if;
  if to_regclass('net._http_response') is not null then
    execute 'revoke all on table net._http_response from public,anon,authenticated';
  end if;
end $$;
