-- =========================================================================
-- SQL MIGRATION: FLEETFLOW VEHICLE COMPLIANCE RENEWALS MODULE SETUP
-- =========================================================================
-- Run this script in your Supabase project's SQL Editor (Dashboard > SQL Editor)
-- This creates the table:
-- 'vehicle_renewals' (Audit log & historical costs of Road Tax, Insurance, PUSPAKOM, and Permit renewals)

CREATE TABLE IF NOT EXISTS vehicle_renewals (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  compliance_type TEXT NOT NULL, -- 'Insurance' | 'Road Tax' | 'PUSPAKOM' | 'Permit'
  old_expiry_date DATE,
  new_expiry_date DATE NOT NULL,
  renewal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  provider_agent_name TEXT,
  receipt_policy_document_url TEXT,
  receipt_policy_document_name TEXT,
  remarks TEXT,
  created_by TEXT,
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security: disabled for seamless multitenancy & service access
ALTER TABLE vehicle_renewals DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE vehicle_renewals TO anon, authenticated, service_role;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_renewals_tenant_id ON vehicle_renewals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_renewals_vehicle_id ON vehicle_renewals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_renewals_compliance_type ON vehicle_renewals(compliance_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_renewals_renewal_date ON vehicle_renewals(renewal_date);

-- Trigger to auto-update 'updated_at' column
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_renewals_updated_at ON vehicle_renewals;
CREATE TRIGGER trg_vehicle_renewals_updated_at
BEFORE UPDATE ON vehicle_renewals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_column();

-- Migration completed successfully!
