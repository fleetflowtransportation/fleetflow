# Implementation Plan: Driver Lifecycle, Reactivation Audit Logs & Supabase Schema

Implement a complete, audit-safe driver lifecycle tracking system that supports Part-Time / Full-Time classification, Active/Inactive toggling, Termination Dates & Reasons, Reactivation Dates & Reasons, a full persistent status history audit log, a dedicated restricted access screen for inactive drivers, and a ready-to-run Supabase SQL migration script.

---

## 1. Data Model & Types (`types.ts`)

### New Type: `UserStatusLog`
Tracks each state transition with timestamp and audit attribution:
```ts
export interface UserStatusLog {
  id: string;
  action: 'created' | 'deactivated' | 'reactivated' | 'updated';
  timestamp: string;      // ISO String
  performedBy: string;    // Name or Email of the Admin who performed the action
  effectiveDate?: string; // Date of termination or reactivation
  reason?: string;        // Notes/reason provided by Admin
  previousStatus?: 'active' | 'inactive';
  newStatus: 'active' | 'inactive';
}
```

### Updates to `User` Interface:
```ts
export interface User {
  // Existing properties...
  employmentType?: 'full_time' | 'part_time'; // Default: 'full_time'
  terminationDate?: string;                   // ISO date string
  terminationReason?: string;                 // Reason for deactivation/termination
  reactivationDate?: string;                  // ISO date string of latest reactivation
  reactivationReason?: string;                // Reason for reactivation
  statusHistory?: UserStatusLog[];            // Chronological audit log of all transitions
}
```

---

## 2. Supabase SQL Migration Script (`fleet_users`)

Run this SQL snippet in the Supabase Dashboard (`SQL Editor` -> `New Query` -> `Run`):

```sql
-- Migration: Add Employment Type, Lifecycle Dates, and Audit Log to fleet_users
ALTER TABLE fleet_users
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time',
ADD COLUMN IF NOT EXISTS termination_date DATE,
ADD COLUMN IF NOT EXISTS termination_reason TEXT,
ADD COLUMN IF NOT EXISTS reactivation_date DATE,
ADD COLUMN IF NOT EXISTS reactivation_reason TEXT,
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Optional Index for fast filtering by employment status & tenant
CREATE INDEX IF NOT EXISTS idx_fleet_users_status 
ON fleet_users(tenant_id, status, employment_type);
```

### Storage Layer Compatibility (`services/storage.ts`):
- Update `toDbUser` and `fromDbUser` to serialize and deserialize `employment_type`, `termination_date`, `termination_reason`, `reactivation_date`, `reactivation_reason`, and `status_history`.
- Add backward-compatibility fallback in `updateUser`/`createUser`: if new columns do not exist yet on an un-migrated Supabase table, gracefully catch column errors so existing user operations continue uninterrupted.

---

## 3. Dedicated Inactive Driver Restricted Screen

### Create `components/InactiveAccountScreen.tsx`:
When an inactive driver opens the portal:
- **Restriction Banner**: `Account Suspended / Access Restricted` with a lock shield icon and clear status alert.
- **Account Summary Card**:
  - Driver Name & Photo/Avatar
  - Employment Classification (`Part-Time` or `Full-Time`)
  - Status: `Inactive`
- **Timeline & Notes**:
  - If `terminationDate`: Displays **Contract / Service End Date: [Date]**.
  - If `terminationReason`: Displays **Status Notice: [Reason]**.
  - If reactivated in the past: Shows previous active periods.
- **Direct Resolution Action**:
  - Prominent **"Contact Admin to Reactivate"** button linking directly to WhatsApp and Phone call.
  - Display admin/dispatch contact details (organization phone & email).
  - Clean **"Sign Out / Switch Account"** button so other users or dispatchers on the device can switch accounts easily.

---

## 4. Admin User Management & Audit History Modal

### Updates in `components/UserForm.tsx`:
- Add **Employment Type** selector (`Full-Time Driver` vs `Part-Time / Temporary Driver`).
- When changing status from `active` to `inactive`:
  - Show **Termination / End Date** picker.
  - Show **Deactivation / Termination Reason** input.
- When changing status from `inactive` to `active` (Reactivating):
  - Show **Reactivation Date** picker (defaults to today).
  - Show **Reactivation Reason** input (e.g. "Rehired for peak season relief").
- On Save, append a new `UserStatusLog` record to `formData.statusHistory`.

### Updates in `components/UserManagement.tsx`:
- Add badges in the driver table:
  - Employment: `Part-Time` (Purple pill) vs `Full-Time` (Blue pill).
  - Status: `Active` (Emerald) vs `Inactive` (Slate/Rose).
- Add filter: Filter by Employment Type (`All`, `Full-Time`, `Part-Time`).
- Add **"View Lifecycle History"** modal button:
  - Admin can inspect the full chronological audit trail of when the driver was created, deactivated (with termination date & notes), and reactivated (with reactivation date & notes), along with which admin made each change.

---

## 5. App Routing Enforcement (`App.tsx`)

- In `renderContent()`, check if `currentUser.role === 'driver'` and user status is `'inactive'`:
  - Render `<InactiveAccountScreen user={driverRecord} />` instead of `<DriverDashboard />`.
  - Suppress the floating speed-dial button when inactive.

---

## 6. Verification & Testing

1. **New Part-Time Driver**: Add a new driver tagged as "Part-Time" and verify active state.
2. **Deactivate Driver**: Set status to Inactive, fill in Termination Date (`2026-10-31`) and note, save and verify audit log entry.
3. **Reactivate Driver**: Switch status back to Active, fill in Reactivation Date (`2026-11-01`) and reason, save and verify second audit log entry.
4. **Audit History Modal**: Open the driver's history modal in User Management and verify all timeline entries with timestamps and admin attribution.
5. **Inactive Driver UI**: Switch to an inactive driver account and verify that the restricted screen appears with correct dates and admin contact links.
6. **Lint & Build**: Run `npm run lint` and `compile_applet` to confirm zero TypeScript compilation errors.
