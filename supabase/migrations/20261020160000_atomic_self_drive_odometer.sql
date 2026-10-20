create or replace function public.complete_self_drive_odometer(
  p_tenant_id text,
  p_vehicle_id text,
  p_booking_ids text[],
  p_start_odometer numeric,
  p_end_odometer numeric,
  p_log jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_vehicle public.vehicles%rowtype;
  v_expected_count integer;
  v_updated_count integer;
  v_booking_ids text[] := coalesce(p_booking_ids, array[]::text[]);
  v_log_id text := p_log ->> 'id';
begin
  if nullif(trim(p_tenant_id), '') is null or nullif(trim(p_vehicle_id), '') is null then
    raise exception 'Tenant and vehicle are required';
  end if;

  if p_start_odometer is null or p_start_odometer <= 0
     or p_end_odometer is null or p_end_odometer < p_start_odometer then
    raise exception 'Invalid odometer readings';
  end if;

  if v_log_id is null or nullif(trim(v_log_id), '') is null then
    raise exception 'Odometer log ID is required';
  end if;

  if cardinality(v_booking_ids) <> (select count(distinct x) from unnest(v_booking_ids) as x) then
    raise exception 'Duplicate booking IDs are not allowed';
  end if;

  -- A repeated request with the same log ID is treated as an idempotent retry.
  if exists (
    select 1 from public.odometer_logs
    where id = v_log_id and tenant_id = p_tenant_id
      and vehicle_id = p_vehicle_id
  ) then
    return jsonb_build_object('success', true, 'already_processed', true);
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found or v_vehicle.tenant_id is distinct from p_tenant_id then
    raise exception 'Vehicle not found for this tenant';
  end if;

  if coalesce(v_vehicle.vehicle_status, 'Active') <> 'Active' then
    raise exception 'Vehicle is not active';
  end if;

  if coalesce((v_vehicle.specifications::jsonb ->> 'allowSelfDrive')::boolean, false) is not true then
    raise exception 'Vehicle is not enabled for Self-Drive';
  end if;

  if cardinality(v_booking_ids) > 0 then
    perform 1
    from public.bookings b
    where b.id = any(v_booking_ids)
    order by b.id
    for update;

    select count(*) into v_expected_count
    from public.bookings b
    where b.id = any(v_booking_ids)
      and b.tenant_id = p_tenant_id
      and b.vehicle_id = p_vehicle_id
      and b.service_type = 'Self-Drive'
      and b.status not in ('Cancelled', 'Completed', 'Conflict');

    if v_expected_count <> cardinality(v_booking_ids) then
      raise exception 'One or more selected bookings are not eligible for this vehicle or tenant';
    end if;
  end if;

  insert into public.odometer_logs (
    id, driver_id, vehicle_id, date, odometer, purpose, from_location,
    to_location, start_odometer, distance, remarks, booking_id, booking_ids,
    staff_name, tenant_id
  ) values (
    v_log_id,
    p_log ->> 'driver_id',
    p_vehicle_id,
    coalesce(p_log ->> 'date', current_date::text),
    p_end_odometer,
    p_log ->> 'purpose',
    p_log ->> 'from_location',
    p_log ->> 'to_location',
    p_start_odometer,
    p_end_odometer - p_start_odometer,
    p_log ->> 'remarks',
    case when cardinality(v_booking_ids) > 0 then v_booking_ids[1] else null end,
    to_jsonb(v_booking_ids),
    p_log ->> 'staff_name',
    p_tenant_id
  );

  if cardinality(v_booking_ids) > 0 then
    update public.bookings
    set status = 'Completed'
    where id = any(v_booking_ids)
      and tenant_id = p_tenant_id
      and vehicle_id = p_vehicle_id
      and service_type = 'Self-Drive'
      and status not in ('Cancelled', 'Completed', 'Conflict');

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> cardinality(v_booking_ids) then
      raise exception 'Not all selected bookings could be completed';
    end if;
  end if;

  update public.vehicles
  set current_odometer = p_end_odometer,
      updated_at = now()
  where id = p_vehicle_id and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Vehicle odometer could not be updated';
  end if;

  return jsonb_build_object(
    'success', true,
    'already_processed', false,
    'completed_bookings', cardinality(v_booking_ids),
    'odometer_log_id', v_log_id
  );
end;
$function$;

revoke all on function public.complete_self_drive_odometer(text, text, text[], numeric, numeric, jsonb) from public;
grant execute on function public.complete_self_drive_odometer(text, text, text[], numeric, numeric, jsonb) to anon, authenticated;
