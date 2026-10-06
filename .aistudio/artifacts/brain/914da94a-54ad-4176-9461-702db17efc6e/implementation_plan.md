# Google Drive Receipt Integration & Supabase Egress Cleanup Plan

Complete data remediation and architecture enforcement to re-upload existing Base64 receipts to Google Drive, sanitize high-egress database rows in Supabase, and enforce mandatory Google Drive storage for all future fuel receipts.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices, we are applying the following strategy:
> 1. **Data Remediation**: Extract all heavy Base64 receipts currently stored in the Supabase `fuel_logs` table, re-upload them to the tenant's dedicated Google Drive folder via Google Apps Script Webhook, and replace the database entries with lightweight Google Drive URLs (`https://lh3.googleusercontent.com/d/...`).
> 2. **Enforce Drive Storage & Ban Base64 in Database**: Prevent fuel log submissions from falling back to multi-megabyte Base64 strings in Supabase when Google Drive is unconfigured or unreachable. The system will clearly notify the user if Google Drive needs configuration, preventing runaway Supabase bandwidth/egress spikes.

- **Confirmed Remediation Strategy**: Automated batch migration of Base64 strings to Google Drive + purging Base64 payloads from Supabase.
- **Confirmed Upload Enforcement**: Mandatory Google Drive upload verification with user feedback when Google Drive is disconnected.

---

### 1. Overview & Core Concept

- **What It Does**: 
  - Resolves the root cause of high Supabase egress by migrating existing embedded Base64 image data out of the PostgreSQL database and into Google Drive.
  - Upgrades the fuel log submission pipeline so every attached receipt is formatted systematically (`DD-MM-YYYY_PLATENUMBER.ext`) and saved directly to Google Drive under `Fuel Logs/{PlateNumber}/`.
  - Provides a one-click **"Clean & Sync Receipts to Drive"** tool in **Settings > Integrations** with live progress tracking and bandwidth savings metrics.
- **Target Audience / Persona**: Fleet managers and drivers who record fuel transactions and need reliable, low-bandwidth receipt storage.
- **Key Value**: Drastically reduces Supabase egress bandwidth consumption, ensures all receipts are centralized in company Google Drive folders, and prevents database bloat.

---

### 2. User Experience & Visual Design

- **Fuel Log Form & Modal UX**:
  - When attaching a receipt, the upload status clearly indicates Google Drive upload progression.
  - If Google Drive is not connected or Apps Script is unreachable, the form presents an informative notice with direct guidance to configure or test the Google Drive integration in Settings.
- **Settings > Integrations Cleanup & Sync Card**:
  - A dedicated **"Database Egress & Receipt Storage Optimization"** card in the Integrations tab.
  - Displays the count of legacy Base64 receipts detected in the database.
  - An interactive button **"Migrate Base64 Receipts to Google Drive"** that processes items sequentially with a real-time progress bar.
  - Displays instant summary stats (e.g. `24 receipts migrated`, `~48 MB Supabase egress saved`).
- **Visual Identity & Theme**:
  - Consistent with FleetFlow dark/light slate palette (`#0F172A`, `#1E293B`, `#3B82F6`).
  - Clear state indicators: emerald for verified Google Drive connection, amber for pending sync, and rose for upload alerts.
  - Data numbers and counts formatted with `font-mono tabular-nums`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Google Drive Webhook vs. Heavy Base64 Fallback**
  - *Chosen Approach*: Enforce direct Google Drive file creation via the Apps Script Webhook / Drive API and remove Base64 storage in database fields.
  - *Why*: Storing multi-megabyte Base64 strings in relational database columns downloads huge payloads on every table fetch, quickly consuming free-tier Supabase egress.
  - *Alternatives Considered*: Storing Base64 in local browser storage was rejected because receipts must remain visible across all team devices.
- **Decision 2: Automated Migration Script & On-Demand UI Trigger**
  - *Chosen Approach*: Provide both an automated background remediation pass on app initialization (for admin) and a manual trigger in Settings.
  - *Why*: Allows immediate remediation of active records while giving administrators full visibility into storage health.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      FleetFlow Client                       │
├──────────────────────────────┬──────────────────────────────┤
│  Fuel Log Form & Modal       │  Settings > Integrations     │
│  (Receipt File Picker)       │  (Egress Optimization Card)  │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               │ Direct File / Migrated Base64│
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│        Google Apps Script Webhook / Google Drive API        │
│         - Creates / Retrieves folder: Fuel Logs/{Plate}     │
│         - Decodes blob & saves file with public view link   │
│         - Returns direct URL (https://lh3.googleusercontent)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Lightweight URL (< 100 bytes)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL Database                │
│    table: fuel_logs                                         │
│    - receipt_attachment_url: Lightweight Google Drive URL   │
│    - Zero heavy Base64 strings -> Minimal Egress Bandwidth  │
└─────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `fuel_logs.receipt_attachment_url`: Guaranteed to contain clean web URLs (Google Drive `lh3` or `drive.google.com` links).
  - Sanitization logic checks for `data:image/` or raw Base64 strings $\ge 1000$ characters and initiates migration.
- **Verification Plan**:
  - Execute migration utility against Supabase `fuel_logs` records.
  - Validate new fuel log submissions with receipt upload to verify Google Drive file creation and lightweight URL persistence.
  - Run `compile_applet` and test all views to ensure zero regressions.
