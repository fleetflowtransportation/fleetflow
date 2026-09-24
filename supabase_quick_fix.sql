-- =========================================================================
-- FLEETFLOW SINGAPORE SUPABASE FIX & PERMISSION SCRIPT
-- =========================================================================
-- Run this in your Singapore Supabase project's SQL Editor (Dashboard > SQL Editor)
-- This fixes the passengers column format and opens read/write permissions for migration.

-- 1. FIX PASSENGERS COLUMN IN BOOKINGS (Change from integer to JSONB)
ALTER TABLE bookings DROP COLUMN IF EXISTS passengers;
ALTER TABLE bookings ADD COLUMN passengers JSONB DEFAULT '[]'::jsonb;

-- 2. DISABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE IF EXISTS tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fleet_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fuel_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS odometer_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS issue_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS driver_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS self_drive_staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_intervals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_logs DISABLE ROW LEVEL SECURITY;

-- 3. GRANT PERMISSIONS TO PUBLIC / ANON / AUTHENTICATED ROLES
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Complete! Now the backend migration script can copy all 224 bookings seamlessly.
