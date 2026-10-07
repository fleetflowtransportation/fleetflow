# Comprehensive Database Audit & Egress Sanitization Plan

A thorough audit and sanitization pass across all Supabase database tables (`fuel_logs`, `bookings`, `issue_logs`, `vehicles`, `fleet_users`, `odometer_logs`) to verify the complete eradication of heavy Base64 payloads and confirm optimal, low-bandwidth PostgREST query operations.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmation, we are executing a full database health audit:
> 1. **Cross-Table Base64 Inspection**: Scan all record attachments and text columns in PostgreSQL to ensure no multi-megabyte image strings remain in `fuel_logs`, `issue_logs`, or user profiles.
> 2. **Verification of Google Drive URL Standardization**: Confirm that all current and newly added attachments use lightweight Google Drive direct image URLs (`https://lh3.googleusercontent.com/d/...`, $<100\text{ bytes}$).
> 3. **Egress Guard Verification**: Verify that the automated Realtime WebSockets sync and background tab suspension are operating smoothly with zero continuous polling overhead.

- **Confirmed Decision**: Full database audit and payload verification to ensure permanent PostgREST Egress protection.

---

### 1. Overview & Core Concept

- **What It Does**:
  - Validates all database records to guarantee that table payloads are compact, fast, and light.
  - Ensures each API fetch consumes minimal bandwidth (kilobytes instead of megabytes).
  - Confirms the complete transition from 15-second polling to event-driven Supabase Realtime synchronization.
- **Target Audience / Persona**: Multi-tenant fleet administrators, system owners, and mobile drivers.
- **Key Value**: Guarantees that daily PostgREST Egress remains within free-tier limits (dropping from 6.4 GB down to a few megabytes per day).

---

### 2. User Experience & Visual Design

- **Settings > Integrations Health Status**:
  - Live metric card displaying the database health indicator: `All Records Optimized (0 Base64 Strings detected)`.
  - Detailed table breakdown showing record counts and clean cloud URL references.
- **Visual Identity & Theme**:
  - FleetFlow slate aesthetic with crisp emerald health badges, unboxed metadata, and monospace tabular numerals (`tabular-nums`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Lightweight Direct URLs vs. Binary Storage in DB**
  - *Chosen Approach*: Store only direct Google Drive file IDs and web URLs in database columns.
  - *Why*: Keeps database row size under $1\text{ KB}$ per entry, preventing bandwidth inflation during table queries.
- **Decision 2: Event-Driven Realtime vs. Polling**
  - *Chosen Approach*: Supabase Realtime channels (`postgres_changes`) filtered by `tenant_id`.
  - *Why*: Delivers real-time multi-device updates with $<10\text{ KB}$ daily egress when idle.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL Database                │
├─────────────────────────────────────────────────────────────┤
│  table: fuel_logs      -> receipt_attachment_url: Drive URL │
│  table: bookings       -> clean JSON attributes             │
│  table: issue_logs     -> clean textual notes               │
│  table: vehicles       -> lightweight metadata              │
├─────────────────────────────────────────────────────────────┤
│  Average Row Size: < 500 bytes (was 2 MB - 8 MB in Base64)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Lightweight query payload
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FleetFlow Application                    │
│      - Instant load times across 3G/4G/5G mobile            │
│      - Total daily PostgREST Egress: < 50 MB / day          │
└─────────────────────────────────────────────────────────────┘
```

- **Verification Steps**:
  1. Inspect `services/storage.ts` and `services/googleDrive.ts` data parsers.
  2. Confirm database schemas and field transforms.
  3. Run `lint_applet` and `compile_applet` to ensure pristine build state.
