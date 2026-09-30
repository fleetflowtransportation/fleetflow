-- =========================================================================
-- FLEETFLOW SUPABASE AUTH SYNC & CASCADE DELETE INTEGRATION
-- =========================================================================
-- This script integrates public.fleet_users with Supabase Auth (auth.users) and 
-- enforces cascade deletes. When a tenant owner deletes their organization, 
-- all associated fleet tables AND auth users are cleanly wiped.
--
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =========================================================================

-- 1. ADD CASCADING FOREIGN KEYS TO ALL FLEET TABLES ON TENANT_ID
-- This ensures deleting a tenant from 'tenants' automatically cascades and 
-- purges all rows with that 'tenant_id' in other tables.

-- Drop existing constraints if they exist to avoid conflicts, then recreate with CASCADE
DO $$
BEGIN
  -- fleet_users
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fleet_users_tenant') THEN
    ALTER TABLE public.fleet_users DROP CONSTRAINT fk_fleet_users_tenant;
  END IF;
  ALTER TABLE public.fleet_users ADD CONSTRAINT fk_fleet_users_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- vehicles
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_vehicles_tenant') THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT fk_vehicles_tenant;
  END IF;
  ALTER TABLE public.vehicles ADD CONSTRAINT fk_vehicles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- bookings
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bookings_tenant') THEN
    ALTER TABLE public.bookings DROP CONSTRAINT fk_bookings_tenant;
  END IF;
  ALTER TABLE public.bookings ADD CONSTRAINT fk_bookings_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- fuel_logs
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fuel_logs_tenant') THEN
    ALTER TABLE public.fuel_logs DROP CONSTRAINT fk_fuel_logs_tenant;
  END IF;
  ALTER TABLE public.fuel_logs ADD CONSTRAINT fk_fuel_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- odometer_logs
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_odometer_logs_tenant') THEN
    ALTER TABLE public.odometer_logs DROP CONSTRAINT fk_odometer_logs_tenant;
  END IF;
  ALTER TABLE public.odometer_logs ADD CONSTRAINT fk_odometer_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- issue_logs
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_issue_logs_tenant') THEN
    ALTER TABLE public.issue_logs DROP CONSTRAINT fk_issue_logs_tenant;
  END IF;
  ALTER TABLE public.issue_logs ADD CONSTRAINT fk_issue_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- driver_schedules
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_driver_schedules_tenant') THEN
    ALTER TABLE public.driver_schedules DROP CONSTRAINT fk_driver_schedules_tenant;
  END IF;
  ALTER TABLE public.driver_schedules ADD CONSTRAINT fk_driver_schedules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- self_drive_staff
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_self_drive_staff_tenant') THEN
    ALTER TABLE public.self_drive_staff DROP CONSTRAINT fk_self_drive_staff_tenant;
  END IF;
  ALTER TABLE public.self_drive_staff ADD CONSTRAINT fk_self_drive_staff_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- maintenance_intervals
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_intervals_tenant') THEN
    ALTER TABLE public.maintenance_intervals DROP CONSTRAINT fk_maintenance_intervals_tenant;
  END IF;
  ALTER TABLE public.maintenance_intervals ADD CONSTRAINT fk_maintenance_intervals_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- maintenance_logs
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_logs_tenant') THEN
    ALTER TABLE public.maintenance_logs DROP CONSTRAINT fk_maintenance_logs_tenant;
  END IF;
  ALTER TABLE public.maintenance_logs ADD CONSTRAINT fk_maintenance_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- vehicle_renewals
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_vehicle_renewals_tenant') THEN
    ALTER TABLE public.vehicle_renewals DROP CONSTRAINT fk_vehicle_renewals_tenant;
  END IF;
  ALTER TABLE public.vehicle_renewals ADD CONSTRAINT fk_vehicle_renewals_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
END $$;


-- 2. CREATE POSTGRES TRIGGER TO SYNC DELETE WITH SUPABASE AUTH (auth.users)
-- This function runs with SECURITY DEFINER privileges. Because it runs with 
-- superuser privileges, it is allowed to delete records directly from 
-- Supabase's protected authentication schema 'auth.users'.

CREATE OR REPLACE FUNCTION public.handle_delete_fleet_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Attempt to delete the user from Supabase Auth where ID matches (checks both text and uuid representation)
  BEGIN
    DELETE FROM auth.users WHERE id::text = OLD.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log warning or ignore if the user didn't exist in auth.users
    RAISE WARNING 'Could not delete user % from auth.users: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to 'public.fleet_users'
DROP TRIGGER IF EXISTS on_delete_fleet_user ON public.fleet_users;
CREATE TRIGGER on_delete_fleet_user
AFTER DELETE ON public.fleet_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_delete_fleet_user();


-- 3. [OPTIONAL] CLEAN UP AND EXCLUDE DEMO DATA
-- If you want to clear old/orphaned records, you can execute the commented lines below.
-- DELETE FROM public.tenants WHERE id = 'yayasan-chow-kit-demo';
-- DELETE FROM public.fleet_users WHERE tenant_id = 'yayasan-chow-kit-demo';
