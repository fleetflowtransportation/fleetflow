# Vehicle Seating Capacity Integration & Public Booking Upgrade Plan

Add vehicle seating capacity tracking across fleet vehicles, update Vehicle Management forms for administrators, display seating info directly next to vehicle names in the Public Booking Form, and provide the Supabase SQL script for database column migration.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> We are implementing the following changes:
> 1. **Data Model (`Vehicle`)**: Add `seatingCapacity` (number of seats, e.g. 10, 12, 15) to the vehicle type.
> 2. **Database Mapper (`services/storage.ts`)**: Map `seating_capacity` in PostgreSQL `vehicles` table to `seatingCapacity` in TypeScript.
> 3. **Admin Vehicle Form (`VehicleForm.tsx`)**: Add a dedicated input field for Seating Capacity.
> 4. **Public Booking Form (`PublicBookingPage.tsx`)**: Display seating capacity prominently next to vehicle names in selection options so users can easily choose the right van.
> 5. **Supabase SQL Migration Script**: Provide a ready-to-run SQL snippet for Supabase SQL Editor.

- **Confirmed Decision**: Add seating capacity to vehicle info and display it right next to vehicle names in the Public Booking form selection list.

---

### 1. Supabase SQL Migration Script

Run this SQL snippet in your Supabase SQL Editor to add the seating capacity column to your `vehicles` table:

```sql
-- Add seating capacity column to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS seating_capacity INTEGER DEFAULT 10;

-- Optional: Update existing vehicles with default seating if needed
UPDATE vehicles 
SET seating_capacity = 12 
WHERE seating_capacity IS NULL;
```

---

### 2. Overview of Code Changes

- **`types.ts`**: Add `seatingCapacity?: number;` to `Vehicle`.
- **`services/storage.ts`**: Update `toDbVehicle` and `fromDbVehicle` to read/write `seating_capacity`.
- **`components/VehicleForm.tsx`**: Add "Seating Capacity" number input field.
- **`components/PublicBookingPage.tsx`**: Display seating badge/text next to vehicle names in vehicle selection controls.
