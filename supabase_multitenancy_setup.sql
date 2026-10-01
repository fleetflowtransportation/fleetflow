-- =========================================================================
-- SQL MIGRATION: FLEETFLOW MULTITENANCY SETUP
-- =========================================================================
-- Sila jalankan skrip ini di dalam SQL Editor Supabase anda.
-- Skrip ini akan:
-- 1. Mencipta jadual 'tenants' untuk menyimpan maklumat organisasi penyewa.
-- 2. Mendaftarkan 'Yayasan Chow Kit' sebagai penyewa pertama (percuma).
-- 3. Menambah kolum 'tenant_id' ke semua jadual sedia ada secara selamat.
-- 4. Memigrasikan semua data sedia ada kepada penyewa 'Yayasan Chow Kit'.
-- 5. Menambah index untuk carian pantas mengikut tenant.

-- 1. CIPTA JADUAL TENANTS
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

-- Pastikan semua kolum profil organisasi wujud pada jadual tenants sedia ada:
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
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_apps_script_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_drive_id TEXT;

-- Buang keperluan pengesahan e-mel (Confirm email bypass):
UPDATE auth.users 
SET email_confirmed_at = now(), confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- Pastikan hak akses dibuka untuk client anon Supabase (PENTING untuk simpanan tetapan):
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE tenants TO anon, authenticated, service_role;

-- MASUKKAN YAYASAN CHOW KIT SEBAGAI DEFAULT TENANT
INSERT INTO tenants (id, name, company_name, status)
VALUES ('yayasan-chow-kit', 'Yayasan Chow Kit', 'Yayasan Chow Kit', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. TAMBAH KOLUM & INDEX BAGI TABLE: fleet_users
ALTER TABLE fleet_users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE fleet_users SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_users_tenant_id ON fleet_users(tenant_id);

-- Table: vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE vehicles SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);

-- Table: bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE bookings SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);

-- Table: fuel_logs
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE fuel_logs SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fuel_logs_tenant_id ON fuel_logs(tenant_id);

-- Table: odometer_logs
ALTER TABLE odometer_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE odometer_logs SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_odometer_logs_tenant_id ON odometer_logs(tenant_id);

-- Table: issue_logs
ALTER TABLE issue_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE issue_logs SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_issue_logs_tenant_id ON issue_logs(tenant_id);

-- Table: driver_schedules
ALTER TABLE driver_schedules ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
UPDATE driver_schedules SET tenant_id = 'yayasan-chow-kit' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_driver_schedules_tenant_id ON driver_schedules(tenant_id);

-- Selesai! Aplikasi anda kini sedia untuk multitenancy tanpa sebarang kehilangan data sedia ada.
