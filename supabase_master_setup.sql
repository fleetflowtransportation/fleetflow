-- =========================================================================
-- FLEETFLOW MASTER SUPABASE SETUP (EXACT PRODUCTION SCHEMA)
-- =========================================================================
-- Run this in your Singapore Supabase project's SQL Editor (Dashboard > SQL Editor)
-- This creates/updates all tables with the exact columns used by FleetFlow.

-- 1. TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  google_calendar_id TEXT,
  google_drive_id TEXT,
  google_apps_script_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE tenants TO anon, authenticated, service_role;

-- 2. FLEET USERS TABLE (fleet_users)
CREATE TABLE IF NOT EXISTS fleet_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  joining_date TEXT,
  address TEXT,
  comments TEXT,
  role TEXT NOT NULL DEFAULT 'driver',
  status TEXT DEFAULT 'active',
  password TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS joining_date TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE fleet_users DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE fleet_users TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_fleet_users_tenant_id ON fleet_users(tenant_id);

-- 3. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  photo_url TEXT,
  specifications TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS specifications TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE vehicles TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);

-- 4. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  purpose TEXT,
  date_time TEXT NOT NULL,
  finish_date_time TEXT,
  pickup_point TEXT,
  address TEXT,
  passengers JSONB DEFAULT '[]'::jsonb,
  escort TEXT,
  should_wait BOOLEAN DEFAULT false,
  return_trip BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pending Approval',
  driver_id TEXT,
  vehicle_id TEXT,
  attachment_name TEXT,
  attachment_url TEXT,
  remarks TEXT,
  requester_name TEXT,
  requester_email TEXT,
  department TEXT,
  service_type TEXT,
  vehicle_preference TEXT,
  ic_number TEXT,
  recurrence_id TEXT,
  recurrence TEXT,
  start_odometer NUMERIC,
  end_odometer NUMERIC,
  distance NUMERIC,
  calendar_event_id TEXT,
  calendar_event_title TEXT,
  calendar_color TEXT,
  admin_notes TEXT,
  conflict_reason TEXT,
  is_pre_working_hour BOOLEAN DEFAULT false,
  warning_notes TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS finish_date_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_point TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passengers JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escort TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS should_wait BOOLEAN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_trip BOOLEAN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requester_email TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_preference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ic_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_odometer NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_odometer NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS distance NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_title TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_color TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS conflict_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_pre_working_hour BOOLEAN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warning_notes TEXT;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE bookings TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);

-- 5. FUEL LOGS TABLE
CREATE TABLE IF NOT EXISTS fuel_logs (
  id TEXT PRIMARY KEY,
  driver_id TEXT,
  vehicle_id TEXT,
  date TEXT NOT NULL,
  odometer NUMERIC,
  liters NUMERIC,
  cost NUMERIC,
  price_per_liter NUMERIC,
  receipt_attachment_name TEXT,
  receipt_attachment_url TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS price_per_liter NUMERIC;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_attachment_name TEXT;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_attachment_url TEXT;
ALTER TABLE fuel_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE fuel_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_fuel_logs_tenant_id ON fuel_logs(tenant_id);

-- 6. ODOMETER LOGS TABLE
CREATE TABLE IF NOT EXISTS odometer_logs (
  id TEXT PRIMARY KEY,
  driver_id TEXT,
  vehicle_id TEXT,
  date TEXT NOT NULL,
  odometer NUMERIC NOT NULL,
  purpose TEXT,
  from_location TEXT,
  to_location TEXT,
  start_odometer NUMERIC,
  distance NUMERIC,
  remarks TEXT,
  booking_id TEXT,
  booking_ids JSONB,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS from_location TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS to_location TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS start_odometer NUMERIC;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS distance NUMERIC;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS booking_id TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS booking_ids JSONB;
ALTER TABLE odometer_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE odometer_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_odometer_logs_tenant_id ON odometer_logs(tenant_id);

-- 7. DRIVER ISSUE DEFECT LOGS TABLE
CREATE TABLE IF NOT EXISTS issue_logs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  odometer NUMERIC DEFAULT 0,
  issue_title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  reported_date TEXT NOT NULL,
  reported_by_id TEXT,
  comments TEXT,
  photo_url TEXT,
  photo_name TEXT,
  priority TEXT DEFAULT 'Medium',
  is_vehicle_out_of_service BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Open',
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS is_vehicle_out_of_service BOOLEAN DEFAULT false;
ALTER TABLE issue_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE issue_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_issue_logs_tenant_id ON issue_logs(tenant_id);

-- 8. DRIVER SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS driver_schedules (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  mula TEXT,
  tamat TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS mula TEXT;
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS tamat TEXT;
ALTER TABLE driver_schedules DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE driver_schedules TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_driver_schedules_tenant_id ON driver_schedules(tenant_id);

-- 9. SELF-DRIVE STAFF DIRECTORY
CREATE TABLE IF NOT EXISTS self_drive_staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  ic_number TEXT,
  ic_attachment_name TEXT,
  license_attachment_name TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE self_drive_staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE self_drive_staff TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_self_drive_staff_tenant_id ON self_drive_staff(tenant_id);

-- 10. MAINTENANCE INTERVALS TABLE
CREATE TABLE IF NOT EXISTS maintenance_intervals (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  interval_km NUMERIC DEFAULT 0,
  interval_months NUMERIC DEFAULT 0,
  last_service_date TEXT,
  last_service_odometer NUMERIC DEFAULT 0,
  next_due_odometer NUMERIC,
  next_due_date TEXT,
  estimated_cost NUMERIC,
  notes TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE maintenance_intervals DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE maintenance_intervals TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_maintenance_intervals_tenant_id ON maintenance_intervals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_intervals_vehicle_id ON maintenance_intervals(vehicle_id);

-- 11. MAINTENANCE LOGS TABLE
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  service_date TEXT NOT NULL,
  odometer NUMERIC DEFAULT 0,
  service_type TEXT DEFAULT 'Scheduled Maintenance',
  service_items JSONB DEFAULT '[]'::jsonb,
  workshop_name TEXT NOT NULL,
  invoice_number TEXT,
  total_cost NUMERIC DEFAULT 0,
  performed_by TEXT,
  remarks TEXT,
  receipt_url TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE maintenance_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE maintenance_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_tenant_id ON maintenance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_id ON maintenance_logs(vehicle_id);
