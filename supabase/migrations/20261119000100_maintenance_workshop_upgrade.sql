-- FleetFlow maintenance itemization, workshop directory, and next-service schedule
CREATE TABLE IF NOT EXISTS workshops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  email TEXT,
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_workshops_tenant ON workshops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workshops_name_tenant ON workshops(tenant_id, name);

ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS workshop_id TEXT;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS delivered_by_user_id TEXT;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS service_item_details JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS next_service_date TEXT;
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS next_service_odometer NUMERIC;

ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE workshops TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_workshop_tenant ON maintenance_logs(workshop_id, tenant_id);
