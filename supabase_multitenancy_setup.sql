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
  status TEXT DEFAULT 'active',
  google_apps_script_url TEXT,
  google_calendar_id TEXT,
  google_drive_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolum integrasi wujud jika jadual tenants sudah lama dicipta:
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_apps_script_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_drive_id TEXT;

-- Pastikan hak akses dibuka untuk client anon Supabase (PENTING untuk simpanan tetapan):
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE tenants TO anon, authenticated, service_role;

-- MASUKKAN YAYASAN CHOW KIT SEBAGAI DEFAULT TENANT
INSERT INTO tenants (id, name, status)
VALUES ('yayasan-chow-kit', 'Yayasan Chow Kit', 'active')
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
