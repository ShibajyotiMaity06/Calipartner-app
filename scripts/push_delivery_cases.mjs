import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function runPushDeliveryTests(db) {
  await db.exec('reset role');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      () => db.query('select public.process_push_notifications_cron()'),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        db.query('select public.configure_push_delivery($1,$2)', [
          'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/send-push',
          'a'.repeat(64),
        ]),
      /permission denied/,
    );
    await db.exec('reset role');
  }
  console.log('PASS App users cannot invoke or configure scheduled push delivery');

  // Test doubles for hosted extensions unavailable in the embedded database.
  await db.exec(`
    create schema vault;
    create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
    alter table vault.secrets enable row level security;
    revoke all on vault.secrets from authenticated;
    create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(new_secret text,new_name text,description text) returns uuid language sql as $$ insert into vault.secrets(name,secret) values(new_name,new_secret) returning id $$;
    create function vault.update_secret(secret_id uuid,new_secret text,new_name text,description text) returns void language sql as $$ update vault.secrets set name=new_name,secret=new_secret where id=secret_id $$;
    create schema net;
    create table net.test_requests(id bigint generated always as identity primary key,url text,headers jsonb,body jsonb);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$ insert into net.test_requests(url,headers,body) values(url,headers,body) returning id $$;
    create schema if not exists extensions;
    create table extensions.test_hmac_calls(data text,secret text,algorithm text);
    create function extensions.hmac(data text,secret text,algorithm text) returns bytea language plpgsql as $$ begin
      insert into extensions.test_hmac_calls values(data,secret,algorithm);
      return decode(repeat('ab',32),'hex');
    end $$;
  `);
  await db.exec('set role service_role');
  assert.equal(
    (await db.query('select public.process_push_notifications_cron() as id')).rows[0].id,
    null,
  );
  await assert.rejects(
    () =>
      db.query('select public.configure_push_delivery($1,$2)', [
        'https://attacker.example/send-push',
        'a'.repeat(64),
      ]),
    /INVALID_PUSH_CONFIGURATION/,
  );
  await assert.rejects(
    () =>
      db.query('select public.configure_push_delivery($1,$2)', [
        'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/send-push',
        'short',
      ]),
    /INVALID_PUSH_CONFIGURATION/,
  );
  const url = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/send-push';
  await db.query('select public.configure_push_delivery($1,$2)', [url, 'a'.repeat(64)]);
  await db.query('select public.configure_push_delivery($1,$2)', [url, 'b'.repeat(64)]);
  await db.query('select public.process_push_notifications_cron()');
  await db.exec('reset role');
  assert.equal(
    (await db.query('select count(*)::int as count from vault.secrets')).rows[0].count,
    2,
  );
  const request = (await db.query('select * from net.test_requests')).rows[0];
  assert.equal(request.url, url);
  assert.equal(request.headers['x-push-worker-secret'], undefined);
  assert.equal(request.headers['x-push-worker-signature'], 'ab'.repeat(32));
  assert.match(request.headers['x-push-worker-timestamp'], /^\d{10}$/);
  const signed = (await db.query('select * from extensions.test_hmac_calls')).rows[0];
  assert.equal(signed.secret, 'b'.repeat(64));
  assert.equal(signed.algorithm, 'sha256');
  assert.equal(
    signed.data,
    `${request.headers['x-push-worker-timestamp']}.${JSON.stringify(request.body).replace(':', ': ')}`,
  );
  assert.equal(request.headers.Authorization, undefined);
  assert.deepEqual(request.body, { limit: 50 });
  console.log('PASS Push scheduling uses rotated Vault configuration and an expiring signature');
  await db.exec(`create table net.http_request_queue(headers jsonb);
    create table net._http_response(content text);
    grant select on net.http_request_queue,net._http_response to public,authenticated;`);
  await db.exec(
    await readFile(
      'supabase/migrations/20261026000003_protect_push_transport_credentials.sql',
      'utf8',
    ),
  );
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      () => db.query('select * from net.http_request_queue'),
      /permission denied/,
    );
    await assert.rejects(() => db.query('select * from net._http_response'), /permission denied/);
    await db.exec('reset role');
  }
  console.log('PASS App roles cannot inspect transport headers or private server HTTP responses');
  console.log('Push delivery database tests: 3 passed, 0 failed');
}
