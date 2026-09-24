-- =========================================================================
-- SQL MIGRATION: FLEETFLOW MAINTENANCE MODULE SETUP
-- =========================================================================
-- Run this script in your Supabase project's SQL Editor (Dashboard > SQL Editor)
-- This creates the tables for:
-- 1. 'maintenance_intervals' (Preventive service schedules & odometer intervals)
-- 2. 'maintenance_logs' (Service records, workshop invoices & expense history)
-- 3. 'self_drive_staff' (Authorized staff directory for self-drive bookings)

-- 1. TABLE: maintenance_intervals
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

-- 2. TABLE: maintenance_logs
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

-- 3. TABLE: self_drive_staff (Self-Drive Authorized Directory)
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

-- Migration completed successfully!
