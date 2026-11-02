-- Allow requester time changes outside the assigned driver's roster hours.
-- Keep token validation, same-date validation, lunch rules, and driver/vehicle overlap checks.
create or replace function public.manage_booking_update_times(
  p_tenant_id text,
  p_token_hash text,
  p_pickup_time text,
  p_return_time text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_date date;
  v_start time;
  v_end time;
  v_old_start timestamp;
  v_old_end timestamp;
  v_conflict record;
  v_now_local timestamp := timezone('Asia/Kuala_Lumpur', now());
begin
  if p_tenant_id is null or p_token_hash is null or length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'status', 404, 'error', 'Invalid management link.');
  end if;

  perform pg_advisory_xact_lock(hashtext('manage-booking-time:' || p_tenant_id));

  select b.* into v_booking
  from public.bookings b
  join public.booking_manage_tokens t on t.booking_id=b.id and t.tenant_id=b.tenant_id
  where t.token_hash=p_token_hash and t.tenant_id=p_tenant_id and t.revoked_at is null and b.tenant_id=p_tenant_id
  for update of b;

  if not found then
    return jsonb_build_object('ok',false,'status',404,'error','This management link is invalid or no longer available.');
  end if;

  if v_booking.status not in ('Pending','Assigned','Confirmed') then
    return jsonb_build_object('ok',false,'status',409,'error','Only Pending, Assigned or Confirmed bookings can be edited.');
  end if;

  v_date := coalesce(nullif(v_booking.start_date,''),substring(v_booking.date_time from 1 for 10))::date;
  if v_date is null then
    return jsonb_build_object('ok',false,'status',400,'error','The original booking date is invalid.');
  end if;

  if v_now_local >= (v_date::text || ' ' || coalesce(nullif(v_booking.start_time,''),substring(v_booking.date_time from 12 for 5)))::timestamp then
    return jsonb_build_object('ok',false,'status',409,'error','This booking has already started and can no longer be edited.');
  end if;

  if p_pickup_time is null or p_return_time is null
     or p_pickup_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or p_return_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return jsonb_build_object('ok',false,'status',400,'error','Please enter valid pickup and return times.');
  end if;

  v_start:=p_pickup_time::time;
  v_end:=p_return_time::time;
  if v_end<=v_start then
    return jsonb_build_object('ok',false,'status',400,'error','Return time must be later than pickup time on the same date.');
  end if;

  v_old_start:=v_date+coalesce(nullif(v_booking.start_time,''),substring(v_booking.date_time from 12 for 5))::time;
  v_old_end:=v_date+coalesce(nullif(v_booking.end_time,''),substring(coalesce(v_booking.finish_date_time,v_booking.date_time) from 12 for 5))::time;

  if coalesce(v_booking.service_type,'Perlu Driver')<>'Self-Drive'
     and ((extract(dow from v_date)=5 and v_start>=time '12:30' and v_start<time '14:30')
       or (extract(dow from v_date)<>5 and v_start>=time '12:00' and v_start<time '13:00')) then
    return jsonb_build_object('ok',false,'status',409,'error','The selected pickup time overlaps with the official lunch break. Please choose another time.');
  end if;

  select b.id,b.requester_name into v_conflict
  from public.bookings b
  where b.tenant_id=p_tenant_id and b.id<>v_booking.id
    and coalesce(b.status,'') not in ('Cancelled','Completed','Conflict')
    and ((coalesce(v_booking.service_type,'Perlu Driver')='Self-Drive' and v_booking.vehicle_id is not null and b.vehicle_id=v_booking.vehicle_id)
      or (coalesce(v_booking.service_type,'Perlu Driver')<>'Self-Drive' and v_booking.driver_id is not null and b.driver_id=v_booking.driver_id and coalesce(b.service_type,'Perlu Driver')<>'Self-Drive'))
    and coalesce(nullif(b.start_date,''),substring(b.date_time from 1 for 10))=v_date::text
    and v_date+coalesce(nullif(b.end_time,''),substring(coalesce(b.finish_date_time,b.date_time) from 12 for 5))::time > v_date+v_start
    and v_date+coalesce(nullif(b.start_time,''),substring(b.date_time from 12 for 5))::time < v_date+v_end
  limit 1;

  if found then
    return jsonb_build_object('ok',false,'status',409,'error','This time conflicts with another booking. Please choose a different time.');
  end if;

  -- Roster hours are informational only. Overtime is permitted; driver overlap remains enforced.
  update public.bookings set start_time=p_pickup_time,end_time=p_return_time,
    date_time=v_date::text||'T'||p_pickup_time||':00+08:00',
    finish_date_time=v_date::text||'T'||p_return_time||':00+08:00'
  where id=v_booking.id and tenant_id=p_tenant_id returning * into v_booking;

  insert into public.booking_manage_activity_logs(booking_id,tenant_id,action,changes)
  values(v_booking.id,p_tenant_id,'updated_times',jsonb_build_object(
    'before',jsonb_build_object('pickupTime',to_char(v_old_start,'HH24:MI'),'returnTime',to_char(v_old_end,'HH24:MI'),'date',v_date::text),
    'after',jsonb_build_object('pickupTime',p_pickup_time,'returnTime',p_return_time,'date',v_date::text)));

  return jsonb_build_object('ok',true,'booking',to_jsonb(v_booking));
end;
$$;

revoke all on function public.manage_booking_update_times(text,text,text,text) from public,anon,authenticated;
grant execute on function public.manage_booking_update_times(text,text,text,text) to service_role;
