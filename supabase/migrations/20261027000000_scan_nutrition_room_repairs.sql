-- Owner-requested scan, nutrition and room repairs, 27 October 2026.
-- Deploy the targeted legacy-trigger repair without replaying unrelated migrations.
create or replace function public.trg_room_requests_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_room_name text;
  v_host_id uuid;
begin
  select r.name, (select user_id from public.room_members where room_id=r.id and role='host' and status<>'left' limit 1) into v_room_name, v_host_id from public.rooms r where r.id=NEW.room_id;
  v_room_name := coalesce(v_room_name, 'a room');

  select nickname into v_sender_nick from public.profiles where id = NEW.sender_id;
  v_sender_nick := coalesce(v_sender_nick, 'Someone');

  if TG_OP = 'INSERT' then
    if NEW.type = 'invitation' and NEW.recipient_id is not null then
      -- User was invited
      perform public.queue_push_notification(
        p_user_id := NEW.recipient_id,
        p_type := 'room_invitation',
        p_title := 'Room Invitation',
        p_body := v_sender_nick || ' invited you to join ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_invitation',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' and v_host_id is not null then
      -- User requested to join room, notify host
      perform public.queue_push_notification(
        p_user_id := v_host_id,
        p_type := 'room_join_request',
        p_title := 'Join Request',
        p_body := v_sender_nick || ' requested to join ' || v_room_name || '.',
        p_data := jsonb_build_object(
          'type', 'room_join_request',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    end if;

  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'accepted' then
    if NEW.type = 'invitation' then
      -- Recipient accepted, notify inviter
      select nickname into v_sender_nick from public.profiles where id = NEW.recipient_id;
      v_sender_nick := coalesce(v_sender_nick, 'Your partner');
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Invitation Accepted',
        p_body := v_sender_nick || ' joined ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' then
      -- Host accepted, notify requester (sender_id)
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Request Accepted',
        p_body := 'You were accepted into ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.valid_nutrition_details(p_value jsonb, p_portion boolean default false)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare v_key text; v_max numeric;
begin
  if p_value is null then return true; end if;
  if jsonb_typeof(p_value)<>'object' then return false; end if;
  if p_value-array['saturated_fat','cholesterol_mg','locked']<>'{}'::jsonb then return false; end if;
  if p_value ? 'locked' and jsonb_typeof(p_value->'locked')<>'boolean' then return false; end if;
  foreach v_key in array array['saturated_fat','cholesterol_mg'] loop
    if p_value->v_key is not null and p_value->v_key<>'null'::jsonb then
      if jsonb_typeof(p_value->v_key)<>'number' then return false; end if;
      v_max:=case when v_key='saturated_fat' and not p_portion then 100 else 100000 end;
      if (p_value->>v_key)::numeric<0 or (p_value->>v_key)::numeric>v_max then return false; end if;
    end if;
  end loop;
  return true;
end; $$;
alter table public.foods add column if not exists nutrition_details jsonb check(public.valid_nutrition_details(nutrition_details));
-- Portions can exceed 100g, so entry values are non-negative portion totals.
alter table public.food_entries add column if not exists nutrition_details jsonb check(public.valid_nutrition_details(nutrition_details,true));

create or replace function public.can_view_advanced_nutrition(p_user_id uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if p_user_id is null then return false; end if;
  if auth.uid() is distinct from p_user_id and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'NOT_AUTHORIZED'; end if;
  return public.active_room_tier(p_user_id) in ('plus','pro');
end; $$;
revoke all on function public.can_view_advanced_nutrition(uuid) from public,anon;
grant execute on function public.can_view_advanced_nutrition(uuid) to authenticated,service_role;
