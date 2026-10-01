-- =========================================================================
-- FLEETFLOW MASTER SUPABASE SETUP (UNIFIED PRODUCTION SCHEMA)
-- =========================================================================
-- Jalankan skrip ini sekali di dalam SQL Editor Supabase projek anda.
-- Skrip ini menyediakan 100% struktur pangkalan data yang bersih, neutral,
-- dan sedia untuk pelbagai tenant (Multi-tenant) tanpa sebarang data demo tiruan.
-- =========================================================================

-- 1. TENANTS TABLE (Maklumat Profil & Integrasi Organisasi)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  status TEXT DEFAULT 'active',
  registration_number TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  postcode TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  pic_name TEXT,
  pic_phone TEXT,
  description TEXT,
  operating_hours TEXT,
  timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
  logo_url TEXT,
  google_calendar_id TEXT,
  google_drive_id TEXT,
  google_apps_script_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan semua kolum profil organisasi wujud pada jadual sedia ada:
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pic_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pic_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS operating_hours TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kuala_Lumpur';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_drive_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_apps_script_url TEXT;

ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE tenants TO anon, authenticated, service_role;


-- 2. FLEET USERS TABLE (Pengguna, Pemandu & Pentadbir)
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
  is_owner BOOLEAN DEFAULT false,
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS joining_date TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE fleet_users DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE fleet_users TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_fleet_users_tenant_id ON fleet_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fleet_users_email ON fleet_users(email);


-- 3. VEHICLES TABLE (Rekod Kenderaan & Maklumat Geran/Cukai)
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  vin_chassis_number TEXT,
  engine_number TEXT,
  photo_url TEXT,
  photo_name TEXT,
  vehicle_type TEXT DEFAULT 'Van',
  brand_make TEXT,
  manufacture_year INTEGER,
  ownership_type TEXT DEFAULT 'Owned',
  vehicle_status TEXT DEFAULT 'Active',
  assigned_branch TEXT,
  assigned_driver_id TEXT,
  fuel_type TEXT DEFAULT 'Diesel',
  fuel_card_number TEXT,
  current_odometer NUMERIC DEFAULT 0,
  max_payload_capacity_kg NUMERIC,
  engine_capacity_cc INTEGER,
  road_tax_expiry TEXT,
  insurance_expiry TEXT,
  puspakom_expiry TEXT,
  permit_expiry TEXT,
  grant_attachment_url TEXT,
  grant_attachment_name TEXT,
  specifications TEXT,
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin_chassis_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Van';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS brand_make TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS manufacture_year INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'Owned';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_status TEXT DEFAULT 'Active';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_branch TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_driver_id TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'Diesel';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_card_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer NUMERIC DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS max_payload_capacity_kg NUMERIC;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_capacity_cc INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS road_tax_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS puspakom_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS permit_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS grant_attachment_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS grant_attachment_name TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS specifications TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE vehicles TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_status ON vehicles(vehicle_status);


-- 4. BOOKINGS TABLE (Tempahan & Penjadualan Perjalanan)
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
  tenant_id TEXT,
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
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE bookings TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(date_time);


-- 5. FUEL LOGS TABLE (Rekod Isian Minyak & Resit)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS price_per_liter NUMERIC;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_attachment_name TEXT;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS receipt_attachment_url TEXT;
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE fuel_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE fuel_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_fuel_logs_tenant_id ON fuel_logs(tenant_id);


-- 6. ODOMETER LOGS TABLE (Log Perjalanan & Bacaan Meter)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS from_location TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS to_location TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS start_odometer NUMERIC;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS distance NUMERIC;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS booking_id TEXT;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS booking_ids JSONB;
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE odometer_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE odometer_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_odometer_logs_tenant_id ON odometer_logs(tenant_id);


-- 7. DRIVER ISSUE DEFECT LOGS TABLE (Laporan Kerosakan Kenderaan)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS is_vehicle_out_of_service BOOLEAN DEFAULT false;
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE issue_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE issue_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_issue_logs_tenant_id ON issue_logs(tenant_id);


-- 8. DRIVER SCHEDULES TABLE (Jadual Bertugas Pemandu)
CREATE TABLE IF NOT EXISTS driver_schedules (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  mula TEXT,
  tamat TEXT,
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS mula TEXT;
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS tamat TEXT;
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE driver_schedules DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE driver_schedules TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_driver_schedules_tenant_id ON driver_schedules(tenant_id);


-- 9. SELF-DRIVE STAFF DIRECTORY (Kakitangan Pandu Sendiri)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE self_drive_staff ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE self_drive_staff DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE self_drive_staff TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_self_drive_staff_tenant_id ON self_drive_staff(tenant_id);


-- 10. MAINTENANCE INTERVALS TABLE (Tetapan Jadual Servis Berkala)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE maintenance_intervals ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE maintenance_intervals DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE maintenance_intervals TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_maintenance_intervals_tenant_id ON maintenance_intervals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_intervals_vehicle_id ON maintenance_intervals(vehicle_id);


-- 11. MAINTENANCE LOGS TABLE (Rekod Penyelenggaraan & Invois Bengkel)
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
  tenant_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE maintenance_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE maintenance_logs TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_tenant_id ON maintenance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_id ON maintenance_logs(vehicle_id);


-- 12. AUTO-CONFIRM SUPABASE AUTH USERS (Bypass Pengesahan E-mel)
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;
