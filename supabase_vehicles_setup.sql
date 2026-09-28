-- =========================================================================
-- FLEETFLOW VEHICLES TABLE SCHEMA (EXACT PRODUCTION SPECIFICATION)
-- =========================================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates or updates the 'vehicles' table with all required columns
-- so all vehicle details can be viewed, synced, and edited across all devices.

-- 1. CREATE VEHICLES TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                                       -- Vehicle Name / Model (e.g. 'Toyota Hiace 2.5 Turbo Diesel')
  plate_number TEXT NOT NULL,                               -- Registration Plate (e.g. 'WXY 1234')
  vin_chassis_number TEXT,                                  -- VIN / Chassis Number
  engine_number TEXT,                                       -- Engine Serial Number
  photo_url TEXT,                                           -- Google Drive / Cloud URL to vehicle photo
  photo_name TEXT,                                          -- Vehicle photo original filename
  vehicle_type TEXT DEFAULT 'Van',                          -- Enum: 'Sedan' | 'SUV' | 'MPV' | 'Van' | 'Lorry 1-Ton' | 'Lorry 3-Ton' | 'Prime Mover' | 'Motorcycle' | 'Pickup Truck'
  brand_make TEXT,                                          -- Brand / Manufacturer (e.g. 'Toyota', 'Perodua', 'Isuzu')
  manufacture_year INTEGER,                                 -- Year of Manufacture (e.g. 2022)
  ownership_type TEXT DEFAULT 'Owned',                      -- Enum: 'Owned' | 'Leased' | 'Rented'
  vehicle_status TEXT DEFAULT 'Active',                     -- Enum: 'Active' | 'Under Maintenance' | 'Inactive' | 'Sold'
  assigned_branch TEXT,                                     -- Branch / Depot (e.g. 'HQ Kuala Lumpur', 'Central Depot')
  assigned_driver_id TEXT,                                  -- Default Driver User ID (Foreign Key -> fleet_users.id)
  fuel_type TEXT DEFAULT 'Diesel',                          -- Enum: 'Diesel' | 'Petrol' | 'EV' | 'Hybrid'
  fuel_card_number TEXT,                                    -- Fleet Card Number (e.g. Petronas SmartPay / Shell Card)
  current_odometer NUMERIC DEFAULT 0,                       -- Current Mileage reading in KM
  max_payload_capacity_kg NUMERIC,                          -- Maximum payload load capacity (KG)
  engine_capacity_cc INTEGER,                               -- Engine Displacement (CC)
  road_tax_expiry TEXT,                                     -- Road Tax Expiry Date (YYYY-MM-DD)
  insurance_expiry TEXT,                                    -- Insurance Policy Expiry Date (YYYY-MM-DD)
  puspakom_expiry TEXT,                                     -- PUSPAKOM Inspection Expiry Date (YYYY-MM-DD)
  permit_expiry TEXT,                                       -- APAD / Commercial Permit Expiry Date (YYYY-MM-DD)
  grant_attachment_url TEXT,                                -- Vehicle Grant / VOC document URL (Google Drive)
  grant_attachment_name TEXT,                               -- Vehicle Grant / VOC document file name
  specifications TEXT,                                      -- Additional specifications or notes
  tenant_id TEXT DEFAULT 'yayasan-chow-kit',                -- Organization / Multi-tenancy ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. SAFE COLUMN ADDITIONS (Guarantees existing tables upgrade without dropping data)
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
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'yayasan-chow-kit';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. INDEXES FOR HIGH-SPEED FILTERING & MULTI-DEVICE ACCESS
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_status ON vehicles(vehicle_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_road_tax_expiry ON vehicles(road_tax_expiry);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry);

-- 4. ROW LEVEL SECURITY & PERMISSIONS
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE vehicles TO anon, authenticated, service_role;

-- 5. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION update_vehicles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vehicles_timestamp ON vehicles;
CREATE TRIGGER trigger_vehicles_timestamp
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicles_timestamp();

-- 6. DATA MIGRATION: BACKFILL FROM EXISTING SPECIFICATIONS JSON (IF ANY EXIST)
DO $$
BEGIN
  UPDATE vehicles
  SET
    vin_chassis_number = COALESCE(vin_chassis_number, NULLIF(specifications::jsonb->>'vinChassisNumber', '')),
    engine_number = COALESCE(engine_number, NULLIF(specifications::jsonb->>'engineNumber', '')),
    photo_name = COALESCE(photo_name, NULLIF(specifications::jsonb->>'photoName', '')),
    vehicle_type = COALESCE(vehicle_type, NULLIF(specifications::jsonb->>'vehicleType', ''), 'Van'),
    brand_make = COALESCE(brand_make, NULLIF(specifications::jsonb->>'brandMake', '')),
    manufacture_year = COALESCE(manufacture_year, NULLIF(specifications::jsonb->>'manufactureYear', '')::INTEGER),
    ownership_type = COALESCE(ownership_type, NULLIF(specifications::jsonb->>'ownershipType', ''), 'Owned'),
    vehicle_status = COALESCE(vehicle_status, NULLIF(specifications::jsonb->>'vehicleStatus', ''), 'Active'),
    assigned_branch = COALESCE(assigned_branch, NULLIF(specifications::jsonb->>'assignedBranch', '')),
    assigned_driver_id = COALESCE(assigned_driver_id, NULLIF(specifications::jsonb->>'assignedDriverId', '')),
    fuel_type = COALESCE(fuel_type, NULLIF(specifications::jsonb->>'fuelType', ''), 'Diesel'),
    fuel_card_number = COALESCE(fuel_card_number, NULLIF(specifications::jsonb->>'fuelCardNumber', '')),
    current_odometer = COALESCE(current_odometer, NULLIF(specifications::jsonb->>'currentOdometer', '')::NUMERIC, 0),
    max_payload_capacity_kg = COALESCE(max_payload_capacity_kg, NULLIF(specifications::jsonb->>'maxPayloadCapacityKg', '')::NUMERIC),
    engine_capacity_cc = COALESCE(engine_capacity_cc, NULLIF(specifications::jsonb->>'engineCapacityCc', '')::INTEGER),
    road_tax_expiry = COALESCE(road_tax_expiry, NULLIF(specifications::jsonb->>'roadTaxExpiry', '')),
    insurance_expiry = COALESCE(insurance_expiry, NULLIF(specifications::jsonb->>'insuranceExpiry', '')),
    puspakom_expiry = COALESCE(puspakom_expiry, NULLIF(specifications::jsonb->>'puspakomExpiry', '')),
    permit_expiry = COALESCE(permit_expiry, NULLIF(specifications::jsonb->>'permitExpiry', '')),
    grant_attachment_url = COALESCE(grant_attachment_url, NULLIF(specifications::jsonb->>'grantAttachmentUrl', '')),
    grant_attachment_name = COALESCE(grant_attachment_name, NULLIF(specifications::jsonb->>'grantAttachmentName', ''))
  WHERE specifications LIKE '{%}'
    AND (brand_make IS NULL OR road_tax_expiry IS NULL OR vehicle_type IS NULL);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Auto backfill skipped (no legacy JSON data found or invalid format): %', SQLERRM;
END $$;
